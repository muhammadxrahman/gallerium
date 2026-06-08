// Curated deep-sky catalog (Messier + selected Caldwell), embedded rather than fetched:
// it is small, static, and never changes, so it ships with the app and works offline
// with zero network. Positions are J2000 equatorial in degrees; they flow through the
// same precession + horizontal pipeline as stars (far-field objects).

export type DeepSkyKind =
  | "galaxy"
  | "open-cluster"
  | "globular-cluster"
  | "nebula"
  | "planetary-nebula"
  | "supernova-remnant";

export interface DeepSkyObject {
  id: string; // catalog designation, e.g. "M31", "C80"
  name: string; // common name (or the designation if it has none)
  ra: number; // J2000 right ascension, degrees
  dec: number; // J2000 declination, degrees
  magnitude: number; // integrated visual magnitude
  kind: DeepSkyKind;
}

// Human-readable label for a kind (info card, search sublabel).
export const DEEP_SKY_KIND_LABEL: Record<DeepSkyKind, string> = {
  galaxy: "Galaxy",
  "open-cluster": "Open cluster",
  "globular-cluster": "Globular cluster",
  nebula: "Nebula",
  "planetary-nebula": "Planetary nebula",
  "supernova-remnant": "Supernova remnant",
};

// J2000 positions converted from standard catalog RA (h m) / Dec (° ′). Magnitudes are
// integrated visual. Limited to prominent objects so the layer stays legible.
export const DEEP_SKY: DeepSkyObject[] = [
  // Galaxies
  { id: "M31", name: "Andromeda Galaxy", ra: 10.68, dec: 41.27, magnitude: 3.4, kind: "galaxy" },
  { id: "M32", name: "M32", ra: 10.67, dec: 40.87, magnitude: 8.1, kind: "galaxy" },
  { id: "M33", name: "Triangulum Galaxy", ra: 23.46, dec: 30.66, magnitude: 5.7, kind: "galaxy" },
  { id: "M51", name: "Whirlpool Galaxy", ra: 202.47, dec: 47.2, magnitude: 8.4, kind: "galaxy" },
  { id: "M63", name: "Sunflower Galaxy", ra: 198.96, dec: 42.03, magnitude: 8.6, kind: "galaxy" },
  { id: "M64", name: "Black Eye Galaxy", ra: 194.18, dec: 21.68, magnitude: 8.5, kind: "galaxy" },
  { id: "M65", name: "M65", ra: 169.73, dec: 13.09, magnitude: 9.3, kind: "galaxy" },
  { id: "M66", name: "M66", ra: 170.06, dec: 12.99, magnitude: 8.9, kind: "galaxy" },
  { id: "M81", name: "Bode's Galaxy", ra: 148.89, dec: 69.07, magnitude: 6.9, kind: "galaxy" },
  { id: "M82", name: "Cigar Galaxy", ra: 148.97, dec: 69.68, magnitude: 8.4, kind: "galaxy" },
  { id: "M87", name: "Virgo A", ra: 187.71, dec: 12.39, magnitude: 8.6, kind: "galaxy" },
  { id: "M101", name: "Pinwheel Galaxy", ra: 210.8, dec: 54.35, magnitude: 7.9, kind: "galaxy" },
  { id: "M104", name: "Sombrero Galaxy", ra: 190.0, dec: -11.62, magnitude: 8.0, kind: "galaxy" },
  { id: "C77", name: "Centaurus A", ra: 201.36, dec: -43.02, magnitude: 6.8, kind: "galaxy" },

  // Globular clusters
  { id: "M3", name: "M3", ra: 205.55, dec: 28.38, magnitude: 6.2, kind: "globular-cluster" },
  { id: "M4", name: "M4", ra: 245.9, dec: -26.53, magnitude: 5.6, kind: "globular-cluster" },
  { id: "M5", name: "M5", ra: 229.64, dec: 2.08, magnitude: 5.6, kind: "globular-cluster" },
  { id: "M13", name: "Hercules Cluster", ra: 250.42, dec: 36.46, magnitude: 5.8, kind: "globular-cluster" },
  { id: "M15", name: "M15", ra: 322.49, dec: 12.17, magnitude: 6.2, kind: "globular-cluster" },
  { id: "M22", name: "M22", ra: 279.1, dec: -23.9, magnitude: 5.1, kind: "globular-cluster" },
  { id: "C80", name: "Omega Centauri", ra: 201.69, dec: -47.48, magnitude: 3.7, kind: "globular-cluster" },

  // Open clusters
  { id: "M6", name: "Butterfly Cluster", ra: 265.07, dec: -32.22, magnitude: 4.2, kind: "open-cluster" },
  { id: "M7", name: "Ptolemy Cluster", ra: 268.47, dec: -34.82, magnitude: 3.3, kind: "open-cluster" },
  { id: "M11", name: "Wild Duck Cluster", ra: 282.77, dec: -6.27, magnitude: 6.3, kind: "open-cluster" },
  { id: "M35", name: "M35", ra: 92.23, dec: 24.33, magnitude: 5.3, kind: "open-cluster" },
  { id: "M36", name: "M36", ra: 84.05, dec: 34.13, magnitude: 6.3, kind: "open-cluster" },
  { id: "M37", name: "M37", ra: 88.07, dec: 32.55, magnitude: 6.2, kind: "open-cluster" },
  { id: "M38", name: "M38", ra: 82.18, dec: 35.85, magnitude: 7.4, kind: "open-cluster" },
  { id: "M44", name: "Beehive Cluster", ra: 130.1, dec: 19.98, magnitude: 3.7, kind: "open-cluster" },
  { id: "M45", name: "Pleiades", ra: 56.75, dec: 24.12, magnitude: 1.6, kind: "open-cluster" },
  { id: "M46", name: "M46", ra: 115.45, dec: -14.82, magnitude: 6.0, kind: "open-cluster" },
  { id: "M93", name: "M93", ra: 116.15, dec: -23.87, magnitude: 6.2, kind: "open-cluster" },
  { id: "C14", name: "Double Cluster", ra: 35.0, dec: 57.13, magnitude: 4.3, kind: "open-cluster" },
  { id: "C41", name: "Hyades", ra: 66.75, dec: 15.87, magnitude: 0.5, kind: "open-cluster" },

  // Diffuse nebulae
  { id: "M8", name: "Lagoon Nebula", ra: 270.95, dec: -24.38, magnitude: 6.0, kind: "nebula" },
  { id: "M16", name: "Eagle Nebula", ra: 274.7, dec: -13.78, magnitude: 6.0, kind: "nebula" },
  { id: "M17", name: "Omega Nebula", ra: 275.2, dec: -16.17, magnitude: 6.0, kind: "nebula" },
  { id: "M20", name: "Trifid Nebula", ra: 270.65, dec: -23.03, magnitude: 6.3, kind: "nebula" },
  { id: "M42", name: "Orion Nebula", ra: 83.82, dec: -5.39, magnitude: 4.0, kind: "nebula" },
  { id: "C49", name: "Rosette Nebula", ra: 98.0, dec: 5.05, magnitude: 5.5, kind: "nebula" },

  // Planetary nebulae
  { id: "M27", name: "Dumbbell Nebula", ra: 299.9, dec: 22.72, magnitude: 7.5, kind: "planetary-nebula" },
  { id: "M57", name: "Ring Nebula", ra: 283.4, dec: 33.03, magnitude: 8.8, kind: "planetary-nebula" },
  { id: "M76", name: "Little Dumbbell", ra: 25.58, dec: 51.57, magnitude: 10.1, kind: "planetary-nebula" },
  { id: "M97", name: "Owl Nebula", ra: 168.7, dec: 55.02, magnitude: 9.9, kind: "planetary-nebula" },

  // Supernova remnant
  { id: "M1", name: "Crab Nebula", ra: 83.63, dec: 22.02, magnitude: 8.4, kind: "supernova-remnant" },
];
