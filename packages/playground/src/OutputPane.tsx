import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Controls, type Knobs } from "@/Controls";
import { Elapsed, Title, Zoom } from "@/chrome";
import type { Drawing } from "@/drawing";
import { useSelectionCopy } from "@/selection";
import { DRAWING, MIN_WIDTH, NO_LIGATURES } from "@/settings";
import type { Viewport } from "@/viewport";

const COPIED_FOR = 1200;

export function OutputPane({ drawing, view, knobs }: { drawing: Drawing; view: Viewport; knobs: Knobs }) {
  const [copied, setCopied] = useState(false);

  useSelectionCopy(view.display, drawing.ok ? drawing.plain : undefined);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () =>
    navigator.clipboard.writeText(drawing.ok ? drawing.plain : drawing.error).then(
      () => {
        clearTimeout(timer.current);
        setCopied(true);
        timer.current = setTimeout(() => setCopied(false), COPIED_FOR);
      },
      () => undefined
    );

  return (
    <div ref={view.area} className="flex h-full min-w-0 flex-col">
      <div className="bg-card flex h-12 shrink-0 items-center gap-3 px-4">
        <Title>output</Title>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="width" className="text-muted-foreground text-[11px] tracking-wide">
            width
          </Label>
          <Input
            id="width"
            type="number"
            min={MIN_WIDTH}
            value={view.typed}
            onChange={(event) => view.onWidthTyped(event.target.value)}
            className="h-8 w-20 font-mono text-xs"
          />
          <span
            className="text-muted-foreground/70 shrink-0 font-mono text-[11px] whitespace-nowrap tabular-nums"
            title="the lines the pane shows, given to the library along with the width"
          >
            × {view.height ?? "?"}
          </span>
          <Zoom zoom={view.zoom} onZoom={view.changeZoom} />
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      {drawing.ok ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <pre
            ref={view.display}
            style={{ ...DRAWING, ...view.font }}
            className="min-h-0 flex-1 overflow-auto border-t p-4 font-mono"
            dangerouslySetInnerHTML={{ __html: drawing.html }}
          />
          <Elapsed ms={drawing.elapsed} title="the time the library spent rendering this source" />
        </div>
      ) : (
        <pre
          ref={view.display}
          style={NO_LIGATURES}
          className="text-destructive min-h-0 flex-1 overflow-auto border-t p-4 font-mono text-[12px] leading-none"
        >
          {drawing.error}
        </pre>
      )}
      <Controls {...knobs} />
    </div>
  );
}
