import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./i18n";

export type Theme = "light" | "dark";

type Prefs = {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const usePrefs = create<Prefs>()(
  persist(
    (set, get) => ({
      lang: "uk",
      theme: "light",
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const theme = get().theme === "light" ? "dark" : "light";
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "klasnyi-prostir-prefs",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

export function initPrefsDom() {
  const theme = usePrefs.getState().theme;
  applyTheme(theme);
}
