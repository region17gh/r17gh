import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { DistrictExplorer } from "@/components/region/DistrictExplorer";
import { PhotoSlot } from "@/components/region/PhotoSlot";
import { RegionFeed } from "@/components/region/RegionFeed";
import {
  Badge,
  Button,
  ConfidenceFlag,
  Icon,
  Seal,
  SectionHeader,
  Statistic,
} from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useI18n } from "@/i18n";
import { toDistrictViews } from "@/lib/region/districtView";
import { confidenceLevel, fetchRegionPayload, type RegionPayload } from "@/lib/region/payload";
import {
  MOCK_GLANCE,
  MOCK_NEEDS,
  MOCK_RECIPROCAL,
  MOCK_REGISTRY,
  SECTOR_ICONS,
} from "@/lib/region/voltaMockContent";

/**
 * The Volta region page.
 *
 * SCOPE. Volta only. The route takes a `$region` param so the URL is the shape
 * every region page will use — `/{locale}/regions/{slug}`, matching
 * `src/lib/places/path.ts` — but anything other than `volta` is a 404. The page
 * is not a template yet: its feed, needs, registry figures and story bodies are
 * Volta-specific mock content. Generalising it is a later pass, and turning
 * this guard off without doing that work would ship fifteen pages of invented
 * Volta data under other regions' names.
 *
 * WHAT IS REAL. Everything from `region_payload('volta')`: the region, its
 * capital, its eighteen districts with their names, capitals, zones, summaries,
 * url_paths and publication depths, the six priority sectors with their notes,
 * and every source citation and confidence flag attached to those.
 *
 * WHAT IS MOCK. The feed, the needs, the registry chart and counts, the
 * placeholder depth chips, the two story bodies, and two of the six
 * at-a-glance figures. All of it lives in `src/lib/region/voltaMockContent.ts`,
 * whose header says why it is here and what it contradicts. Swapping it for
 * real data is a separate later pass and that file is the whole of the swap.
 */

const SUPPORTED_REGIONS = new Set(["volta"]);

export const Route = createFileRoute("/$locale/regions/$region")({
  beforeLoad: ({ params }) => {
    if (!SUPPORTED_REGIONS.has(params.region)) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Volta | Region 17 Ghana" },
      {
        name: "description",
        content:
          "Volta: eighteen districts, what the region is building, what it needs, and what it holds for you.",
      },
      { property: "og:title", content: "Volta | Region 17 Ghana" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RegionPage,
});

const SECTION_LINKS = [
  { id: "explore", key: "explore" },
  { id: "happening", key: "happening" },
  { id: "building", key: "building" },
  { id: "needs", key: "needs" },
  { id: "join", key: "join" },
] as const;

function RegionPage() {
  const { t, locale } = useI18n();
  const { region: regionSlug } = Route.useParams();
  const [payload, setPayload] = useState<RegionPayload | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let live = true;
    setPayload(null);
    setFailure(null);
    void fetchRegionPayload(regionSlug)
      .then((p) => {
        if (live) setPayload(p);
      })
      .catch((err: unknown) => {
        // Say it out loud. This screen used to be reachable with nothing in the
        // console behind it, which made a build-configuration problem and a
        // database problem look identical from a phone. Whoever opens devtools
        // on a failed region page should find the cause already written down.
        console.error(`[region] ${regionSlug}: region payload failed to load`, err);
        if (live) setFailure(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
    };
  }, [regionSlug, attempt]);

  const districts = useMemo(
    () => (payload ? toDistrictViews(payload.districts) : []),
    [payload],
  );

  if (failure !== null) {
    return (
      <main style={{ padding: "var(--space-20) var(--gutter)", textAlign: "center" }}>
        <p className="r17-notice" role="alert">
          {t("region.loadFailed")}
        </p>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t("region.loadRetry")}
          </Button>
        </div>
        {/* The reason, in the page rather than only in the console: the reader
            who reports this is on a phone and cannot open devtools, and the
            first line of it is usually the whole diagnosis. */}
        <p
          style={{
            margin: "var(--space-6) auto 0",
            maxWidth: "68ch",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
            wordBreak: "break-word",
          }}
        >
          {failure}
        </p>
      </main>
    );
  }

  if (!payload || !payload.region) {
    return (
      <main style={{ padding: "var(--space-20) var(--gutter)", textAlign: "center" }}>
        <p>{t("common.loading")}</p>
      </main>
    );
  }

  const region = payload.region;
  const zoneCount = new Set(districts.map((d) => d.zone).filter(Boolean)).size;
  const followLabel = following ? t("region.following") : t("region.follow", { region: region.name });

  return (
    <div
      style={{
        background: "var(--surface-page)",
        minHeight: "100vh",
        color: "var(--text-body)",
        font: "var(--type-body)",
      }}
    >
      {/* Hero */}
      <section
        aria-labelledby="region-title"
        style={{
          position: "relative",
          height: "86vh",
          minHeight: "620px",
          background: "var(--navy-900)",
          overflow: "hidden",
        }}
      >
        <PhotoSlot
          brief={t("region.hero.photoBrief")}
          style={{ position: "absolute", inset: 0, border: "none" }}
        />
        <span
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, background: "var(--scrim-bottom)", pointerEvents: "none" }}
        />
        <div
          className="r17-region-width"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "0 var(--gutter-lg) var(--space-12)",
          }}
        >
          <span className="r17-eyebrow" style={{ color: "var(--gold-400)" }}>
            {t("region.hero.eyebrow", { region: region.name })}
          </span>
          <h1
            id="region-title"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(64px,8vw,104px)",
              lineHeight: 1.02,
              letterSpacing: "var(--tracking-display)",
              color: "var(--paper-000)",
              margin: "14px 0 0",
            }}
          >
            {region.name}
          </h1>
          <p
            style={{
              font: "var(--type-body-lg)",
              color: "var(--navy-100)",
              maxWidth: "56ch",
              margin: "var(--space-5) 0 0",
            }}
          >
            {t("region.hero.lede")}
          </p>
          <div
            style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", marginTop: "var(--space-8)" }}
          >
            <Button variant="gold" size="lg" onClick={() => setFollowing((f) => !f)} aria-pressed={following}>
              {followLabel}
            </Button>
            <a
              href="#explore"
              style={{
                font: "var(--type-ui)",
                fontWeight: 600,
                color: "var(--paper-000)",
                textDecoration: "none",
                padding: "12px 4px 10px",
                borderBottom: "2px solid var(--gold-500)",
                minHeight: "48px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {t("region.hero.explore")}
            </a>
          </div>
        </div>
      </section>

      {/* Sticky region bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--overlay-glass)",
          backdropFilter: "var(--blur-glass)",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <div
          className="r17-region-width"
          style={{
            minHeight: "var(--r17-region-bar-height)",
            padding: "var(--space-2) var(--gutter-lg)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-5) var(--space-8)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
              {t("region.bar.country")}
            </span>
            <span aria-hidden="true" style={{ color: "var(--text-faint)" }}>
              /
            </span>
            {/* Colour never carries meaning alone: the mark always ships with the name. */}
            <span
              aria-hidden="true"
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: `var(${region.ink_token})`,
              }}
            />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title-3)", color: "var(--navy-700)" }}>
              {region.name}
            </span>
          </span>
          <nav
            aria-label={t("region.bar.navLabel")}
            className="r17-region-bar-nav"
            style={{ display: "flex", gap: "var(--space-6)", alignItems: "center" }}
          >
            {SECTION_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                style={{
                  font: "var(--type-ui)",
                  fontSize: "14.5px",
                  color: "var(--text-body)",
                  textDecoration: "none",
                  padding: "12px 0",
                  borderBottom: "2px solid var(--border-hairline)",
                }}
              >
                {t(`region.bar.${link.key}`)}
              </a>
            ))}
          </nav>
          <div className="r17-region-bar-actions">
            <a
              href="#who-rcc"
              style={{
                font: "var(--type-ui)",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textDecoration: "none",
                borderBottom: "1px solid var(--border-default)",
                padding: "12px 0",
              }}
            >
              {t("region.bar.forTheRegion")}
            </a>
            <Button size="md" onClick={() => setFollowing((f) => !f)} aria-pressed={following}>
              {followLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* At a glance. Four real figures, two mock. */}
      <div style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-hairline)" }}>
        <div
          className="r17-region-width"
          style={{
            padding: "var(--space-6) var(--gutter-lg)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(150px,100%),1fr))",
            gap: "var(--space-6)",
          }}
        >
          <Statistic
            value={String(districts.length)}
            label={t("region.glance.districts")}
            year={region.reference_verified?.slice(0, 4) ?? ""}
            confidence={confidenceLevel(region.data_confidence)}
            source={region.reference_source ?? undefined}
            size="sm"
          />
          <Statistic
            value={String(zoneCount)}
            label={t("region.glance.zones")}
            year={region.reference_verified?.slice(0, 4) ?? ""}
            confidence={confidenceLevel(region.data_confidence)}
            source={region.reference_source ?? undefined}
            size="sm"
          />
          <Statistic
            value={region.capital ?? "—"}
            label={t("region.glance.capital")}
            year={region.reference_verified?.slice(0, 4) ?? ""}
            confidence={confidenceLevel(region.data_confidence)}
            source={region.reference_source ?? undefined}
            size="sm"
          />
          <Statistic
            value={String(payload.priority_sectors.length)}
            label={t("region.glance.sectors")}
            year={payload.priority_sectors[0]?.reference_verified?.slice(0, 4) ?? ""}
            confidence={confidenceLevel(payload.priority_sectors[0]?.data_confidence)}
            source={payload.priority_sectors[0]?.reference_source ?? undefined}
            size="sm"
          />
          {/* Mock: no registry counts are derived from rows yet. */}
          <Statistic
            value={MOCK_GLANCE.membersWatching}
            label={t("region.glance.watching")}
            year={MOCK_GLANCE.year}
            confidence="estimate"
            source={t("region.glance.mockSource")}
            size="sm"
          />
          <Statistic
            value={MOCK_GLANCE.postingsOpen}
            label={t("region.glance.postings")}
            year={MOCK_GLANCE.year}
            confidence="estimate"
            source={t("region.glance.mockSource")}
            size="sm"
          />
        </div>
      </div>

      <DistrictExplorer districts={districts} regionName={region.name} />

      <RegionFeed regionName={region.name} />

      {/* What the region holds for you */}
      <section
        id="toyou"
        aria-labelledby="toyou-heading"
        style={{ borderTop: "1px solid var(--border-hairline)", padding: "var(--space-20) 0" }}
      >
        <div className="r17-region-width" style={{ padding: "0 var(--gutter-lg)" }}>
          <SectionHeader
            eyebrow={t("region.reciprocal.eyebrow", { region: region.name })}
            title={t("region.reciprocal.heading")}
            lede={t("region.reciprocal.lede")}
            id="toyou-heading"
          />
        </div>
        <ul className="r17-region-width-wide r17-card-grid" style={{ marginTop: "var(--space-10)" }}>
          {MOCK_RECIPROCAL.map((item) => (
            <li
              key={item.title}
              style={{
                position: "relative",
                borderRadius: "var(--radius-card)",
                overflow: "hidden",
                background: "var(--navy-900)",
                display: "flex",
                flexDirection: "column",
                minHeight: "280px",
              }}
            >
              <PhotoSlot brief={item.hint} style={{ flex: 1, border: "none" }} />
              <div style={{ padding: "var(--space-5)" }}>
                <span className="r17-eyebrow" style={{ color: "var(--gold-400)" }}>
                  {item.kind}
                </span>
                <h3
                  style={{
                    font: "var(--type-title)",
                    fontSize: "23px",
                    color: "var(--paper-000)",
                    margin: "4px 0 6px",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    font: "var(--type-body)",
                    fontSize: "13.5px",
                    color: "var(--navy-100)",
                    margin: "0 0 10px",
                    maxWidth: "34ch",
                  }}
                >
                  {item.body}
                </p>
                <span
                  style={{
                    font: "var(--type-ui)",
                    fontWeight: 600,
                    fontSize: "14.5px",
                    color: "var(--paper-000)",
                    borderBottom: "2px solid var(--gold-500)",
                    paddingBottom: "3px",
                  }}
                >
                  {item.action}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* What the region is building. Real, from region_payload. */}
      <section
        id="building"
        aria-labelledby="building-heading"
        style={{ background: "var(--surface-inverse)", color: "var(--text-on-inverse)" }}
      >
        <div className="r17-region-width" style={{ padding: "var(--space-20) var(--gutter-lg)" }}>
          <div className="r17-building-grid">
            <div>
              <SectionHeader
                eyebrow={t("region.building.eyebrow", { region: region.name })}
                title={t("region.building.heading")}
                lede={t("region.building.lede")}
                inverse
                id="building-heading"
              />
              {payload.priority_sectors[0] ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-5)",
                    flexWrap: "wrap",
                  }}
                >
                  <ConfidenceFlag level={confidenceLevel(payload.priority_sectors[0].data_confidence)} />
                  <span className="r17-cite" style={{ color: "var(--navy-200)" }}>
                    {payload.priority_sectors[0].reference_source}
                  </span>
                </div>
              ) : null}
              <p
                className="r17-cite"
                style={{ color: "var(--navy-300)", marginTop: "var(--space-3)", maxWidth: "var(--measure-prose)" }}
              >
                {t("region.building.note")}
              </p>
            </div>
            <PhotoSlot
              brief={t("region.building.photoBrief")}
              style={{ aspectRatio: "4/3", borderRadius: "var(--radius-card)" }}
            />
          </div>

          <ul className="r17-card-grid" style={{ marginTop: "var(--space-10)" }}>
            {payload.priority_sectors.map((sector) => (
              <li
                key={sector.sector_slug}
                style={{
                  padding: "22px 22px 24px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderTop: "2px solid var(--gold-500)",
                  borderRadius: "var(--radius-card)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flex: "none",
                      width: "34px",
                      height: "34px",
                      borderRadius: "6px",
                      background: "rgba(212,175,55,0.12)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--gold-400)",
                    }}
                  >
                    <Icon name={SECTOR_ICONS[sector.sector_slug] ?? "circle"} size={18} />
                  </span>
                  <span style={{ font: "var(--type-figure)", fontSize: "15px", color: "var(--navy-300)" }}>
                    {String(sector.rank).padStart(2, "0")}
                  </span>
                </div>
                <div
                  style={{
                    font: "var(--type-ui)",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "var(--text-on-inverse)",
                    marginTop: "14px",
                  }}
                >
                  {sector.sector_name}
                </div>
                <div className="r17-cite" style={{ color: "var(--navy-200)", marginTop: "6px", lineHeight: 1.5 }}>
                  {sector.note}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What the region needs. Mock rows. */}
      <section id="needs" aria-labelledby="needs-heading" style={{ padding: "var(--space-20) 0" }}>
        <div className="r17-region-width" style={{ padding: "0 var(--gutter-lg)" }}>
          <Eyebrow>{t("region.needs.eyebrow", { region: region.name })}</Eyebrow>
          <h2
            id="needs-heading"
            style={{ font: "var(--type-section)", fontSize: "44px", color: "var(--text-strong)", margin: "14px 0 0" }}
          >
            {t("region.needs.heading")}
          </h2>
          <p
            style={{
              font: "var(--type-body-lg)",
              color: "var(--text-body)",
              margin: "var(--space-4) 0 0",
              maxWidth: "var(--measure-prose)",
            }}
          >
            {t("region.needs.lede")}
          </p>
        </div>
        <ul
          className="r17-region-width-wide r17-card-grid"
          style={{ marginTop: "var(--space-10)", gap: "var(--space-6)", alignItems: "stretch" }}
        >
          {MOCK_NEEDS.map((need) => (
            <li
              key={need.title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                padding: "var(--space-6)",
                background: "var(--surface-card)",
                border: "1px solid var(--border-hairline)",
                borderTop: "2px solid var(--navy-700)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                {need.placeLabel} · {need.sector}
              </span>
              <h3 style={{ font: "var(--type-title)", fontSize: "25px", color: "var(--text-strong)", margin: 0 }}>
                {need.title}
              </h3>
              <p style={{ font: "var(--type-body)", fontSize: "14.5px", color: "var(--text-body)", margin: 0 }}>
                {need.body}
              </p>
              <div style={{ display: "flex", gap: "var(--space-8)", marginTop: "auto", paddingTop: "var(--space-3)" }}>
                <div>
                  <div style={{ font: "var(--type-figure)", fontSize: "27px", color: "var(--navy-700)" }}>
                    {need.cost}
                  </div>
                  <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {t("region.needs.documentedCost")}
                  </span>
                </div>
                <div>
                  <div style={{ font: "var(--type-figure)", fontSize: "27px", color: "var(--navy-700)" }}>
                    {need.jobs}
                  </div>
                  <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {need.jobsLabel}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Badge tone="neutral">{need.status}</Badge>
                <ConfidenceFlag level={need.level} compact />
              </div>
              <span
                className="r17-cite"
                style={{
                  color: "var(--text-cite)",
                  borderTop: "1px solid var(--border-hairline)",
                  paddingTop: "var(--space-3)",
                }}
              >
                {need.cite}
              </span>
            </li>
          ))}
        </ul>
        <div
          className="r17-region-width-wide"
          style={{
            marginTop: "var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
            flexWrap: "wrap",
            padding: "var(--space-5) var(--space-6)",
            background: "var(--surface-sunken)",
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
              {t("region.needs.assembliesEyebrow")}
            </span>
            <p style={{ font: "var(--type-body)", fontSize: "14.5px", color: "var(--text-body)", margin: "6px 0 0" }}>
              {t("region.needs.assembliesBody")}
            </p>
          </div>
          {/* Shrinkable: `flex: none` here made a 405px line that pushed the
              whole document sideways at 390px. */}
          <span className="r17-cite" style={{ color: "var(--text-cite)", flex: "0 1 auto", minWidth: 0 }}>
            {MOCK_REGISTRY.assembliesNote}
          </span>
        </div>
      </section>

      {/* Who is here. Mock chart, counts and ledger. */}
      <section
        id="who"
        aria-labelledby="who-heading"
        style={{ borderTop: "1px solid var(--border-hairline)", background: "var(--surface-card)" }}
      >
        <div className="r17-region-width" style={{ padding: "var(--space-20) var(--gutter-lg)" }}>
          <Eyebrow>{t("region.who.eyebrow")}</Eyebrow>
          <h2
            id="who-heading"
            style={{
              font: "var(--type-section)",
              fontSize: "40px",
              color: "var(--text-strong)",
              margin: "14px 0 0",
              maxWidth: "16ch",
            }}
          >
            {t("region.who.heading")}
          </h2>
          <div className="r17-card-grid-wide" style={{ marginTop: "var(--space-10)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
              <div
                style={{
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--space-6)",
                }}
              >
                <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                  {t("region.who.chartHeading")}
                </span>
                <div
                  role="img"
                  aria-label={MOCK_REGISTRY.chart
                    .map((b) => t("region.who.chartPoint", { month: b.month, value: b.value }))
                    .join(", ")}
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "var(--space-6)",
                    height: "180px",
                    marginTop: "var(--space-6)",
                  }}
                >
                  {MOCK_REGISTRY.chart.map((bar) => {
                    const peak = Math.max(...MOCK_REGISTRY.chart.map((b) => b.value));
                    return (
                      <div
                        key={bar.month}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "6px",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                          {bar.value}
                        </span>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "44px",
                            height: `${Math.round((bar.value / peak) * 130) + 6}px`,
                            background: "var(--navy-500)",
                            borderRadius: "2px 2px 0 0",
                          }}
                        />
                        <span className="r17-cite" style={{ color: "var(--text-faint)" }}>
                          {bar.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="r17-cite" style={{ color: "var(--text-cite)", margin: "var(--space-4) 0 0" }}>
                  {t("region.glance.mockSource")}
                </p>
              </div>

              <div style={{ display: "flex", gap: "var(--space-10)", flexWrap: "wrap" }}>
                {MOCK_REGISTRY.stats.map((stat) => (
                  <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ font: "var(--type-figure)", fontSize: "34px", color: "var(--navy-700)" }}>
                      {stat.value}
                    </span>
                    <span style={{ font: "var(--type-ui)", fontSize: "14px", color: "var(--text-body)" }}>
                      {stat.label}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                        {MOCK_GLANCE.year}
                      </span>
                      <ConfidenceFlag level="estimate" compact />
                    </span>
                  </div>
                ))}
              </div>

              <div
                id="who-rcc"
                style={{
                  border: "1px solid var(--border-hairline)",
                  borderLeft: "3px solid var(--navy-700)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--space-6)",
                  maxWidth: "560px",
                }}
              >
                <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                  {t("region.who.rccEyebrow")}
                </span>
                <p style={{ font: "var(--type-body)", color: "var(--text-body)", margin: "var(--space-3) 0 0" }}>
                  {t("region.who.rccBody", { region: region.name, districts: districts.length })}
                </p>
                <a
                  href="#join"
                  style={{
                    font: "var(--type-ui)",
                    fontWeight: 600,
                    color: "var(--navy-700)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "var(--space-4)",
                    minHeight: "48px",
                  }}
                >
                  {t("region.who.rccAction")}
                  <Icon name="arrow-right" size={15} />
                </a>
              </div>
            </div>

            <div>
              <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                {t("region.who.ledgerHeading")}
              </span>
              <ol
                style={{
                  marginTop: "var(--space-4)",
                  listStyle: "none",
                  padding: 0,
                  display: "grid",
                  gap: "var(--space-4)",
                }}
              >
                {MOCK_REGISTRY.ledger.map((entry) => (
                  <li
                    key={`${entry.date}-${entry.actor}`}
                    style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      paddingBottom: "var(--space-4)",
                      borderBottom: "1px solid var(--border-hairline)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "3px",
                        flex: "none",
                        borderRadius: "2px",
                        background: `var(${region.ink_token})`,
                      }}
                    />
                    <div>
                      <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                        {entry.date}
                      </span>
                      <p
                        style={{
                          font: "var(--type-ui)",
                          fontSize: "14.5px",
                          color: "var(--text-strong)",
                          margin: "4px 0 0",
                        }}
                      >
                        <strong style={{ fontWeight: 600 }}>{entry.actor}</strong> · {entry.action}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Invitation */}
      <section
        id="join"
        aria-labelledby="join-heading"
        style={{ background: "var(--surface-inverse)", color: "var(--text-on-inverse)" }}
      >
        <div
          className="r17-region-width"
          style={{
            padding: "var(--space-16) var(--gutter-lg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "var(--space-6)",
          }}
        >
          <Seal size={84} />
          <h2
            id="join-heading"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(34px,4vw,52px)",
              lineHeight: 1.15,
              letterSpacing: "-0.018em",
              color: "var(--text-on-inverse)",
              margin: 0,
              maxWidth: "24ch",
            }}
          >
            {t("region.join.heading", { region: region.name })}
          </h2>
          <Button variant="gold" size="lg" iconAfter="arrow-right" href={`/${locale}/join`}>
            {t("region.join.action")}
          </Button>
          {/* Safety control, not decoration. Its wording is fixed. */}
          <p className="r17-cite" style={{ color: "var(--navy-200)", maxWidth: "var(--measure-prose)" }}>
            {t("legal.notAGovernmentDocument")}
          </p>
        </div>
      </section>
    </div>
  );
}

function Eyebrow({ children, inverse }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <span
      className="r17-eyebrow"
      style={{
        color: inverse ? "var(--gold-400)" : "var(--gold-700)",
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: "28px", height: "2px", background: "var(--gold-500)", display: "inline-block" }}
      />
      {children}
    </span>
  );
}

