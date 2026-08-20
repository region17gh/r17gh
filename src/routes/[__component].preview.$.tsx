// AUTO-INSTALLED by mockupPreviewPlugin: build-servable canvas component preview.
// Renders the component ALONE, client-only — keep __root.tsx providers-only.
import { createFileRoute } from "@tanstack/react-router";
import {
  Component as ReactComponent,
  createElement,
  Fragment,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";

import { components } from "@/.generated/mockup-components";

type PreviewEntry = (typeof components)[string];
type SpecimenProps = Record<string, string | number | boolean>;
type SchemaProp = { name: string; type?: string; values?: string[] };

export const Route = createFileRoute("/__component/preview/$")({
  component: ComponentPreview,
});

function ComponentPreview(): ReactElement | null {
  const { _splat } = Route.useParams();
  const previewPath = _splat ?? "";
  return <PreviewDocument key={previewPath} previewPath={previewPath} />;
}

function PreviewDocument({ previewPath }: { previewPath: string }): ReactElement | null {
  const sourceEntry = previewPath && Object.hasOwn(components, previewPath) ? components[previewPath] : undefined;
  const sourceFile = (sourceEntry as { file?: string } | undefined)?.file ?? "";
  const sourceName = sourceEntry?.name ?? "";
  const [content, setContent] = useState<ReactElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const componentRef = useRef<ComponentType | null>(null);
  const entryRef = useRef<PreviewEntry | null>(null);
  const specimenRef = useRef<SpecimenProps>({});
  const reportPreviewStatus = (status: "ready" | "error", message?: string) => {
    const revision = new URLSearchParams(window.location.search).get("revision");
    window.parent?.postMessage({ type: "lov-canvas-preview-status", previewPath, revision, status, message }, "*");
  };

  const renderSpecimen = () => {
    const Component = componentRef.current;
    const entry = entryRef.current;
    if (!Component || !entry) return;
    setContent(
      createElement(RetryWithoutChildren, {
        key: JSON.stringify(specimenRef.current),
        mount: (withChildren: boolean) => mountContent(Component, entry, specimenRef.current, withChildren),
        onReady: () => reportPreviewStatus("ready"),
        onError: () => reportPreviewStatus("error", "Component threw while rendering."),
      }),
    );
  };

  useEffect(() => {
    if (!isLovablePreviewHost(window.location.hostname)) {
      setBlocked(true);
      return;
    }
    window.parent?.postMessage({ type: "lov-canvas-preview-ready" }, "*");
    let active = true;
    const entry = previewPath && Object.hasOwn(components, previewPath) ? components[previewPath] : undefined;
    if (!entry) {
      const message = 'Component "' + previewPath + '" not found.';
      setContent(errorContent(message));
      reportPreviewStatus("error", message);
      return;
    }
    if (!entry.load) {
      const message = '"' + entry.name + '" has no source to preview (npm / Path B component).';
      setContent(noticeContent(message));
      reportPreviewStatus("error", message);
      return;
    }
    entry
      .load()
      .then((mod) => {
        if (!active) return;
        const Component = pickComponent(mod, entry.name, entry.isDefault);
        if (!Component) {
          const message = 'No component exported for "' + entry.name + '".';
          setContent(errorContent(message));
          reportPreviewStatus("error", message);
          return;
        }
        componentRef.current = Component;
        entryRef.current = entry;
        renderSpecimen();
      })
      .catch((error) => {
        if (active) {
          const message = "Failed to load: " + (error instanceof Error ? error.message : String(error));
          setContent(errorContent(message));
          reportPreviewStatus("error", message);
        }
      });
    return () => {
      active = false;
      componentRef.current = null;
      entryRef.current = null;
    };
  }, [previewPath]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent) return;
      const schemaProps = (entryRef.current as { schemaProps?: SchemaProp[] } | null)?.schemaProps ?? [];
      const props = specimenPropsFromMessage(event.data, schemaProps);
      if (!props) return;
      specimenRef.current = props;
      renderSpecimen();
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  if (blocked) return null;
  return (
    <div
      ref={(node) => stampSource(node, sourceFile, 0, sourceName)}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
        zIndex: 2147483647,
      }}
    >
      <Suspense fallback={null}>{content}</Suspense>
    </div>
  );
}

const RENDERABLE_TYPES = new Set(["react.forward_ref", "react.memo", "react.lazy"].map((type) => Symbol.for(type)));
const JSX_SOURCE_KEY = Symbol.for("__jsxSource__");

function stampSource(node: HTMLElement | null, fileName: string, columnNumber: number, displayName: string): void {
  if (!node || !fileName) return;
  (node as unknown as Record<symbol, unknown>)[JSX_SOURCE_KEY] = {
    fileName,
    lineNumber: 1,
    columnNumber,
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

const PREVIEW_DOMAINS = [".lovable.app", ".lovableproject.com", ".lovable.dev", ".gpt-eng.com"];

function isLovablePreviewHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".sandbox.lovable.dev")) return true;
  if (!PREVIEW_DOMAINS.some((domain) => hostname.endsWith(domain))) return false;
  return /^(id-)?preview(-[0-9a-f]+)?--/.test(hostname.split(".")[0]);
}

function specimenPropsFromMessage(message: unknown, schemaProps: readonly SchemaProp[]): SpecimenProps | null {
  if (!message || typeof message !== "object") return null;
  const candidate = message as { type?: unknown; payload?: { props?: unknown } };
  if (candidate.type !== "DS_SPECIMEN_PROPS") return null;
  const props = candidate.payload?.props;
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  const entries = Object.entries(props);
  if (entries.length > 64) return null;
  const bounded: SpecimenProps = {};
  for (const [name, value] of entries) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$-]{0,127}$/.test(name)) return null;
    if (typeof value === "string" && value.length <= 8192) bounded[name] = value;
    else if (typeof value === "number" && Number.isFinite(value)) bounded[name] = value;
    else if (typeof value === "boolean") bounded[name] = value;
    else return null;
  }
  if (schemaProps.length === 0) return bounded;
  const normalized: SpecimenProps = {};
  for (const prop of schemaProps) {
    if (!Object.hasOwn(bounded, prop.name)) continue;
    const value = bounded[prop.name];
    if (prop.type === "enum" && typeof value === "string" && prop.values?.includes(value)) {
      normalized[prop.name] = value;
    } else if (prop.type === "boolean" && typeof value === "boolean") {
      normalized[prop.name] = value;
    } else if (prop.type === "string" && typeof value === "string" && value.length <= 8192) {
      normalized[prop.name] = value;
    } else if (prop.type === "number" && typeof value === "number" && Number.isFinite(value)) {
      normalized[prop.name] = value;
    }
  }
  return normalized;
}

function isRenderable(value: unknown): value is ComponentType {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  return RENDERABLE_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol);
}

function pascalCaseFromFileName(name: string): string {
  return (name.split("/").pop() ?? "")
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function pickComponent(mod: Record<string, unknown>, name: string, isDefault: boolean): ComponentType | undefined {
  const named = mod[pascalCaseFromFileName(name)] ?? mod[name];
  const primary = isDefault ? (mod.default ?? named) : (named ?? mod.default);
  const candidate = primary ?? Object.values(mod).find(isRenderable);
  return isRenderable(candidate) ? candidate : undefined;
}

class RetryWithoutChildren extends ReactComponent<
  { mount: (withChildren: boolean) => ReactElement; onReady: () => void; onError: () => void },
  { attempt: number }
> {
  state = { attempt: 0 };

  componentDidCatch(): void {
    if (this.state.attempt === 1) this.props.onError();
    this.setState((previous) => ({ attempt: previous.attempt + 1 }));
  }

  render(): ReactElement {
    if (this.state.attempt >= 2) return errorContent("Component threw while rendering.");
    return createElement(
      Fragment,
      null,
      this.props.mount(this.state.attempt === 0),
      createElement(PreviewRenderSuccess, { onReady: this.props.onReady }),
    );
  }
}

function PreviewRenderSuccess({ onReady }: { onReady: () => void }): null {
  useEffect(onReady, [onReady]);
  return null;
}

function displayNameOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const infixAt = base.indexOf("-candidate-");
  if (infixAt <= 0) return base;
  return base
    .slice(0, infixAt)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function mountContent(
  Component: ComponentType,
  entry: PreviewEntry,
  specimenProps: SpecimenProps,
  withChildren: boolean,
): ReactElement {
  const label = withChildren ? displayNameOf(entry.name) : undefined;
  return createElement(Component, { ...entry.props, ...specimenProps }, label);
}

function errorContent(message: string): ReactElement {
  return textContent(message, "red");
}

function noticeContent(message: string): ReactElement {
  return textContent(message, "#6b7280");
}

function textContent(message: string, color: string): ReactElement {
  return createElement(
    "pre",
    { style: { color, padding: "2rem", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" } },
    message,
  );
}
