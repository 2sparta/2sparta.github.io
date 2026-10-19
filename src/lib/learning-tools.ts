/** Add future learning tools here to expose them in both navigation surfaces. */
export const LEARNING_TOOLS = [
  { id: "atlas", uk: "Історична мапа", en: "Historical map" },
  { id: "chess", uk: "Шахи", en: "Chess" },
  { id: "periodic", uk: "Періодична таблиця", en: "Periodic table" },
] as const;
export type LearningTool = (typeof LEARNING_TOOLS)[number]["id"];
export function validateToolSearch(search: Record<string, unknown>): {
  tool?: LearningTool;
  chessTab?: "play" | "openings" | "analysis" | "tournaments";
  chessGame?: string;
  chessTournament?: string;
  element?: number;
  layout?: "compact" | "long";
} {
  const element = Number(search.element);
  const validId = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
  return {
    ...(["play", "openings", "analysis", "tournaments"].includes(String(search.chessTab))
      ? { chessTab: search.chessTab as "play" | "openings" | "analysis" | "tournaments" }
      : {}),
    ...(validId(search.chessGame) ? { chessGame: search.chessGame as string } : {}),
    ...(validId(search.chessTournament)
      ? { chessTournament: search.chessTournament as string }
      : {}),
    ...(LEARNING_TOOLS.some((tool) => tool.id === search.tool)
      ? { tool: search.tool as LearningTool }
      : {}),
    ...(Number.isInteger(element) && element >= 1 && element <= 118 ? { element } : {}),
    ...(search.layout === "compact" || search.layout === "long" ? { layout: search.layout } : {}),
  };
}
