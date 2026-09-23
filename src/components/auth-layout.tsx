import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandMark, ThemeLangPill } from "./theme-lang";

export function AuthLayout({
  variant,
  children,
}: {
  variant: "cream" | "forest";
  children: ReactNode;
}) {
  const forest = variant === "forest";
  const img = forest ? "/img/leaves-forest.jpg" : "/img/leaves-cream.jpg";
  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col items-center overflow-hidden px-5 pb-12 pt-5",
        forest ? "nature-variant-forest bg-forest" : "bg-cream",
      )}
    >
      <div className="nature-scene" aria-hidden>
        <div className="nature-blob nature-blob-a" />
        <div className="nature-blob nature-blob-b" />
        <img className="nature-photo nature-photo-left" src={img} alt="" />
        <img className="nature-photo nature-photo-right" src={img} alt="" />
      </div>
      <header className="relative z-10 flex w-full max-w-[1120px] items-center justify-between gap-4 px-2 pb-4">
        <BrandMark light={forest} />
        <ThemeLangPill inverted={forest} />
      </header>
      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 mt-3 w-full max-w-[520px] rounded-[32px] border border-white/40 bg-paper px-9 py-9 shadow-[var(--shadow-card)] max-sm:px-5">
      {children}
    </div>
  );
}

export function Field({
  icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  return (
    <label className="relative mb-3 block">
      <span className="pointer-events-none absolute top-1/2 left-4 grid size-[18px] -translate-y-1/2 text-muted">
        {icon}
      </span>
      <input
        {...props}
        className="h-12 w-full rounded-full border border-transparent bg-paper-2 pr-4 pl-11 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-forest-mid/35 focus:bg-paper focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-forest)_12%,transparent)]"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "mt-1.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-mid font-display text-[15px] font-bold text-paper transition hover:bg-forest-hover disabled:opacity-60",
        className,
      )}
    >
      {children}
      <span aria-hidden className="text-base font-extrabold">
        →
      </span>
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "mt-1.5 inline-flex h-12 w-full items-center justify-center rounded-full border-[1.5px] border-forest/30 bg-transparent font-display text-[15px] font-bold text-ink-soft transition hover:bg-forest/6 hover:text-ink disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}