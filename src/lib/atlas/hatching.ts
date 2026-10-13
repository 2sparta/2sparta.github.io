/** SVG hatch definitions live in the exact renderer SVG that contains the path. */
export function ensureAtlasHatch(svg: SVGElement, id: string, color: string) {
  if (svg.querySelector(`[id="${id}"]`)) return;
  const ns = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(ns, "defs");
    svg.prepend(defs);
  }
  const pattern = document.createElementNS(ns, "pattern");
  pattern.id = id;
  pattern.setAttribute("width", "9");
  pattern.setAttribute("height", "9");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  const bg = document.createElementNS(ns, "rect");
  bg.setAttribute("width", "9");
  bg.setAttribute("height", "9");
  bg.setAttribute("fill", color);
  bg.setAttribute("fill-opacity", "0.10");
  pattern.append(bg);
  const strokes = document.createElementNS(ns, "path");
  strokes.setAttribute("d", "M-2 2L2 -2M0 9L9 0M7 11L11 7");
  strokes.setAttribute("stroke", color);
  strokes.setAttribute("stroke-width", "1.8");
  strokes.setAttribute("fill", "none");
  pattern.append(strokes);
  defs.append(pattern);
}
