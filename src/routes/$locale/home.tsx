import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Credential } from "@/components/join/Credential";
import { Badge, Button, Card, PanBand, SectionHeader } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { downloadCredentialPdf } from "@/lib/credential/pdf";
import { sendWelcomeEmail } from "@/server/welcome";
import { fetchCurrentMember, fetchFoundingCutoff, type MemberRow } from "@/lib/member/membership";

export const Route = createFileRoute("/$locale/home")({
  head: () => ({ meta: [{ title: "Your membership | Region 17" }] }),
  component: HomePage,
});

/**
 * The member's standing dashboard.
 *
 * This page used to render `member_intent`: one free-text ask, one free-text
 * offer. That table is superseded by `declarations`, which are scoped to a
 * place, bounded by a window, carry a pathway and a sector, and are the only
 * thing the matching engine can see. `member_intent` still exists in the
 * database, commented as superseded the way `chapter_roles` is; what stopped is
 * rendering it. A member who has just used /declare now reads their declaration
 * here rather than an empty ask-and-offer section.
 *
 * Everything on the page below the credential comes from one call to
 * `member_dashboard()`, which composes matches, engagements, declarations,
 * watched places and perks in a single statement so the page makes one request
 * rather than six. It is a plain STABLE function, so RLS still decides what a
 * member can see.
 */

/** One member-visible section fails quietly: a null dashboard renders nothing. */
interface DashboardDeclaration {
  id: string;
  direction: "offer" | "seek";
  headline: string;
  pathway: string;
  sector: string | null;
  place: string;
  place_name: string;
  visibility: string;
  state: string;
  available_until: string;
  days_left: number;
  lapsing: boolean;
}

interface DashboardMatch {
  id: string;
  title: string;
  direction: string;
  place: string;
  place_name: string;
  sector: string | null;
  score: number;
  reasons: string[] | null;
  /** The member's own declaration headline, so a match says why it arrived. */
  because: string;
  state: string;
}

interface DashboardEngagement {
  id: string;
  title: string;
  state: string;
  state_name: string;
  place: string;
  place_name: string;
  participants: number;
  opened_at: string;
  review_due_at: string | null;
  held_until: string | null;
  note: string | null;
}

interface DashboardWatch {
  slug: string;
  name: string;
  type: string;
  url_path: string | null;
  notify: boolean;
  postings: number;
  last_activity: string | null;
}

interface DashboardPerk {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  type: string;
  starts_at: string | null;
  place_name: string | null;
  list_price: number | null;
  currency: string | null;
  perk_kind: string | null;
  discount_percent: number | null;
}

interface DashboardData {
  member_id: string | null;
  declarations: DashboardDeclaration[];
  matches: DashboardMatch[];
  engagements: DashboardEngagement[];
  watching: DashboardWatch[];
  perks: DashboardPerk[];
}

/**
 * The house date and money locale.
 *
 * The copy is British English and dates are written "14 March 2027" wherever
 * they appear. Intl's bare "en" renders the American order, so the region is
 * named rather than left to the runtime. This mirrors `DATE_LOCALE` in
 * `lib/foundingWindow.ts` and `lib/email/welcome.ts`.
 */
const DATE_LOCALE: Record<string, string> = { en: "en-GB" };

function formatDay(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(DATE_LOCALE[locale] ?? locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

const SECTION: React.CSSProperties = { marginTop: "var(--space-10)" };
const SUBTITLE: React.CSSProperties = { font: "var(--type-subtitle)" };
const MUTED: React.CSSProperties = { color: "var(--text-muted)" };
const STACK: React.CSSProperties = { marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" };
const META: React.CSSProperties = {
  marginTop: "var(--space-2)",
  fontSize: "var(--text-body-sm)",
  color: "var(--text-muted)",
};

function HomePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberRow | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardFailed, setDashboardFailed] = useState(false);
  const [cutoff, setCutoff] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        void navigate({ to: localePath(locale, "/signin") });
        return;
      }
      const current = await fetchCurrentMember().catch(() => null);
      if (!current) {
        void navigate({ to: localePath(locale, "/join/register") });
        return;
      }
      setMember(current);
      setCutoff(await fetchFoundingCutoff());

      // `member_dashboard()` returns jsonb, so supabase-js types it as Json.
      // The shape is the function's own jsonb_build_object, which the generated
      // types cannot describe; the interfaces above are that shape.
      const { data: rows, error } = await supabase.rpc("member_dashboard");
      if (error || !rows) setDashboardFailed(true);
      else setDashboard(rows as unknown as DashboardData);

      setLoading(false);

      // The welcome email's safety net. /verify fires the send the moment a
      // record activates, but that call is made by a browser, and a browser
      // that is closed a second later never makes it. The send is claimed once
      // on the record, so this is a no-op for every member who already has
      // theirs: it returns already_sent without touching Resend. It costs one
      // request on a page that is already making three, and it is the
      // difference between a member missing their credential email and not.
      if (current.status === "active") {
        void sendWelcomeEmail({ data: { locale } }).catch(() => undefined);
      }
    })();
  }, [locale, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: localePath(locale, "/signin") });
  };

  const downloadCredential = async () => {
    if (!member) return;
    setDownloadFailed(false);
    setDownloading(true);
    try {
      await downloadCredentialPdf(
        {
          memberNumber: member.member_number,
          credentialId: member.credential_id,
          firstName: member.first_name,
          lastName: member.last_name,
          foundingMember: member.founding_member,
          classYear: member.class_year,
          handle: member.handle,
        },
        locale,
      );
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  if (loading || !member) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <PanBand />
        <main style={{ padding: "var(--space-16) var(--gutter)" }}>
          <p>{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  const pending = member.status === "pending_verification" || !member.email_verified_at;
  const name = member.first_name ?? t("join.issued.fallbackName");

  const declarations = dashboard?.declarations ?? [];
  const matches = dashboard?.matches ?? [];
  const engagements = dashboard?.engagements ?? [];
  const watching = dashboard?.watching ?? [];
  const perks = dashboard?.perks ?? [];

  // Nothing declared is the one state that blocks everything downstream: the
  // engine cannot see a member who holds no declaration. It is asked for before
  // the credential, and only once the address is confirmed.
  const nothingDeclared = !pending && dashboard !== null && declarations.length === 0;

  // The watching heading turns on whether anything is actually waiting. A
  // member with quiet regions reads what is moving rather than a list of things
  // they have not done.
  const anythingWaiting = watching.some((w) => w.postings > 0);

  /** How long a live declaration has left, in the words that length deserves. */
  const lapseNote = (d: DashboardDeclaration): string | null => {
    if (d.state === "dormant") return t("home.declarationDormant");
    if (d.state !== "active") return t("home.declarationLapsed");
    if (d.days_left < 0) return t("home.declarationLapsed");
    if (!d.lapsing) return null;
    if (d.days_left === 0) return t("home.declarationLapsingToday");
    if (d.days_left === 1) return t("home.declarationLapsingOne");
    return t("home.declarationLapsing", { days: d.days_left });
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <PanBand />
      <main
        style={{
          maxWidth: "var(--measure-prose)",
          margin: "0 auto",
          padding: "var(--space-12) var(--gutter) var(--space-20)",
        }}
      >
        <SectionHeader
          title={t("home.heading", { name })}
          action={
            <Button size="lg" variant="ghost" onClick={() => void signOut()}>
              {t("home.signOut")}
            </Button>
          }
        />

        {pending ? (
          <div
            className="r17-notice"
            role="status"
            style={{ marginTop: "var(--space-6)", textAlign: "left" }}
          >
            <h2 style={SUBTITLE}>{t("home.pendingHeading")}</h2>
            <p style={{ marginTop: "var(--space-2)" }}>{t("home.pendingBody")}</p>
            <p style={{ marginTop: "var(--space-3)" }}>
              <Link to={localePath(locale, "/verify")} style={{ borderBottom: "none" }}>
                <Button size="lg">{t("home.pendingAction")}</Button>
              </Link>
            </p>
          </div>
        ) : null}

        {nothingDeclared ? (
          <div
            className="r17-notice"
            role="status"
            style={{ marginTop: "var(--space-6)", textAlign: "left" }}
          >
            <h2 style={SUBTITLE}>{t("home.declareHeading")}</h2>
            <p style={{ marginTop: "var(--space-2)" }}>{t("home.declareBody")}</p>
            <p style={{ marginTop: "var(--space-3)" }}>
              <Link to={localePath(locale, "/declare")} style={{ borderBottom: "none" }}>
                <Button size="lg">{t("home.declareAction")}</Button>
              </Link>
            </p>
          </div>
        ) : null}

        <Card
          elevation={0}
          padding="var(--space-8) var(--space-6)"
          style={{ marginTop: "var(--space-8)", textAlign: "center" }}
        >
          <h2 className="r17-eyebrow" style={MUTED}>
            {t("home.credentialHeading")}
          </h2>
          <Credential
            memberNumber={member.member_number}
            credentialId={member.credential_id}
            foundingMember={member.founding_member}
            classYear={member.class_year}
            cutoff={cutoff}
            locale={locale}
          />
          {member.handle && !pending ? (
            <p className="r17-cite" style={{ marginTop: "var(--space-5)" }}>
              {t("join.step4.handlePrefix")}
              {member.handle}
            </p>
          ) : null}

          <p style={{ marginTop: "var(--space-6)" }}>
            <Button
              size="lg"
              variant="secondary"
              icon="download"
              onClick={() => void downloadCredential()}
              disabled={downloading}
            >
              {downloading ? t("home.downloadingCredential") : t("home.downloadCredential")}
            </Button>
          </p>
          {downloadFailed ? (
            <p className="r17-notice" data-tone="alert" role="alert" style={{ marginTop: "var(--space-3)" }}>
              {t("home.downloadFailed")}
            </p>
          ) : null}
        </Card>

        {dashboardFailed ? (
          <p
            className="r17-notice"
            data-tone="alert"
            role="alert"
            style={{ marginTop: "var(--space-8)", textAlign: "left" }}
          >
            {t("home.dashboardFailed")}
          </p>
        ) : null}

        {/*
          Matches sit above everything else on the page because they are the
          only thing here that asks something of the member. A region has posted
          something their declaration fits, and it waits until they answer.
        */}
        {matches.length > 0 ? (
          <section style={SECTION}>
            <h2 style={SUBTITLE}>{t("home.matchesHeading")}</h2>
            <p style={{ marginTop: "var(--space-2)", ...MUTED }}>{t("home.matchesLede")}</p>
            <div style={STACK}>
              {matches.map((m) => (
                <Card key={m.id} elevation={0} padding="var(--space-5)">
                  <h3 style={SUBTITLE}>{m.title}</h3>
                  <p style={META}>{m.place_name}</p>
                  <p style={{ marginTop: "var(--space-3)" }}>
                    {t("home.matchBecause", { headline: m.because })}
                  </p>
                  {m.reasons && m.reasons.length > 0 ? (
                    <p style={META}>{t("home.matchReasons", { list: m.reasons.join(", ") })}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {engagements.length > 0 ? (
          <section style={SECTION}>
            <h2 style={SUBTITLE}>{t("home.engagementsHeading")}</h2>
            <div style={STACK}>
              {engagements.map((e) => (
                <Card key={e.id} elevation={0} padding="var(--space-5)">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      flexWrap: "wrap",
                    }}
                  >
                    <h3 style={SUBTITLE}>{e.title}</h3>
                    {/* The state's name comes from `engagement_states`, so a new
                        state is a row and this reads it rather than a constant. */}
                    <Badge tone="navy">{e.state_name}</Badge>
                  </div>
                  <p style={META}>
                    {e.place_name}
                    {" — "}
                    {e.participants === 1
                      ? t("home.engagementParticipantsOne")
                      : t("home.engagementParticipants", { count: e.participants })}
                  </p>
                  {e.review_due_at ? (
                    <p style={META}>
                      {t("home.engagementReviewDue", { date: formatDay(e.review_due_at, locale) })}
                    </p>
                  ) : null}
                  {e.held_until ? (
                    <p style={META}>
                      {t("home.engagementHeldUntil", { date: formatDay(e.held_until, locale) })}
                    </p>
                  ) : null}
                  {e.note ? <p style={{ marginTop: "var(--space-3)" }}>{e.note}</p> : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {declarations.length > 0 ? (
          <section style={SECTION}>
            <h2 style={SUBTITLE}>{t("home.declarationsHeading")}</h2>
            <dl style={STACK}>
              {declarations.map((d) => {
                const note = lapseNote(d);
                return (
                  <div key={d.id}>
                    <dt className="r17-eyebrow" style={MUTED}>
                      {d.direction === "seek" ? t("home.askLabel") : t("home.offerLabel")}
                    </dt>
                    <dd style={{ margin: "var(--space-2) 0 0" }}>
                      {d.headline}
                      <span style={{ display: "block", ...META }}>
                        {t("home.declarationsMeta", { pathway: d.pathway, place: d.place_name })}
                      </span>
                      {d.visibility === "members" && member.handle ? (
                        <span style={{ display: "block", ...META }}>
                          {t("home.declarationVisible", { member: member.handle })}
                        </span>
                      ) : null}
                      {note ? (
                        <span style={{ display: "block", ...META }} data-tone="alert">
                          {note}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p style={{ marginTop: "var(--space-5)" }}>
              <Link to={localePath(locale, "/declare")} style={{ borderBottom: "none" }}>
                <Button size="lg" variant="secondary">
                  {t("home.declarationsAdd")}
                </Button>
              </Link>
            </p>
          </section>
        ) : null}

        {watching.length > 0 ? (
          <section style={SECTION}>
            <h2 style={SUBTITLE}>
              {anythingWaiting ? t("home.watchingHeading") : t("home.watchingHeadingQuiet")}
            </h2>
            <dl style={STACK}>
              {watching.map((w) => (
                <div key={w.slug}>
                  <dt style={{ font: "var(--type-body)" }}>{w.name}</dt>
                  <dd style={{ margin: "var(--space-1) 0 0", ...META }}>
                    {w.postings === 0
                      ? t("home.watchingQuiet")
                      : w.postings === 1
                        ? t("home.watchingPostingsOne")
                        : t("home.watchingPostings", { count: w.postings })}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {perks.length > 0 ? (
          <section style={SECTION}>
            <h2 style={SUBTITLE}>{t("home.perksHeading")}</h2>
            <div style={STACK}>
              {perks.map((p) => (
                <Card key={p.id} elevation={0} padding="var(--space-5)">
                  <h3 style={SUBTITLE}>{p.title}</h3>
                  {p.summary ? <p style={{ marginTop: "var(--space-2)" }}>{p.summary}</p> : null}
                  <p style={META}>
                    {p.place_name ? <>{p.place_name} </> : null}
                    {p.starts_at ? t("home.perkStarts", { date: formatDay(p.starts_at, locale) }) : null}
                  </p>
                  {/*
                    The perk line states only what the database holds. The
                    member price is a column on `offering_perks` that
                    `member_dashboard()` does not return, so nothing here
                    computes one: a discount is shown as the discount it is.
                  */}
                  {p.perk_kind === "free" ? (
                    <p style={{ marginTop: "var(--space-2)" }}>
                      <Badge tone="gold">{t("home.perkFree")}</Badge>
                    </p>
                  ) : p.discount_percent ? (
                    <p style={{ marginTop: "var(--space-2)" }}>
                      <Badge tone="gold">
                        {t("home.perkDiscount", { count: p.discount_percent })}
                      </Badge>
                      {p.list_price != null && p.currency ? (
                        <span style={{ marginLeft: "var(--space-2)", ...MUTED }}>
                          {t("home.perkPrice", {
                            amount: formatMoney(p.list_price, p.currency, locale),
                          })}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section style={SECTION}>
          <h2 style={SUBTITLE}>{t("home.townhallHeading")}</h2>
          <p style={{ marginTop: "var(--space-3)", ...MUTED }}>{t("home.townhallBody")}</p>
        </section>

        {/* Safety control, not decoration. Its wording is fixed. */}
        <p
          className="r17-cite"
          style={{
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
