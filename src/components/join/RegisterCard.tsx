import { useT } from "@/i18n";

import { formatMemberNumber } from "./memberNumber";

export interface RegisterCardProps {
  memberNumber: number | null;
  name: string;
  location: string;
  connection: string;
  following: string;
  standing: string;
  /** The register stamp lights up once the record is entered. */
  stamped?: boolean;
}

/**
 * The register entry, filling in as the member types.
 *
 * It is the one place in the flow that shows what is actually being recorded,
 * so the disclaimer sits directly under it: whatever this looks like, it is not
 * a government document.
 */
export function RegisterCard({
  memberNumber,
  name,
  location,
  connection,
  following,
  standing,
  stamped = false,
}: RegisterCardProps) {
  const t = useT();
  const number = memberNumber === null ? null : formatMemberNumber(memberNumber);

  const rows: Array<{ label: string; value: string }> = [
    { label: t("card.rowName"), value: name },
    { label: t("card.rowLocated"), value: location },
    { label: t("card.rowConnection"), value: connection },
    { label: t("card.rowFollowing"), value: following },
    { label: t("card.rowStanding"), value: standing },
  ];

  return (
    <>
      <div className="r17-register-card">
        <div className="r17-register-top">
          <span
            className="r17-eyebrow"
            style={{ color: "var(--gold-400)", letterSpacing: "var(--tracking-eyebrow)" }}
          >
            {t("card.org")}
          </span>
          <span className="r17-cite" style={{ color: "var(--text-on-inverse-muted)" }}>
            {t("card.established")}
          </span>
        </div>

        <div
          className="r17-eyebrow"
          style={{ color: "var(--text-on-inverse-muted)", marginBottom: "var(--space-2)" }}
        >
          {t("card.memberNumberLabel")}
        </div>

        {number ? (
          <p className="r17-register-number">
            <span className="r17-register-prefix">{number.prefix}</span>
            {number.tail}
          </p>
        ) : (
          <p
            style={{
              font: "var(--type-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--text-on-inverse-muted)",
            }}
          >
            {t("card.pendingNumber")}
          </p>
        )}

        {number ? (
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-meta)",
              fontStyle: "italic",
              color: "var(--text-on-inverse-muted)",
              marginTop: "var(--space-2)",
            }}
          >
            {t("card.memberNumberNote")}
          </p>
        ) : null}

        <dl className="r17-register-rows">
          {rows.map((row) => (
            <div className="r17-register-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd data-empty={row.value ? "false" : "true"}>{row.value || t("card.empty")}</dd>
            </div>
          ))}
        </dl>

        <div className="r17-register-stamp" data-on={stamped ? "true" : "false"}>
          <RegisterStar />
          <span
            className="r17-eyebrow"
            style={{ color: "var(--gold-400)", letterSpacing: "var(--tracking-eyebrow)" }}
          >
            {t("card.stamp")}
          </span>
        </div>
      </div>

      {/* Safety control, not decoration. Its wording is fixed. */}
      <p
        className="r17-cite"
        style={{
          fontFamily: "var(--font-sans)",
          marginTop: "var(--space-4)",
          color: "var(--text-muted)",
        }}
      >
        {t("legal.notAGovernmentDocument")}
      </p>
    </>
  );
}

export function RegisterStar({ size = 22 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ fill: "currentColor", flexShrink: 0, color: "var(--gold-400)" }}
    >
      <path d="M12 2l2.6 7.3H22l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6L8 13.9 2 9.3h7.4z" />
    </svg>
  );
}
