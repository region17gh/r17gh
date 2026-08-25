import { useT } from "@/i18n";

import { formatMemberNumber } from "./memberNumber";
import { RegisterStar } from "./RegisterCard";

export interface CredentialProps {
  memberNumber: number;
  credentialId: string;
  foundingMember: boolean;
  classYear: number;
  /** The founding-window cutoff read from app_config, never a date invented here. */
  cutoff: Date | null;
  locale: string;
}

/**
 * The membership credential.
 *
 * Founding standing and class year come from the member's own record, where the
 * database froze them at registration. Nothing here recomputes either, so a
 * later change to the cutoff cannot rewrite what a member was told they hold.
 */
export function Credential({
  memberNumber,
  credentialId,
  foundingMember,
  classYear,
  cutoff,
  locale,
}: CredentialProps) {
  const t = useT();
  const number = formatMemberNumber(memberNumber);

  return (
    <>
      <p className="r17-issued-number">
        <span className="r17-register-prefix">{number.prefix}</span>
        {number.tail}
      </p>

      <p className="r17-cite" style={{ color: "var(--text-muted)" }}>
        {t("join.issued.credentialIdLabel")}{" "}
        <b style={{ color: "var(--navy-700)", fontWeight: "var(--weight-bold)" }}>{credentialId}</b>
      </p>

      <p
        style={{
          marginTop: "var(--space-4)",
          color: "var(--text-muted)",
          fontSize: "var(--text-body-sm)",
        }}
      >
        {t("join.issued.permanent")}
      </p>

      {foundingMember ? (
        <p>
          <span className="r17-issued-founding">
            <RegisterStar size={14} />
            {t("join.issued.founding")}
          </span>
          <span
            className="r17-cite"
            style={{
              display: "inline-block",
              border: "var(--border-width) solid var(--border-default)",
              borderRadius: "var(--radius-pill)",
              padding: "0 var(--space-3)",
              marginLeft: "var(--space-2)",
              color: "var(--text-muted)",
            }}
          >
            {t("join.issued.classOf", { year: classYear })}
          </span>
        </p>
      ) : null}

      {foundingMember && cutoff ? (
        <p
          style={{
            marginTop: "var(--space-4)",
            color: "var(--text-muted)",
            fontSize: "var(--text-body-sm)",
            maxWidth: "var(--measure-narrow)",
            marginInline: "auto",
          }}
        >
          {t("join.issued.foundingNote", { date: formatCutoff(cutoff, locale) })}
        </p>
      ) : null}
    </>
  );
}

function formatCutoff(cutoff: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(cutoff);
  } catch {
    return cutoff.toISOString().slice(0, 10);
  }
}
