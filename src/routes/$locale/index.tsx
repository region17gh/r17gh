import { createFileRoute } from "@tanstack/react-router";

import { PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";

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

// Placeholder home page. Real pages arrive in pass 2; strings already come
// from the locale dictionary rather than being hardcoded here.
function LocaleHome() {
  const t = useT();

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
        <p style={{ maxWidth: "var(--measure-prose)", margin: "var(--space-0)" }}>
          {t("meta.tagline")}
        </p>
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
