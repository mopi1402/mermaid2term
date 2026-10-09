export interface TimelineEvent {
  title: string;
  details: string[];
}

export interface TimelineSection {
  title: string;
  events: TimelineEvent[];
}

export const TIMELINE_DIRECTIONS = ["LR", "TD"] as const;
type TimelineDirection = (typeof TIMELINE_DIRECTIONS)[number];

export interface Timeline {
  title: string;
  sections: TimelineSection[];
  direction: TimelineDirection | undefined;
  // `config.timeline.disableMulticolor` unset: without a section, each period takes its own colour.
  multicolor: boolean;
}

export const makeTimeline = (): Timeline => ({ title: "", sections: [], direction: undefined, multicolor: true });
export const makeTimelineSection = (title: string): TimelineSection => ({ title, events: [] });
export const makeTimelineEvent = (title: string, details: string[] = []): TimelineEvent => ({ title, details });
