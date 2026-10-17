import { DARK_BACKGROUND, LIGHT_BACKGROUND, type Background } from "@tayomi/mermaid2term";

const STORAGE_KEY = "mermaid2term:background";
const DARK_CLASS = "dark";

export const currentBackground = (): Background =>
  document.documentElement.classList.contains(DARK_CLASS) ? DARK_BACKGROUND : LIGHT_BACKGROUND;

export const setBackground = (background: Background): void => {
  document.documentElement.classList.toggle(DARK_CLASS, background === DARK_BACKGROUND);
  try {
    localStorage.setItem(STORAGE_KEY, background);
  } catch {
  }
};
