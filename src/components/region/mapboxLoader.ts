/**
 * Loads Mapbox GL JS on demand, from Mapbox's own CDN.
 *
 * WHY NOT AN NPM DEPENDENCY. Members are frequently mobile-first on metered or
 * unreliable connections, and mapbox-gl is well over a megabyte. Bundling it
 * would put that weight in the region page's chunk for everyone, including the
 * readers who never scroll to the map and the ones whose network cannot carry
 * it. Loaded here, it is fetched only when the explore section actually mounts,
 * and a failure is a handled state rather than a broken page: `onTilesFail`
 * swaps in the schematic SVG map, which needs no tiles and no library.
 *
 * It also comes from the host the map is useless without. If api.mapbox.com is
 * unreachable the tiles were never going to arrive either, so this adds no
 * failure mode the map did not already have. The same pattern is already in the
 * design system: `Icon` pulls Lucide glyphs from a CDN at render time.
 *
 * The token is `VITE_MAPBOX_TOKEN`, a public Mapbox access token, compiled into
 * the bundle the way a `pk.` token is meant to be. It is not committed: the
 * design export carried one inline and that is exactly what `.env.example`
 * exists to stop. With no token configured the loader reports failure and the
 * page renders the fallback map, which is a correct state and not an error.
 */

const GL_VERSION = "3.6.0";
const SCRIPT_SRC = `https://api.mapbox.com/mapbox-gl-js/v${GL_VERSION}/mapbox-gl.js`;
const STYLE_HREF = `https://api.mapbox.com/mapbox-gl-js/v${GL_VERSION}/mapbox-gl.css`;

/**
 * The slice of the Mapbox GL surface this page uses. Hand-written because the
 * library is not an npm dependency here, so `@types/mapbox-gl` is not either.
 * Narrow on purpose: anything added to it is a new thing to keep true.
 */
export interface MapboxFeature {
  properties: Record<string, unknown>;
}

export interface MapMouseEvent {
  features?: MapboxFeature[];
}

export interface MapboxMap {
  addControl(control: unknown, position?: string): void;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>, before?: string): void;
  getSource(id: string): unknown;
  setFeatureState(target: { source: string; id: string }, state: Record<string, boolean>): void;
  getCanvas(): HTMLCanvasElement;
  on(type: string, layerOrListener: string | ((e: unknown) => void), listener?: (e: unknown) => void): void;
  panTo(center: [number, number], options?: { duration?: number }): void;
  resize(): void;
  remove(): void;
}

export interface MapboxMarker {
  setLngLat(coords: [number, number]): MapboxMarker;
  addTo(map: MapboxMap): MapboxMarker;
  remove(): void;
}

export interface MapboxGl {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options: { element: HTMLElement; anchor?: string; offset?: [number, number] }) => MapboxMarker;
  NavigationControl: new (options: { showCompass?: boolean }) => unknown;
}

declare global {
  interface Window {
    mapboxgl?: MapboxGl;
  }
}

export function mapboxToken(): string {
  return (import.meta.env["VITE_MAPBOX_TOKEN"] as string | undefined) ?? "";
}

let pending: Promise<MapboxGl> | null = null;

/** Resolves with the library, or rejects. Loads at most once per document. */
export function loadMapboxGl(): Promise<MapboxGl> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mapbox GL is browser-only"));
  }
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (pending) return pending;

  pending = new Promise<MapboxGl>((resolve, reject) => {
    if (!document.querySelector(`link[href="${STYLE_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_HREF;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const settle = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("Mapbox GL loaded but did not register"));
    };
    script.addEventListener("load", settle);
    script.addEventListener("error", () => reject(new Error("Mapbox GL failed to load")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  // A failed load must not poison every later attempt.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
