import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Title } from "@/chrome";
import { headingOf, readDirection, writeDirection } from "@/direction";
import { NO_LIGATURES } from "@/settings";
import { dedented } from "@/paste";

// The direction picker's entry for a source that names none.
const DEFAULT = "default";

export function SourcePane({
  source,
  onEdit,
  note,
}: {
  source: string;
  onEdit: (text: string) => void;
  note: readonly string[] | undefined;
}) {
  const direction = readDirection(source);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="bg-card flex h-12 shrink-0 items-center justify-between px-4">
        <Title>source</Title>
        {direction !== undefined ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="direction" className="text-muted-foreground text-[11px] tracking-wide">
              Direction
            </Label>
            <Select
              value={direction.current ?? DEFAULT}
              onValueChange={(choice) => onEdit(writeDirection(source, choice === DEFAULT ? undefined : headingOf(choice)))}
            >
              <SelectTrigger id="direction" className="h-7 w-28 py-0 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT} className="font-mono text-xs">
                  Default
                </SelectItem>
                {direction.options.map((heading) => (
                  <SelectItem key={heading} value={heading} className="font-mono text-xs">
                    {heading}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : undefined}
      </div>
      <Textarea
        value={source}
        onChange={(event) => onEdit(event.target.value)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          const tidied = dedented(pasted);
          if (tidied === pasted) return;
          event.preventDefault();
          const field = event.currentTarget;
          field.setRangeText(tidied, field.selectionStart, field.selectionEnd, "end");
          onEdit(field.value);
        }}
        spellCheck={false}
        style={NO_LIGATURES}
        className="min-h-0 flex-1 resize-none rounded-none border-0 border-t bg-transparent p-4 font-mono text-[12px] leading-normal whitespace-pre focus-visible:ring-0"
      />
      {note !== undefined ? (
        <div className="text-muted-foreground max-h-36 shrink-0 overflow-y-auto border-t px-4 py-2.5 text-[12px] leading-relaxed">
          <ul className="list-disc space-y-0.5 pl-4">
            {note.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : undefined}
    </div>
  );
}
