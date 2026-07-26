import { useCallback, useEffect, useRef, useState } from "react";
import howlCastleFallback from "./assets/night-library/howl_castle_fallback.png";
import howlCastleIdleLeft from "./assets/night-library/howl_castle_idle_left.webm";
import howlCastleIdleLeftMobile from "./assets/night-library/howl_castle_idle_left_mobile.webp";
import howlCastleIdleRight from "./assets/night-library/howl_castle_idle_right.webm";
import howlCastleIdleRightMobile from "./assets/night-library/howl_castle_idle_right_mobile.webp";
import howlCastleWalkLeft from "./assets/night-library/howl_castle_walk_left.webm";
import howlCastleWalkLeftMobile from "./assets/night-library/howl_castle_walk_left_mobile.webp";
import howlCastleWalkRight from "./assets/night-library/howl_castle_walk_right.webm";
import howlCastleWalkRightMobile from "./assets/night-library/howl_castle_walk_right_mobile.webp";
import "./howl-character.css";
import TotoroShelfCompanion from "./totoro-shelf-companion";

export type LibraryCharacterChoice = "totoro" | "howl";

const CHARACTER_STORAGE_KEY = "haru-library-character";
const TRANSITION_HALF_DURATION = 180;
const TRAVEL_DURATION_MS = 30_000;
const IDLE_DURATION_MS = 5_500;
const MEDIA_READY_TIMEOUT_MS = 6_000;
const PLAY_RETRY_DELAY_MS = 240;
const EDGE_INSET = 2;
const BOOKEND_SAFETY_GAP = 2;

type HowlState =
  | "resting-at-right"
  | "walking-left"
  | "resting-at-left"
  | "walking-right";

type HowlEndpoint = "left" | "right";
type HowlMediaStatus = "loading" | "ready" | "failed";
type HowlAnimatedElement = HTMLVideoElement | HTMLImageElement;

type HowlClip = {
  src: string;
  next: HowlState;
  endpoint: HowlEndpoint;
  walking: boolean;
};

type ShelfBounds = {
  leftX: number;
  rightX: number;
  y: number;
  size: number;
};

type IdleCountdown = {
  remaining: number;
  startedAt: number;
  timer: number | null;
};

type TravelClock = {
  state: HowlState;
  accumulatedMs: number;
  startedAt: number | null;
};

const HOWL_STATES: HowlState[] = [
  "resting-at-right",
  "walking-left",
  "resting-at-left",
  "walking-right",
];

const HOWL_CLIPS: Record<HowlState, HowlClip> = {
  "resting-at-right": {
    src: howlCastleIdleLeft,
    next: "walking-left",
    endpoint: "right",
    walking: false,
  },
  "walking-left": {
    src: howlCastleWalkLeft,
    next: "resting-at-left",
    endpoint: "left",
    walking: true,
  },
  "resting-at-left": {
    src: howlCastleIdleRight,
    next: "walking-right",
    endpoint: "left",
    walking: false,
  },
  "walking-right": {
    src: howlCastleWalkRight,
    next: "resting-at-right",
    endpoint: "right",
    walking: true,
  },
};

const HOWL_MOBILE_IMAGES: Record<HowlState, string> = {
  "resting-at-right": howlCastleIdleLeftMobile,
  "walking-left": howlCastleWalkLeftMobile,
  "resting-at-left": howlCastleIdleRightMobile,
  "walking-right": howlCastleWalkRightMobile,
};

const isIOSWebKit = () => {
  const userAgent = navigator.userAgent;

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

// Union of the alpha bounds in all four 640×720 clips. Endpoint fitting uses
// visible pixels instead of the clips' transparent canvas.
const HOWL_VISIBLE_LEFT_RATIO = 28 / 640;
const HOWL_VISIBLE_RIGHT_RATIO = 612 / 640;
const HOWL_VISIBLE_WIDTH_RATIO =
  HOWL_VISIBLE_RIGHT_RATIO - HOWL_VISIBLE_LEFT_RATIO;
const HOWL_VISIBLE_FOOT_RATIO = 673 / 720;
const HOWL_CANVAS_ASPECT_RATIO = 720 / 640;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function getSavedLibraryCharacter(): LibraryCharacterChoice {
  if (typeof window === "undefined") return "totoro";

  try {
    const savedChoice = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    return savedChoice === "howl" || savedChoice === "totoro" ? savedChoice : "totoro";
  } catch {
    return "totoro";
  }
}

export function saveLibraryCharacter(choice: LibraryCharacterChoice) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, choice);
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function LibraryCharacterSelector({
  value,
  onChange,
}: {
  value: LibraryCharacterChoice;
  onChange: (choice: LibraryCharacterChoice) => void;
}) {
  const isTotoro = value === "totoro";
  const currentCharacter = isTotoro ? "Totoro" : "Howl's Castle";
  const nextCharacter: LibraryCharacterChoice = isTotoro ? "howl" : "totoro";
  const nextCharacterLabel = isTotoro ? "Howl's Castle" : "Totoro";

  return (
    <button
      className="library-character-toggle"
      type="button"
      aria-label={`Library character: ${currentCharacter}. Switch to ${nextCharacterLabel}`}
      title={`Library character: ${currentCharacter}`}
      onClick={() => onChange(nextCharacter)}
    >
      {isTotoro ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.1 7.2 5.8 3.7c-.2-.6.5-1 1-.6l2.5 2M16.9 7.2l1.3-3.5c.2-.6-.5-1-1-.6l-2.5 2" />
          <path d="M5.2 13.6c0-4.1 2.8-7 6.8-7s6.8 2.9 6.8 7c0 4.4-2.5 7.1-6.8 7.1s-6.8-2.7-6.8-7.1Z" />
          <path d="M8.3 13.7c1.1-.9 2.3-1.3 3.7-1.3s2.6.4 3.7 1.3M9.5 10.1h.01M14.5 10.1h.01" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19.5h14M6.5 19.5v-7l2-1.5 2 1.5v-5l2-1.5 2 1.5v3.2l3 1.8v7" />
          <path d="M7.5 8.8V5.5M16.2 10.9V6.5M5.7 5.5h3.6M14.4 6.5H18M9 15.2h2M14 14.2h2" />
        </svg>
      )}
    </button>
  );
}

export function LibraryCharacter({
  choice,
  readerOpen,
}: {
  choice: LibraryCharacterChoice;
  readerOpen: boolean;
}) {
  const [visibleChoice, setVisibleChoice] = useState(choice);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (choice === visibleChoice) return;

    setIsExiting(true);
    const transitionTimer = window.setTimeout(() => {
      setVisibleChoice(choice);
      setIsExiting(false);
    }, TRANSITION_HALF_DURATION);

    return () => window.clearTimeout(transitionTimer);
  }, [choice, visibleChoice]);

  return (
    <div
      className={`library-character-stage${visibleChoice === "howl" ? " is-howl" : ""}${isExiting ? " is-exiting" : ""}`}
    >
      {visibleChoice === "totoro" ? (
        <TotoroShelfCompanion readerOpen={readerOpen} />
      ) : (
        <HowlCastleCharacter readerOpen={readerOpen} />
      )}
    </div>
  );
}

function HowlCastleCharacter({ readerOpen }: { readerOpen: boolean }) {
  const companionRef = useRef<HTMLDivElement | null>(null);
  const travellerRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<HTMLImageElement | null>(null);
  const videoRefs = useRef<Record<HowlState, HTMLVideoElement | null>>({
    "resting-at-right": null,
    "walking-left": null,
    "resting-at-left": null,
    "walking-right": null,
  });
  const mobileImageRefs = useRef<Record<HowlState, HTMLImageElement | null>>({
    "resting-at-right": null,
    "walking-left": null,
    "resting-at-left": null,
    "walking-right": null,
  });
  const boundsRef = useRef<ShelfBounds | null>(null);
  const stateRef = useRef<HowlState>("resting-at-right");
  const mediaStatusRef = useRef<HowlMediaStatus>("loading");
  const mountedRef = useRef(true);
  const pausedRef = useRef(readerOpen || document.hidden);
  const readerOpenRef = useRef(readerOpen);
  const movementFrameRef = useRef<number | null>(null);
  const idleCountdownRef = useRef<IdleCountdown | null>(null);
  const travelClockRef = useRef<TravelClock | null>(null);
  const transitionTokenRef = useRef(0);
  const [howlState, setHowlState] = useState<HowlState>("resting-at-right");
  const [mediaStatus, setMediaStatus] =
    useState<HowlMediaStatus>("loading");
  const [isIOS] = useState(isIOSWebKit);
  const [motionReduced, setMotionReduced] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  readerOpenRef.current = readerOpen;

  const setTravellerPosition = useCallback((x: number, y: number) => {
    const traveller = travellerRef.current;
    if (!traveller) return;
    traveller.style.setProperty("--howl-x", `${x}px`);
    traveller.style.setProperty("--howl-y", `${y}px`);
  }, []);

  const cancelMovement = useCallback(() => {
    if (movementFrameRef.current !== null) {
      window.cancelAnimationFrame(movementFrameRef.current);
      movementFrameRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    const countdown = idleCountdownRef.current;
    if (!countdown || countdown.timer === null) return;
    window.clearTimeout(countdown.timer);
    countdown.timer = null;
  }, []);

  const positionForState = useCallback(
    (state: HowlState) => {
      const bounds = boundsRef.current;
      if (!bounds) return;

      if (mediaStatusRef.current !== "ready") {
        setTravellerPosition(bounds.rightX, bounds.y);
        return;
      }

      const clip = HOWL_CLIPS[state];
      if (!clip.walking) {
        const x = clip.endpoint === "left" ? bounds.leftX : bounds.rightX;
        setTravellerPosition(x, bounds.y);
        return;
      }

      const travelClock = travelClockRef.current;
      const activeTravelMs =
        travelClock?.state === state && travelClock.startedAt !== null
          ? performance.now() - travelClock.startedAt
          : 0;
      const accumulatedTravelMs =
        travelClock?.state === state
          ? travelClock.accumulatedMs + activeTravelMs
          : 0;
      const progress = clamp(
        accumulatedTravelMs / TRAVEL_DURATION_MS,
        0,
        1,
      );
      const x =
        state === "walking-left"
          ? bounds.rightX + (bounds.leftX - bounds.rightX) * progress
          : bounds.leftX + (bounds.rightX - bounds.leftX) * progress;
      setTravellerPosition(x, bounds.y);
    },
    [setTravellerPosition],
  );

  const hideFallback = useCallback(() => {
    if (fallbackRef.current) fallbackRef.current.dataset.visible = "false";
  }, []);

  const showFallback = useCallback(() => {
    const bounds = boundsRef.current;
    if (bounds) setTravellerPosition(bounds.rightX, bounds.y);
    if (fallbackRef.current) fallbackRef.current.dataset.visible = "true";
  }, [setTravellerPosition]);

  const failMedia = useCallback(() => {
    if (mediaStatusRef.current === "failed") return;
    mediaStatusRef.current = "failed";
    transitionTokenRef.current += 1;
    cancelMovement();
    clearIdleTimer();
    travelClockRef.current = null;
    HOWL_STATES.forEach((state) => {
      const video = videoRefs.current[state];
      if (video) {
        video.pause();
        video.loop = false;
        video.dataset.active = "false";
      }
      const image = mobileImageRefs.current[state];
      if (image) image.dataset.active = "false";
    });
    setMediaStatus("failed");
    showFallback();
  }, [cancelMovement, clearIdleTimer, showFallback]);

  const ensureReady = useCallback((video: HTMLVideoElement) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("error", handleError);
        callback();
      };
      const handleReady = () =>
        finish(() => {
          resolve();
        });
      const handleError = () =>
        finish(() => {
          reject(new Error("Howl clip failed to load"));
        });
      const timer = window.setTimeout(
        () =>
          finish(() => {
            reject(new Error("Howl clip readiness timed out"));
          }),
        MEDIA_READY_TIMEOUT_MS,
      );

      video.addEventListener("loadeddata", handleReady);
      video.addEventListener("canplay", handleReady);
      video.addEventListener("error", handleError);
      video.load();
    });
  }, []);

  const ensureMobileImageReady = useCallback(
    async (image: HTMLImageElement) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          const handleLoad = () => {
            image.removeEventListener("load", handleLoad);
            image.removeEventListener("error", handleError);
            resolve();
          };
          const handleError = () => {
            image.removeEventListener("load", handleLoad);
            image.removeEventListener("error", handleError);
            reject(new Error("Howl mobile animation failed to load"));
          };

          image.addEventListener("load", handleLoad);
          image.addEventListener("error", handleError);
        });
      }

      if (image.naturalWidth === 0) {
        throw new Error("Howl mobile animation has no decoded pixels");
      }

      if (typeof image.decode === "function") {
        await image.decode();
      }
    },
    [],
  );

  const playActiveVideo = useCallback(async (video: HTMLVideoElement) => {
    if (pausedRef.current || mediaStatusRef.current !== "ready") return false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await video.play();
        return true;
      } catch (error) {
        if (pausedRef.current || !mountedRef.current) return false;
        if (error instanceof DOMException && error.name === "NotSupportedError") {
          return false;
        }
        if (attempt === 0) {
          await new Promise<void>((resolve) =>
            window.setTimeout(resolve, PLAY_RETRY_DELAY_MS),
          );
        }
      }
    }

    return false;
  }, []);

  const pauseTravelClock = useCallback((state: HowlState) => {
    const travelClock = travelClockRef.current;
    if (
      travelClock?.state !== state ||
      travelClock.startedAt === null
    ) {
      return;
    }

    travelClock.accumulatedMs = Math.min(
      TRAVEL_DURATION_MS,
      travelClock.accumulatedMs +
        (performance.now() - travelClock.startedAt),
    );
    travelClock.startedAt = null;
  }, []);

  const startWalkingLoop = useCallback(
    (state: HowlState, media: HowlAnimatedElement) => {
      cancelMovement();
      if (!HOWL_CLIPS[state].walking) return;

      const travelClock = travelClockRef.current;
      if (travelClock?.state !== state) return;
      if (travelClock.startedAt === null) {
        travelClock.startedAt = performance.now();
      }

      const phaseToken = transitionTokenRef.current;
      const isMobileImage = media instanceof HTMLImageElement;
      const expectedSource = new URL(
        isMobileImage
          ? HOWL_MOBILE_IMAGES[state]
          : HOWL_CLIPS[state].src,
        document.baseURI,
      ).href;

      const tick = () => {
        movementFrameRef.current = null;
        const sourceMatches =
          (media.currentSrc || media.src) === expectedSource;
        const activeMediaMatches = isMobileImage
          ? isIOS && mobileImageRefs.current[state] === media
          : videoRefs.current[state] === media;
        if (
          !mountedRef.current ||
          mediaStatusRef.current !== "ready" ||
          transitionTokenRef.current !== phaseToken ||
          stateRef.current !== state ||
          !activeMediaMatches ||
          media.dataset.active !== "true" ||
          !sourceMatches
        ) {
          return;
        }

        if (
          pausedRef.current ||
          (!isMobileImage &&
            (media.paused ||
              media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA))
        ) {
          pauseTravelClock(state);
          return;
        }

        const currentTravelClock = travelClockRef.current;
        if (
          currentTravelClock?.state !== state ||
          currentTravelClock.startedAt === null
        ) {
          return;
        }

        const accumulatedTravelMs = Math.min(
          TRAVEL_DURATION_MS,
          currentTravelClock.accumulatedMs +
            (performance.now() - currentTravelClock.startedAt),
        );
        const progress = clamp(
          accumulatedTravelMs / TRAVEL_DURATION_MS,
          0,
          1,
        );
        const bounds = boundsRef.current;
        if (bounds) {
          const x =
            state === "walking-left"
              ? bounds.rightX + (bounds.leftX - bounds.rightX) * progress
              : bounds.leftX + (bounds.rightX - bounds.leftX) * progress;
          setTravellerPosition(x, bounds.y);
        }

        if (progress >= 1) {
          currentTravelClock.accumulatedMs = TRAVEL_DURATION_MS;
          currentTravelClock.startedAt = null;
          if (!isMobileImage) {
            media.pause();
            media.loop = false;
          }
          if (bounds) {
            const endpointX =
              HOWL_CLIPS[state].endpoint === "left"
                ? bounds.leftX
                : bounds.rightX;
            setTravellerPosition(endpointX, bounds.y);
          }
          void activateStateRef.current(HOWL_CLIPS[state].next);
          return;
        }

        movementFrameRef.current = window.requestAnimationFrame(tick);
      };

      movementFrameRef.current = window.requestAnimationFrame(tick);
    },
    [cancelMovement, isIOS, pauseTravelClock, setTravellerPosition],
  );

  const pauseIdleCountdown = useCallback(() => {
    const countdown = idleCountdownRef.current;
    if (!countdown || countdown.timer === null) return;
    countdown.remaining = Math.max(
      0,
      countdown.remaining - (performance.now() - countdown.startedAt),
    );
    clearIdleTimer();
  }, [clearIdleTimer]);

  const activateStateRef = useRef<(state: HowlState) => Promise<void>>(async () => undefined);

  const startIdleCountdown = useCallback(
    (state: HowlState, remaining = IDLE_DURATION_MS) => {
      if (HOWL_CLIPS[state].walking) return;
      clearIdleTimer();
      idleCountdownRef.current = {
        remaining,
        startedAt: performance.now(),
        timer: null,
      };

      if (pausedRef.current || stateRef.current !== state) return;
      idleCountdownRef.current.timer = window.setTimeout(() => {
        const countdown = idleCountdownRef.current;
        if (
          !countdown ||
          stateRef.current !== state ||
          HOWL_CLIPS[state].walking
        ) {
          return;
        }
        countdown.remaining = 0;
        countdown.timer = null;
        void activateStateRef.current(HOWL_CLIPS[state].next);
      }, remaining);
    },
    [clearIdleTimer],
  );

  const activateState = useCallback(
    async (state: HowlState) => {
      if (
        !mountedRef.current ||
        mediaStatusRef.current !== "ready" ||
        motionReduced
      ) {
        return;
      }
      const requestToken = ++transitionTokenRef.current;
      const nextMedia = isIOS
        ? mobileImageRefs.current[state]
        : videoRefs.current[state];
      if (!nextMedia) {
        failMedia();
        return;
      }

      try {
        if (nextMedia instanceof HTMLImageElement) {
          await ensureMobileImageReady(nextMedia);
        } else {
          await ensureReady(nextMedia);
        }
      } catch {
        failMedia();
        return;
      }

      if (
        !mountedRef.current ||
        mediaStatusRef.current !== "ready" ||
        requestToken !== transitionTokenRef.current
      ) {
        return;
      }

      cancelMovement();
      clearIdleTimer();
      idleCountdownRef.current = null;

      HOWL_STATES.forEach((otherState) => {
        const video = videoRefs.current[otherState];
        if (video) {
          video.pause();
          video.loop =
            otherState === state && HOWL_CLIPS[state].walking;
          video.dataset.active =
            !isIOS && otherState === state ? "true" : "false";
        }
        const image = mobileImageRefs.current[otherState];
        if (image) {
          image.dataset.active =
            isIOS && otherState === state ? "true" : "false";
        }
      });

      if (nextMedia instanceof HTMLVideoElement) {
        try {
          nextMedia.currentTime = 0;
          nextMedia.playbackRate = 1;
        } catch {
          failMedia();
          return;
        }
      }

      stateRef.current = state;
      travelClockRef.current = HOWL_CLIPS[state].walking
        ? {
            state,
            accumulatedMs: 0,
            startedAt: null,
          }
        : null;
      if (companionRef.current) {
        companionRef.current.dataset.howlState = state;
      }
      setHowlState(state);
      positionForState(state);
      hideFallback();

      if (pausedRef.current) return;

      if (nextMedia instanceof HTMLImageElement) {
        if (HOWL_CLIPS[state].walking) {
          startWalkingLoop(state, nextMedia);
        } else {
          startIdleCountdown(state);
        }
        return;
      }

      const started = await playActiveVideo(nextMedia);
      if (!started && !pausedRef.current) failMedia();
    },
    [
      cancelMovement,
      clearIdleTimer,
      ensureReady,
      ensureMobileImageReady,
      failMedia,
      hideFallback,
      isIOS,
      motionReduced,
      playActiveVideo,
      positionForState,
      startIdleCountdown,
      startWalkingLoop,
    ],
  );

  activateStateRef.current = activateState;

  const handlePlaying = useCallback(
    (state: HowlState, video: HTMLVideoElement) => {
      if (
        mediaStatusRef.current !== "ready" ||
        pausedRef.current ||
        stateRef.current !== state ||
        video.dataset.active !== "true"
      ) {
        return;
      }

      if (HOWL_CLIPS[state].walking) {
        startWalkingLoop(state, video);
        return;
      }

      positionForState(state);
      const remaining = idleCountdownRef.current?.remaining ?? IDLE_DURATION_MS;
      startIdleCountdown(state, remaining);
    },
    [positionForState, startIdleCountdown, startWalkingLoop],
  );

  const handlePlaybackPause = useCallback(
    (state: HowlState, video: HTMLVideoElement) => {
      if (
        stateRef.current === state &&
        videoRefs.current[state] === video &&
        video.dataset.active === "true"
      ) {
        if (HOWL_CLIPS[state].walking) pauseTravelClock(state);
        cancelMovement();
      }
    },
    [cancelMovement, pauseTravelClock],
  );

  const pauseSequence = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    if (HOWL_CLIPS[stateRef.current].walking) {
      pauseTravelClock(stateRef.current);
    }
    cancelMovement();
    pauseIdleCountdown();
    videoRefs.current[stateRef.current]?.pause();
  }, [cancelMovement, pauseIdleCountdown, pauseTravelClock]);

  const resumeSequence = useCallback(async () => {
    if (
      !pausedRef.current ||
      mediaStatusRef.current !== "ready" ||
      motionReduced ||
      !mountedRef.current
    ) {
      return;
    }

    pausedRef.current = false;
    const state = stateRef.current;

    if (!HOWL_CLIPS[state].walking && idleCountdownRef.current?.remaining === 0) {
      void activateState(HOWL_CLIPS[state].next);
      return;
    }

    if (isIOS) {
      const image = mobileImageRefs.current[state];
      if (!image || image.dataset.active !== "true") {
        failMedia();
        return;
      }

      if (HOWL_CLIPS[state].walking) {
        startWalkingLoop(state, image);
      } else {
        const remaining =
          idleCountdownRef.current?.remaining ?? IDLE_DURATION_MS;
        startIdleCountdown(state, remaining);
      }
      return;
    }

    const video = videoRefs.current[state];
    if (!video) return;
    const started = await playActiveVideo(video);
    if (!started && !pausedRef.current) failMedia();
  }, [
    activateState,
    failMedia,
    isIOS,
    motionReduced,
    playActiveVideo,
    startIdleCountdown,
    startWalkingLoop,
  ]);

  const syncPauseState = useCallback(() => {
    const shouldPause = readerOpenRef.current || document.hidden;
    if (shouldPause) pauseSequence();
    else void resumeSequence();
  }, [pauseSequence, resumeSequence]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setMotionReduced(reducedMotion.matches);
    updateMotionPreference();
    reducedMotion.addEventListener("change", updateMotionPreference);
    return () => reducedMotion.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const companion = companionRef.current;
    const traveller = travellerRef.current;
    const shelfWall = companion?.closest<HTMLElement>(".shelf-wall");
    const woodShelf = shelfWall?.querySelector<HTMLElement>(".wood-shelf");
    const leftBookend = shelfWall?.querySelector<HTMLElement>(".bookend-left");
    const rightBookend = shelfWall?.querySelector<HTMLElement>(".bookend-right");
    if (
      !companion ||
      !traveller ||
      !shelfWall ||
      !woodShelf ||
      !leftBookend ||
      !rightBookend
    ) {
      return;
    }

    let measurementFrame: number | null = null;

    const measureShelf = () => {
      measurementFrame = null;
      const wallRect = shelfWall.getBoundingClientRect();
      const wallWidth = shelfWall.offsetWidth;
      const wallHeight = shelfWall.offsetHeight;
      if (
        wallRect.width <= 0 ||
        wallRect.height <= 0 ||
        wallWidth <= 0 ||
        wallHeight <= 0
      ) {
        return;
      }

      const scaleX = wallRect.width / wallWidth;
      const scaleY = wallRect.height / wallHeight;
      const toLocalX = (viewportX: number) =>
        (viewportX - wallRect.left) / scaleX;
      const toLocalY = (viewportY: number) =>
        (viewportY - wallRect.top) / scaleY;
      const woodRect = woodShelf.getBoundingClientRect();
      const leftBookendRect = leftBookend.getBoundingClientRect();
      const rightBookendRect = rightBookend.getBoundingClientRect();

      const leftZoneStart = toLocalX(woodRect.left) + EDGE_INSET;
      const leftZoneEnd = toLocalX(leftBookendRect.left) - BOOKEND_SAFETY_GAP;
      const rightZoneStart = toLocalX(rightBookendRect.right) + BOOKEND_SAFETY_GAP;
      const rightZoneEnd = toLocalX(woodRect.right) - EDGE_INSET;
      const leftZoneWidth = Math.max(0, leftZoneEnd - leftZoneStart);
      const rightZoneWidth = Math.max(0, rightZoneEnd - rightZoneStart);

      const styles = window.getComputedStyle(companion);
      const preferredSize =
        Number.parseFloat(styles.getPropertyValue("--howl-preferred-size")) || 78;
      const minimumRecognizableSize =
        Number.parseFloat(styles.getPropertyValue("--howl-min-size")) || 32;
      const footOffset =
        Number.parseFloat(styles.getPropertyValue("--howl-foot-offset")) || 0;
      const responsiveSize = Math.min(
        preferredSize,
        Math.max(minimumRecognizableSize, wallWidth * 0.2),
      );
      const maximumFittingSize =
        Math.min(leftZoneWidth, rightZoneWidth) / HOWL_VISIBLE_WIDTH_RATIO;
      const size = Math.max(1, Math.min(responsiveSize, maximumFittingSize));
      const visualCenterOffset =
        size * ((HOWL_VISIBLE_LEFT_RATIO + HOWL_VISIBLE_RIGHT_RATIO) / 2);

      const centerAndClamp = (zoneStart: number, zoneEnd: number) => {
        const centered = (zoneStart + zoneEnd) / 2 - visualCenterOffset;
        const minimumX = zoneStart - size * HOWL_VISIBLE_LEFT_RATIO;
        const maximumX = zoneEnd - size * HOWL_VISIBLE_RIGHT_RATIO;
        return clamp(centered, minimumX, Math.max(minimumX, maximumX));
      };

      const wrapperHeight = size * HOWL_CANVAS_ASPECT_RATIO;
      const plankTop = toLocalY(woodRect.top);
      const y = plankTop - wrapperHeight * HOWL_VISIBLE_FOOT_RATIO + footOffset;
      const bounds: ShelfBounds = {
        leftX: centerAndClamp(leftZoneStart, leftZoneEnd),
        rightX: centerAndClamp(rightZoneStart, rightZoneEnd),
        y,
        size,
      };

      boundsRef.current = bounds;
      traveller.style.setProperty("--howl-size", `${size}px`);
      if (mediaStatusRef.current !== "ready" || motionReduced) showFallback();
      else positionForState(stateRef.current);
    };

    const scheduleMeasurement = () => {
      if (measurementFrame !== null) window.cancelAnimationFrame(measurementFrame);
      measurementFrame = window.requestAnimationFrame(measureShelf);
    };

    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(shelfWall);
    resizeObserver.observe(woodShelf);
    resizeObserver.observe(leftBookend);
    resizeObserver.observe(rightBookend);
    window.addEventListener("resize", scheduleMeasurement);
    scheduleMeasurement();

    return () => {
      if (measurementFrame !== null) window.cancelAnimationFrame(measurementFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [motionReduced, positionForState, showFallback]);

  useEffect(() => {
    readerOpenRef.current = readerOpen;
    syncPauseState();
  }, [readerOpen, syncPauseState]);

  useEffect(() => {
    document.addEventListener("visibilitychange", syncPauseState);
    return () => document.removeEventListener("visibilitychange", syncPauseState);
  }, [syncPauseState]);

  useEffect(() => {
    mountedRef.current = true;
    pausedRef.current = readerOpenRef.current || document.hidden;
    mediaStatusRef.current = "loading";
    setMediaStatus("loading");
    stateRef.current = "resting-at-right";
    travelClockRef.current = null;
    setHowlState("resting-at-right");
    showFallback();

    const preloadToken = ++transitionTokenRef.current;
    HOWL_STATES.forEach((state) => {
      const video = videoRefs.current[state];
      if (video) {
        video.pause();
        video.loop = false;
        video.playbackRate = 1;
        video.dataset.active = "false";
      }
      const image = mobileImageRefs.current[state];
      if (image) image.dataset.active = "false";
    });

    const cleanup = () => {
      mountedRef.current = false;
      transitionTokenRef.current += 1;
      cancelMovement();
      clearIdleTimer();
      travelClockRef.current = null;
      HOWL_STATES.forEach((state) => {
        const video = videoRefs.current[state];
        if (video) {
          video.pause();
          video.loop = false;
          video.dataset.active = "false";
        }
        const image = mobileImageRefs.current[state];
        if (image) image.dataset.active = "false";
      });
    };

    if (motionReduced) {
      return cleanup;
    }

    let preloadPromise: Promise<void[]>;
    if (isIOS) {
      const requiredImages = HOWL_STATES.map(
        (state) => mobileImageRefs.current[state],
      );
      if (requiredImages.some((image) => !image)) {
        failMedia();
        return cleanup;
      }
      preloadPromise = Promise.all(
        requiredImages.map((image) =>
          ensureMobileImageReady(image as HTMLImageElement),
        ),
      );
    } else {
      if (
        !document
          .createElement("video")
          .canPlayType('video/webm; codecs="vp9"')
      ) {
        failMedia();
        return cleanup;
      }

      const requiredVideos = HOWL_STATES.map(
        (state) => videoRefs.current[state],
      );
      if (requiredVideos.some((video) => !video)) {
        failMedia();
        return cleanup;
      }
      preloadPromise = Promise.all(
        requiredVideos.map((video) =>
          ensureReady(video as HTMLVideoElement),
        ),
      );
    }

    void preloadPromise
      .then(() => {
        if (
          !mountedRef.current ||
          motionReduced ||
          mediaStatusRef.current !== "loading" ||
          transitionTokenRef.current !== preloadToken
        ) {
          return;
        }

        mediaStatusRef.current = "ready";
        setMediaStatus("ready");
        void activateState("resting-at-right");
      })
      .catch(() => {
        if (
          mountedRef.current &&
          transitionTokenRef.current === preloadToken
        ) {
          failMedia();
        }
      });

    return cleanup;
  }, [
    activateState,
    cancelMovement,
    clearIdleTimer,
    ensureReady,
    ensureMobileImageReady,
    failMedia,
    isIOS,
    motionReduced,
    showFallback,
  ]);

  return (
    <div
      ref={companionRef}
      className={`howl-castle-companion${mediaStatus !== "ready" ? " is-fallback" : ""}`}
      data-howl-state={howlState}
      data-media-status={mediaStatus}
      aria-hidden="true"
    >
      <div ref={travellerRef} className="howl-castle-traveller">
        {isIOS
          ? !motionReduced &&
            HOWL_STATES.map((state) => (
              <img
                key={state}
                ref={(image) => {
                  mobileImageRefs.current[state] = image;
                }}
                className="howl-castle-mobile-animation"
                data-howl-clip={state}
                data-active="false"
                src={HOWL_MOBILE_IMAGES[state]}
                alt=""
                width="320"
                height="360"
                draggable={false}
                aria-hidden="true"
                onError={failMedia}
              />
            ))
          : HOWL_STATES.map((state) => (
              <video
                key={state}
                ref={(video) => {
                  videoRefs.current[state] = video;
                }}
                className="howl-castle-video"
                data-howl-clip={state}
                data-active="false"
                src={HOWL_CLIPS[state].src}
                muted
                playsInline
                preload={motionReduced ? "none" : "auto"}
                aria-hidden="true"
                tabIndex={-1}
                draggable={false}
                disablePictureInPicture
                onError={failMedia}
                onPlaying={(event) =>
                  handlePlaying(state, event.currentTarget)
                }
                onWaiting={(event) =>
                  handlePlaybackPause(state, event.currentTarget)
                }
                onStalled={(event) =>
                  handlePlaybackPause(state, event.currentTarget)
                }
                onPause={(event) =>
                  handlePlaybackPause(state, event.currentTarget)
                }
              />
            ))}
        <img
          ref={fallbackRef}
          className="howl-castle-fallback"
          src={howlCastleFallback}
          alt=""
          width="640"
          height="720"
          draggable="false"
          data-visible="true"
        />
      </div>
    </div>
  );
}
