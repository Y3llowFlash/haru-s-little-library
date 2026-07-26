const MOBILE_BREAKPOINT = 480;
const STYLE_ID = "howl-mobile-layout-styles";
const VISIBLE_LEFT_RATIO = 28 / 640;
const VISIBLE_RIGHT_RATIO = 612 / 640;
const VISIBLE_WIDTH_RATIO = VISIBLE_RIGHT_RATIO - VISIBLE_LEFT_RATIO;
const VISIBLE_FOOT_RATIO = 673 / 720;
const CANVAS_ASPECT_RATIO = 720 / 640;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
      .library-character-stage.is-howl .howl-castle-traveller {
        width: var(--howl-mobile-size, var(--howl-size, 78px));
        transform:
          translate3d(
            var(--howl-mobile-x, var(--howl-x, 0px)),
            var(--howl-mobile-y, var(--howl-y, 0px)),
            0
          )
          translateX(var(--howl-anchor-shift, 0%));
      }
    }
  `;
  document.head.append(style);
}

type HowlState =
  | "resting-at-right"
  | "walking-left"
  | "resting-at-left"
  | "walking-right";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

let activeCompanion: HTMLElement | null = null;
let detachActive: (() => void) | null = null;

function attachMobileLayout(companion: HTMLElement) {
  const traveller = companion.querySelector<HTMLElement>(".howl-castle-traveller");
  const shelfWall = companion.closest<HTMLElement>(".shelf-wall");
  const woodShelf = shelfWall?.querySelector<HTMLElement>(".wood-shelf");
  const leftBookend = shelfWall?.querySelector<HTMLElement>(".bookend-left");
  const rightBookend = shelfWall?.querySelector<HTMLElement>(".bookend-right");

  if (!traveller || !shelfWall || !woodShelf || !leftBookend || !rightBookend) {
    return () => undefined;
  }

  let frame = 0;
  let stopped = false;

  const clearMobileOverrides = () => {
    traveller.style.removeProperty("--howl-mobile-size");
    traveller.style.removeProperty("--howl-mobile-x");
    traveller.style.removeProperty("--howl-mobile-y");
  };

  const calculate = () => {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      clearMobileOverrides();
      return;
    }

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
    if (scaleX <= 0 || scaleY <= 0) return;

    const toLocalX = (viewportX: number) =>
      (viewportX - wallRect.left) / scaleX;
    const toLocalY = (viewportY: number) =>
      (viewportY - wallRect.top) / scaleY;

    const woodRect = woodShelf.getBoundingClientRect();
    const leftBookendRect = leftBookend.getBoundingClientRect();
    const rightBookendRect = rightBookend.getBoundingClientRect();

    const plankLeft = toLocalX(woodRect.left);
    const plankRight = toLocalX(woodRect.right);
    const plankTop = toLocalY(woodRect.top);

    /*
     * Mobile books use almost the whole shelf, so the old "fit inside both empty
     * side zones" rule reduced Howl to about one pixel. Choose a readable rendered
     * size, convert it back into shelf-local coordinates, and let Howl travel in
     * front of the books as intended.
     */
    const targetRenderedSize = clamp(window.innerWidth * 0.16, 52, 68);
    const localSize = targetRenderedSize / scaleX;
    const edgeInset = 5 / scaleX;

    const mobileLeftX =
      plankLeft + edgeInset - localSize * VISIBLE_LEFT_RATIO;
    const mobileRightX =
      plankRight - edgeInset - localSize * VISIBLE_RIGHT_RATIO;
    const mobileY =
      plankTop -
      localSize * CANVAS_ASPECT_RATIO * VISIBLE_FOOT_RATIO +
      3 / scaleY;

    /* Recreate the original tiny-zone endpoints only to read its travel progress. */
    const rawSize = Math.max(
      1,
      Number.parseFloat(
        traveller.style.getPropertyValue("--howl-size") ||
          window.getComputedStyle(traveller).getPropertyValue("--howl-size"),
      ) || 1,
    );
    const rawLeftZoneStart = plankLeft + 2;
    const rawLeftZoneEnd = toLocalX(leftBookendRect.left) - 2;
    const rawRightZoneStart = toLocalX(rightBookendRect.right) + 2;
    const rawRightZoneEnd = plankRight - 2;
    const rawVisualCenterOffset =
      rawSize * ((VISIBLE_LEFT_RATIO + VISIBLE_RIGHT_RATIO) / 2);

    const centerAndClamp = (zoneStart: number, zoneEnd: number) => {
      const centered = (zoneStart + zoneEnd) / 2 - rawVisualCenterOffset;
      const minimumX = zoneStart - rawSize * VISIBLE_LEFT_RATIO;
      const maximumX = zoneEnd - rawSize * VISIBLE_RIGHT_RATIO;
      return clamp(centered, minimumX, Math.max(minimumX, maximumX));
    };

    const rawLeftX = centerAndClamp(rawLeftZoneStart, rawLeftZoneEnd);
    const rawRightX = centerAndClamp(rawRightZoneStart, rawRightZoneEnd);
    const rawX =
      Number.parseFloat(traveller.style.getPropertyValue("--howl-x")) ||
      rawRightX;

    const state = (companion.dataset.howlState ??
      "resting-at-right") as HowlState;
    const mediaStatus = companion.dataset.mediaStatus ?? "loading";

    let mobileX = mobileRightX;
    if (mediaStatus === "ready") {
      if (state === "resting-at-left") {
        mobileX = mobileLeftX;
      } else if (state === "walking-left" || state === "walking-right") {
        const distance = rawRightX - rawLeftX;
        const progress =
          Math.abs(distance) < 0.001
            ? state === "walking-left"
              ? 0
              : 1
            : state === "walking-left"
              ? clamp((rawRightX - rawX) / distance, 0, 1)
              : clamp((rawX - rawLeftX) / distance, 0, 1);

        mobileX =
          state === "walking-left"
            ? mobileRightX + (mobileLeftX - mobileRightX) * progress
            : mobileLeftX + (mobileRightX - mobileLeftX) * progress;
      }
    }

    traveller.style.setProperty("--howl-mobile-size", `${localSize}px`);
    traveller.style.setProperty("--howl-mobile-x", `${mobileX}px`);
    traveller.style.setProperty("--howl-mobile-y", `${mobileY}px`);
  };

  const tick = () => {
    if (stopped || !companion.isConnected || !traveller.isConnected) return;
    calculate();
    frame = window.requestAnimationFrame(tick);
  };

  const handleResize = () => calculate();
  window.addEventListener("resize", handleResize);

  const resizeObserver = new ResizeObserver(calculate);
  resizeObserver.observe(shelfWall);
  resizeObserver.observe(woodShelf);
  resizeObserver.observe(leftBookend);
  resizeObserver.observe(rightBookend);

  frame = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", handleResize);
    resizeObserver.disconnect();
    clearMobileOverrides();
  };
}

function syncCompanion() {
  const companion = document.querySelector<HTMLElement>(".howl-castle-companion");
  if (companion === activeCompanion) return;

  detachActive?.();
  detachActive = null;
  activeCompanion = companion;

  if (companion) detachActive = attachMobileLayout(companion);
}

const observer = new MutationObserver(syncCompanion);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

syncCompanion();
