/** Add future learning tools here to expose them in both navigation surfaces. */
export const LEARNING_TOOLS = [
  { id: "atlas", uk: "Історична мапа", en: "Historical map" },
  { id: "periodic", uk: "Періодична таблиця", en: "Periodic table" },
] as const;
export type LearningTool = (typeof LEARNING_TOOLS)[number]["id"];
export function validateToolSearch(search: Record<string, unknown>): {
  tool?: LearningTool;
  element?: number;
  layout?: "compact" | "long";
} {
  const element = Number(search.element);
  return {
    ...(LEARNING_TOOLS.some((tool) => tool.id === search.tool)
      ? { tool: search.tool as LearningTool }
      : {}),
    ...(Number.isInteger(element) && element >= 1 && element <= 118 ? { element } : {}),
    ...(search.layout === "compact" || search.layout === "long" ? { layout: search.layout } : {}),
  };
}
