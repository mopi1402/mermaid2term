export const DEFAULT_SCORE = 3;

interface JourneyTask {
  title: string;
  score: number;
  actors: string[];
}

export interface JourneySection {
  title: string;
  tasks: JourneyTask[];
}

export interface Journey {
  title: string;
  sections: JourneySection[];
}

export const makeJourney = (): Journey => ({ title: "", sections: [] });
export const makeJourneySection = (title: string): JourneySection => ({ title, tasks: [] });
