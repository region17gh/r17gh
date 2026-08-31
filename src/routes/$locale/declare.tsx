import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { TAP_CONTROL } from "@/components/join/steps/shared";
import {
  Button,
  Field,
  Input,
  PanBand,
  SectionHeader,
  Select,
  Switch,
  Textarea,
} from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/declare")({
  head: () => ({ meta: [{ title: "What brings you | Region 17" }] }),
  component: DeclarePage,
});

/**
 * Platform activation, and the last step that matters.
 *
 * NOT REGISTRATION ACTIVATION. `/verify` finishes the register: handle, email,
 * `activate_membership()`. This finishes the platform. A member can be `active`
 * in the register and still be invisible to the engine (no matches, no
 * notifications, no place in a recruitment query) until they hold one live
 * declaration. That is what `member_is_activated()` reports and what
 * `account_state()` routes on: it returns `verify` while registration is
 * unfinished and `declare` once it is finished with no declaration behind it.
 *
 * The four fields the matching engine reads are direction, pathway, place and
 * sector, and they are composed here as a sentence rather than a form. A member
 * writing a line about themselves has no reason to know they are populating a
 * matching index, which is the point.
 *
 * Reachable again after activation, so a member can add a second declaration
 * without a different screen.
 */

type Direction = "offer" | "seek";

interface Pathway {
  slug: string;
  offer_label: string;
  seek_label: string;
}

interface PlaceOption {
  slug: string;
  name: string;
  type_slug: string;
}

interface SectorOption {
  slug: string;
  name: string;
}

interface Visibility {
  slug: string;
  name: string;
  description: string;
}

/**
 * Purposes offered here. `matching` is required and not rendered as a choice:
 * a declaration exists in order to be routed, so consenting to declare and
 * refusing to be matched is incoherent. It is still written as its own row with
 * a policy version, because Act 843 wants the record, not the inference.
 */
const OPTIONAL_CONSENTS = [
  "directory_visibility",
  "programme_updates",
  "institutional_discoverability",
] as const;

const POLICY_VERSION = "v1.0";

/**
 * `Select` is a flex shell, so it lays out as a block and the sentence would
 * stack into four rows. Its own `style` prop is spread last, so the display mode
 * is set through the documented seam rather than by editing the component.
 * `TAP_CONTROL` keeps every one of them at the 48px tap target.
 */
const SENTENCE_CONTROL: CSSProperties = {
  ...TAP_CONTROL,
  display: "inline-flex",
  verticalAlign: "baseline",
};

function DeclarePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [visibilities, setVisibilities] = useState<Visibility[]>([]);

  const [direction, setDirection] = useState<Direction>("offer");
  const [pathway, setPathway] = useState("serve");
  const [place, setPlace] = useState("");
  const [sector, setSector] = useState("");
  const [headline, setHeadline] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("members");
  const [consents, setConsents] = useState<string[]>(["directory_visibility"]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vocabularies come from the database, never from a constant in this file.
  // Adding a pathway or a sector is a row, and this screen picks it up.
  useEffect(() => {
    void (async () => {
      const [p, pl, s, v] = await Promise.all([
        supabase
          .from("pathways")
          .select("slug, offer_label, seek_label")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("places")
          .select("slug, name, type_slug")
          .eq("is_published", true)
          .in("type_slug", ["country", "region"])
          .order("name"),
        supabase
          .from("sectors")
          .select("slug, name")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("declaration_visibilities")
          .select("slug, name, description")
          .order("sort_order"),
      ]);

      if (p.data) setPathways(p.data);
      if (pl.data) setPlaces(pl.data);
      if (s.data) setSectors(s.data);
      if (v.data) setVisibilities(v.data);
      if (pl.data?.length) {
        // Runs once, before a member has touched the control, so there is no
        // choice here to overwrite.
        const ghana = pl.data.find((x) => x.type_slug === "country");
        setPlace(ghana?.slug ?? pl.data[0].slug);
      }
      setLoading(false);
    })();
    // Runs once. The vocabularies do not change while the screen is open.
  }, []);

  const pathwayLabel = useMemo(
    () => (slug: string) => {
      const found = pathways.find((x) => x.slug === slug);
      if (!found) return slug;
      return direction === "offer" ? found.offer_label : found.seek_label;
    },
    [pathways, direction],
  );

  const ready = headline.trim().length >= 3 && place.length > 0 && !busy;

  const submit = async () => {
    setError(null);
    setBusy(true);

    const { data, error: rpcError } = await supabase.rpc("activate_with_declaration", {
      p_consents: ["matching", ...consents],
      p_policy_version: POLICY_VERSION,
      p_direction: direction,
      p_pathway: pathway,
      p_place: place,
      p_headline: headline.trim(),
      p_sector: sector || undefined,
      p_capacity_note: note.trim() || undefined,
      p_months: 18,
      p_visibility: visibility,
    });

    setBusy(false);

    if (rpcError || !data) {
      setError(t("declare.failed"));
      return;
    }

    // /home is the dashboard. There has never been a /dashboard route, so this
    // landed a member on a 404 at the one moment the platform had something to
    // show them: the declaration they had just made.
    void navigate({ to: localePath(locale, "/home") });
  };

  const setConsent = (slug: string, next: boolean) =>
    setConsents((current) =>
      next
        ? current.includes(slug)
          ? current
          : [...current, slug]
        : current.filter((x) => x !== slug),
    );

  return (
    <div style={{ minHeight: "100vh" }}>
      <PanBand />
      <main
        style={{
          maxWidth: "var(--measure-narrow)",
          margin: "0 auto",
          padding: "var(--space-16) var(--gutter) var(--space-20)",
        }}
      >
        <SectionHeader title={t("declare.heading")} lede={t("declare.lede")} />

        {loading ? (
          <p className="r17-notice" role="status" style={{ marginTop: "var(--space-6)" }}>
            {t("declare.loading")}
          </p>
        ) : (
          <>
            {/*
              The sentence. Four controls, four fields, one line of prose. The
              select elements sit inline so the member reads what they are
              saying rather than filling boxes.
            */}
            <p style={{ marginTop: "var(--space-8)", font: "var(--type-title)" }}>
              {t("declare.sentence.iAm")}{" "}
              <Select
                aria-label={t("declare.field.direction")}
                value={direction}
                style={SENTENCE_CONTROL}
                onChange={(e) => setDirection(e.target.value as Direction)}
              >
                <option value="offer">{t("declare.direction.offer")}</option>
                <option value="seek">{t("declare.direction.seek")}</option>
              </Select>{" "}
              <Select
                aria-label={t("declare.field.pathway")}
                value={pathway}
                style={SENTENCE_CONTROL}
                onChange={(e) => setPathway(e.target.value)}
              >
                {pathways.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {pathwayLabel(p.slug)}
                  </option>
                ))}
              </Select>{" "}
              {t("declare.sentence.in")}{" "}
              <Select
                aria-label={t("declare.field.place")}
                value={place}
                style={SENTENCE_CONTROL}
                onChange={(e) => setPlace(e.target.value)}
              >
                {places.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </Select>{" "}
              {t("declare.sentence.around")}{" "}
              <Select
                aria-label={t("declare.field.sector")}
                value={sector}
                style={SENTENCE_CONTROL}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="">{t("declare.sector.any")}</option>
                {sectors.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {t("declare.sentence.stop")}
            </p>

            <div style={{ marginTop: "var(--space-8)", display: "grid", gap: "var(--space-4)" }}>
              <Field label={t("declare.headline.label")} hint={t("declare.headline.hint")}>
                <Input
                  type="text"
                  maxLength={140}
                  value={headline}
                  style={TAP_CONTROL}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </Field>

              <Field label={t("declare.note.label")} hint={t("declare.note.hint")}>
                <Textarea
                  rows={3}
                  maxLength={600}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>

              <Field label={t("declare.visibility.label")}>
                <Select
                  value={visibility}
                  style={TAP_CONTROL}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  {visibilities.map((v) => (
                    <option key={v.slug} value={v.slug}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div style={{ marginTop: "var(--space-10)" }}>
              <h2 style={{ font: "var(--type-subtitle)" }}>{t("declare.consent.heading")}</h2>
              <p
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                {t("declare.consent.matchingRequired")}
              </p>

              <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-3)" }}>
                {OPTIONAL_CONSENTS.map((slug) => (
                  <Switch
                    key={slug}
                    checked={consents.includes(slug)}
                    onChange={(next) => setConsent(slug, next)}
                    label={t(`declare.consent.${slug}`)}
                  />
                ))}
              </div>
            </div>

            {error ? (
              <p
                className="r17-notice"
                data-tone="alert"
                role="alert"
                style={{ marginTop: "var(--space-6)" }}
              >
                {error}
              </p>
            ) : null}

            <div style={{ marginTop: "var(--space-8)" }}>
              <Button size="lg" onClick={() => void submit()} disabled={!ready}>
                {busy ? t("declare.submitting") : t("declare.submit")}
              </Button>
            </div>

            <p
              style={{
                marginTop: "var(--space-6)",
                fontSize: "var(--text-body-sm)",
                color: "var(--text-muted)",
              }}
            >
              {t("declare.window")}
            </p>
          </>
        )}

        {/* Safety control, not decoration. Its wording is fixed. */}
        <p
          className="r17-cite"
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--text-muted)",
            marginTop: "var(--space-12)",
          }}
        >
          {t("legal.notAGovernmentDocument")}
        </p>
      </main>
    </div>
  );
}
