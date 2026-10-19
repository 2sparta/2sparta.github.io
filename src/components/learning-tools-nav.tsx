import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Atom, ChevronDown, Compass, Map, Swords } from "lucide-react";
import { LEARNING_TOOLS } from "@/lib/learning-tools";
import { cn } from "@/lib/cn";

export function LearningToolsNav({
  active,
  tool,
  uk,
  onNavigate,
}: {
  active: boolean;
  tool: string;
  uk: boolean;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active, tool]);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="learning-tools-subnav"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-left font-display text-sm font-bold transition-colors",
          active ? "bg-white/15 text-white" : "text-paper/80 hover:bg-white/10 hover:text-white",
        )}
      >
        <Compass className="size-[18px]" />
        {uk ? "Корисне" : "Tools"}
        <ChevronDown
          className={cn("ml-auto size-4 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div
          id="learning-tools-subnav"
          className="ml-5 mt-1 flex flex-col gap-1 border-l border-white/20 pl-2"
        >
          {LEARNING_TOOLS.map((item) => {
            const selected = active && item.id === tool;
            const Icon = item.id === "chess" ? Swords : item.id === "periodic" ? Atom : Map;
            return (
              <Link
                key={item.id}
                to="/app/materials"
                search={{ section: "useful", tool: item.id }}
                aria-current={selected ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2.5 py-3 text-xs font-bold transition-colors",
                  selected
                    ? "bg-white/15 text-white"
                    : "text-paper/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {uk ? item.uk : item.en}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
