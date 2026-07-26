const STYLE_ID = "howl-animation-guard-styles";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* Howl must stay above the books, while the wooden plank still grounds the books. */
    .library-character-stage.is-howl {
      z-index: 6;
      pointer-events: none;
    }

    .library-character-stage.is-howl + .wood-shelf {
      z-index: 4 !important;
    }

    /*
     * The four generated clips do not place the castle body at the same x-position
     * inside their transparent 640px canvas. Correct those per-clip offsets so the
     * castle no longer jumps when idle and walking buffers swap.
     */
    .library-character-stage.is-howl .howl-castle-traveller {
      transform:
        translate3d(
          var(--howl-visual-x, var(--howl-x, 0px)),
          var(--howl-y, 0px),
          0
        )
        translateX(var(--howl-anchor-shift, 0%));
    }

    .howl-castle-companion[data-howl-state="resting-at-right"] .howl-castle-traveller {
      --howl-anchor-shift: -0.234375%;
    }

    .howl-castle-companion[data-howl-state="walking-left"] .howl-castle-traveller {
      --howl-anchor-shift: 6.25%;
    }

    .howl-castle-companion[data-howl-state="resting-at-left"] .howl-castle-traveller {
      --howl-anchor-shift: 1.953125%;
    }

    .howl-castle-companion[data-howl-state="walking-right"] .howl-castle-traveller {
      --howl-anchor-shift: -4.53125%;
    }
  `;
  document.head.append(style);
}

const WALK_ASSET_BY_STATE = {
  "walking-left": "howl_castle_walk_left",
  "walking-right": "howl_castle_walk_right",
} as const;

type WalkingState = keyof typeof WALK_ASSET_BY_STATE;
type HowlState =
  | "resting-at-right"
  | "walking-left"
  | "resting-at-left"
  | "walking-right";

const isWalkingState = (state: string): state is WalkingState =>
  state === "walking-left" || state === "walking-right";

let detachCurrent: (() => void) | null = null;
let currentCompanion: HTMLElement | null = null;

function attachGuard(companion: HTMLElement) {
  const traveller = companion.querySelector<HTMLElement>(".howl-castle-traveller");
  if (!traveller) return () => undefined;

  let frame = 0;
  let stopped = false;
  let lastState = "";
  let lastSize = "";
  let lastVisualX = "";
  let lockedIdleX = "";
  let settlingFrames = 4;

  const allowEndpointToSettle = () => {
    settlingFrames = 5;
    lockedIdleX = "";
  };

  const handleResize = () => allowEndpointToSettle();
  window.addEventListener("resize", handleResize);

  const shelfWall = companion.closest<HTMLElement>(".shelf-wall");
  const resizeObserver = shelfWall
    ? new ResizeObserver(allowEndpointToSettle)
    : null;
  if (shelfWall) resizeObserver?.observe(shelfWall);

  const tick = () => {
    if (stopped || !companion.isConnected || !traveller.isConnected) return;

    const state = (companion.dataset.howlState ?? "resting-at-right") as HowlState;
    const rawX = traveller.style.getPropertyValue("--howl-x").trim();
    const size = traveller.style.getPropertyValue("--howl-size").trim();

    if (state !== lastState) {
      lastState = state;
      allowEndpointToSettle();
    }
    if (size !== lastSize) {
      lastSize = size;
      allowEndpointToSettle();
    }

    const activeVideo = companion.querySelector<HTMLVideoElement>(
      '.howl-castle-video[data-active="true"]',
    );
    const source = decodeURIComponent(
      activeVideo?.currentSrc || activeVideo?.src || "",
    ).toLowerCase();

    const walking = isWalkingState(state);
    const expectedAsset = walking ? WALK_ASSET_BY_STATE[state] : "";
    const correctWalkingClip =
      walking &&
      Boolean(activeVideo) &&
      source.includes(expectedAsset) &&
      activeVideo?.dataset.active === "true";
    const walkingPlaybackIsLive =
      correctWalkingClip &&
      !activeVideo!.paused &&
      !activeVideo!.ended &&
      activeVideo!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    if (walkingPlaybackIsLive) {
      // The React state machine derives rawX from this walking video's currentTime.
      // Only release the visual position while that exact walking clip is playing.
      if (rawX) lastVisualX = rawX;
      lockedIdleX = "";
      settlingFrames = 0;
    } else if (!walking) {
      // Idle clips are allowed to breathe internally, but their shelf x-position is
      // locked. This also blocks any stale walking callback from producing a glide.
      if (settlingFrames > 0 || !lockedIdleX) {
        if (rawX) {
          lockedIdleX = rawX;
          lastVisualX = rawX;
        }
      } else if (lockedIdleX) {
        lastVisualX = lockedIdleX;
      }
    } else if (!lastVisualX && rawX) {
      // A walking state may be selected slightly before its decoded frame starts.
      // Hold the endpoint until the matching walk clip fires playing.
      lastVisualX = rawX;
    }

    if (lastVisualX) {
      traveller.style.setProperty("--howl-visual-x", lastVisualX);
    }

    if (settlingFrames > 0) settlingFrames -= 1;
    frame = window.requestAnimationFrame(tick);
  };

  frame = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", handleResize);
    resizeObserver?.disconnect();
    traveller.style.removeProperty("--howl-visual-x");
  };
}

function syncCompanion() {
  const companion = document.querySelector<HTMLElement>(".howl-castle-companion");
  if (companion === currentCompanion) return;

  detachCurrent?.();
  detachCurrent = null;
  currentCompanion = companion;

  if (companion) detachCurrent = attachGuard(companion);
}

const observer = new MutationObserver(syncCompanion);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

syncCompanion();
