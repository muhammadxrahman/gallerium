export interface Location {
  latitude: number;
  longitude: number;
}

export function requestLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function cachedLocation(): Location | null {
  const raw = localStorage.getItem("observer-location");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Location;
  } catch {
    return null;
  }
}

export function saveLocation(loc: Location): void {
  localStorage.setItem("observer-location", JSON.stringify(loc));
}