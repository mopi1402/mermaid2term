import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  DARK_BACKGROUND,
  DEFAULT_CHARSET,
  LIGHT_BACKGROUND,
  writeFrontmatterTheme,
  type Background,
  type BorderMode,
} from "@tayomi/mermaid2term";

import { cssVars } from "@/css";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Fixtures } from "@/Fixtures";
import { Diagram, mermaidTheme } from "@/Diagram";
import { BY_NAME } from "@/corpus";
import { type Fixture } from "@/model";
import { written, type Address } from "@/address";
import { INITIAL_SOURCE, addressAt, setAddress } from "@/hash";
import { forMermaidPanel, pickedTheme } from "@/theme";
import { currentBackground, setBackground } from "@/background";
import { Masthead, Title } from "@/chrome";
import { SourcePane } from "@/SourcePane";
import { OutputPane } from "@/OutputPane";
import { draw } from "@/drawing";
import { useThrottled } from "@/throttle";
import { useViewport } from "@/viewport";
import {
  ADDRESS_DELAY,
  DIAGRAM_SHARE,
  DRAWER,
  DRAWER_MAX,
  DRAWER_MIN,
  FLOOR,
  LINE_HEIGHT,
  OUTPUT_FLOOR,
  OUTPUT_SHARE,
  PROBE,
  SOURCE_SHARE,
  TEXT_SHARE,
  THEME,
} from "@/settings";

export function App({ start }: { start: Address }) {
  const [source, setSource] = useState(start.source ?? INITIAL_SOURCE);
  const [selected, setSelected] = useState(start.name);
  const [drawer, setDrawer] = useState(DRAWER);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState(THEME);
  const [autoRotate, setAutoRotate] = useState(true);
  const [autoWrap, setAutoWrap] = useState(true);
  const [borders, setBorders] = useState<BorderMode>("padless");
  const [charset, setCharset] = useState<string>(DEFAULT_CHARSET);
  const [background, setBackgroundState] = useState<Background>(currentBackground);

  const view = useViewport();
  const addressRank = useRef(0);

  const edit = (text: string) => {
    setSource(text);
    setSelected(undefined);
  };

  const toggleBackground = () => {
    const target = background === DARK_BACKGROUND ? LIGHT_BACKGROUND : DARK_BACKGROUND;
    setBackground(target);
    setBackgroundState(target);
  };

  const deferred = useDeferredValue(source);
  const size = useMemo(() => ({ width: view.width, height: view.height }), [view.width, view.height]);
  const drawn = useThrottled(size);
  const drawing = useMemo(
    () => draw(deferred, drawn.width, drawn.height, theme, autoRotate, autoWrap, borders, charset, background),
    [deferred, drawn, theme, autoRotate, autoWrap, borders, charset, background]
  );

  const writeAddress = useCallback((name: string | undefined, text: string, push: boolean) => {
    const mine = ++addressRank.current;
    void written(name, text).then((fragment) => {
      if (addressRank.current === mine) setAddress(fragment, push);
    });
  }, []);

  useEffect(() => {
    const follow = () => {
      const asked = location.hash.slice(1);
      void addressAt(asked).then(({ name, source: carried }) => {
        if (carried === undefined || location.hash.slice(1) !== asked) return;
        setSource(carried);
        setSelected(name);
      });
    };
    addEventListener("hashchange", follow);
    return () => removeEventListener("hashchange", follow);
  }, []);

  useEffect(() => {
    if (selected === start.name && source === (start.source ?? INITIAL_SOURCE)) return;
    const timer = setTimeout(() => writeAddress(selected, source, false), ADDRESS_DELAY);
    return () => clearTimeout(timer);
  }, [source, selected, start, writeAddress]);

  const load = (fixture: Fixture) => {
    setSource(fixture.source);
    setSelected(fixture.name);
    writeAddress(fixture.name, fixture.source, true);
  };

  const fixture = selected === undefined ? undefined : BY_NAME.get(selected);
  const note = fixture !== undefined && source === fixture.source ? fixture.notes : undefined;

  return (
    <SidebarProvider
      style={cssVars({ "--sidebar-width": `${drawer}px` })}
      className={dragging ? "[&_*]:transition-none" : undefined}
    >
      <Fixtures
        selected={selected}
        onSelect={load}
        onWidth={(pixels) => setDrawer(Math.min(Math.max(pixels, DRAWER_MIN), DRAWER_MAX))}
        onDragging={setDragging}
      />
      <SidebarInset className="bg-background h-screen min-w-0 gap-3 overflow-hidden p-3">
        <Masthead background={background} onToggle={toggleBackground} />
        <div ref={view.container} className="min-h-0 flex-1 overflow-hidden rounded-xl border">
          <ResizablePanelGroup orientation="horizontal" onLayoutChanged={view.onHandleDrag}>
            <ResizablePanel defaultSize={SOURCE_SHARE} minSize={FLOOR}>
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={TEXT_SHARE} minSize={FLOOR}>
                  <SourcePane source={source} onEdit={edit} note={note} />
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={DIAGRAM_SHARE} minSize={FLOOR}>
                  <div className="flex h-full min-w-0 flex-col">
                    <div className="bg-card flex h-12 shrink-0 items-center px-4">
                      <Title>mermaid diagram</Title>
                    </div>
                    <Diagram source={forMermaidPanel(deferred, theme, background)} theme={mermaidTheme(background === DARK_BACKGROUND)} />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              defaultSize={OUTPUT_SHARE}
              minSize={OUTPUT_FLOOR}
              panelRef={view.outputPanel}
              onResize={view.onPanelResize}
            >
              <OutputPane
                drawing={drawing}
                view={view}
                knobs={{
                  theme: pickedTheme(source, theme),
                  onTheme: (name) => {
                    setTheme(name);
                    edit(writeFrontmatterTheme(source, name));
                  },
                  autoRotate,
                  onAutoRotate: setAutoRotate,
                  autoWrap,
                  onAutoWrap: setAutoWrap,
                  borders,
                  onBorders: setBorders,
                  charset,
                  onCharset: setCharset,
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <span ref={view.probe} aria-hidden style={{ ...LINE_HEIGHT, ...view.font }} className="invisible absolute font-mono whitespace-pre">
          {PROBE}
        </span>
      </SidebarInset>
    </SidebarProvider>
  );
}
