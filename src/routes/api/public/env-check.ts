import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnostic only: reports whether the deployed server runtime received the
 * Supabase environment binding. Returns presence booleans and never a value.
 */
export const Route = createFileRoute("/api/public/env-check")({
  server: {
    handlers: {
      GET: () => {
        const present = (name: string) => Boolean(process.env[name]);
        return new Response(
          JSON.stringify({
            server: {
              SUPABASE_URL: present("SUPABASE_URL"),
              SUPABASE_PUBLISHABLE_KEY: present("SUPABASE_PUBLISHABLE_KEY"),
              SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
            },
            build: {
              VITE_SUPABASE_URL: Boolean(import.meta.env["VITE_SUPABASE_URL"]),
              VITE_SUPABASE_PUBLISHABLE_KEY: Boolean(
                import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
              ),
              VITE_SUPABASE_PROJECT_ID: Boolean(import.meta.env["VITE_SUPABASE_PROJECT_ID"]),
            },
          }),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
      },
    },
  },
});
