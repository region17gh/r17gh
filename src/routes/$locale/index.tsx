import { createFileRoute } from "@tanstack/react-router";

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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        padding: "var(--space-8)",
        backgroundColor: "var(--paper-050)",
        color: "var(--ink-900)",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-display-3)",
          lineHeight: "var(--lh-display)",
          letterSpacing: "var(--tracking-display)",
          margin: "var(--space-0)",
        }}
      >
        {t("meta.siteName")}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body)",
          lineHeight: "var(--lh-body)",
          maxWidth: "var(--measure-prose)",
          margin: "var(--space-0)",
        }}
      >
        {t("meta.tagline")}
      </p>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-meta)",
          lineHeight: "var(--lh-body)",
          color: "var(--ink-700)",
          maxWidth: "var(--measure-prose)",
          margin: "var(--space-0)",
        }}
      >
        {t("legal.notAGovernmentDocument")}
      </p>
    </main>
  );
}
