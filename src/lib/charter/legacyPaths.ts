import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Legacy addresses, and where each one now lives.
 *
 * Routing is locale-first: the story is `/<locale>/join` and the registration
 * flow is `/<locale>/join/register`. Everything that circulated before that
 * decision has to keep working, because a URL in a QR code, a partner deck or
 * a WhatsApp forward is not something anyone gets to recall.
 *
 * These are permanent moves, so they answer 301 and not 302: a temporary
 * redirect leaves the old address indexed and splits the campaign's analytics
 * across two URLs for the life of the window.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<{ from: string; to: string; why: string }> = [
  {
    from: "/join",
    to: `/${DEFAULT_LOCALE}/join`,
    why: "Locale-less story path, from before locale-first routing.",
  },
  {
    from: "/register",
    to: `/${DEFAULT_LOCALE}/join/register`,
    why: "Locale-less registration path.",
  },
  {
    from: "/join/en",
    to: `/${DEFAULT_LOCALE}/join`,
    why: "Locale-suffix form. This is the address printed on launch material.",
  },
];

/**
 * `/en` is deliberately NOT in that table, and this is the one place the
 * handoff and this repository disagree.
 *
 * The spec asks for `/en` to 301 to registration, because on the old site `/en`
 * was the registration page. Here `/en` is the locale root: it renders the home
 * placeholder, and it is where a dead or expired confirmation link lands,
 * carrying its reason in the URL fragment. `src/routes/$locale/index.tsx` reads
 * that fragment and offers the member a fresh link. A fragment is never sent to
 * the server, so a redirect at `/en` cannot preserve that recovery: it would
 * bounce a member with a broken sign-in link into a registration form that
 * tells them nothing about what went wrong.
 *
 * Adding it is one entry in the table above, once the link-recovery landing has
 * somewhere else to live. Until then it stays out and stays written down.
 */
export const DEFERRED_REDIRECTS: ReadonlyArray<{ from: string; blockedBy: string }> = [
  {
    from: "/en",
    blockedBy:
      "Locale root. Also the landing address for dead auth links, whose reason arrives in the fragment and would be lost on redirect.",
  },
];
