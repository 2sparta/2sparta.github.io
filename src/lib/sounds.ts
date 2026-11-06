import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppSound =
  "navigate" | "success" | "notification" | "move" | "capture" | "check" | "end";

export const useSoundPrefs = create<{
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.35,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "class-space-sounds:v1",
      skipHydration: true,
      merge: (persisted, current) => {
        const saved =
          persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {};
        return {
          ...current,
          enabled: typeof saved.enabled === "boolean" ? saved.enabled : current.enabled,
          volume:
            typeof saved.volume === "number" && Number.isFinite(saved.volume)
              ? Math.max(0, Math.min(1, saved.volume))
              : current.volume,
        };
      },
    },
  ),
);

let context: AudioContext | undefined;

/** Called from a user gesture. No audio or network requests on page load. */
export function unlockAudio() {
  if (typeof window === "undefined" || !useSoundPrefs.getState().enabled) return;
  try {
    if (!window.AudioContext) return;
    context ??= new window.AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Audio is optional: unsupported/blocked audio must never interrupt play.
  }
}

/** Short, locally synthesized sounds; no media files or external services. */
export function playSound(sound: AppSound) {
  const { enabled, volume } = useSoundPrefs.getState();
  if (!enabled || !volume || !context || context.state !== "running") return;
  const notes: Record<AppSound, number[]> = {
    navigate: [620],
    success: [660, 880],
    notification: [780, 1040],
    move: [260],
    capture: [180, 130],
    check: [440, 554],
    end: [523, 659, 784],
  };
  try {
    const audio = context;
    notes[sound].forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * (sound === "end" ? 0.12 : 0.065);
      const length = sound === "navigate" ? 0.035 : sound === "move" ? 0.07 : 0.13;
      oscillator.type = sound === "move" || sound === "capture" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, start + length);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume * 0.18, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + length + 0.01);
    });
  } catch {
    // A suspended or closed audio device is not an application error.
  }
}
