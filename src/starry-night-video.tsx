"use client";

import { useEffect, useRef, useState } from "react";
import dayBackgroundPoster from "./assets/night-library/day-background-poster.png";
import dayBackground from "./assets/night-library/day_background.mp4";
import starryBackgroundPoster from "./assets/night-library/starry-background-poster.png";
import starryBackground from "./assets/night-library/starry_background.mp4";

export type LibraryTheme = "day" | "night";
type TransitionPhase = "covering" | "idle" | "revealing";

const libraryBackgrounds = {
  day: {
    poster: dayBackgroundPoster,
    video: dayBackground,
  },
  night: {
    poster: starryBackgroundPoster,
    video: starryBackground,
  },
} satisfies Record<LibraryTheme, { poster: string; video: string }>;

export const getSystemTheme = (): LibraryTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";

const getMotionAllowed = () =>
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function safelyPlay(video: HTMLVideoElement) {
  const playRequest = video.play();
  if (playRequest) {
    void playRequest.catch(() => {
      // Decorative media can remain on its current frame when autoplay is unavailable.
    });
  }
}

function waitForDelay(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, duration);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function waitForVideoReady(video: HTMLVideoElement, signal: AbortSignal) {
  return new Promise<"aborted" | "error" | "ready">((resolve) => {
    if (signal.aborted) {
      resolve("aborted");
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve("ready");
      return;
    }

    const finish = (result: "aborted" | "error" | "ready") => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
      resolve(result);
    };
    const handleReady = () => finish("ready");
    const handleError = () => finish("error");
    const handleAbort = () => finish("aborted");
    const timeout = window.setTimeout(() => finish("error"), 2400);

    video.addEventListener("loadeddata", handleReady, { once: true });
    video.addEventListener("canplay", handleReady, { once: true });
    video.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export default function LibraryBackgroundVideo({
  readerOpen,
  requestedTheme,
}: {
  readerOpen: boolean;
  requestedTheme: LibraryTheme;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initialThemeRef = useRef<LibraryTheme>(requestedTheme);
  const [theme, setTheme] = useState<LibraryTheme>(initialThemeRef.current);
  const [motionAllowed, setMotionAllowed] = useState(getMotionAllowed);
  const [transition, setTransition] = useState<{
    direction: `to-${LibraryTheme}`;
    phase: TransitionPhase;
  }>({ direction: `to-${initialThemeRef.current}`, phase: "idle" });
  const themeRef = useRef(theme);
  const desiredThemeRef = useRef(theme);
  const motionAllowedRef = useRef(motionAllowed);
  const readerOpenRef = useRef(readerOpen);
  const processingThemeRef = useRef(false);
  const requestThemeRef = useRef<((theme: LibraryTheme) => void) | null>(null);

  readerOpenRef.current = readerOpen;
  motionAllowedRef.current = motionAllowed;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncSourceWithPreference = () => {
      const allowMotion = !reducedMotion.matches;
      motionAllowedRef.current = allowMotion;
      setMotionAllowed(allowMotion);

      if (allowMotion) {
        const activeBackground = libraryBackgrounds[themeRef.current];
        video.poster = activeBackground.poster;
        video.preload = "metadata";
        if (video.getAttribute("src") !== activeBackground.video) {
          video.src = activeBackground.video;
          video.load();
        }
        return;
      }

      video.pause();
      video.autoplay = false;
      video.preload = "none";
      video.removeAttribute("src");
      video.load();
    };

    reducedMotion.addEventListener("change", syncSourceWithPreference);

    return () => {
      reducedMotion.removeEventListener("change", syncSourceWithPreference);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const controller = new AbortController();

    const processThemeChanges = async () => {
      if (processingThemeRef.current) return;
      processingThemeRef.current = true;

      while (
        !controller.signal.aborted &&
        desiredThemeRef.current !== themeRef.current
      ) {
        const incomingTheme = desiredThemeRef.current;
        const direction = `to-${incomingTheme}` as const;
        const coverDuration = motionAllowedRef.current ? 440 : 80;
        const revealDuration = motionAllowedRef.current ? 680 : 80;

        setTransition({ direction, phase: "covering" });
        await waitForDelay(coverDuration, controller.signal);
        if (controller.signal.aborted) break;

        const incomingBackground = libraryBackgrounds[incomingTheme];
        video.pause();
        video.poster = incomingBackground.poster;
        themeRef.current = incomingTheme;
        setTheme(incomingTheme);

        let ready: "aborted" | "error" | "ready" = "ready";
        if (motionAllowedRef.current) {
          video.preload = "metadata";
          video.src = incomingBackground.video;
          video.load();
          ready = await waitForVideoReady(video, controller.signal);
        } else {
          video.autoplay = false;
          video.preload = "none";
          video.removeAttribute("src");
          video.load();
        }

        if (ready === "aborted") break;
        if (ready === "error") {
          video.removeAttribute("src");
          video.load();
        }

        const shouldPlay =
          motionAllowedRef.current &&
          !readerOpenRef.current &&
          !document.hidden &&
          ready === "ready";
        video.autoplay = shouldPlay;
        if (shouldPlay) safelyPlay(video);

        setTransition({ direction, phase: "revealing" });
        await waitForDelay(revealDuration, controller.signal);
        if (controller.signal.aborted) break;
        setTransition({ direction, phase: "idle" });
      }

      processingThemeRef.current = false;
    };

    requestThemeRef.current = (incomingTheme: LibraryTheme) => {
      desiredThemeRef.current = incomingTheme;

      const incomingPoster = new Image();
      incomingPoster.src = libraryBackgrounds[incomingTheme].poster;

      void processThemeChanges();
    };

    return () => {
      controller.abort();
      requestThemeRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestThemeRef.current?.(requestedTheme);
  }, [requestedTheme]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncPlayback = () => {
      const shouldPlay = motionAllowed && !readerOpen && !document.hidden;
      video.autoplay = shouldPlay;

      if (shouldPlay) {
        safelyPlay(video);
      } else {
        video.pause();
      }
    };

    syncPlayback();
    video.addEventListener("canplay", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);

    return () => {
      video.removeEventListener("canplay", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, [motionAllowed, readerOpen]);

  const activeBackground = libraryBackgrounds[theme];

  return (
    <>
      <video
        ref={videoRef}
        className="starry-night-video"
        data-theme={theme}
        autoPlay={motionAllowed && !readerOpen}
        muted
        loop
        playsInline
        preload={motionAllowed ? "metadata" : "none"}
        src={motionAllowed ? activeBackground.video : undefined}
        poster={activeBackground.poster}
        controls={false}
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        onError={(event) => {
          const video = event.currentTarget;
          if (video.hasAttribute("src")) {
            video.removeAttribute("src");
            video.load();
          }
        }}
      />
      <div className="night-video-overlay" data-theme={theme} aria-hidden="true" />
      <div className="paper-grain" aria-hidden="true" />
      <div
        className="library-theme-transition"
        data-direction={transition.direction}
        data-phase={transition.phase}
        aria-hidden="true"
      />
    </>
  );
}
