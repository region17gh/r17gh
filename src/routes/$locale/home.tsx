import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Credential } from "@/components/join/Credential";
import { Button, Card, PanBand, SectionHeader } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmail } from "@/server/welcome";
import {
  fetchCurrentMember,
  fetchFoundingCutoff,
  fetchIntent,
  type MemberIntent,
  type MemberRow,
} from "@/lib/member/membership";

export const Route = createFileRoute("/$locale/home")({
  head: () => ({ meta: [{ title: "Your membership | Region 17" }] }),
  component: HomePage,
});

/**
 * The first session. Deliberately minimal: the credential, what is still
 * outstanding, and the one thing worth doing next.
 */
function HomePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberRow | null>(null);
  const [intent, setIntent] = useState<MemberIntent>({ ask: null, offer: null });
  const [cutoff, setCutoff] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        void navigate({ to: localePath(locale, "/signin") });
        return;
      }
      const current = await fetchCurrentMember().catch(() => null);
      if (!current) {
        void navigate({ to: localePath(locale, "/join") });
        return;
      }
      setMember(current);
      setCutoff(await fetchFoundingCutoff());
      setIntent(await fetchIntent(current.id).catch(() => ({ ask: null, offer: null })));
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

        <section
          style={{
            marginTop: "var(--space-8)",
            padding: "var(--space-8) var(--space-6)",
            border: "var(--border-width) solid var(--border-hairline)",
            borderRadius: "var(--radius-card)",
            background: "var(--surface-card)",
            textAlign: "center",
          }}
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
            <p className="r17-cite" style={{ marginTop: "var(--space-5)", color: "var(--navy-700)" }}>
              {t("join.step4.handlePrefix")}
              {member.handle}
            </p>
          ) : null}
        </section>

        <section style={{ marginTop: "var(--space-10)" }}>
          <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.askOfferHeading")}</h2>
          {intent.ask || intent.offer ? (
            <dl style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" }}>
              {intent.ask ? (
                <div>
                  <dt className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {t("home.askLabel")}
                  </dt>
                  <dd style={{ margin: "var(--space-2) 0 0" }}>{intent.ask}</dd>
                </div>
              ) : null}
              {intent.offer ? (
                <div>
                  <dt className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
                    {t("home.offerLabel")}
                  </dt>
                  <dd style={{ margin: "var(--space-2) 0 0" }}>{intent.offer}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p
              style={{
                marginTop: "var(--space-3)",
                color: "var(--text-muted)",
                maxWidth: "var(--measure-narrow)",
              }}
            >
              {t("home.askOfferEmpty")}
            </p>
          )}
        </section>

        <section style={{ marginTop: "var(--space-10)" }}>
          <h2 style={{ font: "var(--type-subtitle)" }}>{t("home.townhallHeading")}</h2>
          <p style={{ marginTop: "var(--space-3)", color: "var(--text-muted)" }}>
            {t("home.townhallBody")}
          </p>
        </section>

        <section className="r17-next" style={{ marginTop: "var(--space-10)" }}>
          <h2 className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
            {t("home.nextHeading")}
          </h2>
          <ol style={{ marginTop: "var(--space-3)" }}>
            <li>{t("join.issued.nextOne")}</li>
            <li>{t("join.issued.nextTwo")}</li>
            <li>{t("join.issued.nextThree")}</li>
          </ol>
        </section>

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
