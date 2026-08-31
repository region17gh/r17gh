import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Credential } from "@/components/join/Credential";
import {
  Button,
  Card,
  PanBand,
  SectionHeader,
} from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { downloadCredentialPdf } from "@/lib/credential/pdf";
import { sendWelcomeEmail } from "@/server/welcome";
import {
  fetchCurrentMember,
  fetchFoundingCutoff,
  type MemberRow,
} from "@/lib/member/membership";

export const Route = createFileRoute("/$locale/home")({
  head: () => ({ meta: [{ title: "Your membership | Region 17" }] }),
  component: HomePage,
});

/**
 * The signed-in member's page: their standing, and their work.
 *
 * Previously this rendered `member_intent` — one free-text ask and one offer.
 * That table is superseded by `declarations`, which are scoped to a place,
 * bounded by a window, and the only thing the matching engine can see. A member
 * who had just declared saw an empty ask-and-offer section here and could
 * reasonably conclude nothing had saved.
 *
 * Everything else stays: the credential and its PDF, the pending-verification
 * prompt, sign out, and the welcome-email safety net.
 *
 * One call, `member_dashboard()`, returns the whole page. It runs security
 * invoker, so RLS decides what comes back and this component cannot see past it.
 */

interface Ladder {
  watching: number;
  declared: number;
  dormant: number;
  expressed: number;
  in_review: number;
  matched: number;
  active: number;
  delivered: number;
}

interface Attention {
  unread_notifications: number;
  new_matches: number;
  lapsing_soon: number;
  awaiting_response: number;
}

interface DeclarationRow {
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

interface MatchRow {
  id: string;
  title: string;
  direction: "offer" | "seek";
  place: string;
  place_name: string;
  sector: string | null;
  score: number;
  reasons: string[];
  because: string;
  state: string;
}

interface EngagementRow {
  id: string;
  title: string;
  state: string;
  state_name: string;
  place_name: string;
  participants: number;
  opened_at: string;
  review_due_at: string;
  held_until: string | null;
}

interface WatchingRow {
  slug: string;
  name: string;
  url_path: string;
  notify: boolean;
  postings: number;
  last_activity: string | null;
}

interface PerkRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  starts_at: string | null;
  place_name: string | null;
  list_price: number | null;
  currency: string | null;
  perk_kind: string | null;
  discount_percent: number | null;
}

interface DashboardData {
  ladder: Ladder;
  attention: Attention;
  declarations: DeclarationRow[];
  matches: MatchRow[];
  engagements: EngagementRow[];
  watching: WatchingRow[];
  perks: PerkRow[];
}

function HomePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const [member, setMember] = useState<MemberRow | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
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

      const { data: dashboard } = await supabase.rpc("member_dashboard");
      if (dashboard) setDash(dashboard as unknown as DashboardData);
      setLoading(false);

      // The welcome email's safety net. /verify fires the send the moment a
      // record activates, but that call is made by a browser, and a browser
      // that is closed a second later never makes it. The send is claimed once
      // on the record, so this is a no-op for every member who already has
      // theirs: it returns already_sent without touching Resend.
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

  const declarations = dash?.declarations ?? [];
  const matches = dash?.matches ?? [];
  const engagements = dash?.engagements ?? [];
  const watching = dash?.watching ?? [];
  const perks = dash?.perks ?? [];
  const attention = dash?.attention;

  // Quiet members lead with the places they follow, never with four zeros. A
  // dashboard should not open as a list of things you have not done.
  const waiting = attention
    ? attention.new_matches +
      attention.awaiting_response +
      attention.lapsing_soon +
      attention.unread_notifications
    : 0;

  const daysUntil = (iso: string) => {
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 0 : days;
  };

  const daysSince = (iso: string | null) => {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  };

  /*
    Counts below pick a key rather than interpolate into one. `translate.ts` is
    a placeholder substitution with no plural rule in it, so "{days} days" is
    "1 days" the day before a declaration lapses. Every counted string on this
    page therefore has a one and a zero of its own.
  */

  /** How long a declaration has left, in the words that length deserves. */
  const declarationNote = (d: DeclarationRow) => {
    if (!d.lapsing) {
      return d.days_left === 1
        ? t("home.declarationRunsOne")
        : t("home.declarationRuns", { days: d.days_left });
    }
    if (d.days_left <= 0) return t("home.declarationLapsingToday");
    if (d.days_left === 1) return t("home.declarationLapsingOne");
    return t("home.declarationLapsing", { days: d.days_left });
  };

  /** The answer Region 17 owes, and when. */
  const reviewNote = (e: EngagementRow) => {
    const days = daysUntil(e.review_due_at);
    if (days === 0) return t("home.inReviewBodyToday");
    if (days === 1) return t("home.inReviewBodyOne");
    return t("home.inReviewBody", { days });
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
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.pendingHeading")}</h2>
            <p style={{ marginTop: "var(--space-2)" }}>{t("home.pendingBody")}</p>
            <p style={{ marginTop: "var(--space-3)" }}>
              <Link to={localePath(locale, "/verify")} style={{ borderBottom: "none" }}>
                <Button size="lg">{t("home.pendingAction")}</Button>
              </Link>
            </p>
          </div>
        ) : null}

        {/* Nothing declared yet: the engine cannot see this member at all. */}
        {!pending && declarations.length === 0 ? (
          <div
            className="r17-notice"
            role="status"
            style={{ marginTop: "var(--space-6)", textAlign: "left" }}
          >
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.declareHeading")}</h2>
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
          <h2 className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
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
            <p
              className="r17-notice"
              data-tone="alert"
              role="alert"
              style={{ marginTop: "var(--space-3)" }}
            >
              {t("home.downloadFailed")}
            </p>
          ) : null}
        </Card>

        {/*
          Matches. The one thing on this page that asks something of the member,
          so it sits above everything except their standing. `because` and
          `reasons` come from the database: a member who cannot see why they
          were matched will not trust the next one.
        */}
        {matches.length > 0 ? (
          <section style={{ marginTop: "var(--space-10)" }}>
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.matchesHeading")}</h2>
            <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" }}>
              {matches.map((m) => (
                <Card key={m.id} elevation={0} padding="var(--space-6)">
                  <p className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {m.place_name} ·{" "}
                    {m.direction === "seek" ? t("home.matchAsking") : t("home.matchOffering")}
                  </p>
                  <h3 style={{ font: "var(--type-subtitle)", marginTop: "var(--space-2)" }}>
                    {m.title}
                  </h3>
                  <p style={{ marginTop: "var(--space-3)" }}>
                    {t("home.matchBecause", { headline: m.because })}
                  </p>
                  <ul
                    className="r17-cite"
                    style={{
                      marginTop: "var(--space-3)",
                      color: "var(--text-muted)",
                      listStyle: "none",
                      padding: 0,
                    }}
                  >
                    {m.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/*
          Engagements in review. The copy states the promise the database is
          already holding: three exits, none of them a bare no.
        */}
        {engagements.length > 0 ? (
          <section style={{ marginTop: "var(--space-10)" }}>
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.underwayHeading")}</h2>
            <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" }}>
              {engagements.map((e) => (
                <Card key={e.id} elevation={0} padding="var(--space-6)">
                  <p className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {e.place_name} · {e.state_name}
                  </p>
                  <h3 style={{ font: "var(--type-subtitle)", marginTop: "var(--space-2)" }}>
                    {e.title}
                  </h3>
                  {e.state === "in-review" ? (
                    <p style={{ marginTop: "var(--space-3)" }}>{reviewNote(e)}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* Declarations, replacing the member_intent ask and offer. */}
        {declarations.length > 0 ? (
          <section style={{ marginTop: "var(--space-10)" }}>
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.declarationsHeading")}</h2>
            <dl style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-5)" }}>
              {declarations.map((d) => (
                <div key={d.id}>
                  <dt className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {d.direction === "offer" ? t("home.offerLabel") : t("home.askLabel")} ·{" "}
                    {d.place_name}
                  </dt>
                  <dd style={{ margin: "var(--space-2) 0 0" }}>{d.headline}</dd>
                  <p
                    className="r17-cite"
                    style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}
                  >
                    {declarationNote(d)}
                  </p>
                </div>
              ))}
            </dl>
            <p style={{ marginTop: "var(--space-4)" }}>
              <Link to={localePath(locale, "/declare")} style={{ borderBottom: "none" }}>
                <Button size="lg" variant="secondary">
                  {t("home.declareAnother")}
                </Button>
              </Link>
            </p>
          </section>
        ) : null}

        {/* Where they are watching. Leads when nothing is waiting on them. */}
        {watching.length > 0 ? (
          <section style={{ marginTop: "var(--space-10)" }}>
            <h2 style={{ font: "var(--type-subtitle)" }}>
              {waiting === 0 ? t("home.watchingLeadHeading") : t("home.watchingHeading")}
            </h2>
            <ul
              style={{
                marginTop: "var(--space-4)",
                display: "grid",
                gap: "var(--space-3)",
                listStyle: "none",
                padding: 0,
              }}
            >
              {watching.map((w) => {
                const days = daysSince(w.last_activity);
                const open =
                  w.postings === 0
                    ? t("home.watchingPostingsNone")
                    : w.postings === 1
                      ? t("home.watchingPostingsOne")
                      : t("home.watchingPostings", { count: w.postings });
                const moved =
                  days === null
                    ? null
                    : days === 0
                      ? t("home.watchingLastActivityToday")
                      : days === 1
                        ? t("home.watchingLastActivityOne")
                        : t("home.watchingLastActivity", { days });
                return (
                  <li key={w.slug}>
                    {/*
                      The place's name, not a link to it. `places.url_path` is a
                      full path ("greater-accra/accra-metropolitan") and there is
                      no route that serves one yet, so a link here would be a
                      404 on every row. This becomes a Link the day the place
                      route lands; nothing else about the row changes.
                    */}
                    {w.name}
                    <span
                      className="r17-cite"
                      style={{ color: "var(--text-muted)", marginLeft: "var(--space-3)" }}
                    >
                      {open}
                      {moved === null ? "" : ` · ${moved}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* What membership is worth. Free to join, free to keep; perks are the price difference. */}
        {perks.length > 0 ? (
          <section style={{ marginTop: "var(--space-10)" }}>
            <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.perksHeading")}</h2>
            <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" }}>
              {perks.map((p) => {
                const memberPrice =
                  p.perk_kind === "free"
                    ? t("home.perkFree")
                    : p.perk_kind === "member-only"
                      ? t("home.perkMemberOnly")
                      : p.discount_percent && p.list_price
                        ? `${p.currency} ${Math.round(p.list_price * (1 - p.discount_percent / 100))}`
                        : p.list_price
                          ? `${p.currency} ${p.list_price}`
                          : null;
                return (
                  <Card key={p.id} elevation={0} padding="var(--space-6)">
                    <p className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                      {p.type}
                      {p.place_name ? ` · ${p.place_name}` : ""}
                    </p>
                    <h3 style={{ font: "var(--type-subtitle)", marginTop: "var(--space-2)" }}>
                      {p.title}
                    </h3>
                    <p style={{ marginTop: "var(--space-2)", color: "var(--text-muted)" }}>
                      {p.summary}
                    </p>
                    {memberPrice ? (
                      <p className="r17-cite" style={{ marginTop: "var(--space-3)" }}>
                        {p.list_price
                          ? t("home.perkPrice", {
                              list: `${p.currency} ${Math.round(p.list_price)}`,
                              member: memberPrice,
                            })
                          : memberPrice}
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        <section style={{ marginTop: "var(--space-10)" }}>
          <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.townhallHeading")}</h2>
          <p style={{ marginTop: "var(--space-3)", color: "var(--text-muted)" }}>
            {t("home.townhallBody")}
          </p>
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
