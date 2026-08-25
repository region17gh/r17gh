import { useEffect, useRef } from "react";

/**
 * Ghana's flag, thrown once when a member number is issued.
 *
 * Colours are read from the design system at run time rather than written here,
 * so a token change carries. Nothing renders at all under prefers-reduced-motion.
 */
export function Confetti({ fire }: { fire: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spent = useRef(false);

  useEffect(() => {
    if (!fire || spent.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    spent.current = true;

    const styles = getComputedStyle(document.documentElement);
    const colours = ["--pan-red", "--gold-500", "--pan-green", "--pan-black"]
      .map((token) => styles.getPropertyValue(token).trim())
      .filter(Boolean);
    if (colours.length === 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = (canvas.width = window.innerWidth * ratio);
    const height = (canvas.height = window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const count = window.innerWidth < 640 ? 70 : 130;
    const pieces = Array.from({ length: count }, () => ({
      x: (Math.random() * 0.6 + 0.2) * width,
      y: height * 0.34 + Math.random() * 40 * ratio,
      vx: (Math.random() - 0.5) * 11 * ratio,
      vy: (-Math.random() * 15 - 7) * ratio,
      w: (Math.random() * 7 + 4) * ratio,
      h: (Math.random() * 4 + 3) * ratio,
      colour: colours[Math.floor(Math.random() * colours.length)] as string,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.28,
      star: Math.random() < 0.12,
      life: 0,
    }));

    const gravity = 0.34 * ratio;
    const drag = 0.992;
    const maxFrames = 190;
    let frame = 0;
    let raf = 0;

    const drawStar = (radius: number) => {
      context.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    };

    const tick = () => {
      context.clearRect(0, 0, width, height);
      let alive = false;
      for (const piece of pieces) {
        piece.life++;
        piece.vy += gravity;
        piece.vx *= drag;
        piece.vy *= drag;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        if (piece.y < height + 40 * ratio) alive = true;

        const fade = piece.life > maxFrames - 45 ? Math.max(0, (maxFrames - piece.life) / 45) : 1;
        context.save();
        context.globalAlpha = fade;
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.colour;
        if (piece.star) drawStar(piece.w * 0.85);
        else context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        context.restore();
      }
      frame++;
      if (alive && frame < maxFrames) raf = requestAnimationFrame(tick);
      else context.clearRect(0, 0, width, height);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  return <canvas ref={canvasRef} className="r17-confetti" aria-hidden="true" />;
}
