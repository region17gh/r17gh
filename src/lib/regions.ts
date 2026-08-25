import {
  REGIONS,
  type Region,
} from "@/design-system/region-17-ghana-design-system-e3e62f/design-system/region17/data/regions";

/**
 * Ghana's sixteen regions, in alphabetical order.
 *
 * The design system holds them in its own canonical order, which runs by colour
 * band and reads as arbitrary to anyone who is not looking at the map. A member
 * scanning the list is looking for one name, so every surface that shows the
 * regions to a member reads down them alphabetically instead.
 *
 * Sorted here rather than in the design system on purpose. Those files are
 * replaced in place as design work continues, so a reordering made there would
 * not survive the next replacement; the order a member sees is ours to hold.
 */
export const REGIONS_ALPHABETICAL: readonly Region[] = [...REGIONS].sort((a, b) =>
  a.name.localeCompare(b.name, "en"),
);
