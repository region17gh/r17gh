import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LinkRecovery } from "@/components/auth/LinkRecovery";
import { Button, PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { clearLinkError, currentLinkError, type LinkProblem } from "@/lib/auth/linkError";

export const Route = createFileRoute("/$locale/")({
  head: () => ({
    meta: [
      { title: "Region 17 Ghana | Membership register" },
      {
        name: "description",
        content:
          "Region 17 Ghana is the membership register of Ghana's seventeenth region: the global African diaspora, Ghanaians at home and abroad, continental Africans, and allies.",
      },
      { property: "og:title", content: "Region 17 Ghana | Membership register" },
      {
        property: "og:description",
        content:
          "The membership register of Ghana's seventeenth region, and a public intelligence layer covering Ghana's 16 regions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocaleHome,
});

// Placeholder home page. The marketing home page is still out of scope; this
// carries the site name, the tagline, the standing disclaimer, and one link
// into the join flow so the flow is reachable. Strings come from the locale
// dictionary rather than being hardcoded here.
function LocaleHome() {
  const { locale, t } = useI18n();
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null);

  // This is where a dead confirmation link lands: the site URL, carrying the
  // reason in the fragment. Unread, it shows a member the home page and no
  // explanation at all, so it is read here and answered.
  useEffect(() => {
    const failure = currentLinkError();
    if (!failure) return;
    setLinkProblem(failure.problem);
    clearLinkError();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PanBand />
      <main
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          padding: "var(--space-8)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            font: "var(--type-hero)",
            letterSpacing: "var(--tracking-display)",
            margin: "var(--space-0)",
          }}
        >
          {t("meta.siteName")}
        </h1>
        {linkProblem ? (
          <LinkRecovery problem={linkProblem} />
        ) : (
          <>
            <p style={{ maxWidth: "var(--measure-prose)", margin: "var(--space-0)" }}>
              {t("meta.tagline")}
            </p>
            {/* size="lg" is --control-lg, the 48px tap-target floor for anything a
                member taps. Link keeps the navigation client-side. */}
            <Link to={localePath(locale, "/join")} style={{ borderBottom: "none" }}>
              <Button size="lg">{t("nav.joinCta")}</Button>
            </Link>
          </>
        )}
        {/* Safety control, not decoration. Its wording is fixed. */}
        <p
          className="r17-cite"
          style={{ maxWidth: "var(--measure-prose)", margin: "var(--space-0)" }}
        >
          {t("legal.notAGovernmentDocument")}
        </p>
      </main>
    </div>
  );
}
