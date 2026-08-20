import type { Dirent } from "node:fs";
import type * as TS from "typescript";
import type { Plugin, ViteDevServer } from "vite";

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const LOVABLE_CANVAS_MOCKUP_PREVIEW_RUNTIME_VERSION = "2026-08-18.1";
export const LOVABLE_CANVAS_MOCKUP_PREVIEW_RUNTIME_FINGERPRINT =
  "sha256:8ce47e451547e6c9c9f472943a9f9f3b4bb2e868df43e8af7987b56253eb35f0";

// The editor's element-selector runtime — the same CDN tag the proxy worker
// injects into static previews, so click-to-select works inside canvas frames.
const SELECTOR_SCRIPT_TAG = `<script src="https://cdn.gpteng.co/lovable.js" type="module"></script>`;

const MOCKUPS_DIR = "src/components/mockups";
const GENERATED_MODULE = "src/.generated/mockup-components.ts";
const APP_CSS_IMPORT = "@/styles.css";
const SCHEMA_PATH = ".lovable/design-system.json";
const MOCKUP_ROUTE_FILE = "src/routes/[__mockup].preview.$.tsx";
const COMPONENT_ROUTE_FILE = "src/routes/[__component].preview.$.tsx";

// A draft exploration sits beside the component it explores, e.g.
// "src/components/ui/button-candidate-squared.tsx".
const DRAFT_CANDIDATE_INFIX = "-candidate-";

const COMPONENT_SOURCE_EXTENSION = /\.(tsx|ts|jsx|js)$/;

function isDraftCandidateFile(projectRelativePath: string): boolean {
  if (!projectRelativePath.startsWith("src/") || !COMPONENT_SOURCE_EXTENSION.test(projectRelativePath)) return false;
  if (projectRelativePath.startsWith(`${MOCKUPS_DIR}/`)) return false;
  const segments = projectRelativePath.split("/");
  if (segments.some((segment) => segment.startsWith("_"))) return false;
  return (segments[segments.length - 1] ?? "").includes(DRAFT_CANDIDATE_INFIX);
}

function draftCandidateName(projectRelativePath: string): string {
  return projectRelativePath.replace(/^\/+/, "").replace(COMPONENT_SOURCE_EXTENSION, "");
}

function componentFileStem(file: string): string {
  return file
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(tsx|ts|jsx|js)$/, "");
}

function draftCandidateSourceStem(file: string): string {
  const stem = componentFileStem(file);
  const index = stem.indexOf(DRAFT_CANDIDATE_INFIX, stem.lastIndexOf("/") + 1);
  return index === -1 ? stem : stem.slice(0, index);
}

function fileBaseName(file: string): string {
  return (file.split("/").pop() ?? "").replace(/\.(tsx|ts|jsx|js)$/, "");
}

// Joins names across casing conventions: "alert-dialog" and "AlertDialog" are one component.
function normalizeJoinKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function previewDisplayName(name: string): string {
  const base = fileBaseName(name);
  const infixAt = base.indexOf(DRAFT_CANDIDATE_INFIX);
  return infixAt > 0 ? pascalCaseFromFileName(base.slice(0, infixAt)) : base;
}

// "button-candidate-squared-outline" -> "ButtonCandidateSquaredOutline": the export a
// draft is expected to carry. A hint only; resolution still scans the module.
function pascalCaseFromFileName(name: string): string {
  return fileBaseName(name)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// The plugin owns these route sources so existing projects self-install them
// and the committed template files stay byte-identical (write-if-changed).
const MOCKUP_ROUTE_SOURCE = `// AUTO-INSTALLED by mockupPreviewPlugin: build-servable canvas mockup preview.
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
`;

const COMPONENT_ROUTE_SOURCE = `// AUTO-INSTALLED by mockupPreviewPlugin: build-servable canvas component preview.
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
`;

interface DiscoveredComponent {
  key: string;
  importPath: string;
}

interface ResolvedComponentEntry {
  name: string;
  // Absent for npm / Path-B components (no local source file to import).
  importPath?: string;
  // Project-relative source path, forwarded to the preview so it can stamp the
  // harness chrome the editor's element selector reads.
  file?: string;
  isDefault: boolean;
  props: Record<string, string | number | boolean>;
  schemaProps: SchemaProp[];
  variants?: VariantAxes;
}

type VariantAxes = Record<string, string[]>;

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

interface SchemaProp {
  name: string;
  type?: string;
  values?: string[];
  default?: string;
  required?: boolean;
}

interface SchemaComponent {
  name: string;
  file?: string;
  is_default?: boolean;
  props?: SchemaProp[];
}

export function mockupPreviewPlugin(): Plugin {
  let root = "";
  let currentSource = "";

  function getMockupsAbsDir(): string {
    return path.join(root, MOCKUPS_DIR);
  }

  function getGeneratedModuleAbsPath(): string {
    return path.join(root, GENERATED_MODULE);
  }

  function isPreviewTarget(relativeToMockups: string): boolean {
    return relativeToMockups.split(path.sep).every((segment) => !segment.startsWith("_"));
  }

  function isSafeComponentPath(componentPath: string): boolean {
    return (
      /^[A-Za-z0-9_/-]+$/.test(componentPath) &&
      componentPath
        .split("/")
        .every((segment) => segment !== "" && segment !== "." && segment !== ".." && !segment.startsWith("_"))
    );
  }

  // Schema-declared paths become client-visible import() literals: reject
  // absolute/traversal paths, allow only component source under src/.
  function isSafeComponentFile(file: string): boolean {
    const normalized = file.split(path.sep).join(path.posix.sep);
    if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return false;
    if (!normalized.split("/").every((segment) => segment !== "..")) return false;
    return /^src\/.+\.(tsx|jsx|ts|js)$/.test(normalized);
  }

  function escapeHTML(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  async function walk(dir: string): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return [];
      throw error;
    }

    const files = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name.startsWith("_") ? [] : walk(absolutePath);
        if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];

        const relativeToMockups = path.relative(getMockupsAbsDir(), absolutePath);
        return isPreviewTarget(relativeToMockups) ? [absolutePath] : [];
      }),
    );

    return files.flat();
  }

  async function walkSource(dir: string): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return [];
      throw error;
    }

    const files = await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith("_") || entry.name === "node_modules") return [];
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return absolutePath === getMockupsAbsDir() ? [] : walkSource(absolutePath);
        }
        return entry.isFile() && COMPONENT_SOURCE_EXTENSION.test(entry.name) ? [absolutePath] : [];
      }),
    );

    return files.flat();
  }

  async function discoverComponents(): Promise<DiscoveredComponent[]> {
    const files = await walk(getMockupsAbsDir());
    return files
      .map((absolutePath) => {
        const projectRelativePath = path.relative(root, absolutePath).split(path.sep).join(path.posix.sep);
        const mockupRelative = path.posix.relative(MOCKUPS_DIR, projectRelativePath);
        return {
          key: mockupRelative.replace(/\.tsx$/, ""),
          importPath: path.posix.relative("src/.generated", projectRelativePath),
        };
      })
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  function generateSource(mockups: DiscoveredComponent[], components: ResolvedComponentEntry[]): string {
    const mockupEntries = mockups
      .map((mockup) => `  ${JSON.stringify(mockup.key)}: () => import(${JSON.stringify(mockup.importPath)})`)
      .join(",\n");
    const componentEntries = components
      .map((component) => {
        const meta = `name: ${JSON.stringify(component.name)}, isDefault: ${component.isDefault}, props: ${JSON.stringify(component.props)}, schemaProps: ${JSON.stringify(component.schemaProps)}`;
        const load = component.importPath ? `load: () => import(${JSON.stringify(component.importPath)}), ` : "";
        const file = component.file ? `, file: ${JSON.stringify(component.file)}` : "";
        const variants = component.variants ? `, variants: ${JSON.stringify(component.variants)}` : "";
        return `  ${JSON.stringify(component.name)}: { ${load}${meta}${file}${variants} }`;
      })
      .join(",\n");

    return [
      "// This file is auto-generated by mockupPreviewPlugin.ts.",
      "export type PreviewLoader = () => Promise<Record<string, unknown>>;",
      "export interface ComponentPreview {",
      "  load?: PreviewLoader;",
      "  name: string;",
      "  isDefault: boolean;",
      "  file?: string;",
      "  props: Record<string, string | number | boolean>;",
      "  schemaProps: Array<{ name: string; type?: string; values?: string[] }>;",
      "  variants?: Record<string, string[]>;",
      "}",
      "export const mockups: Record<string, PreviewLoader> = {",
      mockupEntries,
      "};",
      "export const components: Record<string, ComponentPreview> = {",
      componentEntries,
      "};",
      "",
    ].join("\n");
  }

  // File-bearing components get a loader; Path-B (no file) a loader-less entry.
  // Files are existence-checked first: the schema can lag a deleted source.
  async function discoverComponentEntries(): Promise<ResolvedComponentEntry[]> {
    const components = await loadPreviewComponents();
    if (!components) return [];
    const perFile = componentsPerFile(components);

    const entries = await Promise.all(
      components.map(async (component): Promise<ResolvedComponentEntry | null> => {
        const base = {
          name: component.name,
          isDefault: Boolean(component.is_default),
          props: synthesizeProps(component),
          schemaProps: component.props ?? [],
        };
        if (!component.file) return base;
        if (!isSafeComponentFile(component.file)) return null;
        try {
          await stat(path.join(root, component.file));
        } catch {
          return null;
        }
        return {
          ...base,
          importPath: toComponentImportSpecifier(component.file),
          file: component.file,
          variants: await scanVariantAxes(component.file, component.name, (perFile.get(component.file) ?? 1) === 1),
        };
      }),
    );

    return entries.filter((entry): entry is ResolvedComponentEntry => entry !== null);
  }

  async function writeFileIfChanged(absolutePath: string, content: string): Promise<boolean> {
    try {
      if ((await readFile(absolutePath, "utf8")) === content) return false;
    } catch {
      // missing → fall through to write
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    return true;
  }

  async function usesTanstackRouter(): Promise<boolean> {
    try {
      const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return !!(pkg.dependencies?.["@tanstack/react-router"] ?? pkg.devDependencies?.["@tanstack/react-router"]);
    } catch {
      return false;
    }
  }

  async function writePreviewRoutes(): Promise<boolean> {
    const mockupChanged = await writeFileIfChanged(path.join(root, MOCKUP_ROUTE_FILE), MOCKUP_ROUTE_SOURCE);
    const componentChanged = await writeFileIfChanged(path.join(root, COMPONENT_ROUTE_FILE), COMPONENT_ROUTE_SOURCE);
    return mockupChanged || componentChanged;
  }

  let refreshInFlight = false;
  let refreshQueued = false;

  async function refresh(): Promise<boolean> {
    if (refreshInFlight) {
      refreshQueued = true;
      return false;
    }

    refreshInFlight = true;
    let changed = false;
    try {
      const [discoveredMockups, componentEntries] = await Promise.all([
        discoverComponents(),
        discoverComponentEntries(),
      ]);
      const nextSource = generateSource(discoveredMockups, componentEntries);
      if (nextSource !== currentSource) {
        currentSource = nextSource;
        const generatedModuleAbsPath = getGeneratedModuleAbsPath();
        await mkdir(path.dirname(generatedModuleAbsPath), { recursive: true });
        await writeFile(generatedModuleAbsPath, currentSource);
        changed = true;
      }
    } catch (error) {
      // Never propagate: buildStart awaits this (a throw fails the build) and
      // the watcher handlers fire-and-forget it (unhandled rejection).
      console.warn("[mockup-preview] refresh failed; previews degrade to empty:", error);
      changed = await ensureGeneratedModuleExists();
    } finally {
      refreshInFlight = false;
    }

    if (refreshQueued) {
      refreshQueued = false;
      const followUpChanged = await refresh();
      return changed || followUpChanged;
    }

    return changed;
  }

  // The routes statically import the generated module: after a failed refresh
  // it must still exist (empty) or the build fails on an unresolvable import.
  async function ensureGeneratedModuleExists(): Promise<boolean> {
    const generatedModuleAbsPath = getGeneratedModuleAbsPath();
    try {
      await stat(generatedModuleAbsPath);
      return false;
    } catch {
      try {
        currentSource = generateSource([], []);
        await mkdir(path.dirname(generatedModuleAbsPath), { recursive: true });
        await writeFile(generatedModuleAbsPath, currentSource);
        return true;
      } catch {
        return false;
      }
    }
  }

  function previewHTML(componentPath: string): string {
    const importPath = `@/components/mockups/${componentPath}.tsx`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview: ${escapeHTML(componentPath)}</title>
  <style>
    html, body {
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #fff !important;
    }

    #mockup-root {
      width: 100% !important;
      height: 100% !important;
    }
  </style>
</head>
<body>
  <div id="mockup-root"></div>
  <script type="module">
    import React from "react";
    import ReactDOM from "react-dom/client";
    import ${JSON.stringify(APP_CSS_IMPORT)};

    const root = ReactDOM.createRoot(document.getElementById("mockup-root"));

    import(${JSON.stringify(importPath)}).then((mod) => {
      const Comp = mod.default || mod.Preview || Object.values(mod).find((value) => typeof value === "function");
      if (Comp) {
        root.render(React.createElement(Comp));
      } else {
        root.render(React.createElement("pre", { style: { color: "red", padding: "2rem" } },
          "No exported component found in " + ${JSON.stringify(componentPath)} + ".tsx"));
      }
    }).catch((err) => {
      root.render(React.createElement("pre", { style: { color: "red", padding: "2rem" } },
        "Failed to load: " + err.message));
    });
  </script>
  ${SELECTOR_SCRIPT_TAG}
</body>
</html>`;
  }

  function toComponentImportSpecifier(file: string): string {
    const normalized = file.split(path.sep).join(path.posix.sep).replace(/^\/+/, "");
    return normalized.startsWith("src/") ? "@/" + normalized.slice("src/".length) : "/" + normalized;
  }

  function representativePropValue(prop: SchemaProp, componentName: string): string | number | boolean | undefined {
    if (prop.default !== undefined && prop.default !== "") {
      switch (prop.type) {
        case "boolean":
          return prop.default === "true";
        case "number": {
          const parsed = Number(prop.default);
          return Number.isNaN(parsed) ? 1 : parsed;
        }
        case "enum":
        case "string":
          return prop.default;
        default:
          return undefined;
      }
    }
    if (prop.type === "enum" && prop.values && prop.values.length > 0) return prop.values[0];
    switch (prop.type) {
      case "string":
        return componentName;
      case "number":
        return 1;
      case "boolean":
        return false;
      default:
        return undefined;
    }
  }

  // The published schema's props array is never populated, so a component's
  // variant enums come from its own source. Parse-only — no Program, no
  // type-checker: a library mid-authoring routinely has type errors, and a
  // syntactic scan still finds the axis. Never throws.
  async function scanVariantAxes(
    file: string,
    componentName: string,
    exclusive: boolean,
  ): Promise<VariantAxes | undefined> {
    let ts: typeof TS;
    try {
      const mod = await import("typescript");
      ts = ((mod as { default?: typeof TS }).default ?? mod) as typeof TS;
    } catch {
      return undefined;
    }

    try {
      const source = await readFile(path.join(root, file), "utf8");
      // setParentNodes: cvaConstName walks up to the variable declaration.
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const axes: VariantAxes = {};
      const unions = new Map<string, string[]>();

      // `const buttonVariants = cva(...)` -> "buttonVariants"; undefined when the
      // call is not directly assigned to a variable.
      const cvaConstName = (call: TS.CallExpression): string | undefined => {
        const parent = call.parent as TS.Node | undefined;
        if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
        return undefined;
      };

      const keyOf = (name: TS.PropertyName): string | undefined =>
        ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

      const objectKeys = (object: TS.ObjectLiteralExpression): string[] =>
        object.properties.flatMap((property) => {
          const key = property.name ? keyOf(property.name) : undefined;
          return key ? [key] : [];
        });

      // `"a" | "b"` — every member must be a string literal, or it is not an axis.
      // Parens are unwrapped and a nullish member skipped, so `("a" | "b")` and
      // `"a" | "b" | undefined` still read as two-value axes.
      const unwrapType = (node: TS.TypeNode): TS.TypeNode =>
        ts.isParenthesizedTypeNode(node) ? unwrapType(node.type) : node;

      const literalUnion = (node: TS.TypeNode): string[] | undefined => {
        const root = unwrapType(node);
        const members = ts.isUnionTypeNode(root) ? root.types : [root];
        const values: string[] = [];
        for (const raw of members) {
          const member = unwrapType(raw);
          if (member.kind === ts.SyntaxKind.UndefinedKeyword || member.kind === ts.SyntaxKind.NullKeyword) continue;
          if (!ts.isLiteralTypeNode(member)) return undefined;
          if (member.literal.kind === ts.SyntaxKind.NullKeyword) continue;
          if (!ts.isStringLiteral(member.literal)) return undefined;
          values.push(member.literal.text);
        }
        return values.length > 1 ? values : undefined;
      };

      // cva(base, { variants: { variant: { primary: … } } }) — the inner keys are the values.
      const collectCva = (call: TS.CallExpression): void => {
        for (const argument of call.arguments) {
          if (!ts.isObjectLiteralExpression(argument)) continue;
          for (const property of argument.properties) {
            if (!ts.isPropertyAssignment(property) || keyOf(property.name) !== "variants") continue;
            if (!ts.isObjectLiteralExpression(property.initializer)) continue;
            for (const axis of property.initializer.properties) {
              if (!ts.isPropertyAssignment(axis) || !ts.isObjectLiteralExpression(axis.initializer)) continue;
              const name = keyOf(axis.name);
              const values = objectKeys(axis.initializer);
              if (name && values.length > 1) axes[name] = values;
            }
          }
        }
      };

      const collectUnionsAndCva = (node: TS.Node): void => {
        if (ts.isTypeAliasDeclaration(node)) {
          const values = literalUnion(node.type);
          if (values) unions.set(node.name.text, values);
        } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cva") {
          // Compound files (card.tsx exporting Card, CardHeader, …) must not
          // hand every export the first cva axis they happen to share a file
          // with: take the `<name>Variants` const, or anything only when this
          // component owns the file outright.
          if (exclusive || cvaConstName(node) === lowerFirst(componentName) + "Variants") collectCva(node);
        }
        ts.forEachChild(node, collectUnionsAndCva);
      };
      ts.forEachChild(sourceFile, collectUnionsAndCva);

      // `interface ButtonProps { variant?: ButtonVariant }` — resolved against the
      // aliases above. Runs second so a cva axis wins over a redeclared prop.
      // Same scoping rule as cva: `<Name>Props`, or any `*Props` only when this
      // component is the file's sole export.
      const ownProps = componentName + "Props";
      const propsMembers = (node: TS.Node): readonly TS.TypeElement[] | undefined => {
        const named = (name: string): boolean => name === ownProps || (exclusive && name.endsWith("Props"));
        if (ts.isInterfaceDeclaration(node) && named(node.name.text)) return node.members;
        if (ts.isTypeAliasDeclaration(node) && named(node.name.text) && ts.isTypeLiteralNode(node.type)) {
          return node.type.members;
        }
        return undefined;
      };

      const collectProps = (node: TS.Node): void => {
        for (const member of propsMembers(node) ?? []) {
          if (!ts.isPropertySignature(member) || !member.type) continue;
          const name = keyOf(member.name);
          if (!name || axes[name]) continue;
          const values =
            literalUnion(member.type) ??
            (ts.isTypeReferenceNode(member.type) && ts.isIdentifier(member.type.typeName)
              ? unions.get(member.type.typeName.text)
              : undefined);
          if (values) axes[name] = values;
        }
        ts.forEachChild(node, collectProps);
      };
      ts.forEachChild(sourceFile, collectProps);

      return Object.keys(axes).length > 0 ? axes : undefined;
    } catch {
      return undefined;
    }
  }

  // How many schema components claim each source file, so a compound file's
  // exports are not each handed the whole file's axes.
  function componentsPerFile(components: SchemaComponent[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const component of components) {
      if (component.file) counts.set(component.file, (counts.get(component.file) ?? 0) + 1);
    }
    return counts;
  }

  function synthesizeProps(component: SchemaComponent): Record<string, string | number | boolean> {
    const props: Record<string, string | number | boolean> = {};
    for (const prop of component.props ?? []) {
      if (!prop.required) continue;
      const value = representativePropValue(prop, previewDisplayName(component.name));
      if (value !== undefined) props[prop.name] = value;
    }
    return props;
  }

  function errorPreviewHTML(title: string, message: string, color = "red"): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Preview: ${escapeHTML(title)}</title>
</head>
<body>
  <pre style="color: ${escapeHTML(color)}; padding: 2rem; white-space: pre-wrap; font-family: ui-monospace, monospace;">${escapeHTML(message)}</pre>
  <script>
    window.parent?.postMessage({ type: "lov-canvas-preview-ready" }, "*");
    window.parent?.postMessage({ type: "lov-canvas-preview-status", previewPath: ${JSON.stringify(title)}, revision: new URLSearchParams(window.location.search).get("revision"), status: "error", message: ${JSON.stringify(message)} }, "*");
  </script>
</body>
</html>`;
  }

  // Pure function of a resolved component: no I/O, so a build-time emitter can reuse it.
  // The axis is resolved by the caller (scanning is I/O) — absent means single mount.
  function componentPreviewHTML(component: SchemaComponent): string {
    if (!component.file) {
      return errorPreviewHTML(
        component.name,
        `"${component.name}" has no source file to render (npm / Path B component).`,
        "#6b7280",
      );
    }
    const importPath = toComponentImportSpecifier(component.file);
    const nameLiteral = JSON.stringify(component.name);
    const propsLiteral = JSON.stringify(synthesizeProps(component)).replace(/</g, "\\u003c");
    const schemaPropsLiteral = JSON.stringify(component.props ?? []).replace(/</g, "\\u003c");
    const childrenLiteral = JSON.stringify(previewDisplayName(component.name)).replace(/</g, "\\u003c");
    const exportNameLiteral = JSON.stringify(pascalCaseFromFileName(component.name));
    const primaryExport = component.is_default
      ? `mod.default ?? mod[${nameLiteral}] ?? mod[${exportNameLiteral}]`
      : `mod[${nameLiteral}] ?? mod[${exportNameLiteral}] ?? mod.default`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview: ${escapeHTML(component.name)}</title>
  <style>
    html, body {
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #fff !important;
    }

    #component-root {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div id="component-root"></div>
  <script type="module">
    import React from "react";
    import ReactDOM from "react-dom/client";
    import ${JSON.stringify(APP_CSS_IMPORT)};

    const componentRoot = document.getElementById("component-root");
    const root = ReactDOM.createRoot(componentRoot);
    const baseProps = ${propsLiteral};
    const schemaProps = ${schemaPropsLiteral};
    const children = ${childrenLiteral};
    const sourceFile = ${JSON.stringify(component.file)};
    const sourceName = ${nameLiteral};
    const previewPath = ${nameLiteral};
    let Component = null;
    let specimenProps = {};

    function reportPreviewStatus(status, message) {
      const revision = new URLSearchParams(window.location.search).get("revision");
      window.parent?.postMessage({ type: "lov-canvas-preview-status", previewPath, revision, status, message }, "*");
    }
    window.parent?.postMessage({ type: "lov-canvas-preview-ready" }, "*");

    const JSX_SOURCE_KEY = Symbol.for("__jsxSource__");
    function stampSource(node, fileName, columnNumber, displayName) {
      if (!node || !fileName) return;
      node[JSX_SOURCE_KEY] = { fileName, lineNumber: 1, columnNumber, displayName: displayName || undefined };
      const map = window.sourceElementMap ?? new Map();
      window.sourceElementMap = map;
      const key = fileName + ":1:" + columnNumber;
      const refs = map.get(key) ?? new Set();
      refs.add(new WeakRef(node));
      map.set(key, refs);
    }

    function specimenPropsFromMessage(message) {
      if (!message || typeof message !== "object" || message.type !== "DS_SPECIMEN_PROPS") return null;
      const props = message.payload?.props;
      if (!props || typeof props !== "object" || Array.isArray(props)) return null;
      const entries = Object.entries(props);
      if (entries.length > 64) return null;
      const bounded = {};
      for (const [name, value] of entries) {
        if (!/^[A-Za-z_$][A-Za-z0-9_$-]{0,127}$/.test(name)) return null;
        if (typeof value === "string" && value.length <= 8192) bounded[name] = value;
        else if (typeof value === "number" && Number.isFinite(value)) bounded[name] = value;
        else if (typeof value === "boolean") bounded[name] = value;
        else return null;
      }
      if (schemaProps.length === 0) return bounded;
      const normalized = {};
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

    function mount(Comp, withChildren) {
      return React.createElement(Comp, { ...baseProps, ...specimenProps }, withChildren ? children : undefined);
    }

    class RetryWithoutChildren extends React.Component {
      state = { attempt: 0 };
      componentDidCatch() {
        if (this.state.attempt === 1) reportPreviewStatus("error", "Component threw while rendering.");
        this.setState((previous) => ({ attempt: previous.attempt + 1 }));
      }
      render() {
        if (this.state.attempt >= 2) {
          return React.createElement("pre", { style: { color: "red", padding: "2rem" } },
            "Component threw while rendering.");
        }
        return React.createElement(React.Fragment, null,
          mount(this.props.comp, this.state.attempt === 0),
          React.createElement(PreviewRenderSuccess));
      }
    }

    class PreviewRenderSuccess extends React.Component {
      componentDidMount() {
        reportPreviewStatus("ready");
      }
      render() {
        return null;
      }
    }

    function renderSpecimen() {
      if (Component) root.render(React.createElement(RetryWithoutChildren, {
        key: JSON.stringify(specimenProps),
        comp: Component,
      }));
    }

    window.addEventListener("message", (event) => {
      if (event.source !== parent) return;
      const next = specimenPropsFromMessage(event.data);
      if (!next) return;
      specimenProps = next;
      renderSpecimen();
    });

    stampSource(componentRoot, sourceFile, 0, sourceName);

    const RENDERABLE = new Set(["react.forward_ref", "react.memo", "react.lazy"].map((type) => Symbol.for(type)));
    const isRenderableExport = (value) => typeof value === "function"
      || (typeof value === "object" && value !== null && RENDERABLE.has(value.$$typeof));

    import(${JSON.stringify(importPath).replace(/</g, "\\u003c")}).then((mod) => {
      Component = ${primaryExport} ?? Object.values(mod).find(isRenderableExport);
      if (Component) {
        renderSpecimen();
      } else {
        const message = "No exported component found for " + ${nameLiteral};
        root.render(React.createElement("pre", { style: { color: "red", padding: "2rem" } }, message));
        reportPreviewStatus("error", message);
      }
    }).catch((err) => {
      const message = "Failed to load: " + err.message;
      root.render(React.createElement("pre", { style: { color: "red", padding: "2rem" } }, message));
      reportPreviewStatus("error", message);
    });
  </script>
  ${SELECTOR_SCRIPT_TAG}
</body>
</html>`;
  }

  // Drafts are unexported and .dsignore'd by design, so neither the published schema
  // nor the barrel fallback can name them; glob them in separately.
  async function discoverDraftCandidates(): Promise<SchemaComponent[]> {
    const files = await walkSource(path.join(root, "src"));
    return files
      .map((absolutePath) => path.relative(root, absolutePath).split(path.sep).join(path.posix.sep))
      .filter((file) => isDraftCandidateFile(file))
      .map((file) => ({ name: draftCandidateName(file), file }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  // A draft keeps the props of the component it explores, so it needs that component's
  // prop samples: mounted with an empty bag, a draft with a required prop renders blank
  // while the canonical tile beside it works.
  function inheritExploredProps(draft: SchemaComponent, schema: SchemaComponent[]): SchemaComponent {
    const sourceStem = draftCandidateSourceStem(draft.file ?? draft.name);
    const sourceName = normalizeJoinKey(fileBaseName(sourceStem));
    const explored =
      schema.find((component) => component.file && componentFileStem(component.file) === sourceStem) ??
      schema.find((component) => normalizeJoinKey(component.name) === sourceName);
    return explored?.props ? { ...draft, props: explored.props } : draft;
  }

  // The published schema plus every draft found on disk. Drafts never collide with
  // a schema name (their filename carries the -candidate- infix), so no dedup.
  async function loadPreviewComponents(): Promise<SchemaComponent[] | null> {
    const [schema, drafts] = await Promise.all([loadSchemaComponents(), discoverDraftCandidates()]);
    if (!schema) return drafts.length > 0 ? drafts : null;
    return [...schema, ...drafts.map((draft) => inheritExploredProps(draft, schema))];
  }

  async function loadSchemaComponents(): Promise<SchemaComponent[] | null> {
    try {
      const raw = await readFile(path.join(root, SCHEMA_PATH), "utf8");
      const parsed = JSON.parse(raw) as { components?: unknown };
      if (!Array.isArray(parsed.components)) return [];
      // Drifted schemas exist in prod: skip malformed entries, never throw —
      // buildStart awaits refresh(), so a throw here blocks the user's build.
      return parsed.components.filter(isValidSchemaComponent);
    } catch {
      // Pre-publish there's no design-system.json; enumerate the public
      // components straight from the src/index.ts barrel so frames render before
      // first publish (EVERY-2515). Names + files only — no props/tokens.
      return deriveComponentsFromSource();
    }
  }

  function isValidSchemaComponent(entry: unknown): entry is SchemaComponent {
    if (typeof entry !== "object" || entry === null) return false;
    const c = entry as Record<string, unknown>;
    if (typeof c.name !== "string" || c.name === "") return false;
    if (c.file !== undefined && c.file !== null && typeof c.file !== "string") return false;
    if (c.props !== undefined && c.props !== null && !Array.isArray(c.props)) return false;
    return true;
  }

  // Enumerate public components from the src/index.ts re-export barrel — the
  // curated "these are the components" list — mapping each to its source file.
  // The fallback when no published schema exists yet. Never throws.
  async function deriveComponentsFromSource(): Promise<SchemaComponent[] | null> {
    let barrel: string;
    try {
      barrel = await readFile(path.join(root, "src/index.ts"), "utf8");
    } catch {
      return null;
    }
    const out: SchemaComponent[] = [];
    const seen = new Set<string>();
    const reExport = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = reExport.exec(barrel)) !== null) {
      if (match[1]) continue; // `export type { ... }` is not a renderable component
      const file = await resolveBarrelExport(match[3]);
      if (!file) continue;
      for (const specifier of match[2].split(",")) {
        const name = specifier
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        // Components are PascalCase named exports; skip lowercase utilities.
        if (!name || seen.has(name) || !/^[A-Z][A-Za-z0-9]*$/.test(name)) continue;
        seen.add(name);
        out.push({ name, file });
      }
    }
    return out.length > 0 ? out : null;
  }

  // Resolve a barrel re-export target ("./components/alert") to an existing
  // source file under src/ with a real extension (matches isSafeComponentFile).
  async function resolveBarrelExport(specifier: string): Promise<string | undefined> {
    if (!specifier.startsWith(".")) return undefined; // only local re-exports
    const target = path.posix.normalize(path.posix.join("src", specifier.replace(/^\.\//, "")));
    if (!target.startsWith("src/")) return undefined;
    const candidates = [
      `${target}.tsx`,
      `${target}.ts`,
      `${target}.jsx`,
      `${target}.js`,
      path.posix.join(target, "index.tsx"),
      path.posix.join(target, "index.ts"),
    ];
    for (const candidate of candidates) {
      try {
        if ((await stat(path.join(root, candidate))).isFile()) return candidate;
      } catch {
        // not this extension — try the next
      }
    }
    return undefined;
  }

  function addPreviewMiddleware(server: ViteDevServer): void {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "";
      const match = url.match(/^\/__mockup\/preview\/(.+?)(?:\?.*)?$/);
      if (!match) return next();

      let componentPath: string;
      try {
        componentPath = decodeURIComponent(match[1]);
      } catch {
        return next();
      }
      if (!isSafeComponentPath(componentPath)) return next();

      const html = previewHTML(componentPath);

      let body = html;
      try {
        body = await server.transformIndexHtml(url, html);
      } catch {
        // transformIndexHtml can throw under a terminal SSR plugin (tanstackStart);
        // serve the untransformed shell instead of 404ing via the SSR catch-all.
      }
      res.setHeader("Content-Type", "text/html");
      res.statusCode = 200;
      res.end(body);
    });
  }

  function addComponentPreviewMiddleware(server: ViteDevServer): void {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "";
      const match = url.match(/^\/__component\/preview\/([^?]+)(?:\?(.*))?$/);
      if (!match) return next();

      let componentName: string;
      try {
        componentName = decodeURIComponent(match[1]);
      } catch {
        return next();
      }
      if (!isSafeComponentPath(componentName)) return next();
      const components = await loadPreviewComponents();
      let html: string;
      if (!components) {
        html = errorPreviewHTML(
          componentName,
          `${SCHEMA_PATH} is missing or unreadable — publish the design system first.`,
        );
      } else {
        const component = components.find((candidate) => candidate.name === componentName);
        html = component
          ? componentPreviewHTML(component)
          : errorPreviewHTML(componentName, `Component "${componentName}" not found in ${SCHEMA_PATH}.`);
      }

      let body = html;
      try {
        body = await server.transformIndexHtml(url, html);
      } catch {
        // transformIndexHtml can throw under a terminal SSR plugin (tanstackStart);
        // serve the untransformed shell instead of 404ing via the SSR catch-all.
      }
      res.setHeader("Content-Type", "text/html");
      res.statusCode = 200;
      res.end(body);
    });
  }

  return {
    name: "mockup-preview",
    enforce: "pre",

    async configResolved(config) {
      root = config.root;
      // Routes import @tanstack/react-router — skip stacks without it. Written
      // in configResolved so the route-tree generator's scan sees them.
      try {
        if (await usesTanstackRouter()) await writePreviewRoutes();
      } catch (error) {
        console.warn("[mockup-preview] route self-install failed:", error);
      }
    },

    async buildStart() {
      await refresh();
    },

    configureServer(server) {
      addPreviewMiddleware(server);
      addComponentPreviewMiddleware(server);

      return async () => {
        await mkdir(getMockupsAbsDir(), { recursive: true });
        await refresh();

        server.watcher.add(getMockupsAbsDir());
        const isMockupPreviewFile = (file: string): boolean => {
          const relativeToMockups = path.relative(getMockupsAbsDir(), file);
          return (
            !relativeToMockups.startsWith("..") &&
            !path.isAbsolute(relativeToMockups) &&
            relativeToMockups.endsWith(".tsx") &&
            isPreviewTarget(relativeToMockups)
          );
        };
        const isPreviewSource = (file: string): boolean => {
          if (isMockupPreviewFile(file)) return true;
          const projectRelative = path.relative(root, file).split(path.sep).join(path.posix.sep);
          return isDraftCandidateFile(projectRelative);
        };
        server.watcher.on("add", (file) => {
          if (isPreviewSource(file)) void refresh();
        });
        server.watcher.on("unlink", (file) => {
          if (isPreviewSource(file)) void refresh();
        });
      };
    },
  };
}
