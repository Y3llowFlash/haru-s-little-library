"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import backgroundMusic from "./assets/night-library/new_bgm.mp3";

const HOME_VOLUME = 0.18;
const READER_VOLUME = 0.1;
const FADE_IN_MS = 1050;
const FADE_OUT_MS = 550;
const DUCK_FADE_MS = 600;
const FADE_STEP_MS = 40;

export default function LibraryBgm({ readerOpen }: { readerOpen: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const playbackCommandRef = useRef(0);
  const enabledRef = useRef(false);
  const mountedRef = useRef(true);
  const targetVolumeRef = useRef(HOME_VOLUME);
  const [enabled, setEnabled] = useState(false);

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (targetVolume: number, duration: number, onComplete?: () => void) => {
      const audio = audioRef.current;
      if (!audio) return;

      clearFade();

      const target = Math.min(1, Math.max(0, targetVolume));
      const startVolume = audio.volume;
      const volumeDifference = target - startVolume;

      if (Math.abs(volumeDifference) < 0.001 || duration <= 0) {
        audio.volume = target;
        onComplete?.();
        return;
      }

      const startedAt = performance.now();
      fadeTimerRef.current = window.setInterval(() => {
        const progress = Math.min((performance.now() - startedAt) / duration, 1);
        audio.volume = startVolume + volumeDifference * progress;

        if (progress === 1) {
          clearFade();
          onComplete?.();
        }
      }, FADE_STEP_MS);
    },
    [clearFade],
  );

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const command = ++playbackCommandRef.current;
    clearFade();

    // A fresh or fully paused start begins silently. If a visitor reverses a
    // fade-out, keep the current level so rapid presses do not cause a jump.
    if (audio.paused) {
      audio.volume = 0;
    }

    try {
      await audio.play();
    } catch {
      if (command === playbackCommandRef.current && mountedRef.current) {
        enabledRef.current = false;
        setEnabled(false);
        audio.pause();
        audio.volume = 0;
      }
      return;
    }

    if (command !== playbackCommandRef.current) {
      if (!enabledRef.current || document.hidden) {
        audio.pause();
      }
      return;
    }

    if (!enabledRef.current || document.hidden) {
      audio.pause();
      return;
    }

    fadeTo(targetVolumeRef.current, FADE_IN_MS);
  }, [clearFade, fadeTo]);

  const handleToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabledRef.current) {
      enabledRef.current = false;
      setEnabled(false);
      playbackCommandRef.current += 1;
      clearFade();

      if (audio.paused) {
        audio.volume = 0;
        return;
      }

      fadeTo(0, FADE_OUT_MS, () => {
        if (!enabledRef.current) {
          audio.pause();
        }
      });
      return;
    }

    enabledRef.current = true;
    setEnabled(true);
    void startPlayback();
  };

  useEffect(() => {
    targetVolumeRef.current = readerOpen ? READER_VOLUME : HOME_VOLUME;

    const audio = audioRef.current;
    if (enabledRef.current && audio && !audio.paused && !document.hidden) {
      fadeTo(targetVolumeRef.current, DUCK_FADE_MS);
    }
  }, [fadeTo, readerOpen]);

  useEffect(() => {
    const handleFirstInteraction = (event: PointerEvent) => {
      const target = event.target;

      // The toggle owns its own click so a pointer press on it cannot enable
      // the music here and then immediately disable it in handleToggle.
      if (target instanceof Element && target.closest(".library-bgm-toggle")) {
        return;
      }

      if (enabledRef.current) return;

      enabledRef.current = true;
      setEnabled(true);
      void startPlayback();
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      capture: true,
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, {
        capture: true,
      });
    };
  }, [startPlayback]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;

      playbackCommandRef.current += 1;
      clearFade();

      if (document.hidden) {
        audio.pause();
        audio.volume = 0;
        return;
      }

      if (enabledRef.current) {
        void startPlayback();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearFade, startPlayback]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      enabledRef.current = false;
      playbackCommandRef.current += 1;
      clearFade();
      audioRef.current?.pause();
    };
  }, [clearFade]);

  const accessibleLabel = enabled
    ? "Pause background music"
    : "Play background music";

  return (
    <>
      <button
        className="library-bgm-toggle"
        type="button"
        aria-label={accessibleLabel}
        aria-pressed={enabled}
        title={accessibleLabel}
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
          {enabled ? (
            <>
              <path d="M15 9.25a4 4 0 0 1 0 5.5" />
              <path d="M17.5 6.75a7.5 7.5 0 0 1 0 10.5" />
            </>
          ) : (
            <>
              <path d="m15.5 10 4 4" />
              <path d="m19.5 10-4 4" />
            </>
          )}
        </svg>
      </button>
      <audio
        ref={audioRef}
        className="library-bgm-audio"
        src={backgroundMusic}
        loop
        preload="none"
      />
    </>
  );
}
