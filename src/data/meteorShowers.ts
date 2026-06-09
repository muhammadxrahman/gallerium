// Major annual meteor showers, embedded (no fetch). A shower's timing is tied to where
// Earth sits in its orbit, so it's expressed as a SOLAR LONGITUDE (λ☉, degrees) rather
// than a calendar date — that's what makes the peak accurate to within hours every year,
// independent of leap years. The radiant is the J2000 point meteors appear to stream from
// (essentially fixed for a shower); ZHR is the ideal-sky zenithal hourly rate at maximum.
// Constants follow the IMO working list.

export interface MeteorShower {
  name: string;
  peakLon: number; // λ☉ at maximum (deg)
  startLon: number; // λ☉ at the start of the visible window (deg)
  endLon: number; // λ☉ at the end of the window (deg)
  radiantRA: number; // J2000 right ascension (deg)
  radiantDec: number; // J2000 declination (deg)
  zhr: number; // peak zenithal hourly rate (ideal dark sky)
  parent: string; // parent comet/asteroid
}

export const METEOR_SHOWERS: MeteorShower[] = [
  { name: "Quadrantids", peakLon: 283.16, startLon: 281.5, endLon: 284.5, radiantRA: 230.0, radiantDec: 49.0, zhr: 110, parent: "(196256) 2003 EH1" },
  { name: "Lyrids", peakLon: 32.32, startLon: 27, endLon: 36, radiantRA: 271.0, radiantDec: 34.0, zhr: 18, parent: "C/1861 G1 Thatcher" },
  { name: "Eta Aquariids", peakLon: 45.5, startLon: 35, endLon: 58, radiantRA: 338.0, radiantDec: -1.0, zhr: 50, parent: "1P/Halley" },
  { name: "Southern Delta Aquariids", peakLon: 125.0, startLon: 120, endLon: 140, radiantRA: 340.0, radiantDec: -16.0, zhr: 25, parent: "96P/Machholz" },
  { name: "Perseids", peakLon: 140.0, startLon: 120, endLon: 150, radiantRA: 48.2, radiantDec: 58.0, zhr: 100, parent: "109P/Swift-Tuttle" },
  { name: "Orionids", peakLon: 208.0, startLon: 198, endLon: 220, radiantRA: 95.2, radiantDec: 16.0, zhr: 20, parent: "1P/Halley" },
  { name: "Southern Taurids", peakLon: 220.0, startLon: 196, endLon: 235, radiantRA: 52.0, radiantDec: 13.0, zhr: 5, parent: "2P/Encke" },
  { name: "Leonids", peakLon: 235.27, startLon: 230, endLon: 240, radiantRA: 152.0, radiantDec: 22.0, zhr: 15, parent: "55P/Tempel-Tuttle" },
  { name: "Geminids", peakLon: 262.2, startLon: 255, endLon: 267, radiantRA: 112.0, radiantDec: 33.0, zhr: 150, parent: "(3200) Phaethon" },
  { name: "Ursids", peakLon: 270.7, startLon: 268, endLon: 274, radiantRA: 217.0, radiantDec: 76.0, zhr: 10, parent: "8P/Tuttle" },
];
