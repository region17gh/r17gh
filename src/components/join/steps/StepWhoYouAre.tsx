import { useState } from "react";

import { Button, Field, Input, Select } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { MONTHS, birthYears, checkAge, type AgeVerdict } from "@/lib/join/age";
import { GENDERS, type GenderIdentity } from "@/lib/join/options";

import { TAP_CONTROL, type StepProps } from "./shared";

export interface Country {
  code: string;
  name: string;
}

export interface StepWhoYouAreProps extends StepProps {
  countries: Country[];
  emailConfirmed: boolean;
  /** Runs after the code checks out: claims a member number. */
  onEmailConfirmed: () => void;
  onUnderage: () => void;
  onContinue: () => void;
  reserving: boolean;
}

type CodeStage = "idle" | "sent";

export function StepWhoYouAre({
  draft,
  update,
  countries,
  emailConfirmed,
  onEmailConfirmed,
  onUnderage,
  onContinue,
  reserving,
}: StepWhoYouAreProps) {
  const t = useT();
  const [dobTouched, setDobTouched] = useState(false);
  const [stage, setStage] = useState<CodeStage>("idle");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verdict: AgeVerdict = checkAge(draft.birthMonth, draft.birthYear);

  /**
   * The gate runs before anything else on this screen exists.
   *
   * Nothing below the date of birth renders until it passes, so an under-18
   * visitor is never asked for an email address, and there is none to store.
   */
  const setDob = (patch: { birthMonth?: number | null; birthYear?: number | null }) => {
    setDobTouched(true);
    const next = { ...draft, ...patch };
    update(patch);
    if (checkAge(next.birthMonth, next.birthYear) === "under") onUnderage();
  };

  const sendCode = async () => {
    const email = draft.email.trim();
    if (!email || !email.includes("@")) {
      setEmailError(t("join.step1.emailMissing"));
      return;
    }
    setEmailError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setEmailError(t("signin.failed"));
      return;
    }
    setStage("sent");
  };

  const confirmCode = async () => {
    const token = code.trim();
    if (token.length === 0) {
      setCodeError(t("join.step1.codeMissing"));
      return;
    }
    setCodeError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: draft.email.trim(),
      token,
      type: "email",
    });
    setBusy(false);
    if (error) {
      setCodeError(t("join.step1.codeWrong"));
      return;
    }
    setCode("");
    onEmailConfirmed();
  };

  if (verdict === "under") {
    return (
      <div className="r17-notice" data-tone="alert" role="alert">
        {t("join.step1.underage")}
      </div>
    );
  }

  return (
    <>
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
            onChange={(e) => setDob({ birthMonth: e.target.value ? Number(e.target.value) : null })}
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
        {dobTouched && verdict === "missing" ? (
          <p className="r17-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
            {t("join.step1.dobMissing")}
          </p>
        ) : null}
      </fieldset>

      {verdict !== "ok" ? null : (
        <div style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-5)" }}>
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

          <Field
            label={t("join.step1.email")}
            hint={t("join.step1.emailHint")}
            error={emailError ?? undefined}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={draft.email}
              disabled={emailConfirmed || stage === "sent"}
              style={TAP_CONTROL}
              onChange={(e) => update({ email: e.target.value })}
            />
          </Field>

          {emailConfirmed ? (
            <p className="r17-notice" role="status">
              {t("join.step1.emailConfirmed")}
            </p>
          ) : stage === "sent" ? (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <p className="r17-notice" role="status">
                {t("join.step1.codeSent", { email: draft.email.trim() })}
              </p>
              <Field
                label={t("join.step1.codeLabel")}
                hint={t("join.step1.codeHint")}
                error={codeError ?? undefined}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  style={{ ...TAP_CONTROL, maxWidth: "var(--measure-narrow)" }}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Button size="lg" onClick={() => void confirmCode()} disabled={busy}>
                  {busy ? t("join.step1.codeVerifying") : t("join.step1.codeVerify")}
                </Button>
                <Button size="lg" variant="ghost" onClick={() => void sendCode()} disabled={busy}>
                  {t("join.step1.codeResend")}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => {
                    setStage("idle");
                    setCode("");
                    setCodeError(null);
                  }}
                >
                  {t("join.step1.codeChangeEmail")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button size="lg" onClick={() => void sendCode()} disabled={busy}>
                {busy ? t("join.step1.sendingCode") : t("join.step1.sendCode")}
              </Button>
            </div>
          )}

          {emailConfirmed ? (
            <>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend
                  style={{
                    font: "var(--type-meta)",
                    color: "var(--text-strong)",
                    padding: 0,
                    marginBottom: "var(--space-2)",
                  }}
                >
                  {t("join.step1.locationLabel")}
                </legend>
                <div className="r17-field-grid">
                  <Field label={t("join.step1.cityLabel")}>
                    <Input
                      autoComplete="address-level2"
                      placeholder={t("join.step1.cityPlaceholder")}
                      value={draft.city}
                      style={TAP_CONTROL}
                      onChange={(e) => update({ city: e.target.value })}
                    />
                  </Field>
                  <Field label={t("join.step1.countryLabel")}>
                    <Select
                      autoComplete="country"
                      value={draft.country}
                      style={TAP_CONTROL}
                      onChange={(e) => update({ country: e.target.value })}
                    >
                      <option value="">{t("join.step1.countryPlaceholder")}</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p
                  className="r17-cite"
                  style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}
                >
                  {t("join.step1.locationHint")}
                </p>
              </fieldset>

              <Field
                label={
                  <>
                    {t("join.step1.genderLabel")}
                    <span className="r17-optional">{t("common.optional")}</span>
                  </>
                }
                hint={t("join.step1.genderHint")}
                style={{ marginTop: "var(--space-5)" }}
              >
                <Select
                  value={draft.gender}
                  style={{ ...TAP_CONTROL, maxWidth: "var(--measure-narrow)" }}
                  onChange={(e) => update({ gender: e.target.value as GenderIdentity })}
                >
                  {GENDERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`join.genders.${option.key}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
        </div>
      )}

      <div className="r17-step-nav">
        <span />
        <div className="r17-step-nav-end">
          <Button
            size="lg"
            onClick={onContinue}
            disabled={!emailConfirmed || reserving || !draft.reservation}
          >
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </>
  );
}
