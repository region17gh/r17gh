import { Link } from "@tanstack/react-router";

import { Button } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";

import { Credential } from "./Credential";

export interface IssuedProps {
  firstName: string;
  memberNumber: number;
  credentialId: string;
  foundingMember: boolean;
  classYear: number;
  cutoff: Date | null;
  handle: string;
  /** Anything that would not save alongside the member row. */
  incomplete: string[];
  onRetry: () => void;
  retrying: boolean;
}

/**
 * The credential, the moment it is issued.
 *
 * The address is shown but stated as pending: the record is
 * `pending_verification` until the member confirms their email, and an
 * unverified account does not hold a live public address.
 */
export function Issued({
  firstName,
  memberNumber,
  credentialId,
  foundingMember,
  classYear,
  cutoff,
  handle,
  incomplete,
  onRetry,
  retrying,
}: IssuedProps) {
  const { t, locale } = useI18n();

  return (
    <div className="r17-issued">
      <p className="r17-eyebrow" style={{ color: "var(--gold-700)" }}>
        {t("join.issued.eyebrow")}
      </p>
      <h2 style={{ font: "var(--type-section)", marginTop: "var(--space-2)" }}>
        {t("join.issued.welcome", { name: firstName || t("join.issued.fallbackName") })}
      </h2>

      <Credential
        memberNumber={memberNumber}
        credentialId={credentialId}
        foundingMember={foundingMember}
        classYear={classYear}
        cutoff={cutoff}
        locale={locale}
      />

      {incomplete.length > 0 ? (
        <div
          className="r17-notice"
          data-tone="alert"
          role="alert"
          style={{ textAlign: "left", marginTop: "var(--space-6)" }}
        >
          <p>{t("join.issued.incomplete", { items: incomplete.join(", ") })}</p>
          <p style={{ marginTop: "var(--space-3)" }}>
            <Button size="lg" onClick={onRetry} disabled={retrying}>
              {t("join.issued.retry")}
            </Button>
          </p>
        </div>
      ) : null}

      {handle ? (
        <div
          style={{
            margin: "var(--space-6) auto 0",
            maxWidth: "var(--measure-narrow)",
            textAlign: "left",
            background: "var(--surface-card)",
            border: "var(--border-width) solid var(--border-default)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4)",
          }}
        >
          <p className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
            {t("join.issued.addressLabel")}
          </p>
          <p className="r17-cite" style={{ marginTop: "var(--space-2)", color: "var(--navy-700)" }}>
            {t("join.step4.handlePrefix")}
            {handle}
          </p>
          <p className="r17-cite" style={{ marginTop: "var(--space-2)", color: "var(--text-cite)" }}>
            {t("join.issued.addressPending")}
          </p>
        </div>
      ) : null}

      <div
        className="r17-next"
        style={{ maxWidth: "var(--measure-narrow)", marginInline: "auto" }}
      >
        <h3 className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
          {t("join.issued.nextHeading")}
        </h3>
        <ol style={{ marginTop: "var(--space-3)" }}>
          <li>{t("join.issued.nextOne")}</li>
          <li>{t("join.issued.nextTwo")}</li>
          <li>{t("join.issued.nextThree")}</li>
        </ol>
        <p style={{ marginTop: "var(--space-5)" }}>
          <Link to={localePath(locale, "/verify")} style={{ borderBottom: "none" }}>
            <Button size="lg">{t("join.issued.toVerify")}</Button>
          </Link>
        </p>
      </div>

      {/* Safety control, not decoration. Its wording is fixed. */}
      <p
        className="r17-cite"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--text-muted)",
          marginTop: "var(--space-8)",
          maxWidth: "var(--measure-narrow)",
          marginInline: "auto",
        }}
      >
        {t("legal.notAGovernmentDocument")}
      </p>
    </div>
  );
}
