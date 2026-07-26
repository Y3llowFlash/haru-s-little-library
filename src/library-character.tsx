import { useCallback, useEffect, useRef, useState } from "react";
import howlCastleFallback from "./assets/night-library/howl_castle_fallback.png";
import howlCastleIdleLeft from "./assets/night-library/howl_castle_idle_left.webm";
import howlCastleIdleRight from "./assets/night-library/howl_castle_idle_right.webm";
import howlCastleWalkLeft from "./assets/night-library/howl_castle_walk_left.webm";
import howlCastleWalkRight from "./assets/night-library/howl_castle_walk_right.webm";
import "./howl-character.css";
import TotoroShelfCompanion from "./totoro-shelf-companion";

export type LibraryCharacterChoice = "totoro" | "howl";

const CHARACTER_STORAGE_KEY = "haru-library-character";
const TRANSITION_HALF_DURATION = 180;
const WALK_DURATION_MS = 10_000;
const IDLE_DURATION_MS = 2_750;
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

const getStateStartEndpoint = (state: HowlState): HowlEndpoint =>
  state === "resting-at-right" || state === "walking-left" ? "right" : "left";

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
  const boundsRef = useRef<ShelfBounds | null>(null);
  const stateRef = useRef<HowlState>("resting-at-right");
  const mediaFailedRef = useRef(false);
  const mountedRef = useRef(true);
  const pausedRef = useRef(readerOpen || document.hidden);
  const readerOpenRef = useRef(readerOpen);
  const movementFrameRef = useRef<number | null>(null);
  const idleCountdownRef = useRef<IdleCountdown | null>(null);
  const transitionTokenRef = useRef(0);
  const [howlState, setHowlState] = useState<HowlState>("resting-at-right");
  const [mediaFailed, setMediaFailed] = useState(false);
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

      const clip = HOWL_CLIPS[state];
      if (!clip.walking) {
        const x = clip.endpoint === "left" ? bounds.leftX : bounds.rightX;
        setTravellerPosition(x, bounds.y);
        return;
      }

      const video = videoRefs.current[state];
      const duration =
        video && Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : WALK_DURATION_MS / 1_000;
      const progress = clamp((video?.currentTime ?? 0) / duration, 0, 1);
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

  const showFallback = useCallback(
    (endpoint: HowlEndpoint = getStateStartEndpoint(stateRef.current)) => {
      const bounds = boundsRef.current;
      if (bounds) {
        const x = endpoint === "left" ? bounds.leftX : bounds.rightX;
        setTravellerPosition(x, bounds.y);
      }
      if (fallbackRef.current) fallbackRef.current.dataset.visible = "true";
    },
    [setTravellerPosition],
  );

  const failMedia = useCallback(() => {
    if (mediaFailedRef.current) return;
    mediaFailedRef.current = true;
    transitionTokenRef.current += 1;
    cancelMovement();
    clearIdleTimer();
    HOWL_STATES.forEach((state) => {
      const video = videoRefs.current[state];
      if (!video) return;
      video.pause();
      video.dataset.active = "false";
    });
    setMediaFailed(true);
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

  const playActiveVideo = useCallback(async (video: HTMLVideoElement) => {
    if (pausedRef.current || mediaFailedRef.current) return false;

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

  const startWalkingLoop = useCallback(
    (state: HowlState, video: HTMLVideoElement) => {
      cancelMovement();
      if (!HOWL_CLIPS[state].walking) return;

      const tick = () => {
        movementFrameRef.current = null;
        if (
          !mountedRef.current ||
          pausedRef.current ||
          mediaFailedRef.current ||
          stateRef.current !== state ||
          videoRefs.current[state] !== video ||
          video.dataset.active !== "true" ||
          video.paused ||
          video.ended ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          return;
        }

        positionForState(state);
        movementFrameRef.current = window.requestAnimationFrame(tick);
      };

      movementFrameRef.current = window.requestAnimationFrame(tick);
    },
    [cancelMovement, positionForState],
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
      if (!mountedRef.current || mediaFailedRef.current || motionReduced) return;
      const requestToken = ++transitionTokenRef.current;
      const nextVideo = videoRefs.current[state];
      if (!nextVideo) {
        failMedia();
        return;
      }

      try {
        await ensureReady(nextVideo);
      } catch {
        failMedia();
        return;
      }

      if (
        !mountedRef.current ||
        mediaFailedRef.current ||
        requestToken !== transitionTokenRef.current
      ) {
        return;
      }

      cancelMovement();
      clearIdleTimer();
      idleCountdownRef.current = null;

      HOWL_STATES.forEach((otherState) => {
        const video = videoRefs.current[otherState];
        if (!video) return;
        video.pause();
        video.dataset.active = otherState === state ? "true" : "false";
      });

      try {
        nextVideo.currentTime = 0;
      } catch {
        failMedia();
        return;
      }

      stateRef.current = state;
      setHowlState(state);
      positionForState(state);
      hideFallback();

      if (!pausedRef.current) {
        const started = await playActiveVideo(nextVideo);
        if (!started && !pausedRef.current) failMedia();
      }
    },
    [
      cancelMovement,
      clearIdleTimer,
      ensureReady,
      failMedia,
      hideFallback,
      motionReduced,
      playActiveVideo,
      positionForState,
    ],
  );

  activateStateRef.current = activateState;

  const handlePlaying = useCallback(
    (state: HowlState, video: HTMLVideoElement) => {
      if (
        mediaFailedRef.current ||
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
        cancelMovement();
      }
    },
    [cancelMovement],
  );

  const handleEnded = useCallback(
    (state: HowlState, video: HTMLVideoElement) => {
      if (
        stateRef.current !== state ||
        video.dataset.active !== "true" ||
        !HOWL_CLIPS[state].walking
      ) {
        return;
      }

      cancelMovement();
      const bounds = boundsRef.current;
      if (bounds) {
        const x = HOWL_CLIPS[state].endpoint === "left" ? bounds.leftX : bounds.rightX;
        setTravellerPosition(x, bounds.y);
      }
      void activateState(HOWL_CLIPS[state].next);
    },
    [activateState, cancelMovement, setTravellerPosition],
  );

  const pauseSequence = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    cancelMovement();
    pauseIdleCountdown();
    videoRefs.current[stateRef.current]?.pause();
  }, [cancelMovement, pauseIdleCountdown]);

  const resumeSequence = useCallback(async () => {
    if (
      !pausedRef.current ||
      mediaFailedRef.current ||
      motionReduced ||
      !mountedRef.current
    ) {
      return;
    }

    pausedRef.current = false;
    const state = stateRef.current;
    const video = videoRefs.current[state];
    if (!video) return;

    if (!HOWL_CLIPS[state].walking && idleCountdownRef.current?.remaining === 0) {
      void activateState(HOWL_CLIPS[state].next);
      return;
    }

    const started = await playActiveVideo(video);
    if (!started && !pausedRef.current) failMedia();
  }, [activateState, failMedia, motionReduced, playActiveVideo]);

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
      if (mediaFailedRef.current || motionReduced) showFallback("right");
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
    mediaFailedRef.current = false;
    setMediaFailed(false);
    stateRef.current = "resting-at-right";
    setHowlState("resting-at-right");
    showFallback("right");

    if (motionReduced) {
      HOWL_STATES.forEach((state) => {
        const video = videoRefs.current[state];
        if (!video) return;
        video.pause();
        video.dataset.active = "false";
      });
      return () => {
        mountedRef.current = false;
      };
    }

    if (!document.createElement("video").canPlayType('video/webm; codecs="vp9"')) {
      failMedia();
      return () => {
        mountedRef.current = false;
      };
    }

    void activateState("resting-at-right");

    return () => {
      mountedRef.current = false;
      transitionTokenRef.current += 1;
      cancelMovement();
      clearIdleTimer();
      HOWL_STATES.forEach((state) => {
        const video = videoRefs.current[state];
        if (!video) return;
        video.pause();
        video.dataset.active = "false";
      });
    };
  }, [
    activateState,
    cancelMovement,
    clearIdleTimer,
    failMedia,
    motionReduced,
    showFallback,
  ]);

  return (
    <div
      ref={companionRef}
      className={`howl-castle-companion${mediaFailed ? " is-fallback" : ""}`}
      data-howl-state={howlState}
      aria-hidden="true"
    >
      <div ref={travellerRef} className="howl-castle-traveller">
        {HOWL_STATES.map((state) => (
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
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            draggable={false}
            disablePictureInPicture
            onError={failMedia}
            onPlaying={(event) => handlePlaying(state, event.currentTarget)}
            onWaiting={(event) =>
              handlePlaybackPause(state, event.currentTarget)
            }
            onStalled={(event) =>
              handlePlaybackPause(state, event.currentTarget)
            }
            onPause={(event) =>
              handlePlaybackPause(state, event.currentTarget)
            }
            onEnded={(event) => handleEnded(state, event.currentTarget)}
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
