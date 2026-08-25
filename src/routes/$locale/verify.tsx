import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingHandle, loadPendingHandle } from "@/lib/join/draft";
import { checkHandle, normaliseHandle, type HandleProblem } from "@/lib/join/handle";
import { commitVerification, fetchCurrentMember, type MemberRow } from "@/lib/member/membership";

export const Route = createFileRoute("/$locale/verify")({
  head: () => ({ meta: [{ title: "Confirm your email | Region 17" }] }),
  component: VerifyPage,
});

type Phase = "loading" | "signed_out" | "no_member" | "ready" | "done";

/**
 * Email confirmation, and the moment the address goes live.
 *
 * Until this runs a member's status is `pending_verification`: no directory
 * listing, no live handle, no RSVP. The handle chosen at the Compact is written
 * here, which is why an unverified account never holds a public address.
 */
function VerifyPage() {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [member, setMember] = useState<MemberRow | null>(null);
  const [handle, setHandle] = useState("");
  const [problem, setProblem] = useState<HandleProblem | "taken" | "reserved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setPhase("signed_out");
        return;
      }
      const current = await fetchCurrentMember().catch(() => null);
      if (!current) {
        setPhase("no_member");
        return;
      }
      setMember(current);
      // Their own chosen address, held since the Compact. On another device that
      // storage is empty, so they confirm the address here instead.
      setHandle(current.handle ?? loadPendingHandle());
      setPhase(current.status === "active" && current.email_verified_at ? "done" : "ready");
    })();
  }, []);

  const confirm = async () => {
    const issue = checkHandle(handle);
    if (issue) {
      setProblem(issue);
      return;
    }
    setProblem(null);
    setError(null);
    setBusy(true);
    const outcome = await commitVerification(handle);
    setBusy(false);

    switch (outcome.status) {
      case "verified":
        clearPendingHandle();
        setMember(outcome.member);
        setPhase("done");
        break;
      case "handle_taken":
        setProblem("taken");
        break;
      case "handle_reserved":
        setProblem("reserved");
        break;
      case "email_unconfirmed":
        setError(t("verify.emailUnconfirmed"));
        break;
      case "no_member":
        setPhase("no_member");
        break;
      default:
        setError(outcome.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <PanBand />
      <main
        style={{
          maxWidth: "var(--measure-prose)",
          margin: "0 auto",
          padding: "var(--space-16) var(--gutter) var(--space-20)",
        }}
      >
        {phase === "loading" ? <p>{t("common.loading")}</p> : null}

        {phase === "signed_out" ? (
          <>
            <h1 style={{ font: "var(--type-section)" }}>{t("verify.heading")}</h1>
            <p style={{ marginTop: "var(--space-4)", color: "var(--text-muted)" }}>
              {t("verify.emailUnconfirmed")}
            </p>
            <p style={{ marginTop: "var(--space-5)" }}>
              <Link to={localePath(locale, "/signin")}>{t("nav.signIn")}</Link>
            </p>
          </>
        ) : null}

        {phase === "no_member" ? (
          <>
            <h1 style={{ font: "var(--type-section)" }}>{t("verify.heading")}</h1>
            <p style={{ marginTop: "var(--space-4)", color: "var(--text-muted)" }}>
              {t("verify.noMember")}
            </p>
            <p style={{ marginTop: "var(--space-5)" }}>
              <Link to={localePath(locale, "/join")}>{t("verify.toJoin")}</Link>
            </p>
          </>
        ) : null}

        {phase === "ready" ? (
          <>
            <h1 style={{ font: "var(--type-section)" }}>{t("verify.heading")}</h1>
            <p
              style={{
                marginTop: "var(--space-4)",
                color: "var(--text-muted)",
                maxWidth: "var(--measure-narrow)",
              }}
            >
              {t("verify.lede")}
            </p>

            <div style={{ marginTop: "var(--space-8)" }}>
              <h2
                style={{
                  font: "var(--type-meta)",
                  color: "var(--text-strong)",
                  marginBottom: "var(--space-2)",
                }}
              >
                {t("verify.addressLabel")}
              </h2>
              <div className="r17-handle-row" style={{ maxWidth: "var(--measure-narrow)" }}>
                <span className="r17-handle-prefix">{t("join.step4.handlePrefix")}</span>
                <input
                  value={handle}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label={t("verify.addressLabel")}
                  aria-invalid={problem ? true : undefined}
                  placeholder={t("join.step4.handlePlaceholder")}
                  onChange={(e) => setHandle(normaliseHandle(e.target.value))}
                />
              </div>
              {problem ? (
                <p className="r17-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
                  {t(`join.handleErrors.${problem}`)}
                </p>
              ) : (
                <p
                  className="r17-cite"
                  style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}
                >
                  {t("join.step4.handleHint")}
                </p>
              )}
            </div>

            {error ? (
              <p className="r17-notice" data-tone="alert" role="alert">
                {error}
              </p>
            ) : null}

            <p style={{ marginTop: "var(--space-6)" }}>
              <Button size="lg" variant="gold" onClick={() => void confirm()} disabled={busy}>
                {busy ? t("verify.working") : t("verify.confirm")}
              </Button>
            </p>
          </>
        ) : null}

        {phase === "done" && member ? (
          <>
            <h1 style={{ font: "var(--type-section)" }}>{t("verify.successHeading")}</h1>
            <p style={{ marginTop: "var(--space-4)", color: "var(--text-muted)" }}>
              {t("verify.successLede")}
            </p>
            {member.handle ? (
              <p className="r17-cite" style={{ marginTop: "var(--space-5)", color: "var(--navy-700)" }}>
                {t("join.step4.handlePrefix")}
                {member.handle}
              </p>
            ) : null}
            <p style={{ marginTop: "var(--space-6)" }}>
              <Link to={localePath(locale, "/home")} style={{ borderBottom: "none" }}>
                <Button size="lg">{t("verify.toHome")}</Button>
              </Link>
            </p>
          </>
        ) : null}

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
