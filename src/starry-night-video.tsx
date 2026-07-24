"use client";

import { useEffect, useRef, useState } from "react";
import dayBackgroundPoster from "./assets/night-library/day-background-poster.png";
import dayBackground from "./assets/night-library/day_background.mp4";
import starryBackgroundPoster from "./assets/night-library/starry-background-poster.png";
import starryBackground from "./assets/night-library/starry_background.mp4";

export type LibraryTheme = "day" | "night";
type LayerSlot = "primary" | "secondary";
type TransitionState = {
  from: LayerSlot;
  to: LayerSlot;
  phase: "loading" | "crossfading";
};

const CROSSFADE_DURATION = 1400;
const REDUCED_MOTION_CROSSFADE_DURATION = 180;
const INCOMING_VIDEO_TIMEOUT = 2600;

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

const getOtherSlot = (slot: LayerSlot): LayerSlot =>
  slot === "primary" ? "secondary" : "primary";

function safelyPlay(video: HTMLVideoElement) {
  const playRequest = video.play();
  if (playRequest) {
    void playRequest.catch(() => {
      // Decorative media can remain on its poster/current frame when autoplay is unavailable.
    });
  }
}

export default function LibraryBackgroundVideo({
  readerOpen,
  requestedTheme,
}: {
  readerOpen: boolean;
  requestedTheme: LibraryTheme;
}) {
  const initialThemeRef = useRef<LibraryTheme>(requestedTheme);
  const videoRefs = useRef<Record<LayerSlot, HTMLVideoElement | null>>({
    primary: null,
    secondary: null,
  });
  const [motionAllowed, setMotionAllowed] = useState(getMotionAllowed);
  const [visibleSlot, setVisibleSlot] = useState<LayerSlot>("primary");
  const [layers, setLayers] = useState<Record<LayerSlot, LibraryTheme | null>>({
    primary: initialThemeRef.current,
    secondary: null,
  });
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setMotionAllowed(!reducedMotion.matches);

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);

    return () => {
      reducedMotion.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  useEffect(() => {
    const activeTheme = layers[visibleSlot];
    if (transition || activeTheme === requestedTheme) return;

    const incomingSlot = getOtherSlot(visibleSlot);
    setLayers((currentLayers) => ({
      ...currentLayers,
      [incomingSlot]: requestedTheme,
    }));
    setTransition({
      from: visibleSlot,
      to: incomingSlot,
      phase: "loading",
    });
  }, [layers, requestedTheme, transition, visibleSlot]);

  useEffect(() => {
    if (!transition || transition.phase !== "loading") return;

    const incomingVideo = videoRefs.current[transition.to];
    if (!incomingVideo) return;

    let cancelled = false;
    let readinessTimer: number | null = null;

    const beginCrossfade = () => {
      if (cancelled) return;

      if (readinessTimer !== null) {
        window.clearTimeout(readinessTimer);
        readinessTimer = null;
      }

      incomingVideo.removeEventListener("loadeddata", beginCrossfade);
      incomingVideo.removeEventListener("canplay", beginCrossfade);
      incomingVideo.removeEventListener("error", beginCrossfade);

      const shouldPlay = motionAllowed && !readerOpen && !document.hidden;
      if (shouldPlay && incomingVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        safelyPlay(incomingVideo);
      }

      // Let React paint the incoming poster/frame at opacity 0 before fading it in.
      window.setTimeout(() => {
        if (!cancelled) {
          setTransition((currentTransition) =>
            currentTransition && currentTransition.to === transition.to
              ? { ...currentTransition, phase: "crossfading" }
              : currentTransition,
          );
        }
      }, 32);
    };

    if (!motionAllowed || incomingVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      beginCrossfade();
    } else {
      incomingVideo.addEventListener("loadeddata", beginCrossfade, { once: true });
      incomingVideo.addEventListener("canplay", beginCrossfade, { once: true });
      // The poster is a safe fallback if the MP4 is slow or unavailable.
      incomingVideo.addEventListener("error", beginCrossfade, { once: true });
      readinessTimer = window.setTimeout(beginCrossfade, INCOMING_VIDEO_TIMEOUT);
    }

    return () => {
      cancelled = true;
      if (readinessTimer !== null) window.clearTimeout(readinessTimer);
      incomingVideo.removeEventListener("loadeddata", beginCrossfade);
      incomingVideo.removeEventListener("canplay", beginCrossfade);
      incomingVideo.removeEventListener("error", beginCrossfade);
    };
  }, [motionAllowed, readerOpen, transition]);

  useEffect(() => {
    if (!transition || transition.phase !== "crossfading") return;

    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
    }

    const duration = motionAllowed
      ? CROSSFADE_DURATION
      : REDUCED_MOTION_CROSSFADE_DURATION;

    finishTimerRef.current = window.setTimeout(() => {
      const outgoingVideo = videoRefs.current[transition.from];
      outgoingVideo?.pause();

      setVisibleSlot(transition.to);
      setLayers((currentLayers) => ({
        ...currentLayers,
        [transition.from]: null,
      }));
      setTransition(null);
      finishTimerRef.current = null;
    }, duration);

    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [motionAllowed, transition]);

  useEffect(() => {
    const syncPlayback = () => {
      (Object.keys(videoRefs.current) as LayerSlot[]).forEach((slot) => {
        const video = videoRefs.current[slot];
        const theme = layers[slot];
        if (!video || !theme) return;

        const participatesInTransition =
          transition !== null && (transition.from === slot || transition.to === slot);
        const shouldPlay =
          motionAllowed &&
          !readerOpen &&
          !document.hidden &&
          (slot === visibleSlot || participatesInTransition);

        video.autoplay = shouldPlay;
        if (shouldPlay) safelyPlay(video);
        else video.pause();
      });
    };

    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [layers, motionAllowed, readerOpen, transition, visibleSlot]);

  useEffect(
    () => () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
      }
      (Object.keys(videoRefs.current) as LayerSlot[]).forEach((slot) => {
        const video = videoRefs.current[slot];
        if (!video) return;
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    },
    [],
  );

  const crossfadeDuration = motionAllowed
    ? CROSSFADE_DURATION
    : REDUCED_MOTION_CROSSFADE_DURATION;

  const renderLayer = (slot: LayerSlot) => {
    const layerTheme = layers[slot];
    if (!layerTheme) return null;

    const background = libraryBackgrounds[layerTheme];
    const isIncoming = transition?.to === slot;
    const isOutgoing = transition?.from === slot;
    const isCrossfading = transition?.phase === "crossfading";
    const isVisible = isCrossfading
      ? isIncoming
      : slot === visibleSlot || isOutgoing;

    return (
      <div
        key={slot}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -3,
          overflow: "hidden",
          pointerEvents: "none",
          opacity: isVisible ? 1 : 0,
          transition: `opacity ${crossfadeDuration}ms cubic-bezier(.22, .61, .36, 1)`,
          willChange: transition ? "opacity" : "auto",
        }}
      >
        <video
          ref={(video) => {
            videoRefs.current[slot] = video;
          }}
          className="starry-night-video"
          data-theme={layerTheme}
          muted
          loop
          playsInline
          preload={motionAllowed ? "metadata" : "none"}
          src={motionAllowed ? background.video : undefined}
          poster={background.poster}
          controls={false}
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          style={{ zIndex: 0 }}
          onError={(event) => {
            const video = event.currentTarget;
            if (video.hasAttribute("src")) {
              video.removeAttribute("src");
              video.load();
            }
          }}
        />
        <div
          className="night-video-overlay"
          data-theme={layerTheme}
          aria-hidden="true"
          style={{ zIndex: 1 }}
        />
      </div>
    );
  };

  return (
    <>
      {renderLayer("primary")}
      {renderLayer("secondary")}
      <div className="paper-grain" aria-hidden="true" />
    </>
  );
}
