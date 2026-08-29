import { useEffect, type RefObject } from "react";

import { clamp, isMobileViewport, palette, trackProgress, type Palette } from "./motion";

/**
 * One animation frame for the whole page.
 *
 * Everything scroll-driven on this page reads the same frame: the reading
 * thread, the colour field, the hero stanzas, the ledger lighting, the still's
 * rising background and the parallax on every photograph. Separate loops would
 * mean separate reads of layout in the same frame, which is where scroll pages
 * get their jitter.
 *
 * Elements are found by data attribute rather than threaded through as a dozen
 * refs, so a section can be reordered in the markup without rewiring this.
 */

/** The five slow pools that make the paper move without anything moving on it. */
const POOLS = [
  { token: "--charter-brass-lit", alpha: 0.34, radius: 0.52, x: 0.8, y: 0.1, dx: 0.00013, dy: 0.00009, phase: 0, parallax: 0.05 },
  { token: "--charter-brass", alpha: 0.2, radius: 0.44, x: 0.06, y: 0.85, dx: 0.0001, dy: 0.00012, phase: 2.1, parallax: 0.09 },
  { token: "--charter-ink", alpha: 0.1, radius: 0.6, x: 0.42, y: 0.42, dx: 0.00007, dy: 0.00006, phase: 4.2, parallax: 0.03 },
  { token: "--pan-green", alpha: 0.09, radius: 0.4, x: 0.88, y: 0.72, dx: 0.00011, dy: 0.00008, phase: 1.3, parallax: 0.07 },
  { token: "--pan-red", alpha: 0.05, radius: 0.34, x: 0.18, y: 0.16, dx: 0.00009, dy: 0.00011, phase: 3.4, parallax: 0.06 },
] as const;

/** Of the ledger track, the share spent lighting cells. The rest is the landing. */
const LIGHTING_SHARE = 0.7;
/** Where the seventeenth lands, and where it lets go again on the way back up. */
const LAND_AT = 0.78;
const UNLAND_AT = 0.68;

export function useCharterStage(root: RefObject<HTMLElement | null>, still: boolean) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    // Re-bound with a concrete type: narrowing does not reach into the hoisted
    // function declarations below.
    const host: HTMLElement = element;

    const field = host.querySelector<HTMLCanvasElement>("[data-charter-field]");
    const fieldContext = field?.getContext("2d") ?? null;
    const pin = host.querySelector<HTMLElement>("[data-charter-pin]");
    const stanzas = Array.from(host.querySelectorAll<HTMLElement>("[data-charter-stanza]"));
    const returnStanza = host.querySelector<HTMLElement>("[data-charter-return]");
    const hint = host.querySelector<HTMLElement>("[data-charter-hint]");
    const portrait = host.querySelector<HTMLElement>("[data-charter-portrait]");
    const ledger = host.querySelector<HTMLElement>("[data-charter-ledger]");
    const cells = Array.from(host.querySelectorAll<HTMLElement>("[data-charter-cell]"));
    const seventeenth = host.querySelector<HTMLElement>("[data-charter-seventeenth]");
    const stillSection = host.querySelector<HTMLElement>("[data-charter-still]");
    const stillBackdrop = host.querySelector<HTMLElement>("[data-charter-still-bg]");
    const bar = host.querySelector<HTMLElement>("[data-charter-deadline]");
    const media = Array.from(host.querySelectorAll<HTMLElement>("[data-charter-parallax]"));

    const ink: Palette = palette(host);
    const documentElement = document.documentElement;

    let width = 0;
    let height = 0;
    let dpr = 1;

    function sizeField() {
      if (!field) return;
      // Half resolution on purpose: this is out-of-focus colour, and the pools
      // are the one thing on the page that repaints every single frame.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
      width = field.width = Math.ceil(window.innerWidth * dpr);
      height = field.height = Math.ceil(window.innerHeight * dpr);
    }

    function drawField(time: number, scrolled: number) {
      if (!field || !fieldContext) return;
      fieldContext.clearRect(0, 0, width, height);
      const base = Math.max(width, height);
      for (const pool of POOLS) {
        const x = (pool.x + Math.sin(time * pool.dx + pool.phase) * 0.1) * width;
        let y = (pool.y + Math.cos(time * pool.dy + pool.phase) * 0.12) * height - scrolled * pool.parallax * dpr;
        // Wrap through a span taller than the viewport so a pool that drifts
        // off the top returns from the bottom instead of leaving a dead page.
        const span = height * 2.4;
        y = (((y % span) + span) % span) - height * 0.7;
        const gradient = fieldContext.createRadialGradient(x, y, 0, x, y, base * pool.radius);
        gradient.addColorStop(0, ink(pool.token, pool.alpha));
        gradient.addColorStop(1, ink(pool.token, 0));
        fieldContext.fillStyle = gradient;
        fieldContext.fillRect(0, 0, width, height);
      }
    }

    sizeField();

    // The deadline bar arrives once the definition has been read, not before.
    // (The spec flags moving this to hero-exit as an accepted pending change.)
    //
    // The state is set from where the reader actually is, not left to the
    // observer alone. This effect runs twice: `still` starts true so the server
    // render and first paint are the reduced-motion version, then flips once
    // the media query is read. Without this resync the bar raised on that first
    // pass stayed raised, so the scarcity bar met the reader on the hero,
    // before the page had said what a region is.
    if (bar && stillSection) {
      const passed = stillSection.getBoundingClientRect().top < 0;
      bar.classList.toggle("is-up", passed);
    }

    let barObserver: IntersectionObserver | null = null;
    if (bar && stillSection) {
      barObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.boundingClientRect.top < 0) bar.classList.add("is-up");
          }
        },
        { threshold: 0 },
      );
      barObserver.observe(stillSection);
    }

    if (still) {
      // One frame of colour, then nothing. The stylesheet has already unpinned
      // the tracks, lit every cell, and shown the bar without needing a class.
      drawField(0, 0);
      const onResize = () => {
        sizeField();
        drawField(0, 0);
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        barObserver?.disconnect();
        ink.dispose();
      };
    }

    const mobile = isMobileViewport();
    const lift = mobile ? 26 : 54;
    const parallaxTravel = mobile ? 6 : 11;
    let landed = false;
    let raf = 0;

    /* Hero: three stanzas cross-dissolving across the pinned track. Each owns
       an equal slice; the fades occupy the outer 26% of a slice so the slices
       never overlap and a flick cannot land between two of them. The last 14%
       of the track belongs to the return: the opening words come back once the
       third stanza has let go, and hold until the pin releases. */
    const RETURN_FROM = 0.86;

    function paintHero() {
      if (!pin || stanzas.length === 0) return;
      const progress = trackProgress(pin);
      const slice = RETURN_FROM / stanzas.length;
      const p = Math.min(progress, RETURN_FROM);

      stanzas.forEach((stanza, index) => {
        const local = (p - index * slice) / slice;
        let opacity: number;
        let offset: number;

        if (index === 0) {
          // Stanza one is already on screen at load: it only ever fades out.
          opacity = local >= 1 ? 0 : local > 0.74 ? (1 - local) / 0.26 : 1;
          offset = -(1 - opacity) * lift;
        } else if (local <= 0 || local >= 1) {
          opacity = 0;
          offset = local <= 0 ? lift : -lift;
        } else if (local < 0.26) {
          opacity = local / 0.26;
          offset = (1 - opacity) * lift;
        } else if (local > 0.74) {
          opacity = (1 - local) / 0.26;
          offset = -(1 - opacity) * lift;
        } else {
          opacity = 1;
          offset = 0;
        }

        stanza.style.opacity = opacity.toFixed(3);
        stanza.style.setProperty("--charter-dy", `${offset.toFixed(1)}px`);

        // The portrait belongs to the last stanza and rides its fade, held
        // under full strength so the type over it stays the loudest thing.
        if (portrait && index === stanzas.length - 1) {
          portrait.style.opacity = (opacity * 0.9).toFixed(3);
        }
      });

      /* The return: rises over the first 60% of its share, then holds. It
         starts exactly where stanza three's fade ends, so the two never
         share a frame. */
      if (returnStanza) {
        const back = clamp((progress - RETURN_FROM) / (1 - RETURN_FROM), 0, 1);
        const opacity = clamp(back / 0.6, 0, 1);
        returnStanza.style.opacity = opacity.toFixed(3);
        returnStanza.style.setProperty("--charter-dy", `${((1 - opacity) * lift).toFixed(1)}px`);
      }

      if (hint) hint.style.opacity = clamp(1 - progress * 6, 0, 1).toFixed(3);
    }

    /* Ledger: sixteen cells light in sequence over the first 70% of the track,
       then the seventeenth lands. */
    function paintLedger() {
      if (!ledger) return;
      const progress = trackProgress(ledger);
      const lit = Math.floor(clamp(progress / LIGHTING_SHARE, 0, 1) * cells.length);
      for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("is-lit", i < lit);

      if (!seventeenth) return;
      if (progress > LAND_AT && !landed) {
        seventeenth.classList.add("is-lit");
        landed = true;
      } else if (landed && progress < UNLAND_AT) {
        seventeenth.classList.remove("is-lit");
        landed = false;
      }

      /* HOOK for the pattern layer. The prototype ran an adinkra pattern here,
         rising to a peak as the seventeenth lands. It is omitted pending named
         Ghanaian cultural review, but the value it drove is still written, so
         reinstating the layer is a stylesheet change and not a rewrite. */
      const rise = clamp((progress - 0.18) / 0.45, 0, 1);
      const fall = 0.55 + 0.45 * clamp((1 - progress) / 0.22, 0, 1);
      const opacity = (0.02 + (lit / cells.length) * 0.06 + (landed ? 0.05 : 0)) * rise * fall;
      ledger.style.setProperty("--charter-pattern-opacity", opacity.toFixed(3));
    }

    /* The still: its background rises to .72 as the section is read. */
    function paintStill() {
      if (!stillSection || !stillBackdrop) return;
      const box = stillSection.getBoundingClientRect();
      const viewport = window.innerHeight;
      const seen = clamp((viewport - box.top) / (viewport + box.height * 0.6), 0, 1);
      stillBackdrop.style.setProperty("--charter-still-opacity", (seen * 0.72).toFixed(3));
      stillBackdrop.style.setProperty("--charter-still-scale", (1.16 - seen * 0.1).toFixed(4));
    }

    /* Parallax and a slow breath on every photograph. The scale headroom is
       always larger than the parallax travel, so the frame never shows. */
    function paintParallax(time: number) {
      const middle = window.innerHeight / 2;
      for (let i = 0; i < media.length; i++) {
        const element = media[i];
        const host = element.parentElement;
        if (!host) continue;
        const box = host.getBoundingClientRect();
        if (box.bottom < -120 || box.top > window.innerHeight + 120) continue;
        const distance = (box.top + box.height / 2 - middle) / middle;
        const bleed = host.classList.contains("charter-bleed");
        const base = bleed ? 1.015 : 1.05;
        const amplitude = bleed ? 0.015 : 0.012;
        const scale = base + amplitude * Math.sin(time * 0.00008 + i * 2.2);
        element.style.transform = `translateY(${(distance * parallaxTravel).toFixed(1)}px) scale(${scale.toFixed(4)})`;
      }
    }

    function frame(time: number) {
      const scrolled = window.scrollY || 0;
      const span = documentElement.scrollHeight - window.innerHeight;
      host.style.setProperty(
        "--charter-progress",
        `${(span > 0 ? (scrolled / span) * 100 : 0).toFixed(2)}%`,
      );
      drawField(time, scrolled);
      paintHero();
      paintLedger();
      paintStill();
      paintParallax(time);
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => sizeField();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      barObserver?.disconnect();
      ink.dispose();
    };
  }, [root, still]);
}
