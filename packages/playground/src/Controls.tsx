import { BORDER_MODES, CHARSET_NAMES, type BorderMode } from "@tayomi/mermaid2term";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AVAILABLE_THEMES } from "@/theme";

export interface Knobs {
  readonly theme: string;
  readonly onTheme: (name: string) => void;
  readonly autoRotate: boolean;
  readonly onAutoRotate: (on: boolean) => void;
  readonly autoWrap: boolean;
  readonly onAutoWrap: (on: boolean) => void;
  readonly borders: BorderMode;
  readonly onBorders: (mode: BorderMode) => void;
  readonly charset: string;
  readonly onCharset: (name: string) => void;
}

const LABEL = "text-muted-foreground text-[11px] tracking-wide";
const TRIGGER = "h-8 py-0 font-mono text-xs";
const ITEM = "font-mono text-xs";
const KNOB = "flex items-center gap-2";

function Picked({
  id,
  options,
  value,
  width,
  onPick,
}: {
  readonly id: string;
  readonly options: readonly string[];
  readonly value: string;
  readonly width: string;
  readonly onPick: (chosen: string) => void;
}) {
  return (
    <div className={KNOB}>
      <Label htmlFor={id} className={LABEL}>
        {id}
      </Label>
      <Select value={value} onValueChange={onPick}>
        <SelectTrigger id={id} className={`${TRIGGER} ${width}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((name) => (
            <SelectItem key={name} value={name} className={ITEM}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggled({
  id,
  on,
  onToggle,
}: {
  readonly id: string;
  readonly on: boolean;
  readonly onToggle: (on: boolean) => void;
}) {
  return (
    <div className={KNOB}>
      <Switch id={id} checked={on} onCheckedChange={onToggle} />
      <Label htmlFor={id} className={LABEL}>
        {id}
      </Label>
    </div>
  );
}

export function Controls(knobs: Knobs) {
  return (
    <div className="bg-card flex h-12 min-w-0 shrink-0 items-center gap-4 border-t px-4">
      <Picked id="theme" options={AVAILABLE_THEMES} value={knobs.theme} width="w-32" onPick={knobs.onTheme} />
      <Toggled id="autorotate" on={knobs.autoRotate} onToggle={knobs.onAutoRotate} />
      <Toggled id="autowrap" on={knobs.autoWrap} onToggle={knobs.onAutoWrap} />
      <Picked
        id="borders"
        options={BORDER_MODES}
        value={knobs.borders}
        width="w-28"
        onPick={(mode) => knobs.onBorders(BORDER_MODES.find((known) => known === mode) ?? knobs.borders)}
      />
      <Picked id="charset" options={CHARSET_NAMES} value={knobs.charset} width="w-28" onPick={knobs.onCharset} />
    </div>
  );
}
