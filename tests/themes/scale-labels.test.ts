import { describe, expect, it } from "vitest";
import { getTheme } from "../../src/paint/catalogue.js";
import { MERMAID_THEME_NAMES } from "../../src/paint/mermaid-themes.js";

// Read off mermaid 11.17.0's `getThemeVariables({})` for each theme, `cScaleLabel0` to `cScaleLabel11`.
const MERMAID_SCALE_LABELS: Readonly<Record<string, readonly string[]>> = {
  "base": ["#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333"],
  "dark": ["#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3", "#D3D3D3"],
  "default": ["#FFFFFF", "#000000", "#000000", "#FFFFFF", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
  "forest": ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
  "neutral": ["#F4F4F4", "#333333", "#F4F4F4", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333"],
  "neo": ["#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333", "#333333"],
  "neo-dark": ["#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF"],
  "redux": ["#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D"],
  "redux-dark": ["#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF", "#E0DFDF"],
  "redux-color": ["#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D", "#28253D"],
  "redux-dark-color": ["#230029", "#000000", "#000000", "#1A0032", "#000000", "#0B0035", "#230000", "#000000", "#000623", "#000000", "#000000", "#220004"],
};

describe("cScaleLabel on mermaid's themes", () => {
  it("covers every mermaid theme the package ships", () => {
    expect(Object.keys(MERMAID_SCALE_LABELS).sort()).toEqual([...MERMAID_THEME_NAMES].sort());
  });

  it.each(Object.entries(MERMAID_SCALE_LABELS))("%s states mermaid's twelve section label inks", (name, labels) => {
    expect(getTheme(name).variables.cScaleLabel.map((ink) => ink?.toUpperCase())).toEqual(labels);
  });
});
