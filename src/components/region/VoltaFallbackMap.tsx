import type { VoltaMapDistrict } from "./VoltaMap";

/**
 * The schematic map, shown when Mapbox cannot be reached or no token is
 * configured. No tiles, no library, no network: a member on a bad connection
 * still gets a map they can hover, tap and open districts from.
 *
 * Districts are keyed by `places.slug`, the same as the tile map and the list.
 */

const P = (lon: number, lat: number): [number, number] => [
  ((lon + 0.45) / 1.75) * 1000,
  ((7.35 - lat) / 1.7) * 680,
];

const path = (points: [number, number][], close: boolean) =>
  points
    .map((p, i) => (i ? "L" : "M") + P(p[0], p[1]).map((v) => v.toFixed(1)).join(" "))
    .join(" ") + (close ? " Z" : "");

const LAKE = path(
  [
    [0.12, 7.35], [0.05, 7.2], [0.1, 7.05], [0.02, 6.95], [0.08, 6.8], [0.0, 6.68],
    [0.06, 6.55], [0.02, 6.42], [0.12, 6.3], [0.18, 6.18], [0.25, 6.05], [0.35, 5.95],
    [0.45, 5.85], [0.55, 5.78], [0.5, 5.72], [0.3, 5.8], [0.12, 5.92], [0.02, 6.08],
    [-0.05, 6.3], [-0.15, 6.5], [-0.1, 6.7], [-0.2, 6.9], [-0.12, 7.1], [-0.18, 7.35],
  ],
  true,
);
const SEA = path(
  [[0.55, 5.78], [0.75, 5.82], [0.95, 5.88], [1.1, 6.0], [1.3, 6.04], [1.3, 5.65], [0.55, 5.65]],
  true,
);
const BORDER_POINTS: [number, number][] = [
  [1.19, 6.09], [1.05, 6.35], [0.95, 6.58], [0.83, 6.78], [0.7, 6.95], [0.63, 7.12], [0.58, 7.35],
];
const TOGO = path([...BORDER_POINTS, [1.3, 7.35], [1.3, 6.04], [1.19, 6.09]], true);
const BORDER = path(BORDER_POINTS, false);

const POIS: { label: string; lon: number; lat: number; anchor: "start" | "end" }[] = [
  { label: "Wli Falls", lon: 0.58, lat: 7.12, anchor: "start" },
  { label: "Mount Afadja", lon: 0.6, lat: 7.02, anchor: "start" },
  { label: "Aflao crossing", lon: 1.17, lat: 6.16, anchor: "end" },
  { label: "Fort Prinzenstein", lon: 1.03, lat: 5.87, anchor: "start" },
];

const WATER_FILL = "color-mix(in oklab, var(--region-volta) 14%, var(--paper-000))";
const WATER_EDGE = "color-mix(in oklab, var(--region-volta) 30%, var(--paper-000))";

export function VoltaFallbackMap({
  districts,
  anchors,
  selectedId,
  hoverId,
  dimIds,
  onHover,
  onOpen,
  lakeLabel,
}: {
  districts: VoltaMapDistrict[];
  /** Which side each district's label hangs on, by slug. */
  anchors: Record<string, "start" | "end">;
  selectedId: string | null;
  hoverId: string | null;
  dimIds: string[];
  onHover: (slug: string | null) => void;
  onOpen: (slug: string) => void;
  lakeLabel: string;
}) {
  const [lakeX, lakeY] = P(-0.06, 6.86);

  return (
    <svg
      viewBox="0 0 1000 680"
      role="group"
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: "var(--paper-000)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <path d={LAKE} fill={WATER_FILL} stroke={WATER_EDGE} strokeWidth="1" />
      <path d={SEA} fill={WATER_FILL} stroke={WATER_EDGE} strokeWidth="1" />
      <path d={TOGO} fill="var(--surface-sunken)" />
      <path d={BORDER} fill="none" stroke="var(--navy-700)" strokeWidth="1.6" />
      <text
        x={lakeX.toFixed(1)}
        y={lakeY.toFixed(1)}
        fill="var(--navy-400)"
        fontSize="17"
        fontStyle="italic"
        fontFamily="var(--font-display)"
      >
        {lakeLabel}
      </text>

      {POIS.map((poi) => {
        const [x, y] = P(poi.lon, poi.lat);
        return (
          <g key={poi.label}>
            <rect
              x="-4.2"
              y="-4.2"
              width="8.4"
              height="8.4"
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(45)`}
              fill="var(--gold-500)"
            />
            <text
              x={(x + (poi.anchor === "end" ? -12 : 12)).toFixed(1)}
              y={(y + 4.5).toFixed(1)}
              textAnchor={poi.anchor}
              fill="var(--text-strong)"
              fontSize="14"
              fontWeight="600"
              fontFamily="var(--font-sans)"
            >
              {poi.label}
            </text>
          </g>
        );
      })}

      {districts.map((d) => {
        const [x, y] = P(d.lon, d.lat);
        const hot = hoverId === d.id || selectedId === d.id;
        const anchor = anchors[d.id] ?? "start";
        return (
          <g
            key={d.id}
            tabIndex={0}
            role="button"
            aria-label={`${d.name}, ${d.capital}`}
            opacity={dimIds.includes(d.id) ? 0.2 : 1}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(d.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(d.id)}
            onBlur={() => onHover(null)}
            onClick={() => onOpen(d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(d.id);
              }
            }}
          >
            {/* A 28px hit area, so the tap target clears the floor even though
                the visible dot is 13px. */}
            <circle cx={x} cy={y} r="14" fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={hot ? 9 : 6.5}
              fill={hot ? "var(--region-volta)" : "var(--navy-700)"}
              stroke="var(--paper-000)"
              strokeWidth="1.5"
            />
            <text
              x={(x + (anchor === "end" ? -14 : 14)).toFixed(1)}
              y={(y + 4.5).toFixed(1)}
              textAnchor={anchor}
              fill={hot ? "var(--region-volta)" : "var(--text-body)"}
              fontSize="13.5"
              fontFamily="var(--font-sans)"
            >
              {d.name.replace(" Municipal", "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
