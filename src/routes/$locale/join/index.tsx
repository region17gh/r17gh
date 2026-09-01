import { Link, createFileRoute } from "@tanstack/react-router";
import { Fragment, useRef, type CSSProperties } from "react";

import { Atlas } from "@/components/charter/Atlas";
import { Coda } from "@/components/charter/Coda";
import { DeadlineBar } from "@/components/charter/DeadlineBar";
import { Ledger } from "@/components/charter/Ledger";
import { Media, Plate } from "@/components/charter/Plate";
import { RegionIndex } from "@/components/charter/RegionIndex";
import { Line, Reveal } from "@/components/charter/Reveal";
import { usePrefersReducedMotion } from "@/components/charter/motion";
import { useCharterStage } from "@/components/charter/useCharterStage";
import { localePath, useI18n } from "@/i18n";
import { CHARTER_IMAGES, fallbackSrc } from "@/lib/charter/assets";
import { CHARTER_REGIONS } from "@/lib/charter/regions";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { translator } from "@/i18n/translate";

/**
 * The join story: /<locale>/join.
 *
 * One scroll narrative, mobile first. It says the seventeenth region already
 * existed, that the December 2025 declaration caught up with it, and that
 * Charter Membership is how the family gets counted. Every CTA on the page
 * goes to the registration flow at /<locale>/join/register, which this route
 * does not touch: story and form are separate funnel stages with separate,
 * separately measurable URLs.
 *
 * Two things from the approved prototype are deliberately not here. The kente
 * band and the adinkra layer behind the ledger are both omitted: traditional
 * motifs are not decoration and need named Ghanaian cultural review first.
 * Both are documented hooks, not deletions.
 *
 * There is no PanBand here either, and that is a scoping decision rather than
 * an omission. The design system scopes it to a rule at the top of *official*
 * surfaces: the credential, the register, the legal screens. This is a
 * marketing story page, and the golden thread already holds the top edge.
 * Rendering it here would also put four full-width bands in the flag's colours
 * and order across the top of the story, which is the adjacency D-069 governs.
 *
 * None of the seven photographs ship either. Every one is licence-unresolved
 * and two are suspected AI generation, so each slot renders as paper at the
 * right aspect ratio, carrying its real alternative text. See lib/charter/assets.
 */

export const Route = createFileRoute("/$locale/join/")({
  // `head` runs before the provider exists, so it translates directly. The
  // share card is the WhatsApp forward surface, and it is how most readers
  // arrive: these four lines are the page for anyone who never scrolls.
  head: ({ params }) => {
    const meta = translator(isLocale(params.locale) ? params.locale : DEFAULT_LOCALE);
    return {
      meta: [
        { title: meta("charter.meta.title") },
        { name: "description", content: meta("charter.meta.description") },
        { property: "og:title", content: meta("charter.meta.ogTitle") },
        { property: "og:description", content: meta("charter.meta.ogDescription") },
        { property: "og:type", content: "website" },
        // og:image is deliberately absent: there is no licensed photograph to
        // put on the card yet, and a broken image URL is worse than none.
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: JoinStory,
});

function JoinStory() {
  const { locale, t } = useI18n();
  const stage = useRef<HTMLDivElement>(null);
  const still = usePrefersReducedMotion();

  useCharterStage(stage, still);

  const register = localePath(locale, "/join/register");

  return (
    <div className="charter" ref={stage}>
      <a className="charter-skip" href="#charter-window">
        {t("charter.skip")}
      </a>

      {/* The golden thread holds the top edge. See the note above on PanBand. */}
      <div className="charter-thread" aria-hidden="true" />

      <header className="charter-masthead">
        <Link to={localePath(locale, "/")}>{t("charter.masthead.home")}</Link>
        <Link className="charter-masthead-join" to={register}>
          {t("charter.masthead.join")}
        </Link>
      </header>

      <canvas className="charter-field" data-charter-field aria-hidden="true" />

      <main>
        {/* ---------- the opening: three stanzas over one pinned track ---------- */}
        <div className="charter-pin" data-charter-pin>
          <div className="charter-pin-stage">
            <Atlas still={still} />
            {/* The canvas is decoration. The claim it draws is said here. */}
            <p className="r17-sr-only">{t("charter.atlas.alt")}</p>

            <div className="charter-stanza" data-charter-stanza style={{ opacity: 1 }}>
              <h1>{t("charter.stanza1.line1")}</h1>
              <p className="charter-lift">{t("charter.stanza1.line2")}</p>
            </div>

            <div className="charter-stanza" data-charter-stanza>
              <p className="charter-sub" style={{ marginTop: 0 }}>
                {t("charter.stanza2.body")}
              </p>
            </div>

            {/* The President, behind the third stanza only. It fades with that
                stanza, so the opening screen is still paper and light. */}
            <div className="charter-portrait" data-charter-portrait aria-hidden="true">
              <Media image={CHARTER_IMAGES.declaration} />
            </div>

            <div className="charter-stanza" data-charter-stanza>
              <p className="charter-stanza-mid">{t("charter.stanza3.lead")}</p>
              <p className="charter-lift">{t("charter.stanza3.lift")}</p>
              <p className="charter-sub">{t("charter.stanza3.sub")}</p>
            </div>

            <p className="charter-hint" data-charter-hint aria-hidden="true">
              {t("charter.hint")}
              <span />
            </p>
          </div>
        </div>

        {/* ---------- what a region is: motion stops ---------- */}
        <section className="charter-still charter-dark" data-charter-still>
          {CHARTER_IMAGES.kumasi.licensed ? (
            <div
              className="charter-still-bg"
              data-charter-still-bg
              aria-hidden="true"
              style={{ backgroundImage: `url(${fallbackSrc(CHARTER_IMAGES.kumasi)})` }}
            />
          ) : null}
          <Reveal className="charter-still-inner">
            <p className="charter-eyebrow charter-fade">{t("charter.still.eyebrow")}</p>
            <h2>
              <Line index={0}>{t("charter.still.line1")}</Line>
              <Line index={1}>{t("charter.still.line2")}</Line>
              <Line index={2}>{t("charter.still.line3")}</Line>
            </h2>
            <p className="charter-close charter-fade" style={{ "--charter-i": 3 } as CSSProperties}>
              {t("charter.still.closeLead")} <em>{t("charter.still.closeEm")}</em>
            </p>
          </Reveal>
        </section>

        {/* ---------- the sixteen, and the seventeenth ---------- */}
        <Ledger />

        {/* ---------- found by name ---------- */}
        <section className="charter-bleed charter-dark">
          <Media image={CHARTER_IMAGES.greeting} />
          <p className="charter-cred">{t("charter.bleed.credit")}</p>
          <Reveal className="charter-bleed-copy">
            <p className="charter-eyebrow charter-fade">{t("charter.bleed.eyebrow")}</p>
            <h2 className="charter-h2">
              <Line index={1}>{t("charter.bleed.line1")}</Line>
              <Line index={2}>{t("charter.bleed.line2")}</Line>
            </h2>
          </Reveal>
        </section>

        {/* ---------- every branch of the family ---------- */}
        <section className="charter-flow">
          <Reveal className="charter-flow-inner">
            <p className="charter-eyebrow charter-fade">{t("charter.branches.eyebrow")}</p>
            <h2 className="charter-h2">
              <Line index={0}>{t("charter.branches.line1")}</Line>
              <Line index={1}>{t("charter.branches.line2")}</Line>
            </h2>

            <ul className="charter-doors">
              {BRANCHES.map((branch, index) => (
                <li
                  key={branch}
                  className="charter-wipe"
                  style={{ "--charter-i": index + 2 } as CSSProperties}
                >
                  <b>{t(`charter.branches.${branch}Title`)}</b>
                  <small>{t(`charter.branches.${branch}Body`)}</small>
                </li>
              ))}
            </ul>

            <Plate image={CHARTER_IMAGES.seated} index={8} effect="ken-burns" />

            <p className="charter-lede charter-fade" style={{ "--charter-i": 9 } as CSSProperties}>
              {t("charter.branches.close")}
            </p>
          </Reveal>
        </section>

        {/* ---------- the window ---------- */}
        <section
          className="charter-flow charter-window charter-dark"
          id="charter-window"
          tabIndex={-1}
        >
          <Reveal className="charter-flow-inner charter-cols">
            <div>
              <p className="charter-eyebrow charter-fade">{t("charter.window.eyebrow")}</p>
              <h2 className="charter-h2">
                <Line index={0}>{t("charter.window.line1")}</Line>
                <Line index={1}>
                  <span className="charter-gold">{t("charter.window.line2")}</span>
                </Line>
              </h2>

              <div
                className="charter-rule-line charter-fade"
                style={{ "--charter-i": 3 } as CSSProperties}
                aria-hidden="true"
              />

              <p className="charter-only charter-fade" style={{ "--charter-i": 4 } as CSSProperties}>
                {t("charter.window.only")}
                <br />
                {t("charter.window.onlyAfter")}
              </p>
            </div>

            <div>
              <Plate image={CHARTER_IMAGES.register} index={5} />

              <p className="charter-hinge charter-fade" style={{ "--charter-i": 6 } as CSSProperties}>
                {t("charter.window.hinge")}
              </p>

              <Link
                className="charter-cta charter-fade"
                style={{ "--charter-i": 7 } as CSSProperties}
                to={register}
              >
                {t("charter.window.cta")}
              </Link>

              <p className="charter-fineprint charter-fade" style={{ "--charter-i": 8 } as CSSProperties}>
                {t("charter.window.fineprint")}
              </p>
              {/* Safety control, not copy. Its wording is fixed. */}
              <p className="charter-fineprint charter-fade" style={{ "--charter-i": 9 } as CSSProperties}>
                {t("legal.notAGovernmentDocument")}
              </p>
            </div>
          </Reveal>
        </section>

        <div className="charter-ticker" aria-hidden="true">
          <div className="charter-ticker-track">
            {/* Two identical passes: the marquee translates by half its own
                width, so the second pass is what makes the loop seamless. */}
            {[0, 1].map((pass) => (
              <Fragment key={pass}>
                {CHARTER_REGIONS.map((region) => (
                  <span key={`${pass}-${region.slug}`}>{region.name}</span>
                ))}
                <b>{t("charter.ticker.seventeenth")}</b>
              </Fragment>
            ))}
          </div>
        </div>

        {/* ---------- the other door ---------- */}
        <section className="charter-flow charter-index">
          <Reveal className="charter-flow-inner">
            <div className="charter-index-cols">
              <div>
                <p className="charter-eyebrow charter-fade">{t("charter.index.eyebrow")}</p>
                <h2 className="charter-h2">
                  <Line index={0}>{t("charter.index.line1")}</Line>
                  <Line index={1}>{t("charter.index.line2")}</Line>
                </h2>
                <p className="charter-lede charter-fade" style={{ "--charter-i": 2 } as CSSProperties}>
                  {t("charter.index.body")}
                </p>
              </div>
              <RegionIndex />
            </div>

            <Plate image={CHARTER_IMAGES.gate} index={3} />

            <Coda />
          </Reveal>
        </section>
      </main>

      <DeadlineBar />
    </div>
  );
}

/** The six branches, in the order they are met. Copy lives in the dictionary. */
const BRANCHES = ["bornIn", "bornTo", "descended", "continent", "returned", "friends"] as const;
