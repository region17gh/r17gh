import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,300..700;1,300..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Roboto+Mono:wght@400;500;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

/**
 * The deployment injects the Supabase binding into the server runtime only, so
 * a browser build can end up with no `VITE_SUPABASE_*` values at all. Reading
 * the server env during SSR and writing it into the document is what keeps the
 * browser client constructible. `import.meta.env.SSR` is statically false in
 * the client bundle, so this branch never ships to the browser.
 */
function serverSupabaseConfig(): { url: string; publishableKey: string } | null {
  if (!import.meta.env.SSR) return null;
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

function RootShell({ children }: { children: ReactNode }) {
  const config = serverSupabaseConfig();

  return (
    <html lang="en">
      <head>
        {config ? (
          <script
            // Only the publishable (anon) key is written here. It is public by
            // design and is protected by row level security, not by secrecy.
            dangerouslySetInnerHTML={{
              __html: `window.__SUPABASE_RUNTIME_CONFIG__=${JSON.stringify(config)}`,
            }}
          />
        ) : null}
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


// Keep this root providers-only: canvas preview routes (/__mockup,
// /__component) render inside it, so any chrome leaks into every frame.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
