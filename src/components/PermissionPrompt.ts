import { requestOrientationPermission, startOrientationTracking } from "./Orientation";

export function showPermissionPrompt(onGranted: () => void): void {
  // If not iOS, just start directly
  if (
    typeof DeviceOrientationEvent === "undefined" ||
    // @ts-ignore
    typeof DeviceOrientationEvent.requestPermission !== "function"
  ) {
    startOrientationTracking();
    onGranted();
    return;
  }

  // iOS: show a tap-to-enable button
  const btn = document.createElement("button");
  btn.textContent = "Enable Sky Tracking";
  btn.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 24px;
    color: white;
    font-size: 14px;
    padding: 12px 24px;
    cursor: pointer;
    z-index: 200;
    backdrop-filter: blur(8px);
  `;

  document.body.appendChild(btn);

  btn.addEventListener("click", async () => {
    const granted = await requestOrientationPermission();
    btn.remove();
    if (granted) {
      startOrientationTracking();
      onGranted();
    }
  });
}