import { useCallback, useEffect, useRef, useState } from "react";
import howlCastleFallback from "./assets/night-library/howl_castle_fallback.png";
import howlCastleIdleLeft from "./assets/night-library/howl_castle_idle_left.webm";
import howlCastleIdleRight from "./assets/night-library/howl_castle_idle_right.webm";
import howlCastleWalkLeft from "./assets/night-library/howl_castle_walk_left.webm";
import howlCastleWalkRight from "./assets/night-library/howl_castle_walk_right.webm";
import TotoroShelfCompanion from "./totoro-shelf-companion";

export type LibraryCharacterChoice = "totoro" | "howl";

const CHARACTER_STORAGE_KEY = "haru-library-character";
const TRANSITION_HALF_DURATION = 180;
const WALK_DURATION_MS = 10_000;
const IDLE_DURATION_MS = 2_750;
const MEDIA_READY_TIMEOUT_MS = 6_000;
const MEDIA_STALL_RECOVERY_MS = 4_000;
const PLAY_RETRY_DELAY_MS = 240;
const EDGE_INSET = 2;
const BOOKEND_SAFETY_GAP = 2;

type HowlState =
  | "resting-at-right"
  | "walking-left"
  | "resting-at-left"
  | "walking-right";

type HowlEndpoint = "left" | "right";
type VideoBufferSlot = "primary" | "secondary";

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

type PreparedBuffer = {
  slot: VideoBufferSlot;
  state: HowlState;
  video: HTMLVideoElement;
};

type ActiveHowlPhase = PreparedBuffer & {
  source: string;
  token: number;
};

type IdleCountdown = {
  remaining: number;
  startedAt: number;
  timer: number | null;
};

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

const BUFFER_SLOTS: VideoBufferSlot[] = ["primary", "secondary"];

// Union of the alpha bounds in all four 640×720 clips. Endpoint fitting uses
// visible pixels instead of the clips' transparent canvas.
const HOWL_VISIBLE_LEFT_RATIO = 28 / 640;
const HOWL_VISIBLE_RIGHT_RATIO = 612 / 640;
const HOWL_VISIBLE_WIDTH_RATIO =
  HOWL_VISIBLE_RIGHT_RATIO - HOWL_VISIBLE_LEFT_RATIO;
const HOWL_VISIBLE_FOOT_RATIO = 673 / 720;
const HOWL_CANVAS_ASPECT_RATIO = 720 / 640;

const getOtherBuffer = (slot: VideoBufferSlot): VideoBufferSlot =>
  slot === "primary" ? "secondary" : "primary";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const getFallbackEndpoint = (state: HowlState): HowlEndpoint =>
  state === "resting-at-left" || state === "walking-right" ? "left" : "right";

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
  const videoRefs = useRef<Record<VideoBufferSlot, HTMLVideoElement | null>>({
    primary: null,
    secondary: null,
  });
  const boundsRef = useRef<ShelfBounds | null>(null);
  const activeBufferRef = useRef<VideoBufferSlot>("primary");
  const hasActiveVideoRef = useRef(false);
  const stateRef = useRef<HowlState>("resting-at-right");
  const fallbackEndpointRef = useRef<HowlEndpoint>("right");
  const mediaFailedRef = useRef(false);
  const readerOpenRef = useRef(readerOpen);
  const syncPauseRef = useRef<() => void>(() => undefined);
  const failMediaRef = useRef<() => void>(() => undefined);
  const handleWaitingRef = useRef<(video: HTMLVideoElement) => void>(
    () => undefined,
  );
  const handlePlayingRef = useRef<(video: HTMLVideoElement) => void>(
    () => undefined,
  );
  const handlePauseRef = useRef<(video: HTMLVideoElement) => void>(
    () => undefined,
  );
  const handlePlaybackHealthyRef = useRef<(video: HTMLVideoElement) => void>(
    () => undefined,
  );
  const [howlState, setHowlState] =
    useState<HowlState>("resting-at-right");
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

  const positionForCurrentState = useCallback(() => {
    const bounds = boundsRef.current;
    if (!bounds) return;

    if (mediaFailedRef.current || motionReduced) {
      const x =
        fallbackEndpointRef.current === "left"
          ? bounds.leftX
          : bounds.rightX;
      setTravellerPosition(x, bounds.y);
      return;
    }

    const state = stateRef.current;
    if (state === "resting-at-right") {
      setTravellerPosition(bounds.rightX, bounds.y);
      return;
    }
    if (state === "resting-at-left") {
      setTravellerPosition(bounds.leftX, bounds.y);
      return;
    }

    const activeVideo = videoRefs.current[activeBufferRef.current];
    const duration =
      activeVideo &&
      Number.isFinite(activeVideo.duration) &&
      activeVideo.duration > 0
        ? activeVideo.duration
        : WALK_DURATION_MS / 1_000;
    const progress = clamp(
      (activeVideo?.currentTime ?? 0) / duration,
      0,
      1,
    );
    const x =
      state === "walking-left"
        ? bounds.rightX + (bounds.leftX - bounds.rightX) * progress
        : bounds.leftX + (bounds.rightX - bounds.leftX) * progress;
    setTravellerPosition(x, bounds.y);
  }, [motionReduced, setTravellerPosition]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () =>
      setMotionReduced(reducedMotion.matches);

    updateMotionPreference();
    reducedMotion.addEventListener("change", updateMotionPreference);
    return () =>
      reducedMotion.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const companion = companionRef.current;
    const traveller = travellerRef.current;
    const shelfWall = companion?.closest<HTMLElement>(".shelf-wall");
    const woodShelf = shelfWall?.querySelector<HTMLElement>(".wood-shelf");
    const leftBookend =
      shelfWall?.querySelector<HTMLElement>(".bookend-left");
    const rightBookend =
      shelfWall?.querySelector<HTMLElement>(".bookend-right");
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
      const leftZoneEnd =
        toLocalX(leftBookendRect.left) - BOOKEND_SAFETY_GAP;
      const rightZoneStart =
        toLocalX(rightBookendRect.right) + BOOKEND_SAFETY_GAP;
      const rightZoneEnd = toLocalX(woodRect.right) - EDGE_INSET;
      const leftZoneWidth = Math.max(0, leftZoneEnd - leftZoneStart);
      const rightZoneWidth = Math.max(0, rightZoneEnd - rightZoneStart);

      const styles = window.getComputedStyle(companion);
      const preferredSize =
        Number.parseFloat(styles.getPropertyValue("--howl-preferred-size")) ||
        78;
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
        size *
        ((HOWL_VISIBLE_LEFT_RATIO + HOWL_VISIBLE_RIGHT_RATIO) / 2);

      const centerAndClamp = (zoneStart: number, zoneEnd: number) => {
        const centered =
          (zoneStart + zoneEnd) / 2 - visualCenterOffset;
        const minimumX = zoneStart - size * HOWL_VISIBLE_LEFT_RATIO;
        const maximumX = zoneEnd - size * HOWL_VISIBLE_RIGHT_RATIO;
        return clamp(centered, minimumX, Math.max(minimumX, maximumX));
      };

      const wrapperHeight = size * HOWL_CANVAS_ASPECT_RATIO;
      const plankTop = toLocalY(woodRect.top);
      const y =
        plankTop - wrapperHeight * HOWL_VISIBLE_FOOT_RATIO + footOffset;
      const bounds = {
        leftX: centerAndClamp(leftZoneStart, leftZoneEnd),
        rightX: centerAndClamp(rightZoneStart, rightZoneEnd),
        y,
        size,
      };

      boundsRef.current = bounds;
      traveller.style.setProperty("--howl-size", `${size}px`);
      positionForCurrentState();
    };

    const scheduleMeasurement = () => {
      if (measurementFrame !== null) {
        window.cancelAnimationFrame(measurementFrame);
      }
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
      if (measurementFrame !== null) {
        window.cancelAnimationFrame(measurementFrame);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [positionForCurrentState]);

  useEffect(() => {
    const handleVisibilityChange = () => syncPauseRef.current();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    syncPauseRef.current();
  }, [readerOpen]);

  useEffect(() => {
    let destroyed = false;
    let paused = readerOpenRef.current || document.hidden;
    let movementFrame: number | null = null;
    let stallTimer: number | null = null;
    let preparedBuffer: PreparedBuffer | null = null;
    let pendingPreparation: Promise<PreparedBuffer> | null = null;
    let pendingPreparationState: HowlState | null = null;
    let pendingPreparationCleanup: (() => void) | null = null;
    let idleCountdown: IdleCountdown | null = null;
    let playRejections = 0;
    let phaseToken = 0;
    let transitionRequestToken = 0;
    let activePhase: ActiveHowlPhase | null = null;

    const fallback = fallbackRef.current;

    const clearMovementFrame = () => {
      if (movementFrame !== null) {
        window.cancelAnimationFrame(movementFrame);
        movementFrame = null;
      }
    };

    const clearStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const clearIdleTimer = () => {
      if (!idleCountdown || idleCountdown.timer === null) return;
      window.clearTimeout(idleCountdown.timer);
      idleCountdown.timer = null;
    };

    const invalidateActivePhase = () => {
      phaseToken += 1;
      activePhase = null;
      clearMovementFrame();
      clearStallTimer();
    };

    const hideVideos = (removeSources: boolean) => {
      BUFFER_SLOTS.forEach((slot) => {
        const video = videoRefs.current[slot];
        if (!video) return;
        video.pause();
        video.autoplay = false;
        video.dataset.active = "false";
        video.onended = null;
        if (removeSources) {
          video.removeAttribute("src");
          video.load();
        }
      });
      hasActiveVideoRef.current = false;
    };

    const showFallback = (endpoint: HowlEndpoint) => {
      fallbackEndpointRef.current = endpoint;
      if (fallback) fallback.dataset.visible = "true";
      positionForCurrentState();
    };

    const stopSequence = (removeSources: boolean) => {
      transitionRequestToken += 1;
      invalidateActivePhase();
      clearIdleTimer();
      pendingPreparationCleanup?.();
      pendingPreparationCleanup = null;
      pendingPreparation = null;
      pendingPreparationState = null;
      preparedBuffer = null;
      hideVideos(removeSources);
    };

    const failMedia = () => {
      if (destroyed || mediaFailedRef.current) return;
      mediaFailedRef.current = true;
      const endpoint = getFallbackEndpoint(stateRef.current);
      stopSequence(true);
      setMediaFailed(true);
      showFallback(endpoint);
    };

    failMediaRef.current = failMedia;

    const wait = (duration: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, duration);
        if (destroyed) window.clearTimeout(timer);
      });

    const playVideo = async (video: HTMLVideoElement) => {
      if (destroyed || paused || mediaFailedRef.current) return false;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await video.play();
          playRejections = 0;
          return true;
        } catch (error) {
          if (destroyed || paused) return false;
          if (error instanceof DOMException && error.name === "NotSupportedError") {
            failMedia();
            return false;
          }
          playRejections += 1;
          if (attempt === 0) await wait(PLAY_RETRY_DELAY_MS);
        }
      }

      if (playRejections >= 2) failMedia();
      return false;
    };

    const prepareState = (state: HowlState, slot: VideoBufferSlot) => {
      const video = videoRefs.current[slot];
      if (!video) return Promise.reject(new Error("Missing Howl video buffer"));

      pendingPreparationCleanup?.();
      const preparation = new Promise<PreparedBuffer>((resolve, reject) => {
        let readyTimer: number | null = null;
        let settled = false;

        const cleanup = () => {
          if (readyTimer !== null) window.clearTimeout(readyTimer);
          video.removeEventListener("loadeddata", handleReady);
          video.removeEventListener("canplay", handleReady);
          video.removeEventListener("error", handleError);
          if (pendingPreparationCleanup === cleanup) {
            pendingPreparationCleanup = null;
          }
        };

        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback();
        };

        const handleReady = () => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          finish(() => {
            try {
              video.currentTime = 0;
            } catch {
              // loadeddata guarantees a decoded first frame even if seeking is restricted.
            }
            resolve({ slot, state, video });
          });
        };

        const handleError = () =>
          finish(() => reject(new Error(`Could not load Howl state: ${state}`)));

        pendingPreparationCleanup = cleanup;
        video.pause();
        video.autoplay = false;
        video.loop = false;
        video.dataset.active = "false";
        video.onended = null;
        video.addEventListener("loadeddata", handleReady);
        video.addEventListener("canplay", handleReady);
        video.addEventListener("error", handleError);
        readyTimer = window.setTimeout(
          () =>
            finish(() =>
              reject(new Error(`Timed out loading Howl state: ${state}`)),
            ),
          MEDIA_READY_TIMEOUT_MS,
        );
        video.src = HOWL_CLIPS[state].src;
        video.load();
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          handleReady();
        }
      });

      pendingPreparation = preparation;
      pendingPreparationState = state;
      preparation
        .then((prepared) => {
          if (!destroyed && pendingPreparationState === prepared.state) {
            preparedBuffer = prepared;
          }
        })
        .catch(failMedia);
      return preparation;
    };

    const preloadState = (state: HowlState) => {
      const slot = hasActiveVideoRef.current
        ? getOtherBuffer(activeBufferRef.current)
        : "primary";
      return prepareState(state, slot);
    };

    let transitionToState: (state: HowlState) => Promise<void>;

    const isCurrentPhase = (phase: ActiveHowlPhase) => {
      const currentSource = phase.video.currentSrc || phase.video.src;
      return (
        !destroyed &&
        !mediaFailedRef.current &&
        activePhase === phase &&
        phase.token === phaseToken &&
        stateRef.current === phase.state &&
        activeBufferRef.current === phase.slot &&
        videoRefs.current[phase.slot] === phase.video &&
        phase.video.dataset.active === "true" &&
        currentSource === phase.source
      );
    };

    const lockPositionForState = (state: HowlState) => {
      const bounds = boundsRef.current;
      if (!bounds) return;
      const x =
        state === "resting-at-right" || state === "walking-left"
          ? bounds.rightX
          : bounds.leftX;
      setTravellerPosition(x, bounds.y);
    };

    const updateWalkingPosition = (phase: ActiveHowlPhase) => {
      movementFrame = null;
      if (
        paused ||
        !isCurrentPhase(phase) ||
        !HOWL_CLIPS[phase.state].walking ||
        phase.video.paused ||
        phase.video.ended ||
        phase.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }

      const bounds = boundsRef.current;
      if (bounds) {
        const duration =
          Number.isFinite(phase.video.duration) && phase.video.duration > 0
            ? phase.video.duration
            : WALK_DURATION_MS / 1_000;
        const progress = clamp(phase.video.currentTime / duration, 0, 1);
        const x =
          phase.state === "walking-left"
            ? bounds.rightX + (bounds.leftX - bounds.rightX) * progress
            : bounds.leftX + (bounds.rightX - bounds.leftX) * progress;
        setTravellerPosition(x, bounds.y);
      }

      movementFrame = window.requestAnimationFrame(() =>
        updateWalkingPosition(phase),
      );
    };

    const startWalkingFrameLoop = (phase: ActiveHowlPhase) => {
      clearMovementFrame();
      if (
        paused ||
        !isCurrentPhase(phase) ||
        !HOWL_CLIPS[phase.state].walking ||
        phase.video.paused
      ) {
        return;
      }
      movementFrame = window.requestAnimationFrame(() =>
        updateWalkingPosition(phase),
      );
    };

    const startIdleCountdown = (
      phase: ActiveHowlPhase,
      remaining = IDLE_DURATION_MS,
    ) => {
      clearIdleTimer();
      idleCountdown = {
        remaining,
        startedAt: performance.now(),
        timer: null,
      };
      if (paused || !isCurrentPhase(phase)) return;
      idleCountdown.timer = window.setTimeout(() => {
        if (
          !idleCountdown ||
          !isCurrentPhase(phase) ||
          HOWL_CLIPS[phase.state].walking
        ) {
          return;
        }
        idleCountdown.remaining = 0;
        idleCountdown.timer = null;
        void transitionToState(HOWL_CLIPS[phase.state].next);
      }, remaining);
    };

    const beginActiveState = (phase: ActiveHowlPhase) => {
      const clip = HOWL_CLIPS[phase.state];
      void preloadState(clip.next).catch(() => undefined);

      if (clip.walking) {
        idleCountdown = null;
        phase.video.onended = () => {
          if (!isCurrentPhase(phase)) return;
          clearMovementFrame();
          const bounds = boundsRef.current;
          if (bounds) {
            const endpointX =
              clip.endpoint === "left" ? bounds.leftX : bounds.rightX;
            setTravellerPosition(endpointX, bounds.y);
          }
          void transitionToState(clip.next);
        };
      } else {
        phase.video.onended = null;
        idleCountdown = null;
      }
    };

    transitionToState = async (state: HowlState) => {
      if (destroyed || mediaFailedRef.current) return;
      const requestToken = ++transitionRequestToken;

      let prepared = preparedBuffer?.state === state ? preparedBuffer : null;
      if (!prepared) {
        try {
          prepared =
            pendingPreparation &&
            pendingPreparationState === state &&
            !preparedBuffer
              ? await pendingPreparation
              : await preloadState(state);
        } catch {
          failMedia();
          return;
        }
      }
      if (
        !prepared ||
        destroyed ||
        mediaFailedRef.current ||
        requestToken !== transitionRequestToken
      ) {
        return;
      }

      preparedBuffer = null;
      if (pendingPreparationState === state) {
        pendingPreparation = null;
        pendingPreparationState = null;
        pendingPreparationCleanup = null;
      }
      const { slot, video } = prepared;
      try {
        video.currentTime = 0;
      } catch {
        failMedia();
        return;
      }

      const previousSlot = hasActiveVideoRef.current
        ? activeBufferRef.current
        : null;
      const previousVideo = previousSlot
        ? videoRefs.current[previousSlot]
        : null;

      invalidateActivePhase();
      clearIdleTimer();
      idleCountdown = null;

      if (previousVideo && previousVideo !== video) {
        previousVideo.dataset.active = "false";
        previousVideo.pause();
        previousVideo.autoplay = false;
        previousVideo.onended = null;
      }

      activeBufferRef.current = slot;
      hasActiveVideoRef.current = true;
      stateRef.current = state;
      fallbackEndpointRef.current = HOWL_CLIPS[state].endpoint;
      lockPositionForState(state);

      video.autoplay = !paused;
      video.dataset.active = "true";
      if (fallback) fallback.dataset.visible = "false";

      const phase: ActiveHowlPhase = {
        slot,
        state,
        video,
        source: new URL(HOWL_CLIPS[state].src, document.baseURI).href,
        token: phaseToken,
      };
      activePhase = phase;
      setHowlState(state);
      beginActiveState(phase);

      if (!paused) {
        const started = await playVideo(video);
        if (!started && !paused) return;
      }
    };

    const pauseSequence = () => {
      if (paused) return;
      paused = true;
      const activeVideo = hasActiveVideoRef.current
        ? videoRefs.current[activeBufferRef.current]
        : null;
      activeVideo?.pause();
      clearMovementFrame();
      clearStallTimer();

      if (idleCountdown && idleCountdown.timer !== null) {
        idleCountdown.remaining = Math.max(
          0,
          idleCountdown.remaining -
            (performance.now() - idleCountdown.startedAt),
        );
        clearIdleTimer();
      }
    };

    const resumeSequence = async () => {
      if (!paused || destroyed || mediaFailedRef.current || motionReduced) {
        return;
      }
      paused = false;
      const activeVideo = hasActiveVideoRef.current
        ? videoRefs.current[activeBufferRef.current]
        : null;
      if (!activeVideo) return;

      const phase = activePhase;
      if (
        phase &&
        isCurrentPhase(phase) &&
        !HOWL_CLIPS[phase.state].walking &&
        idleCountdown &&
        idleCountdown.remaining <= 0
      ) {
        void transitionToState(HOWL_CLIPS[phase.state].next);
        return;
      }

      activeVideo.autoplay = true;
      const started = await playVideo(activeVideo);
      if (!started || destroyed || paused) return;
    };

    const syncPauseState = () => {
      const shouldPause = readerOpenRef.current || document.hidden;
      if (shouldPause) pauseSequence();
      else void resumeSequence();
    };

    syncPauseRef.current = syncPauseState;

    handleWaitingRef.current = (video) => {
      const phase = activePhase;
      if (
        destroyed ||
        paused ||
        !phase ||
        phase.video !== video ||
        !isCurrentPhase(phase) ||
        stallTimer !== null
      ) {
        return;
      }
      clearMovementFrame();
      const stalledPhase = phase;
      stallTimer = window.setTimeout(() => {
        stallTimer = null;
        if (!paused && isCurrentPhase(stalledPhase)) failMedia();
      }, MEDIA_STALL_RECOVERY_MS);
    };

    handlePlayingRef.current = (video) => {
      const phase = activePhase;
      if (
        !phase ||
        phase.video !== video ||
        !isCurrentPhase(phase) ||
        video.paused
      ) {
        return;
      }

      clearStallTimer();
      if (HOWL_CLIPS[phase.state].walking) {
        startWalkingFrameLoop(phase);
        return;
      }

      lockPositionForState(phase.state);
      if (!idleCountdown) {
        startIdleCountdown(phase);
      } else if (
        idleCountdown.timer === null &&
        idleCountdown.remaining > 0
      ) {
        startIdleCountdown(phase, idleCountdown.remaining);
      }
    };

    handlePauseRef.current = (video) => {
      const phase = activePhase;
      if (phase && phase.video === video && isCurrentPhase(phase)) {
        clearMovementFrame();
        clearStallTimer();
      }
    };

    handlePlaybackHealthyRef.current = (video) => {
      const phase = activePhase;
      if (phase && phase.video === video && isCurrentPhase(phase)) {
        clearStallTimer();
      }
    };

    stateRef.current = "resting-at-right";
    fallbackEndpointRef.current = "right";
    setHowlState("resting-at-right");
    showFallback("right");

    if (motionReduced || mediaFailedRef.current) {
      stopSequence(true);
      showFallback("right");
    } else if (!document.createElement("video").canPlayType('video/webm; codecs="vp9"')) {
      failMedia();
    } else {
      void transitionToState("resting-at-right");
    }

    return () => {
      destroyed = true;
      syncPauseRef.current = () => undefined;
      failMediaRef.current = () => undefined;
      handleWaitingRef.current = () => undefined;
      handlePlayingRef.current = () => undefined;
      handlePauseRef.current = () => undefined;
      handlePlaybackHealthyRef.current = () => undefined;
      stopSequence(true);
    };
  }, [
    motionReduced,
    positionForCurrentState,
    setTravellerPosition,
  ]);

  return (
    <div
      ref={companionRef}
      className={`howl-castle-companion${mediaFailed ? " is-fallback" : ""}`}
      data-howl-state={howlState}
      aria-hidden="true"
    >
      <div ref={travellerRef} className="howl-castle-traveller">
        {BUFFER_SLOTS.map((slot) => (
          <video
            key={slot}
            ref={(video) => {
              videoRefs.current[slot] = video;
            }}
            className="howl-castle-video"
            data-buffer={slot}
            data-active="false"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            draggable={false}
            disablePictureInPicture
            onError={() => failMediaRef.current()}
            onWaiting={(event) => handleWaitingRef.current(event.currentTarget)}
            onStalled={(event) => handleWaitingRef.current(event.currentTarget)}
            onPlaying={(event) => handlePlayingRef.current(event.currentTarget)}
            onPause={(event) => handlePauseRef.current(event.currentTarget)}
            onCanPlay={(event) =>
              handlePlaybackHealthyRef.current(event.currentTarget)
            }
            onTimeUpdate={(event) =>
              handlePlaybackHealthyRef.current(event.currentTarget)
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
