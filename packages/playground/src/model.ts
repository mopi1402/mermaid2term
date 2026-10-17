export type Shelf = "showcase" | "real" | "control";

export interface Fixture {
  name: string;
  label: string;
  source: string;
  shelf: Shelf;
  notes?: string[];
}

export interface Family {
  name: string;
  label: string;
  sources: Fixture[];
}

export type Tab = "showcase" | "real" | "all";
