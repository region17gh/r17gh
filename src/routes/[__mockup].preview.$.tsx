// AUTO-INSTALLED by mockupPreviewPlugin: build-servable canvas mockup preview.
// Renders the mockup ALONE, client-only — keep __root.tsx providers-only.
import { createFileRoute } from "@tanstack/react-router";
import { createElement, Suspense, useEffect, useState, type ComponentType, type ReactElement } from "react";

import { mockups } from "@/.generated/mockup-components";

export const Route = createFileRoute("/__mockup/preview/$")({
  component: MockupPreview,
});

function MockupPreview(): ReactElement | null {
  const { _splat } = Route.useParams();
  const mockupName = (_splat ?? "").split("/").pop() ?? "";
  const [content, setContent] = useState<ReactElement | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!isLovablePreviewHost(window.location.hostname)) {
      setBlocked(true);
      return;
    }
    // Tell the canvas parent this build serves the preview routes — without
    // the handshake a routeless build's app shell is indistinguishable.
    window.parent?.postMessage({ type: "lov-canvas-preview-ready" }, "*");
    let active = true;
    const loader = _splat && Object.hasOwn(mockups, _splat) ? mockups[_splat] : undefined;
    if (!loader) {
      setContent(errorContent('Mockup "' + (_splat ?? "") + '" not found.'));
      return;
    }
    loader()
      .then((mod) => {
        if (!active) return;
        const Component = pickComponent(mod);
        setContent(
          Component ? createElement(Component) : errorContent('No component exported for "' + (_splat ?? "") + '".'),
        );
      })
      .catch((error) => {
        if (active) {
          setContent(errorContent("Failed to load: " + (error instanceof Error ? error.message : String(error))));
        }
      });
    return () => {
      active = false;
    };
  }, [_splat]);

  if (blocked) return null;
  return (
    <div
      ref={(node) => stampSource(node, "src/components/mockups/" + (_splat ?? "") + ".tsx", 0, mockupName)}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#fff", zIndex: 2147483647 }}
    >
      <Suspense fallback={null}>{content}</Suspense>
    </div>
  );
}

const RENDERABLE_TYPES = new Set(["react.forward_ref", "react.memo", "react.lazy"].map((t) => Symbol.for(t)));

const JSX_SOURCE_KEY = Symbol.for("__jsxSource__");

// This chrome is built with createElement outside any JSX transform, so
// lovable-tagger never stamps it and a click on it resolves to nothing. Mirror
// the tagger's contract: the symbol the selector reads, plus the lookup map its
// highlight echo uses.
function stampSource(node: HTMLElement | null, fileName: string, columnNumber: number, displayName: string): void {
  if (!node || !fileName) return;
  (node as unknown as Record<symbol, unknown>)[JSX_SOURCE_KEY] = {
    fileName: fileName,
    lineNumber: 1,
    columnNumber: columnNumber,
    displayName: displayName || undefined,
  };
  const host = window as Window & { sourceElementMap?: Map<string, Set<WeakRef<HTMLElement>>> };
  const map = host.sourceElementMap ?? new Map<string, Set<WeakRef<HTMLElement>>>();
  host.sourceElementMap = map;
  const key = fileName + ":1:" + columnNumber;
  const refs = map.get(key) ?? new Set<WeakRef<HTMLElement>>();
  refs.add(new WeakRef(node));
  map.set(key, refs);
}

// Published sites ship these routes too: only preview hosts may answer.
const PREVIEW_DOMAINS = [".lovable.app", ".lovableproject.com", ".lovable.dev", ".gpt-eng.com"];

function isLovablePreviewHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".sandbox.lovable.dev")) return true;
  if (!PREVIEW_DOMAINS.some((d) => hostname.endsWith(d))) return false;
  return /^(id-)?preview(-[0-9a-f]+)?--/.test(hostname.split(".")[0]);
}

function isRenderable(value: unknown): value is ComponentType {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  // Only wrapper components render; elements/Context also carry $$typeof.
  return RENDERABLE_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol);
}

function pickComponent(mod: Record<string, unknown>): ComponentType | undefined {
  const candidate = mod.default ?? mod.Preview ?? Object.values(mod).find(isRenderable);
  return isRenderable(candidate) ? candidate : undefined;
}

function errorContent(message: string): ReactElement {
  return createElement(
    "pre",
    { style: { color: "red", padding: "2rem", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" } },
    message,
  );
}
