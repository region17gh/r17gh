import { useState } from "react";

import { Button, Field, Input } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  OTP_ACCEPTED_LENGTH,
  OTP_MAX_LENGTH,
  checkCode,
  normaliseCode,
  otpLengthOutOfRange,
} from "@/lib/auth/otp";

import { TAP_CONTROL } from "./shared";

// A project set outside the range this screen accepts is a deployment problem.
// Said here, in development, rather than discovered by a member holding a code
// the input will not take.
if (import.meta.env.DEV && otpLengthOutOfRange(import.meta.env["VITE_AUTH_OTP_LENGTH"])) {
  console.warn(
    `[auth] VITE_AUTH_OTP_LENGTH is ${import.meta.env["VITE_AUTH_OTP_LENGTH"]}, outside the ` +
      `${OTP_ACCEPTED_LENGTH.min} to ${OTP_ACCEPTED_LENGTH.max} digits this screen accepts.`,
  );
}

export interface StepConfirmEmailProps {
  email: string;
  /** The code checked out: claims a member number and opens the rest of step 1. */
  onConfirmed: () => void;
  /** Back to the identity screen, to correct the address. */
  onChangeEmail: () => void;
}

/**
 * The one-time code, on its own screen and after the age gate.
 *
 * It is asked for here rather than beside the identity fields because a code is
 * only ever requested once the answers on the previous screen have been checked.
 * Nothing is written against this address until the code entered here matches.
 */
export function StepConfirmEmail({ email, onConfirmed, onChangeEmail }: StepConfirmEmailProps) {
  const { t, locale } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const token = normaliseCode(code);
    // A length that cannot be a code is answered here. Only the provider is
    // allowed to say a code was wrong, so a configuration change can never
    // again reach the member as "that code did not match".
    const problem = checkCode(token);
    if (problem === "empty") {
      setError(t("join.step1.codeMissing"));
      return;
    }
    if (problem === "length") {
      setError(
        t("join.step1.codeLength", {
          min: OTP_ACCEPTED_LENGTH.min,
          max: OTP_ACCEPTED_LENGTH.max,
        }),
      );
      return;
    }
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setBusy(false);
    if (verifyError) {
      setError(t("join.step1.codeWrong"));
      return;
    }
    setCode("");
    onConfirmed();
  };

  const resend = async () => {
    setError(null);
    setResent(false);
    setBusy(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}${localePath(locale, "/join/register")}`,
      },
    });
    setBusy(false);
    if (sendError) {
      setError(t("signin.failed"));
      return;
    }
    setResent(true);
  };

  return (
    <>
      <p className="r17-notice" role="status">
        {t("join.step1.codeSent", { email })}
      </p>

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <Field
          label={t("join.step1.codeLabel")}
          hint={t("join.step1.codeHint")}
          error={error ?? undefined}
        >
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_MAX_LENGTH}
            value={code}
            style={{ ...TAP_CONTROL, maxWidth: "var(--measure-narrow)" }}
            onChange={(e) => setCode(normaliseCode(e.target.value))}
          />
        </Field>

        {resent ? (
          <p className="r17-notice" role="status">
            {t("join.step1.codeResent", { email })}
          </p>
        ) : null}
      </div>

      <div className="r17-step-nav">
        <Button size="lg" variant="ghost" onClick={onChangeEmail} disabled={busy}>
          {t("join.step1.codeChangeEmail")}
        </Button>
        <div className="r17-step-nav-end">
          <Button size="lg" variant="ghost" onClick={() => void resend()} disabled={busy}>
            {t("join.step1.codeResend")}
          </Button>
          <Button size="lg" onClick={() => void confirm()} disabled={busy}>
            {busy ? t("join.step1.codeVerifying") : t("join.step1.codeVerify")}
          </Button>
        </div>
      </div>
    </>
  );
}
