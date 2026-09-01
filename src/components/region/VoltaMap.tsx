import { useEffect, useRef, useState } from "react";

import { VOLTA_POIS } from "@/lib/region/voltaDistrictMarks";

import {
  loadMapboxGl,
  mapboxToken,
  type MapboxGl,
  type MapboxMap,
  type MapboxMarker,
  type MapMouseEvent,
} from "./mapboxLoader";

/**
 * The Volta district map: real boundaries, a custom style built from Region 17
 * tokens, and two-way hover/click binding with the district list beside it.
 *
 * EVERY DISTRICT IDENTIFIER HERE IS `places.slug`. The GeoJSON's feature ids,
 * `selectedId`, `hoverId` and `dimIds` all carry the same string, so a
 * `setFeatureState` call and a list row address the same district without
 * anything in between. The design export's short ids (`ho`, `keta`, `agotime`,
 * `afadzato`) are retired, not wrapped: there is no translation table in this
 * file and there must not be one. See
 * `docs/volta-district-id-reconciliation.md`.
 *
 * Three accessibility fixes came in with the design's `volta-map-2.js` and are
 * kept deliberately. Do not remove them while tidying:
 *   - POI labels reveal on keyboard focus, not only on hover (`:focus-visible`,
 *     and the markers are focusable).
 *   - A tap toggles a POI label open, so a touch device with no hover state can
 *     still read one.
 *   - `prefers-reduced-motion` suppresses the label fade and the pan animation.
 */

export interface VoltaMapDistrict {
  /** `places.slug`. */
  id: string;
  name: string;
  capital: string;
  lon: number;
  lat: number;
}

export interface VoltaMapProps {
  districts: VoltaMapDistrict[];
  selectedId: string | null;
  hoverId: string | null;
  /** Slugs to fade back, when a zone filter is on. */
  dimIds: string[];
  onHover: (slug: string | null) => void;
  onOpen: (slug: string) => void;
  /** Called when the map cannot be shown at all, so the page can fall back. */
  onTilesFail: () => void;
}

const GEOJSON_URL = "/geo/volta-districts.geojson";

/** Reads a design token off the document, with a literal fallback for SSR-empty values. */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function mix(a: string, b: string, t: number): string {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A Mapbox style built from the design system's tokens rather than a Mapbox preset. */
function regionStyle(): Record<string, unknown> {
  const paper = token("--paper-050", "#FBFAF7");
  const paper100 = token("--paper-100", "#F5F3EE");
  const paper300 = token("--paper-300", "#DCD7CC");
  const navy700 = token("--navy-700", "#10233F");
  const navy400 = token("--navy-400", "#4A648A");
  const navy300 = token("--navy-300", "#8598B2");
  const water = mix(navy300, "#7FA3C4", 0.55);
  const font = ["DIN Pro Regular", "Arial Unicode MS Regular"];

  return {
    version: 8,
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: {
      composite: {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": paper } },
      {
        id: "landcover",
        type: "fill",
        source: "composite",
        "source-layer": "landcover",
        paint: { "fill-color": paper100, "fill-opacity": 0.5, "fill-antialias": false },
      },
      {
        id: "hillshade-shadow",
        type: "fill",
        source: "composite",
        "source-layer": "hillshade",
        filter: ["==", ["get", "class"], "shadow"],
        paint: { "fill-color": navy700, "fill-opacity": 0.045, "fill-antialias": false },
      },
      {
        id: "hillshade-light",
        type: "fill",
        source: "composite",
        "source-layer": "hillshade",
        filter: ["==", ["get", "class"], "highlight"],
        paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.1, "fill-antialias": false },
      },
      {
        id: "waterway",
        type: "line",
        source: "composite",
        "source-layer": "waterway",
        paint: {
          "line-color": water,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 12, 2],
        },
      },
      {
        id: "water",
        type: "fill",
        source: "composite",
        "source-layer": "water",
        paint: { "fill-color": water },
      },
      {
        id: "roads",
        type: "line",
        source: "composite",
        "source-layer": "road",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], true, false],
        paint: {
          "line-color": paper300,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 2.2],
        },
      },
      {
        id: "admin-0",
        type: "line",
        source: "composite",
        "source-layer": "admin",
        filter: ["all", ["==", ["get", "admin_level"], 0], ["==", ["get", "maritime"], "false"]],
        paint: { "line-color": navy700, "line-width": 1.6, "line-dasharray": [3, 1.6] },
      },
      {
        id: "admin-1",
        type: "line",
        source: "composite",
        "source-layer": "admin",
        filter: ["all", ["==", ["get", "admin_level"], 1], ["==", ["get", "maritime"], "false"]],
        paint: {
          "line-color": token("--region-volta", navy700),
          "line-width": 1.1,
          "line-opacity": 0.65,
        },
      },
      {
        id: "water-label",
        type: "symbol",
        source: "composite",
        "source-layer": "natural_label",
        filter: ["match", ["get", "class"], ["water", "sea", "ocean", "reservoir"], true, false],
        layout: {
          "text-field": ["get", "name_en"],
          "text-font": font,
          "text-size": 13,
          "text-letter-spacing": 0.08,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": mix(navy400, water, 0.35),
          "text-halo-color": paper,
          "text-halo-width": 1,
        },
      },
    ],
  };
}

const POI_CSS =
  ".r17poi:hover .r17poi-label,.r17poi:focus-visible .r17poi-label,.r17poi.r17poi-open .r17poi-label{opacity:1 !important}" +
  ".r17poi:focus-visible{outline:2px solid var(--gold-600);outline-offset:3px}" +
  "@media(prefers-reduced-motion:reduce){.r17poi-label{transition:none !important}}";

interface DistrictGeoJson {
  features: { id: string }[];
}

export function VoltaMap(props: VoltaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Record<string, MapboxMarker>>({});
  const geoRef = useRef<DistrictGeoJson | null>(null);
  const applyStatesRef = useRef<(() => void) | null>(null);

  // Callbacks live in a ref so the map is built once and never torn down by a
  // parent re-render handing down new function identities.
  const cb = useRef(props);
  cb.current = props;

  // Mapbox GL is fetched on demand, so the map does not exist on the first
  // render the way it did in the design export, where the library was already
  // on the page. Without this the pin and feature-state effects below run once,
  // find no map, and never run again: no pins, no hover highlight, no selection.
  // Bumping it when the map is built and again when the boundaries land makes
  // those effects re-run against a map that is actually there.
  const [mapEpoch, setMapEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | null = null;
    let styleEl: HTMLStyleElement | null = null;
    let observer: ResizeObserver | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const fail = () => {
      if (!cancelled) cb.current.onTilesFail();
    };

    const accessToken = mapboxToken();
    if (!accessToken) {
      // No token configured. The schematic map is the correct state, not an error.
      fail();
      return;
    }

    void loadMapboxGl()
      .then((mapboxgl: MapboxGl) => {
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = accessToken;

        try {
          map = new mapboxgl.Map({
            container: containerRef.current,
            style: regionStyle(),
            bounds: [
              [0.1, 5.7],
              [1.24, 7.3],
            ],
            fitBoundsOptions: { padding: 24 },
            scrollZoom: false,
            attributionControl: true,
            trackResize: false,
          });
        } catch {
          fail();
          return;
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        // The container is inside a grid that settles after mount; keep asking
        // for a real box before telling the map its size.
        const ensureSized = (tries: number) => {
          if (cancelled || !map) return;
          const box = containerRef.current?.getBoundingClientRect();
          if ((box && box.width > 10 && box.height > 10) || tries > 90) {
            map.resize();
            return;
          }
          requestAnimationFrame(() => ensureSized(tries + 1));
        };
        ensureSized(0);

        let loaded = false;
        map.on("load", () => {
          loaded = true;
          ensureSized(0);
          const current = map;
          if (!current) return;

          void fetch(GEOJSON_URL)
            .then((r) => {
              if (!r.ok) throw new Error(`${GEOJSON_URL} responded ${r.status}`);
              return r.json() as Promise<DistrictGeoJson>;
            })
            .then((geo) => {
              if (cancelled || !mapRef.current) return;
              // `promoteId: "id"` makes each feature's `id` property the feature
              // state key. That property is the district's `places.slug`.
              current.addSource("volta-districts", {
                type: "geojson",
                data: geo,
                promoteId: "id",
              });

              const region = token("--region-volta", token("--navy-700", "#10233F"));
              const gold = token("--gold-600", "#B8901F");

              current.addLayer(
                {
                  id: "district-fill",
                  type: "fill",
                  source: "volta-districts",
                  paint: {
                    "fill-color": [
                      "case",
                      ["boolean", ["feature-state", "selected"], false],
                      gold,
                      ["boolean", ["feature-state", "hover"], false],
                      gold,
                      region,
                    ],
                    "fill-opacity": [
                      "case",
                      ["boolean", ["feature-state", "dim"], false],
                      0.04,
                      ["boolean", ["feature-state", "selected"], false],
                      0.26,
                      ["boolean", ["feature-state", "hover"], false],
                      0.18,
                      0.08,
                    ],
                  },
                },
                "admin-1",
              );

              current.addLayer(
                {
                  id: "district-line",
                  type: "line",
                  source: "volta-districts",
                  paint: {
                    "line-color": [
                      "case",
                      ["boolean", ["feature-state", "selected"], false],
                      gold,
                      ["boolean", ["feature-state", "hover"], false],
                      gold,
                      region,
                    ],
                    "line-opacity": [
                      "case",
                      ["boolean", ["feature-state", "dim"], false],
                      0.25,
                      0.75,
                    ],
                    "line-width": [
                      "case",
                      [
                        "any",
                        ["boolean", ["feature-state", "selected"], false],
                        ["boolean", ["feature-state", "hover"], false],
                      ],
                      1.8,
                      0.8,
                    ],
                  },
                },
                "admin-1",
              );

              geoRef.current = geo;

              const slugOf = (e: unknown): string | null => {
                const feature = (e as MapMouseEvent).features?.[0];
                const id = feature?.properties["id"];
                return typeof id === "string" ? id : null;
              };

              current.on("mousemove", "district-fill", (e: unknown) => {
                const slug = slugOf(e);
                if (!slug) return;
                current.getCanvas().style.cursor = "pointer";
                cb.current.onHover(slug);
              });
              current.on("mouseleave", "district-fill", () => {
                current.getCanvas().style.cursor = "";
                cb.current.onHover(null);
              });
              current.on("click", "district-fill", (e: unknown) => {
                const slug = slugOf(e);
                if (slug) cb.current.onOpen(slug);
              });

              setMapEpoch((n) => n + 1);
              applyStatesRef.current?.();
            })
            .catch(() => {
              // Boundaries missing: the base map still reads, so this is not a
              // whole-map failure. The list beside it remains the way in.
            });
        });

        map.on("error", (e: unknown) => {
          if (loaded) return;
          const err = (e as { error?: { message?: string; status?: number } }).error;
          const text = String(err?.message ?? err?.status ?? "");
          if (/401|403|Unauthorized|access token/i.test(text)) fail();
        });

        styleEl = document.createElement("style");
        styleEl.textContent = POI_CSS;
        document.head.appendChild(styleEl);

        const gold500 = token("--gold-500", "#D4AF37");
        const strong = token("--text-strong", "#14161A");
        const halo = token("--paper-050", "#FBFAF7");

        VOLTA_POIS.forEach((poi) => {
          const el = document.createElement("div");
          el.className = "r17poi";
          // Focusable, so the label reveals on keyboard too.
          el.tabIndex = 0;
          el.setAttribute("role", "button");
          el.setAttribute("aria-label", poi.name);
          el.style.cssText =
            "display:flex;align-items:center;gap:6px;cursor:default;" +
            (poi.side === "left" ? "flex-direction:row-reverse;" : "");
          el.innerHTML =
            `<span style="display:block;width:9px;height:9px;background:${gold500};transform:rotate(45deg);box-shadow:0 0 0 1.5px #fff;flex:none"></span>` +
            `<span class="r17poi-label" style="opacity:0;transition:opacity 120ms;font-family:var(--font-sans);font-size:12.5px;font-weight:600;color:${strong};text-shadow:0 0 3px ${halo},0 0 6px ${halo}"></span>`;
          const label = el.querySelector<HTMLElement>(".r17poi-label");
          if (label) label.textContent = poi.name;

          // Tap toggles the label open, for touch devices with no hover state.
          const toggle = () => el.classList.toggle("r17poi-open");
          el.addEventListener("click", toggle);
          el.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggle();
            }
          });

          if (map) {
            new mapboxgl.Marker({
              element: el,
              anchor: poi.side === "left" ? "right" : "left",
              offset: [poi.side === "left" ? 6 : -6, 0],
            })
              .setLngLat([poi.lng, poi.lat])
              .addTo(map);
          }
        });

        mapRef.current = map;
        setMapEpoch((n) => n + 1);

        if (containerRef.current) {
          observer = new ResizeObserver(() =>
            requestAnimationFrame(() => mapRef.current?.resize()),
          );
          observer.observe(containerRef.current);
        }
        timers.push(setTimeout(() => map?.resize(), 300));
        timers.push(setTimeout(() => map?.resize(), 1000));
      })
      .catch(fail);

    return () => {
      cancelled = true;
      observer?.disconnect();
      timers.forEach(clearTimeout);
      styleEl?.remove();
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
      map?.remove();
      mapRef.current = null;
      setMapEpoch(0);
      geoRef.current = null;
      applyStatesRef.current = null;
    };
  }, []);

  // Feature state: selected, hovered, dimmed. Keyed by slug throughout.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyStatesRef.current = () => {
      const geo = geoRef.current;
      if (!geo || !map.getSource("volta-districts")) return;
      geo.features.forEach((feature) => {
        map.setFeatureState(
          { source: "volta-districts", id: feature.id },
          {
            selected: feature.id === props.selectedId,
            hover: feature.id === props.hoverId,
            dim: props.dimIds.includes(feature.id),
          },
        );
      });
    };
    applyStatesRef.current();
  }, [props.selectedId, props.hoverId, props.dimIds, mapEpoch]);

  // District pins. Rebuilt when the set or its highlight state changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const paper = token("--paper-000", "#FFFFFF");
    const region = token("--region-volta", token("--navy-700", "#10233F"));
    const gold = token("--gold-600", "#B8901F");
    const halo = token("--paper-050", "#FBFAF7");
    const ink = token("--ink-700", "#3A3F47");

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const mapboxgl = window.mapboxgl;
    if (!mapboxgl) return;

    props.districts.forEach((d) => {
      const active = d.id === props.selectedId || d.id === props.hoverId;
      const dim = props.dimIds.includes(d.id);
      const el = document.createElement("button");
      el.type = "button";
      el.title = `${d.name} · ${d.capital}`;
      el.setAttribute("aria-label", `${d.name}, ${d.capital}`);
      el.style.cssText =
        "display:flex;align-items:center;gap:6px;border:none;background:none;padding:0;cursor:pointer;opacity:" +
        (dim ? "0.28" : "1") +
        ";";
      const size = active ? 18 : 13;
      el.innerHTML =
        `<span style="flex:none;width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid ${paper};background:${active ? gold : region};box-shadow:0 1px 3px rgba(9,19,35,0.35);transition:width 140ms,height 140ms"></span>` +
        (active
          ? `<span class="r17-pin-label" style="font-family:var(--font-sans);font-size:11.5px;font-weight:600;color:${ink};text-shadow:0 0 3px ${halo},0 0 5px ${halo},0 0 8px ${halo}"></span>`
          : "");
      const label = el.querySelector<HTMLElement>(".r17-pin-label");
      if (label) label.textContent = d.capital;

      el.addEventListener("mouseenter", () => cb.current.onHover(d.id));
      el.addEventListener("mouseleave", () => cb.current.onHover(null));
      el.addEventListener("focus", () => cb.current.onHover(d.id));
      el.addEventListener("blur", () => cb.current.onHover(null));
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        cb.current.onOpen(d.id);
      });

      markersRef.current[d.id] = new mapboxgl.Marker({
        element: el,
        anchor: "left",
        offset: [-7, 0],
      })
        .setLngLat([d.lon, d.lat])
        .addTo(map);
    });
  }, [props.districts, props.selectedId, props.hoverId, props.dimIds, mapEpoch]);

  // Pan to the open district. Instant under prefers-reduced-motion.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.selectedId) return;
    const d = props.districts.find((x) => x.id === props.selectedId);
    if (d) map.panTo([d.lon, d.lat], { duration: reducedMotion() ? 0 : 500 });
    // Panning follows the selection only; a re-render of the district array is
    // not a reason to move the viewport under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "420px",
        background: "var(--paper-100)",
      }}
    />
  );
}
