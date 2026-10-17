import { ExternalLink, Moon, Sun, ZoomIn, ZoomOut } from "lucide-react";
import { DARK_BACKGROUND, type Background } from "@tayomi/mermaid2term";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { REPOSITORY, ZOOM_BASE, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/settings";

export function Title({ children }: { children: string }) {
  return <span className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">{children}</span>;
}

const PRECISE_UNDER = 10;
const asMs = (elapsed: number): string =>
  elapsed < PRECISE_UNDER ? elapsed.toFixed(1) : String(Math.round(elapsed));

export function Elapsed({ ms, title }: { ms: number; title: string }) {
  return (
    <Badge
      variant="outline"
      className="bg-card/75 text-muted-foreground pointer-events-none absolute right-3 bottom-3 z-10 font-mono text-[10px] font-normal tabular-nums shadow-sm backdrop-blur-sm select-none"
      title={title}
    >
      Rendered in {asMs(ms)} ms
    </Badge>
  );
}

export function Zoom({ zoom, onZoom }: { zoom: number; onZoom: (target: number) => void }) {
  const step = (direction: number): number => (Math.round(zoom / ZOOM_STEP) + direction) * ZOOM_STEP;

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onZoom(step(-1))}
        disabled={zoom <= ZOOM_MIN}
        aria-label="Zoom out"
      >
        <ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onZoom(ZOOM_BASE)}
        className="text-muted-foreground w-11 font-mono text-[11px] tabular-nums"
        aria-label="Back to 100 %"
      >
        {zoom}%
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onZoom(step(1))}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
      >
        <ZoomIn />
      </Button>
    </div>
  );
}

export function Masthead({ background, onToggle }: { background: Background; onToggle: () => void }) {
  const towards = background === DARK_BACKGROUND ? "switch to light" : "switch to dark";

  return (
    <header className="flex h-8 shrink-0 items-center gap-2 px-1">
      <SidebarTrigger className="size-7" />
      <span className="text-[17px] font-semibold tracking-tight">mermaid2term</span>
      <span className="text-muted-foreground/60 text-[13px]">playground</span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground ml-auto"
        onClick={onToggle}
        title={towards}
        aria-label={towards}
      >
        {background === DARK_BACKGROUND ? <Sun /> : <Moon />}
      </Button>
      <a
        href={REPOSITORY}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-mono text-[11px]"
      >
        mopi1402/mermaid2term
        <ExternalLink className="size-3" />
      </a>
    </header>
  );
}
