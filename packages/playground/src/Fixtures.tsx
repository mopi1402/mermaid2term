import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { TABS, placeOf } from "@/corpus";
import { Title } from "@/chrome";
import { type Fixture, type Tab } from "@/model";

// A drag the system takes back ends as surely as one let go.
const ENDINGS = ["pointerup", "pointercancel", "lostpointercapture"] as const;

function Handle({
  onWidth,
  onDragging,
}: {
  onWidth: (pixels: number) => void;
  onDragging: (active: boolean) => void;
}) {
  const grab = (start: React.PointerEvent<HTMLDivElement>) => {
    start.preventDefault();
    const strip = start.currentTarget;
    strip.setPointerCapture(start.pointerId);
    onDragging(true);
    const move = (event: PointerEvent) => onWidth(event.clientX);
    const release = () => {
      strip.releasePointerCapture(start.pointerId);
      strip.removeEventListener("pointermove", move);
      for (const ending of ENDINGS) strip.removeEventListener(ending, release);
      onDragging(false);
    };
    strip.addEventListener("pointermove", move);
    for (const ending of ENDINGS) strip.addEventListener(ending, release);
  };

  return (
    <div
      onPointerDown={grab}
      className="hover:bg-sidebar-border absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize touch-none"
    />
  );
}

export function Fixtures({
  selected,
  onSelect,
  onWidth,
  onDragging,
}: {
  selected: string | undefined;
  onSelect: (fixture: Fixture) => void;
  onWidth: (pixels: number) => void;
  onDragging: (active: boolean) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const place = placeOf(selected);
    return new Set(place === undefined ? [] : [place.family]);
  });
  const [tab, setTab] = useState<Tab>(() => placeOf(selected)?.tab ?? "showcase");

  useEffect(() => {
    const place = placeOf(selected);
    if (place === undefined) return;
    setTab((before) => (before === "all" || before === place.tab ? before : place.tab));
    setOpen((before) => (before.has(place.family) ? before : new Set([...before, place.family])));
  }, [selected]);

  const families = TABS[tab].families;
  const count = TABS[tab].count;
  const readable = tab !== "all";

  const toggle = (name: string) =>
    setOpen((before) => {
      const after = new Set(before);
      if (!after.delete(name)) after.add(name);
      return after;
    });

  return (
    <Sidebar>
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-12 flex-row items-center gap-2 px-4">
          <Title>examples</Title>
          <span className="text-muted-foreground/60 ml-auto font-mono text-[11px]">{count}</span>
        </div>
        <div className="px-3 pb-3">
          <div className="bg-sidebar-accent flex rounded-md p-0.5">
            {(["showcase", "real", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 cursor-pointer rounded-[5px] py-1 text-[11px] font-medium transition-colors ${
                  tab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TABS[value].label}
              </button>
            ))}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="border-t">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {families.map((family) => (
                <Collapsible
                  key={family.name}
                  asChild
                  open={open.has(family.name)}
                  onOpenChange={() => toggle(family.name)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer text-[12px]">
                        <span className="truncate">{family.label}</span>
                        <span className="text-muted-foreground/60 ml-auto text-[11px]">{family.sources.length}</span>
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {family.sources.map((fixture) => (
                          <SidebarMenuSubItem key={fixture.name}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={fixture.name === selected}
                              className={`text-[12px] ${readable ? "" : "font-mono"}`}
                            >
                              <button type="button" onClick={() => onSelect(fixture)} title={fixture.name} className="w-full cursor-pointer">
                                <span className="truncate">{readable ? fixture.label : fixture.name}</span>
                              </button>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <Handle onWidth={onWidth} onDragging={onDragging} />
    </Sidebar>
  );
}
