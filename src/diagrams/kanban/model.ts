export interface KanbanCard {
  title: string;
  ticket: string;
  assigned: string;
  // The colour mermaid's `kanbanItem` strokes down the card's left side, as hex; none for `Medium` or an unknown word.
  priority: string | undefined;
}

export interface KanbanColumn {
  title: string;
  cards: KanbanCard[];
}

export interface Kanban {
  title: string;
  columns: KanbanColumn[];
}

export const makeKanban = (): Kanban => ({ title: "", columns: [] });
export const makeKanbanColumn = (title: string): KanbanColumn => ({ title, cards: [] });
