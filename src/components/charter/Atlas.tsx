import { useEffect, useRef } from "react";

import { palette, type Palette } from "./motion";

/**
 * The Ghana Pulse atlas: the seventeenth region, drawn live.
 *
 * A Black Star beats at Ghana. Gold light travels out along a thread to each of
 * sixteen diaspora cities and rings the city awake on arrival; green light
 * travels back, half a cycle out of phase, and rings Ghana when it lands. That
 * is the whole thesis of the page in one loop: the region is the traffic, not
 * the territory.
 *
 * The constellation is hand-placed for legibility, not for geography. It is
 * decoration in the accessibility sense: the canvas is aria-hidden and the page
 * carries the same claim in text beside it.
 */

/** Ghana's position in the map's own 0..1 space. */
const GHANA = { x: 0.56, y: 0.54 };

/** name, x, y. Spaced so sixteen labels can all be read at once. */
const CITIES: ReadonlyArray<readonly [string, number, number]> = [
  ["Toronto", 0.04, 0.09],
  ["New York", 0.17, 0.21],
  ["Washington", 0.02, 0.33],
  ["Havana", 0.01, 0.51],
  ["Kingston", 0.14, 0.46],
  ["Port of Spain", 0.25, 0.61],
  ["Cartagena", 0.05, 0.71],
  ["Salvador", 0.27, 0.84],
  ["São Paulo", 0.44, 0.96],
  ["London", 0.44, 0.06],
  ["Amsterdam", 0.6, 0.01],
  ["Berlin", 0.76, 0.08],
  ["Paris", 0.36, 0.18],
  ["Dubai", 0.96, 0.24],
  ["Johannesburg", 0.82, 0.9],
  ["Sydney", 1.0, 0.57],
];

/** Timings, in ms. The heartbeat is the one thing that never stops. */
const BEAT_CYCLE = 2000;
const BEAT_OFFSET = 260;
const BEAT_EXPAND = 1500;
const LAUNCH_STAGGER = 900;
const TRAVEL = 2600;
const PULSE_CYCLE = 9000;
const ARRIVAL_RING = 800;

/** A deterministic dust of background stars. Seeded, so it never flickers. */
const STARS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  let seed = 9973;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed % 1000) / 1000;
  };
  for (let i = 0; i < 150; i++) out.push([next(), next(), ((i % 3) + 1) * 0.5]);
  return out;
})();

interface Frame {
  dpr: number;
  clientHeight: number;
  frameWidth: number;
  offsetX: number;
  x0: number;
  xScale: number;
  y0: number;
  yScale: number;
}

function quadratic(
  u: number,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
): [number, number] {
  const v = 1 - u;
  return [v * v * ax + 2 * v * u * cx + u * u * bx, v * v * ay + 2 * v * u * cy + u * u * by];
}

/** The bowed control point that makes a thread an arc rather than a ruler line. */
function control(ax: number, ay: number, bx: number, by: number): [number, number] {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  return [mx - dy * 0.22, my + dx * 0.22];
}

export function Atlas({ still }: { still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvasRef.current;
    const context2d = element?.getContext("2d");
    if (!element || !context2d) return;
    // Re-bound with a concrete type: narrowing does not reach into the hoisted
    // function declarations below, and this loop is nothing but those.
    const canvas: HTMLCanvasElement = element;
    const context: CanvasRenderingContext2D = context2d;

    const ink = palette(canvas.parentElement ?? canvas);
    let frame: Frame = measure();
    let raf = 0;
    let origin: number | null = null;

    function measure(): Frame {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.ceil(canvas.clientWidth * dpr);
      canvas.height = Math.ceil(canvas.clientHeight * dpr);
      const wide = canvas.clientWidth > 1100;
      // The map sits inside the same centred 1440 frame as the type column.
      const frameWidth = Math.min(canvas.clientWidth, 1440);
      return {
        dpr,
        clientHeight: canvas.clientHeight,
        frameWidth,
        offsetX: (canvas.clientWidth - frameWidth) / 2,
        // Wide: the map takes the right half. Stacked: it takes the upper band.
        x0: wide ? 0.47 : 0.04,
        xScale: wide ? 0.5 : 0.92,
        y0: wide ? 0.07 : 0.045,
        yScale: wide ? 0.86 : 0.4,
      };
    }

    const px = (x: number) => (frame.offsetX + (frame.x0 + x * frame.xScale) * frame.frameWidth) * frame.dpr;
    const py = (y: number) => (frame.y0 + y * frame.yScale) * frame.clientHeight * frame.dpr;

    function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ink: Palette) {
      const outer = 8.5 * frame.dpr * scale;
      const inner = outer * 0.42;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      for (let point = 0; point < 10; point++) {
        const radius = point % 2 === 0 ? outer : inner;
        const angle = (point * Math.PI) / 5;
        const method = point === 0 ? "moveTo" : "lineTo";
        ctx[method](Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fillStyle = ink("--pan-black");
      ctx.fill();
      ctx.lineWidth = frame.dpr;
      ctx.strokeStyle = ink("--charter-brass-lit", 0.9);
      ctx.stroke();
      ctx.restore();
    }

    function draw(now: number, frozen: boolean) {
      const ctx = context;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = ink("--charter-ink", 0.16);
      for (const [x, y, radius] of STARS) {
        ctx.beginPath();
        ctx.arc(px(x), py(y), radius * frame.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      if (origin === null) origin = now;
      // Frozen: jump far enough forward that every thread has already settled.
      const elapsed = frozen ? 1e9 : now - origin;

      const ax = px(GHANA.x);
      const ay = py(GHANA.y);

      const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, 34 * frame.dpr);
      halo.addColorStop(0, ink("--charter-brass-lit", 0.45));
      halo.addColorStop(1, ink("--charter-brass-lit", 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(ax, ay, 34 * frame.dpr, 0, Math.PI * 2);
      ctx.fill();

      // The heartbeat: a lub-dub pair of rings leaving the star.
      if (!frozen) {
        const beat = now % BEAT_CYCLE;
        for (const delay of [0, BEAT_OFFSET]) {
          const phase = (beat - delay) / BEAT_EXPAND;
          if (phase <= 0 || phase >= 1) continue;
          ctx.strokeStyle = ink("--charter-brass-lit", 0.38 * (1 - phase));
          ctx.lineWidth = 1.5 * frame.dpr;
          ctx.beginPath();
          ctx.arc(ax, ay, (9 + phase * 52) * frame.dpr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const swell = frozen ? 1 : 1 + Math.max(0, Math.sin(now * 0.00314)) * 0.16;
      drawStar(ctx, ax, ay, swell, ink);

      const label = `${10 * frame.dpr}px ${ink.family("--font-sans")}`;
      ctx.font = `700 ${label}`;
      ctx.fillStyle = ink("--charter-brass-deep");
      ctx.textAlign = "left";
      ctx.fillText("GHANA", ax + 14 * frame.dpr, ay + 3 * frame.dpr);
      ctx.font = label;

      for (let i = 0; i < CITIES.length; i++) {
        const [name, cityX, cityY] = CITIES[i];
        const bx = px(cityX);
        const by = py(cityY);
        const born = i * LAUNCH_STAGGER;
        const arrival = (elapsed - born) / TRAVEL;
        const [cx, cy] = control(ax, ay, bx, by);

        if (arrival < 0) continue;

        if (arrival < 1) {
          // Still travelling out for the first time: a comet, no thread yet.
          const [hx, hy] = quadratic(arrival, ax, ay, cx, cy, bx, by);
          const [tx, ty] = quadratic(Math.max(0, arrival - 0.14), ax, ay, cx, cy, bx, by);
          ctx.strokeStyle = ink("--charter-brass", 0.75);
          ctx.lineWidth = 1.8 * frame.dpr;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = ink("--charter-brass-lit", 0.95);
          ctx.beginPath();
          ctx.arc(hx, hy, 2.2 * frame.dpr, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Settled thread.
        ctx.strokeStyle = ink("--charter-brass", 0.14);
        ctx.lineWidth = frame.dpr;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cx, cy, bx, by);
        ctx.stroke();

        if (!frozen) {
          const phase = (elapsed - born) % PULSE_CYCLE;

          // Gold, travelling out.
          const out = phase / TRAVEL;
          if (out <= 1) {
            const [hx, hy] = quadratic(out, ax, ay, cx, cy, bx, by);
            const [tx, ty] = quadratic(Math.max(0, out - 0.1), ax, ay, cx, cy, bx, by);
            ctx.strokeStyle = ink("--charter-brass-lit", 0.6);
            ctx.lineWidth = 1.6 * frame.dpr;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.stroke();
          }

          // Green, travelling home: the diaspora answering.
          const back = ((phase + PULSE_CYCLE / 2) % PULSE_CYCLE) / TRAVEL;
          if (back <= 1) {
            const head = 1 - back;
            const tail = Math.min(1, head + 0.1);
            const [hx, hy] = quadratic(head, ax, ay, cx, cy, bx, by);
            const [tx, ty] = quadratic(tail, ax, ay, cx, cy, bx, by);
            ctx.strokeStyle = ink("--pan-green", 0.62);
            ctx.lineWidth = 1.6 * frame.dpr;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            ctx.fillStyle = ink("--pan-green", 0.85);
            ctx.beginPath();
            ctx.arc(hx, hy, 2 * frame.dpr, 0, Math.PI * 2);
            ctx.fill();

            // Green ring at Ghana on landing.
            if (back > 0.93) {
              const landing = (back - 0.93) / 0.07;
              ctx.strokeStyle = ink("--pan-green", 0.25 * landing);
              ctx.lineWidth = 1.2 * frame.dpr;
              ctx.beginPath();
              ctx.arc(ax, ay, (6 + landing * 8.4) * frame.dpr, 0, Math.PI * 2);
              ctx.stroke();
            }
          }

          // Every arriving pulse rings the city awake.
          if (phase >= TRAVEL && phase < TRAVEL + ARRIVAL_RING) {
            const ring = (phase - TRAVEL) / ARRIVAL_RING;
            ctx.strokeStyle = ink("--charter-brass-lit", 0.55 * (1 - ring));
            ctx.lineWidth = 1.5 * frame.dpr;
            ctx.beginPath();
            ctx.arc(bx, by, (4 + ring * 22) * frame.dpr, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.fillStyle = ink("--charter-brass", 0.95);
        ctx.beginPath();
        ctx.arc(bx, by, 2.6 * frame.dpr, 0, Math.PI * 2);
        ctx.fill();

        // Labels turn outward from Ghana so none of them sit on a thread.
        ctx.fillStyle = ink("--charter-ink", 0.55);
        ctx.textAlign = cityX > GHANA.x ? "right" : "left";
        ctx.fillText(name, bx + (cityX > GHANA.x ? -8 : 8) * frame.dpr, by + 3 * frame.dpr);
      }
    }

    const resize = () => {
      frame = measure();
      if (still) draw(0, true);
    };
    window.addEventListener("resize", resize);

    if (still) {
      // One frame, fully settled. No loop is started at all.
      draw(0, true);
    } else {
      const loop = (now: number) => {
        draw(now, false);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
      ink.dispose();
    };
  }, [still]);

  return <canvas ref={canvasRef} className="charter-atlas" aria-hidden="true" />;
}
