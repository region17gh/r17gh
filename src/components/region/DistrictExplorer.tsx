import { useMemo, useState } from "react";

import { Badge } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useI18n } from "@/i18n";
import {
  groupByZone,
  zoneLabelFallback,
  ZONE_ORDER,
  type DistrictView,
} from "@/lib/region/districtView";

import { DistrictSpotlight } from "./DistrictSpotlight";
import { VoltaFallbackMap } from "./VoltaFallbackMap";
import { VoltaMap, type VoltaMapDistrict } from "./VoltaMap";

/**
 * Explore Volta: the map, the zone-grouped district list, and the spotlight
 * sheet, bound two ways.
 *
 * Hover a row and the shape lights; hover a shape and the row lights; click
 * either and the sheet opens on the same district. All of that runs on one
 * identifier, `places.slug`, and there is no id translation anywhere between
 * the three.
 */

const DEPTH_TONE: Record<DistrictView["displayDepth"], "gold" | "navy" | "neutral"> = {
  Partnered: "gold",
  Profiled: "navy",
  Listed: "neutral",
};

export function DistrictExplorer({
  districts,
  regionName,
}: {
  districts: DistrictView[];
  regionName: string;
}) {
  const { t } = useI18n();
  const [zone, setZone] = useState<string>("all");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  const groups = useMemo(() => groupByZone(districts), [districts]);

  const zoneLabel = (slug: string | null) => {
    if (slug === null) return t("region.explore.zoneUnassigned");
    const key = `region.zone.${slug}`;
    const value = t(key);
    return value === key ? zoneLabelFallback(slug) : value;
  };

  // Only offer a chip for a zone that actually has districts behind it.
  const zonesPresent = useMemo(() => {
    const present = new Set(districts.map((d) => d.zone).filter((z): z is string => z !== null));
    const ordered = ZONE_ORDER.filter((z) => present.has(z));
    const extra = [...present].filter((z) => !(ZONE_ORDER as readonly string[]).includes(z)).sort();
    return [...ordered, ...extra];
  }, [districts]);

  const dimIds = useMemo(
    () => (zone === "all" ? [] : districts.filter((d) => d.zone !== zone).map((d) => d.slug)),
    [districts, zone],
  );

  // Only districts with a placed marker get a pin; the rest still list and
  // still have boundaries.
  const mapDistricts = useMemo<VoltaMapDistrict[]>(
    () =>
      districts
        .filter((d) => d.mark !== null)
        .map((d) => ({
          id: d.slug,
          name: d.name,
          capital: d.capital,
          lon: d.mark!.lon,
          lat: d.mark!.lat,
        })),
    [districts],
  );

  const anchors = useMemo(() => {
    const out: Record<string, "start" | "end"> = {};
    districts.forEach((d) => {
      if (d.mark) out[d.slug] = d.mark.anchor;
    });
    return out;
  }, [districts]);

  const selected = districts.find((d) => d.slug === selectedId) ?? null;

  const goToNeeds = () => {
    setSelectedId(null);
    document.getElementById("needs")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="explore"
      aria-labelledby="explore-heading"
      className={selected ? "r17-region-width-wide" : "r17-region-width"}
      style={{
        padding: "var(--space-20) var(--gutter-lg) var(--space-16)",
        transition: "width 220ms cubic-bezier(.2,0,.2,1)",
      }}
    >
      <span
        className="r17-eyebrow"
        style={{
          color: "var(--gold-700)",
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ width: "28px", height: "2px", background: "var(--gold-500)", display: "inline-block" }} />
        {t("region.explore.eyebrow", { region: regionName })}
      </span>
      <h2
        id="explore-heading"
        style={{ font: "var(--type-section)", fontSize: "44px", color: "var(--text-strong)", margin: "14px 0 0" }}
      >
        {t("region.explore.heading", { districts: districts.length, zones: zonesPresent.length })}
      </h2>
      <p
        style={{
          font: "var(--type-body-lg)",
          color: "var(--text-body)",
          margin: "var(--space-4) 0 0",
          maxWidth: "var(--measure-prose)",
        }}
      >
        {t("region.explore.lede")}
      </p>

      <div
        role="group"
        aria-label={t("region.explore.zoneFilterLabel")}
        style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-8)" }}
      >
        {[{ id: "all", label: t("region.explore.allZones") }, ...zonesPresent.map((z) => ({ id: z, label: zoneLabel(z) }))].map(
          (chip) => {
            const on = zone === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => setZone(chip.id)}
                style={{
                  font: "var(--type-ui)",
                  fontSize: "14.5px",
                  fontWeight: 500,
                  minHeight: "48px",
                  padding: "0 20px",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  background: on ? "var(--navy-700)" : "var(--surface-card)",
                  color: on ? "var(--paper-000)" : "var(--text-body)",
                  border: `1px solid ${on ? "var(--navy-700)" : "var(--border-default)"}`,
                  transition: "background 140ms cubic-bezier(.2,0,.2,1)",
                }}
              >
                {chip.label}
              </button>
            );
          },
        )}
      </div>

      <div
        className="r17-explore-grid"
        data-spotlight={selected ? "open" : "closed"}
        style={{ marginTop: "var(--space-8)" }}
      >
        <div
          className="r17-explore-map"
          data-mode={tilesFailed ? "fallback" : "tiles"}
          style={{ display: "flex", flexDirection: "column" }}
        >
          {tilesFailed ? (
            <VoltaFallbackMap
              districts={mapDistricts}
              anchors={anchors}
              selectedId={selectedId}
              hoverId={hoverId}
              dimIds={dimIds}
              onHover={setHoverId}
              onOpen={setSelectedId}
              lakeLabel={t("region.explore.lakeVolta")}
            />
          ) : (
            <div
              style={{
                height: "100%",
                border: "1px solid var(--border-hairline)",
                borderRadius: "var(--radius-card)",
                overflow: "hidden",
                position: "relative",
                zIndex: 0,
              }}
            >
              <VoltaMap
                districts={mapDistricts}
                selectedId={selectedId}
                hoverId={hoverId}
                dimIds={dimIds}
                onHover={setHoverId}
                onOpen={setSelectedId}
                onTilesFail={() => setTilesFailed(true)}
              />
              <p
                className="r17-cite"
                style={{
                  position: "absolute",
                  left: "10px",
                  bottom: "10px",
                  zIndex: 2,
                  margin: 0,
                  padding: "5px 10px",
                  background: "rgba(251,250,247,0.88)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-faint)",
                  maxWidth: "min(420px,80%)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t("region.explore.mapCredit")}
              </p>
            </div>
          )}
        </div>

        <div className="r17-explore-list">
          {groups.map((group) => (
            <div key={group.zone ?? "unzoned"} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  padding: "8px 10px",
                  background: "var(--surface-sunken)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <h3
                  style={{
                    font: "var(--type-title)",
                    fontSize: "19px",
                    color: "var(--text-strong)",
                    margin: 0,
                  }}
                >
                  {zoneLabel(group.zone)}
                </h3>
                <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                  {t(
                    group.districts.length === 1
                      ? "region.explore.districtCountOne"
                      : "region.explore.districtCount",
                    { count: group.districts.length },
                  )}
                </span>
              </div>
              {group.districts.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onMouseEnter={() => setHoverId(d.slug)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(d.slug)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => setSelectedId(d.slug)}
                  aria-expanded={selectedId === d.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 10px",
                    minHeight: "48px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                    border: "none",
                    width: "100%",
                    background:
                      hoverId === d.slug || selectedId === d.slug
                        ? "var(--surface-sunken)"
                        : "transparent",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        font: "var(--type-ui)",
                        fontWeight: 600,
                        fontSize: "15px",
                        color: "var(--text-strong)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {d.name}
                    </span>
                    {!selected ? (
                      <span className="r17-cite" style={{ display: "block", color: "var(--text-cite)" }}>
                        {d.capital}
                      </span>
                    ) : null}
                  </span>
                  {!selected ? (
                    <Badge tone={DEPTH_TONE[d.displayDepth]}>{d.displayDepth}</Badge>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>

        {selected ? (
          <DistrictSpotlight
            district={selected}
            zoneLabel={zoneLabel(selected.zone)}
            onClose={() => setSelectedId(null)}
            onGoToNeeds={goToNeeds}
          />
        ) : null}
      </div>
    </section>
  );
}
