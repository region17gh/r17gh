# Fix the join page error, the root URL, and prepare the image slots

## 1. The repeated "we could not run the check" notice

Cause, confirmed: the public Turnstile site key is missing from the project environment. `.env` currently holds only the Supabase variables. `VITE_TURNSTILE_SITE_KEY` is not there, so the join flow's challenge component takes its "no site key in a production build" branch, reports the problem as unavailable, and renders the red notice on every load. It is not a browser extension and not the member's network.

Fix:
- Restore `VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEcbKsPMskb2iyZF` to the environment so the widget can render.
- Confirm `TURNSTILE_SECRET_KEY` is still present in the secret store; if it is missing, ask you to paste it again.
- Verify in the browser that the notice is gone on `/en/join/register` and that a token is produced without the member seeing anything.

Copy fix while we are there: the notice text currently blames the member's browser or network. It will be reworded to state plainly that the check is temporarily unavailable, so a real outage never reads as the member's fault.

## 2. The join URLs

These already resolve, on the live site and locally:

```text
/join              301 -> /en/join
/en/join           200
/en/join/register  200 (after the step redirect)
/register          301 -> /en/join/register
/join/en           301 -> /en/join
```

Nothing is broken in routing. What is missing is that the Lovable preview page picker does not list pages that sit under a dynamic `$locale` segment, which is why `/join` does not appear as an option there. No code change fixes that list; you can type the path in the preview address bar.

## 3. Root should land on the join story

Today `r17gh.com` redirects to `/en`, a placeholder home page. Change it so:
- `/` redirects to `/en/join`.
- `/en` (the locale root) also redirects to `/en/join`, so no visitor lands on the placeholder.

Both as temporary redirects (307), not permanent, since the marketing home page is still planned and a 301 would be cached in browsers indefinitely.

## 4. The photographs

Yes, this will work, and the scroll effects are already built around it. The page declares all seven image slots up front (hero, the dark still, the full-bleed greeting, the seated plate, the register, the Black Star gate, and the pattern layer behind the ledger), each with its aspect ratio, crop focal point, caption, and alternative text already set. Each slot renders as blank paper until its `licensed` flag flips to true; the layout does not move when a real file arrives, and the parallax and Ken Burns motion attach automatically to real images only.

When you send the files, the work per image is:
- Resize each into the widths that slot declares (for example 960 / 1440 / 1920 for the hero) and convert to WebP.
- Place them in `public/images/charter/` as `<name>-<width>.webp`.
- Flip that slot's `licensed` flag to true and record the credit line.

Two slots need a decision from you before they can go live, both recorded in the code as blocks rather than bugs:
- The Kumasi still and the Black Star gate were flagged as possibly AI-generated. If your replacements are real photographs with known provenance, that block clears.
- The pattern layer behind the ledger is a traditional motif and stays off until named Ghanaian cultural review, per workspace policy.

Send the images with, for each one, the slot it belongs to, the photographer credit, and confirmation of licence. I will handle sizing and placement.

## Technical notes

- Files touched: `.env` (site key), `src/routes/index.tsx` and `src/routes/$locale/index.tsx` (redirects), `src/i18n/locales/en.json` (notice wording), and later `src/lib/charter/assets.ts` plus `public/images/charter/` for the photographs.
- No database, RLS, or registration logic changes in this pass.
