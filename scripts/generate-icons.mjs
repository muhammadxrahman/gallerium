// Rasterizes public/icon.svg into the PNG icon set the manifest + iOS need, using the
// system Chrome in headless mode (no extra npm dependency). One source SVG; each output
// is an HTML wrapper that controls the background and the art scale:
//   - "any" icons:   transparent background, art at 100% (keeps the rounded square)
//   - apple-touch:   opaque background, art at 100% (iOS rounds the corners itself, and
//                    SVG apple-touch-icons are ignored — it needs a PNG)
//   - maskable:      opaque full-bleed background, art at 80% inside the safe zone so
//                    Android's circular mask never clips it
//
// Run with: npm run icons   (macOS, requires Google Chrome). Outputs are committed.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const PUBLIC = join(root, "public");
const SVG = join(PUBLIC, "icon.svg");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BG = "#000008";

// [output, size, background, art-scale]
const JOBS = [
  ["icon-192.png", 192, "transparent", 1],
  ["icon-512.png", 512, "transparent", 1],
  ["icon-maskable-512.png", 512, BG, 0.8],
  ["apple-touch-icon-180.png", 180, BG, 1],
];

const work = mkdtempSync(join(tmpdir(), "gallerium-icons-"));

// Headless Chrome enforces a minimum window width, so a small --window-size captures a
// crop of a larger render instead of scaling. We always render the master at 512 (above
// that floor) with the background + safe-zone scale baked in, then downscale with sips.
const MASTER = 512;

function wrapper(background, scale) {
  const inset = ((1 - scale) / 2) * 100;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${MASTER}px;height:${MASTER}px;background:${background};}
    img{position:absolute;left:${inset}%;top:${inset}%;width:${scale * 100}%;height:${scale * 100}%;}
  </style></head><body><img src="file://${SVG}"></body></html>`;
}

try {
  for (const [out, size, background, scale] of JOBS) {
    const html = join(work, `${out}.html`);
    const master = join(work, `${out}.master.png`);
    writeFileSync(html, wrapper(background, scale));
    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--default-background-color=00000000",
        `--window-size=${MASTER},${MASTER}`,
        `--screenshot=${master}`,
        `file://${html}`,
      ],
      { stdio: "ignore" }
    );
    const dest = join(PUBLIC, out);
    if (size === MASTER) {
      execFileSync("cp", [master, dest]);
    } else {
      // sips downscales the 512 master, preserving alpha for the transparent icons.
      execFileSync("sips", ["-z", String(size), String(size), master, "--out", dest], {
        stdio: "ignore",
      });
    }
    console.log(`✓ ${out} (${size}×${size})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
