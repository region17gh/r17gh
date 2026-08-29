import { useEffect, useState } from "react";

import { Button, Field, Input, Select } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { MONTHS, birthYears } from "@/lib/join/age";
import { submitIdentity } from "@/lib/join/identity";
import { GENDERS, type GenderIdentity } from "@/lib/join/options";

import { TAP_CONTROL, type StepProps } from "./shared";

export interface StepWhoYouAreProps extends StepProps {
  onUnderage: () => void;
  /** The code is on its way: the confirmation screen takes it from here. */
  onCodeSent: () => void;
}

/**
 * Who you are, asked first and asked whole.
 *
 * Name, date of birth, email and gender are one screen, because the first
 * thing we ask someone should be who they are, not how old they are or where
 * they live. The age gate has not moved; it runs at submit, before the
 * address is written to the draft and before anything is sent. See
 * `submitIdentity`: an under-18 answer returns from that function having
 * called neither. Gender carries no such gate -- it is optional and never
 * touches the address -- so it is a plain field on the draft like any other
 * answer here, not held back with the email.
 *
 * The address therefore lives in this component's own state until the gate
 * passes, not in the draft. Typing it is not the same as us keeping it.
 */
export function StepWhoYouAre({ draft, update, onUnderage, onCodeSent }: StepWhoYouAreProps) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(draft.email);
  const [dobMissing, setDobMissing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The stored draft arrives a render after this mounts, and a member coming
  // back to change their address arrives with one already confirmed.
  useEffect(() => {
    if (draft.email) setEmail(draft.email);
  }, [draft.email]);

  const setDob = (patch: { birthMonth?: number | null; birthYear?: number | null }) => {
    setDobMissing(false);
    update(patch);
  };

  const send = async () => {
    setEmailError(null);
    setBusy(true);
    const outcome = await submitIdentity(
      { birthMonth: draft.birthMonth, birthYear: draft.birthYear, email },
      {
        keepEmail: (address) => update({ email: address }),
        sendCode: (address) =>
          supabase.auth.signInWithOtp({
            email: address,
            options: {
              shouldCreateUser: true,
              // A member who clicks the link instead of typing the code lands
              // back in the flow they left, and so does a link that has died:
              // /join/register reads the failure out of the fragment and offers a fresh
              // code. Without this they land on the site root, which explains
              // nothing.
              emailRedirectTo: `${window.location.origin}${localePath(locale, "/join/register")}`,
            },
          }),
      },
    );
    setBusy(false);

    switch (outcome.status) {
      case "dob_missing":
        setDobMissing(true);
        break;
      case "underage":
        onUnderage();
        break;
      case "email_missing":
        setEmailError(t("join.step1.emailMissing"));
        break;
      case "send_failed":
        setEmailError(t("signin.failed"));
        break;
      case "sent":
        onCodeSent();
        break;
    }
  };

  return (
    <>
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <div className="r17-field-grid">
          <Field label={t("join.step1.firstName")}>
            <Input
              autoComplete="given-name"
              value={draft.firstName}
              style={TAP_CONTROL}
              onChange={(e) => update({ firstName: e.target.value })}
            />
          </Field>
          <Field label={t("join.step1.lastName")}>
            <Input
              autoComplete="family-name"
              value={draft.lastName}
              style={TAP_CONTROL}
              onChange={(e) => update({ lastName: e.target.value })}
            />
          </Field>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend
            style={{
              font: "var(--type-meta)",
              color: "var(--text-strong)",
              padding: 0,
              marginBottom: "var(--space-2)",
            }}
          >
            {t("join.step1.dobLabel")}
          </legend>
          <div style={{ display: "flex", gap: "var(--space-3)", maxWidth: "var(--measure-narrow)" }}>
            <Select
              aria-label={t("join.step1.dobMonth")}
              value={draft.birthMonth ?? ""}
              style={{ ...TAP_CONTROL, flex: 1 }}
              onChange={(e) =>
                setDob({ birthMonth: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">{t("join.step1.dobMonthPlaceholder")}</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t("join.step1.dobYear")}
              value={draft.birthYear ?? ""}
              style={{ ...TAP_CONTROL, flex: 1 }}
              onChange={(e) => setDob({ birthYear: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">{t("join.step1.dobYearPlaceholder")}</option>
              {birthYears().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
          <p className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}>
            {t("join.step1.dobHint")}
          </p>
          {dobMissing ? (
            <p className="r17-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
              {t("join.step1.dobMissing")}
            </p>
          ) : null}
        </fieldset>

        <Field
          label={t("join.step1.email")}
          hint={t("join.step1.emailHint")}
          error={emailError ?? undefined}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            style={TAP_CONTROL}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field
          label={
            <>
              {t("join.step1.genderLabel")}
              <span className="r17-optional">{t("common.optional")}</span>
            </>
          }
          hint={t("join.step1.genderHint")}
          style={{ maxWidth: "var(--measure-narrow)" }}
        >
          <Select
            value={draft.gender}
            style={TAP_CONTROL}
            onChange={(e) => update({ gender: e.target.value as GenderIdentity })}
          >
            {GENDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`join.genders.${option.key}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="r17-step-nav">
        <span />
        <div className="r17-step-nav-end">
          <Button size="lg" onClick={() => void send()} disabled={busy}>
            {busy ? t("join.step1.sendingCode") : t("join.step1.sendCode")}
          </Button>
        </div>
      </div>
    </>
  );
}
