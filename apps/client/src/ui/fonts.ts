// The game's two typefaces, for text drawn on canvases and in Phaser (CSS uses the same pair: --p-title in popups.css
// for titles, the system font for everything else): Cinzel for names of places, titles and signs, the system font
// for name tags and small print. Cinzel is loaded in index.html; main.ts waits for it before the first scene draws.
export const TITLE_FONT = "'Cinzel', Georgia, serif";
export const BODY_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/** text set in Cinzel goes in capitals, the Turkish way in Turkish (i → İ: Cinzel would draw a lowercase i as a dotless I) */
export function titleCase(text: string, lang: string): string {
  return text.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-GB');
}

/** a canvas font for `text` in the title face, shrunk until it fits `maxW` (signs on boards of a fixed width) */
export function fitTitleFont(c: CanvasRenderingContext2D, text: string, size: number, maxW: number, weight = 700): string {
  let s = size;
  for (; s > 5; s -= 0.5) { c.font = `${weight} ${s}px ${TITLE_FONT}`; if (c.measureText(text).width <= maxW) break; }
  return c.font;
}
