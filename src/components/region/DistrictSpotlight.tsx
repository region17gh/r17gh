import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Badge, Button, ConfidenceFlag, Icon } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useI18n } from "@/i18n";
import { placePath } from "@/lib/places/path";
import { confidenceLevel } from "@/lib/region/payload";
import type { DistrictView } from "@/lib/region/districtView";
import {
  MOCK_DISTRICT_NEEDS,
  MOCK_HAPPENINGS,
  MOCK_ZONE_CARRIES,
} from "@/lib/region/voltaMockContent";

import { PhotoSlot } from "./PhotoSlot";

/**
 * The district spotlight sheet.
 *
 * Two independent states, exactly as the design settled them, and they are not
 * the same fact:
 *
 *   depth      — how far Region 17 has got with the district itself: listed,
 *                profiled, partnered. Lives in `places.depth_slug`.
 *   pageBuilt  — whether the district's own page exists and is safe to send
 *                a reader to. Lives in `places.page_built`.
 *
 * A partnered district can have no page. A listed one can have a page written
 * for it. Nothing here infers either from the other.
 *
 * With `pageBuilt` false the "Open district" link does not navigate: hovering
 * explains why, and clicking replaces the sheet's opening lines with the
 * not-yet-built state. All eighteen Volta districts are in that state today.
 */

/** The "Open <district>" control, whether it navigates or explains why it does not. */
const OPEN_CONTROL_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "48px",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  font: "var(--type-ui)",
  fontWeight: 600,
  fontSize: "14.5px",
  color: "var(--navy-700)",
  textDecoration: "none",
  background: "var(--surface-card)",
};

const DEPTH_TONE: Record<DistrictView["displayDepth"], "gold" | "navy" | "neutral"> = {
  Partnered: "gold",
  Profiled: "navy",
  Listed: "neutral",
};

export function DistrictSpotlight({
  district,
  zoneLabel,
  onClose,
  onGoToNeeds,
}: {
  district: DistrictView;
  zoneLabel: string;
  onClose: () => void;
  onGoToNeeds: () => void;
}) {
  const { t, locale } = useI18n();
  const [mediaTab, setMediaTab] = useState<"photo" | "video">(
    district.mark?.mediaType === "video" ? "video" : "photo",
  );
  const [openedUnbuilt, setOpenedUnbuilt] = useState(false);
  const [openHover, setOpenHover] = useState(false);
  const [watching, setWatching] = useState(false);
  const headingRef = useRef<HTMLDivElement | null>(null);

  // The sheet is the new context; move focus to its heading so a screen reader
  // and a keyboard both land inside it rather than back at the top of the list.
  useEffect(() => {
    headingRef.current?.focus();
    setMediaTab(district.mark?.mediaType === "video" ? "video" : "photo");
    setOpenedUnbuilt(false);
    setOpenHover(false);
  }, [district.slug, district.mark?.mediaType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shortName = district.name.replace(" Municipal", "");
  const needs = MOCK_DISTRICT_NEEDS[district.slug] ?? [];
  const happenings = MOCK_HAPPENINGS[district.slug] ?? [];
  const carries = district.zone ? (MOCK_ZONE_CARRIES[district.zone] ?? "") : "";
  const href = placePath(locale, district.urlPath);

  const label = (key: string, vars?: Record<string, string>) => t(`region.spotlight.${key}`, vars);

  return (
    <aside
      aria-label={label("regionLabel", { district: district.name })}
      className="r17-spotlight"
      style={{
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-card)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "var(--shadow-2)",
      }}
    >
      <div
        style={{
          background: "var(--navy-700)",
          color: "var(--paper-050)",
          padding: "var(--space-5) var(--space-6)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          ref={headingRef}
          tabIndex={-1}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}
        >
          <span
            style={{
              flex: "1 1 0",
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              font: "var(--type-ui)",
              fontWeight: 600,
              fontSize: "15px",
              color: "var(--gold-400)",
            }}
          >
            {label("header", { zone: zoneLabel })}
          </span>
          <span
            style={{
              flex: "0 1 auto",
              minWidth: "90px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              font: "var(--type-ui)",
              fontWeight: 700,
              fontSize: "15px",
              color: "var(--paper-000)",
            }}
          >
            {district.name} · {district.capital}
          </span>
          <span style={{ flex: "none" }}>
            <Badge tone={DEPTH_TONE[district.displayDepth]}>{district.displayDepth}</Badge>
          </span>
          {district.pageBuilt ? (
            <span
              className="r17-cite"
              style={{
                color: "var(--gold-400)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                flex: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "var(--gold-400)",
                  display: "inline-block",
                  flex: "none",
                }}
              />
              {label("live")}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={label("close")}
          style={{
            flex: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--navy-200)",
            display: "inline-flex",
            padding: "12px",
            margin: "-12px",
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="r17-spotlight-body">
        <div className="r17-spotlight-media" style={{ background: "var(--navy-900)" }}>
          {mediaTab === "photo" ? (
            <PhotoSlot
              brief={label("photoBrief", { district: shortName })}
              style={{ position: "absolute", inset: 0, border: "none" }}
            />
          ) : (
            /*
              The design export let an editor paste a YouTube or Vimeo link here
              at runtime. That was a canvas affordance: on a public region page
              it is an editing control nobody may use and nowhere to persist it
              to. A district video will arrive as a cleared `media_assets` row,
              and until one does this states the absence.
            */
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-5)",
                textAlign: "center",
              }}
            >
              <span className="r17-cite" style={{ color: "var(--navy-200)", maxWidth: "26ch" }}>
                {label("noVideo")}
              </span>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              zIndex: 2,
              display: "flex",
              gap: "4px",
            }}
          >
            {(["photo", "video"] as const).map((tab) => {
              const on = mediaTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMediaTab(tab)}
                  style={{
                    font: "var(--type-ui)",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "none",
                    cursor: "pointer",
                    background: on ? "var(--paper-000)" : "rgba(9,19,35,0.55)",
                    color: on ? "var(--navy-700)" : "var(--paper-000)",
                  }}
                >
                  {label(tab === "photo" ? "tabPhoto" : "tabVideo")}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--space-3) var(--space-6) var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            minWidth: 0,
          }}
        >
          {openedUnbuilt ? (
            <div
              role="status"
              style={{
                padding: "var(--space-4) var(--space-5)",
                background: "var(--surface-sunken)",
                border: "1px dashed var(--border-default)",
                borderRadius: "var(--radius-card)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <p
                style={{
                  font: "var(--type-body)",
                  fontSize: "14px",
                  color: "var(--text-strong)",
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                {label("notBuilt", { district: shortName })}
              </p>
              <button
                type="button"
                onClick={() => setOpenedUnbuilt(false)}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "var(--type-ui)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--navy-700)",
                  borderBottom: "1px solid var(--gold-500)",
                }}
              >
                {label("backToOverview")}
              </button>
            </div>
          ) : null}

          <p style={{ font: "var(--type-body)", fontSize: "15px", color: "var(--text-body)", margin: 0 }}>
            {district.mark?.line ?? district.summary ?? ""}
          </p>

          {/*
            The sourced line from `places.summary`, with its confidence and its
            citation. Provenance is structural here: a surface that cannot show
            the source does not show the fact.
          */}
          {district.summary ? (
            <div
              style={{
                borderLeft: "2px solid var(--border-hairline)",
                paddingLeft: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span className="r17-cite" style={{ color: "var(--text-body)" }}>
                {district.summary}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <ConfidenceFlag level={confidenceLevel(district.dataConfidence)} compact />
                <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                  {district.referenceSource ?? label("noSource")}
                </span>
              </span>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(90px,1fr))",
              gap: "6px 10px",
              padding: "8px 12px",
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <Figure value={String(needs.length)} label={label("statNeeds")} />
            <Figure value={String(happenings.length)} label={label("statActivity")} />
            {/*
              Population and land area are `Conflicted` for Volta and cannot be
              published: a check constraint, not a convention. They are shown as
              withheld rather than omitted, so the gap is legible.
            */}
            <Figure value="—" label={label("statPopulation")} muted title={label("withheld")} />
            <Figure value="—" label={label("statLandArea")} muted title={label("withheld")} />
          </div>

          <div className="r17-spotlight-split">
            <div>
              <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                {label("needsHeading")}
              </span>
              {needs.length ? (
                <>
                  {needs.map((n) => (
                    <div
                      key={n.title}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "12px",
                        marginTop: "12px",
                        padding: "12px 14px",
                        border: "1px solid var(--border-hairline)",
                        borderLeft: "3px solid var(--gold-500)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            font: "var(--type-ui)",
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "var(--text-strong)",
                          }}
                        >
                          {n.title}
                        </div>
                        <span
                          className="r17-cite"
                          style={{ color: "var(--text-cite)", display: "block", marginTop: "3px" }}
                        >
                          {n.status}
                        </span>
                      </div>
                      <span
                        style={{
                          font: "var(--type-figure)",
                          fontSize: "18px",
                          color: "var(--navy-700)",
                          flexShrink: 0,
                        }}
                      >
                        {n.cost}
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={onGoToNeeds}
                    style={{
                      display: "inline-block",
                      marginTop: "12px",
                      background: "none",
                      border: "none",
                      padding: "0 0 2px",
                      cursor: "pointer",
                      font: "var(--type-ui)",
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--navy-700)",
                      borderBottom: "2px solid var(--gold-500)",
                    }}
                  >
                    {label("seeUnderNeeds")}
                  </button>
                </>
              ) : (
                <p className="r17-cite" style={{ color: "var(--text-cite)", margin: "10px 0 0" }}>
                  {label("noNeeds")}
                </p>
              )}
            </div>
            <div>
              <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                {label("happeningHeading")}
              </span>
              {(happenings.length ? happenings : [label("nothingPosted")]).map((line) => (
                <p key={line} className="r17-cite" style={{ color: "var(--text-body)", margin: "10px 0 0" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {carries ? (
            <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "var(--space-3)" }}>
              <span
                style={{
                  display: "block",
                  font: "var(--type-ui)",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  color: "var(--navy-700)",
                }}
              >
                {label("carriesHeading")}
              </span>
              <p
                style={{
                  font: "var(--type-body)",
                  fontSize: "14.5px",
                  color: "var(--text-body)",
                  margin: "6px 0 0",
                }}
              >
                {carries}
              </p>
            </div>
          ) : null}

          <div
            style={{
              borderTop: "1px solid var(--border-hairline)",
              paddingTop: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                flex: "none",
                font: "var(--type-ui)",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "var(--navy-700)",
              }}
            >
              {label("waysInHeading")}
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {["visit", "teach", "invest", "volunteer"].map((way) => (
                <span
                  key={way}
                  style={{
                    font: "var(--type-ui)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    padding: "5px 12px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-pill)",
                    color: "var(--navy-700)",
                  }}
                >
                  {label(`wayIn.${way}`)}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              paddingTop: "var(--space-3)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <Button
              size="lg"
              fullWidth
              iconAfter={watching ? "check" : "arrow-right"}
              aria-pressed={watching}
              onClick={() => setWatching((w) => !w)}
            >
              {label(watching ? "watching" : "watch")}
            </Button>

            {!openedUnbuilt ? (
              <div style={{ position: "relative" }}>
                {openHover ? (
                  <div
                    role="note"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      left: 0,
                      right: 0,
                      background: "var(--navy-700)",
                      color: "var(--navy-100)",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-card)",
                      boxShadow: "var(--shadow-3)",
                      font: "var(--type-body)",
                      fontSize: "13.5px",
                      lineHeight: 1.5,
                      zIndex: 3,
                    }}
                  >
                    {label("openNote", { district: shortName })}
                  </div>
                ) : null}
                {/*
                  Built: a link, because it navigates. Not built: a button,
                  because it does not. `aria-disabled` on a control that still
                  does something on activation announces "dimmed" and then acts,
                  which is worse than either honest option.
                */}
                {district.pageBuilt ? (
                  <a href={href} style={OPEN_CONTROL_STYLE}>
                    {label("open", { district: shortName })}
                    <Icon name="arrow-right" size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onMouseEnter={() => setOpenHover(true)}
                    onMouseLeave={() => setOpenHover(false)}
                    onFocus={() => setOpenHover(true)}
                    onBlur={() => setOpenHover(false)}
                    onClick={() => {
                      setOpenedUnbuilt(true);
                      setOpenHover(false);
                    }}
                    data-page-built="false"
                    data-href={href}
                    style={{ ...OPEN_CONTROL_STYLE, width: "100%", cursor: "pointer" }}
                  >
                    {label("open", { district: shortName })}
                    <Icon name="arrow-right" size={14} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Figure({
  value,
  label,
  muted,
  title,
}: {
  value: string;
  label: string;
  muted?: boolean;
  title?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }} title={title}>
      <span
        style={{
          font: "var(--type-figure)",
          fontSize: "16px",
          color: muted ? "var(--text-faint)" : "var(--navy-700)",
        }}
      >
        {value}
      </span>
      <span className="r17-eyebrow" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
        {label}
      </span>
    </div>
  );
}
