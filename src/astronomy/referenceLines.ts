// Static celestial reference geometry as RA/Dec paths, ready to flow through the
// normal coordinate pipeline (equatorialToHorizontal → projection). Pure math, no
// body positioning — just fixed great circles and the galactic band.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

const OBLIQUITY = 23.4393; // mean obliquity of the ecliptic (deg)

// The ecliptic (the Sun/Moon/planets' highway) as an equatorial polyline.
export function eclipticPath(stepDeg = 2): Array<[number, number]> {
  const eps = OBLIQUITY * D2R;
  const path: Array<[number, number]> = [];
  for (let lon = 0; lon <= 360; lon += stepDeg) {
    const l = lon * D2R;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(l), Math.cos(l));
    const dec = Math.asin(Math.sin(eps) * Math.sin(l));
    path.push([normDeg(ra * R2D), dec * R2D]);
  }
  return path;
}

// Galactic → equatorial (J2000). North galactic pole + longitude of the NCP.
const A_NGP = 192.8595 * D2R;
const D_NGP = 27.1283 * D2R;
const L_NCP = 122.9320 * D2R;

function galacticToEquatorial(lDeg: number, bDeg: number): [number, number] {
  const l = lDeg * D2R;
  const b = bDeg * D2R;
  const sinDec = Math.sin(D_NGP) * Math.sin(b) + Math.cos(D_NGP) * Math.cos(b) * Math.cos(L_NCP - l);
  const dec = Math.asin(sinDec);
  const y = Math.cos(b) * Math.sin(L_NCP - l);
  const x = Math.cos(D_NGP) * Math.sin(b) - Math.sin(D_NGP) * Math.cos(b) * Math.cos(L_NCP - l);
  const ra = A_NGP + Math.atan2(y, x);
  return [normDeg(ra * R2D), dec * R2D];
}

export interface MilkyWaySample {
  ra: number;
  dec: number;
  w: number; // 0..1 brightness weight (brighter toward the galactic plane & center)
}

// A soft band of weighted samples along the galactic plane, brighter toward the
// galactic center (Sagittarius, l≈0) and fading toward the anticenter.
export function milkyWayBand(): MilkyWaySample[] {
  const samples: MilkyWaySample[] = [];
  for (let l = 0; l < 360; l += 6) {
    // brighter toward the galactic center (l≈0), dimmer toward the anticenter (l≈180)
    const centerFactor = 0.4 + 0.6 * ((1 + Math.cos(l * D2R)) / 2);
    for (let b = -12; b <= 12; b += 6) {
      const vertical = Math.exp(-((b / 8) ** 2)); // concentrate near the plane
      const [ra, dec] = galacticToEquatorial(l, b);
      samples.push({ ra, dec, w: centerFactor * vertical });
    }
  }
  return samples;
}
