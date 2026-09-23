import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("mb-4 rounded-[22px] border border-hairline bg-paper p-5 shadow-[var(--shadow-soft)]", className)}>
      {children}
    </section>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 font-display text-xl font-extrabold tracking-tight text-ink">{children}</h2>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm text-muted">{children}</p>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 rounded-full border border-transparent bg-paper-2 px-4 text-sm text-ink outline-none focus:border-forest-mid/35 focus:bg-white",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 rounded-full border border-transparent bg-paper-2 px-4 text-sm text-ink outline-none focus:border-forest-mid/35",
        props.className,
      )}
    />
  );
}

export function PillButton({
  children,
  tone = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-full px-5 font-display text-sm font-bold disabled:opacity-60",
        tone === "primary" ? "bg-forest-mid text-paper hover:bg-forest-hover" : "border border-forest/25 text-ink-soft hover:bg-forest/5",
        className,
      )}
    >
      {children}
    </button>
  );
}
