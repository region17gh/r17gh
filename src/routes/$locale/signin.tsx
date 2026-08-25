import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button, Field, Input, PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { TAP_CONTROL } from "@/components/join/steps/shared";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/signin")({
  head: () => ({ meta: [{ title: "Sign in | Region 17" }] }),
  component: SignInPage,
});

/**
 * Returning members only.
 *
 * `shouldCreateUser` is false on purpose: signing in must never quietly mint a
 * new auth account with no member record behind it. Someone who has not joined
 * is sent to /join, which is the only path that issues a number.
 */
function SignInPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const address = email.trim();
    if (!address || !address.includes("@")) {
      setError(t("signin.failed"));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${localePath(locale, "/home")}`,
      },
    });
    setBusy(false);
    if (sendError) {
      setError(t("signin.failed"));
      return;
    }
    setSent(true);
  };

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
        <h1 style={{ font: "var(--type-section)" }}>{t("signin.heading")}</h1>
        <p style={{ marginTop: "var(--space-4)", color: "var(--text-muted)" }}>{t("signin.lede")}</p>

        {sent ? (
          <p className="r17-notice" role="status" style={{ marginTop: "var(--space-6)" }}>
            {t("signin.sent", { email: email.trim() })}
          </p>
        ) : (
          <div style={{ marginTop: "var(--space-8)", display: "grid", gap: "var(--space-4)" }}>
            <Field label={t("signin.emailLabel")} error={error ?? undefined}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                style={TAP_CONTROL}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <div>
              <Button size="lg" onClick={() => void send()} disabled={busy}>
                {busy ? t("signin.sending") : t("signin.send")}
              </Button>
            </div>
          </div>
        )}

        <p style={{ marginTop: "var(--space-8)", fontSize: "var(--text-body-sm)" }}>
          {t("signin.notAMember")} <Link to={localePath(locale, "/join")}>{t("signin.join")}</Link>
        </p>

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
