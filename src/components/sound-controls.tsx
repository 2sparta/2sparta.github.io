import { useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playSound, unlockAudio, useSoundPrefs } from "@/lib/sounds";
import { usePrefs } from "@/lib/prefs";

export function SoundToggle({ className = "" }: { className?: string }) {
  const { enabled, setEnabled } = useSoundPrefs();
  const uk = usePrefs((s) => s.lang === "uk");
  const label = enabled
    ? uk
      ? "Вимкнути звуки"
      : "Mute sounds"
    : uk
      ? "Увімкнути звуки"
      : "Enable sounds";
  return (
    <button
      type="button"
      className={`sound-toggle ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      onClick={() => {
        setEnabled(!enabled);
        if (!enabled) {
          unlockAudio();
          playSound("success");
        }
      }}
    >
      {enabled ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
    </button>
  );
}

export function SoundFeedback() {
  useEffect(() => {
    // Hydrate after the first render so saved mute settings agree with SSR markup.
    void useSoundPrefs.persist.rehydrate();
    const unlock = () => unlockAudio();
    const feedback = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-sound="navigate"]')) playSound("navigate");
    };
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    document.addEventListener("click", feedback);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("click", feedback);
    };
  }, []);
  return null;
}
