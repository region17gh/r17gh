import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef } from "react";

import { Button, Card } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import type { LinkProblem } from "@/lib/auth/linkError";

/**
 * What a member sees when an email link will not open.
 *
 * Given the same treatment as a lapsed member number: say what happened, say
 * what is still theirs, and put the way onward in reach. A link that expires is
 * an ordinary event on a slow connection or a shared inbox, not a failure the
 * member should have to interpret from a URL.
 */
export function LinkRecovery({ problem }: { problem: LinkProblem }) {
  const { t, locale } = useI18n();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The member did not navigate here on purpose, so focus goes to the
  // explanation rather than leaving a reader at the top of an unchanged page.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const key = problem === "expired" ? "expired" : problem === "denied" ? "denied" : "unknown";

  return (
    <section
      aria-labelledby={headingId}
      style={{ width: "100%", maxWidth: "var(--measure-prose)", margin: "0 auto" }}
    >
      <Card accent="var(--gold-500)" style={{ textAlign: "left" }}>
        <p className="r17-eyebrow" style={{ color: "var(--gold-700)" }}>
          {t("authLink.eyebrow")}
        </p>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          style={{ font: "var(--type-title)", marginTop: "var(--space-3)" }}
        >
          {t(`authLink.${key}Heading`)}
        </h2>
        <p style={{ marginTop: "var(--space-3)", color: "var(--text-body)" }}>
          {t(`authLink.${key}Body`)}
        </p>
        <p style={{ marginTop: "var(--space-3)", color: "var(--text-muted)" }}>
          {t("authLink.held")}
        </p>
        <div
          style={{
            marginTop: "var(--space-6)",
            display: "flex",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Link to={localePath(locale, "/join/register")} style={{ borderBottom: "none" }}>
            <Button size="lg" variant="gold">
              {t("authLink.continue")}
            </Button>
          </Link>
          <Link to={localePath(locale, "/signin")}>{t("authLink.signIn")}</Link>
        </div>
      </Card>
    </section>
  );
}
