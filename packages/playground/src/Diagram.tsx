import { useEffect, useRef, useState } from "react";

import { Elapsed } from "@/chrome";

type Rendered = { ok: true; svg: string; elapsed: number } | { ok: false; error: string };

type Mermaid = (typeof import("mermaid"))["default"];

let loading: Promise<Mermaid> | undefined;
let configured: MermaidTheme | undefined;

const DARK_THEME = "dark";
const LIGHT_THEME = "default";
export type MermaidTheme = typeof DARK_THEME | typeof LIGHT_THEME;
export const mermaidTheme = (dark: boolean): MermaidTheme => (dark ? DARK_THEME : LIGHT_THEME);

export const settings = (theme: MermaidTheme) => ({
  startOnLoad: false,
  theme,
  securityLevel: "strict" as const,
  suppressErrorRendering: true,
});

const loaded = (theme: MermaidTheme): Promise<Mermaid> => {
  // mermaid ships `tidy-tree` as a package of its own that a site registers; without it, `layout: tidy-tree` falls back.
  loading ??= Promise.all([import("mermaid"), import("@mermaid-js/layout-tidy-tree")])
    .then(([{ default: mermaid }, { default: tidyTree }]) => {
      mermaid.registerLayoutLoaders(tidyTree);
      return mermaid;
    })
    .catch((reason: unknown) => {
      loading = undefined;
      throw reason;
    });
  return loading.then((mermaid) => {
    if (configured !== theme) {
      mermaid.initialize(settings(theme));
      configured = theme;
    }
    return mermaid;
  });
};

let queue: Promise<unknown> = Promise.resolve();

// The clock runs around `render` alone, after the queue, the imports and our own pane's layout.
export const draw = (
  id: string,
  source: string,
  theme: MermaidTheme,
  stale: () => boolean
): Promise<{ svg: string; elapsed: number } | undefined> => {
  const next = queue.then(async () => {
    if (stale()) return undefined;
    const mermaid = await loaded(theme);
    await mermaid.parse(source, { suppressErrors: true });
    if (stale()) return undefined;
    document.body.getBoundingClientRect();
    const started = performance.now();
    const { svg } = await mermaid.render(id, source);
    return { svg, elapsed: performance.now() - started };
  });
  queue = next.catch(() => undefined);
  return next;
};

export function Diagram({ source, theme }: { source: string; theme: MermaidTheme }) {
  const [rendered, setRendered] = useState<Rendered | undefined>(undefined);
  const counter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (source.trim() === "") {
      setRendered(undefined);
      return;
    }

    draw(`diagram-${counter.current++}`, source, theme, () => cancelled).then(
      (drawn) => {
        if (!cancelled && drawn !== undefined) setRendered({ ok: true, ...drawn });
      },
      (error: unknown) => {
        if (!cancelled) setRendered({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [source, theme]);

  if (rendered === undefined) return <div className="min-h-0 flex-1 border-t" />;

  if (!rendered.ok) {
    return (
      <pre className="text-destructive min-h-0 flex-1 overflow-auto border-t p-4 font-mono text-[12px] whitespace-pre-wrap">
        {rendered.error}
      </pre>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto border-t p-4">
        <div
          className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: rendered.svg }}
        />
      </div>
      <Elapsed ms={rendered.elapsed} title="the time mermaid spent generating this diagram" />
    </div>
  );
}
