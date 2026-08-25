/* Ghana's 16 regions — canonical order, capital, slug and accent token.
   Slug matches the public URL: r17gh.com/regions/<slug>. */

export interface Region {
  slug: string;
  name: string;
  capital: string;
  /** CSS custom property holding the region accent colour. */
  token: string;
  zone: "Coast" | "Forest" | "Corridor" | "Transition" | "Savanna";
  lonlat: [number, number];
}

export const REGIONS: Region[] = [
  { slug: "greater-accra", name: "Greater Accra", capital: "Accra", token: "--region-greater-accra", zone: "Coast", lonlat: [-0.19, 5.6] },
  { slug: "ashanti", name: "Ashanti", capital: "Kumasi", token: "--region-ashanti", zone: "Forest", lonlat: [-1.62, 6.69] },
  { slug: "western", name: "Western", capital: "Sekondi-Takoradi", token: "--region-western", zone: "Forest", lonlat: [-1.76, 4.93] },
  { slug: "western-north", name: "Western North", capital: "Sefwi Wiawso", token: "--region-western-north", zone: "Forest", lonlat: [-2.48, 6.2] },
  { slug: "central", name: "Central", capital: "Cape Coast", token: "--region-central", zone: "Coast", lonlat: [-1.25, 5.11] },
  { slug: "eastern", name: "Eastern", capital: "Koforidua", token: "--region-eastern", zone: "Forest", lonlat: [-0.26, 6.09] },
  { slug: "volta", name: "Volta", capital: "Ho", token: "--region-volta", zone: "Corridor", lonlat: [0.47, 6.61] },
  { slug: "oti", name: "Oti", capital: "Dambai", token: "--region-oti", zone: "Corridor", lonlat: [0.18, 8.07] },
  { slug: "bono", name: "Bono", capital: "Sunyani", token: "--region-bono", zone: "Forest", lonlat: [-2.33, 7.34] },
  { slug: "bono-east", name: "Bono East", capital: "Techiman", token: "--region-bono-east", zone: "Transition", lonlat: [-1.94, 7.59] },
  { slug: "ahafo", name: "Ahafo", capital: "Goaso", token: "--region-ahafo", zone: "Forest", lonlat: [-2.52, 6.8] },
  { slug: "northern", name: "Northern", capital: "Tamale", token: "--region-northern", zone: "Savanna", lonlat: [-0.84, 9.4] },
  { slug: "savannah", name: "Savannah", capital: "Damongo", token: "--region-savannah", zone: "Savanna", lonlat: [-1.82, 9.08] },
  { slug: "north-east", name: "North East", capital: "Nalerigu", token: "--region-north-east", zone: "Savanna", lonlat: [-0.36, 10.52] },
  { slug: "upper-east", name: "Upper East", capital: "Bolgatanga", token: "--region-upper-east", zone: "Savanna", lonlat: [-0.85, 10.79] },
  { slug: "upper-west", name: "Upper West", capital: "Wa", token: "--region-upper-west", zone: "Savanna", lonlat: [-2.5, 10.06] },
];

/** CSS colour value for a region slug, falling back to the brand navy. */
export function regionColor(slug: string): string {
  const region = REGIONS.find((r) => r.slug === slug);
  return region ? `var(${region.token})` : "var(--navy-700)";
}
