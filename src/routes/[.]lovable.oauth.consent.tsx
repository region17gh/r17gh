import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button, Card, Field, Input, PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";

type OAuthResult = { redirect_url?: string; redirect_to?: string; client?: { name?: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser only: the Supabase client reads its session from local storage,
  // which does not exist on the SSR pass.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Missing authorization_id");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { signedIn: false as const, details: null };

    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return { signedIn: true as const, details: data };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <Shell>
      <p role="alert" style={{ font: "var(--text-body)", color: "var(--pan-red)" }}>
        We could not load this authorisation request: {String((error as Error)?.message ?? error)}
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper-050)" }}>
      <PanBand />
      <main
        style={{
          maxWidth: "var(--measure-narrow)",
          marginInline: "auto",
          paddingTop: "var(--space-16)",
          paddingBottom: "var(--space-16)",
          paddingInline: "var(--space-5)",
        }}
      >
        <Card>{children}</Card>
      </main>
    </div>
  );
}

function Consent() {
  const state = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: decideError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The authorisation server returned no redirect.");
      return;
    }
    window.location.href = target;
  }

  if (!state.signedIn) {
    return (
      <Shell>
        <h1 style={{ font: "var(--text-title-1)", fontFamily: "var(--font-display)", marginTop: "var(--space-0)" }}>
          Sign in to continue
        </h1>
        <p style={{ font: "var(--text-body)", color: "var(--ink-700)" }}>
          We send a sign-in link to the email address on your member record. Open it on this device and you will return
          to this approval screen.
        </p>
        {sent ? (
          <p style={{ font: "var(--text-body)" }} role="status">
            Check {email} for the sign-in link.
          </p>
        ) : (
          <form onSubmit={sendLink}>
            <Field label="Email address" htmlFor="consent-email">
              <Input
                id="consent-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <div style={{ marginTop: "var(--space-5)" }}>
              <Button type="submit" disabled={busy}>
                Send sign-in link
              </Button>
            </div>
          </form>
        )}
        {error ? (
          <p role="alert" style={{ font: "var(--text-body-sm)", color: "var(--pan-red)", marginTop: "var(--space-4)" }}>
            {error}
          </p>
        ) : null}
      </Shell>
    );
  }

  const clientName = state.details?.client?.name ?? "this application";

  return (
    <Shell>
      <h1 style={{ font: "var(--text-title-1)", fontFamily: "var(--font-display)", marginTop: "var(--space-0)" }}>
        Connect {clientName} to your Region 17 account
      </h1>
      <p style={{ font: "var(--text-body)", color: "var(--ink-700)" }}>
        {clientName} will be able to read your own member record, your consent history, and the reference list of Ghana's
        regions, acting as you. It cannot read other members' records and it cannot change yours. You can revoke this at
        any time.
      </p>
      <p style={{ font: "var(--text-body-sm)", color: "var(--ink-700)" }}>
        Region 17 membership is a standing in a community. It is not a government document and confers no citizenship,
        residence, visa, or right of entry.
      </p>
      {error ? (
        <p role="alert" style={{ font: "var(--text-body-sm)", color: "var(--pan-red)" }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-6)", flexWrap: "wrap" }}>
        <Button disabled={busy} onClick={() => decide(true)}>
          Approve
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>
          Deny
        </Button>
      </div>
    </Shell>
  );
}
