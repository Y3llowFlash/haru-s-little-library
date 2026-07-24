import { useEffect, useRef, useState, type CSSProperties } from "react";
import totoroBlink from "./assets/night-library/totoro-blink-overlay.png";
import totoroSeated from "./assets/night-library/totoro-seated.png";

const FIRST_BLINK_DELAY = { min: 2500, max: 5000 };
const BLINK_DELAY = { min: 4000, max: 9000 };
const DOUBLE_BLINK_DELAY = { min: 140, max: 260 };
const DOUBLE_BLINK_CHANCE = 0.16;

function randomDelay({ min, max }: { min: number; max: number }) {
  return Math.round(min + Math.random() * (max - min));
}

export default function TotoroShelfCompanion({ readerOpen }: { readerOpen: boolean }) {
  const blinkLayerRef = useRef<HTMLImageElement | null>(null);
  const [motionActive, setMotionActive] = useState(false);

  useEffect(() => {
    const blinkLayer = blinkLayerRef.current;
    if (!blinkLayer) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let blinkTimer: number | null = null;
    let blinkAnimation: Animation | null = null;
    let animationEligible = false;

    const clearBlink = () => {
      if (blinkTimer !== null) {
        window.clearTimeout(blinkTimer);
        blinkTimer = null;
      }

      if (blinkAnimation) {
        blinkAnimation.cancel();
        blinkAnimation = null;
      }
    };

    const scheduleBlink = (delayRange: { min: number; max: number }, isDouble = false) => {
      if (!animationEligible) return;

      blinkTimer = window.setTimeout(() => {
        blinkTimer = null;
        if (!animationEligible || blinkAnimation) return;

        const animation = blinkLayer.animate(
          [
            { opacity: 0, offset: 0, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            { opacity: 1, offset: 0.31, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
            { opacity: 1, offset: 0.58, easing: "cubic-bezier(0.7, 0, 0.84, 0)" },
            { opacity: 0, offset: 1 },
          ],
          { duration: 225, fill: "none" },
        );

        blinkAnimation = animation;
        animation.addEventListener(
          "finish",
          () => {
            if (blinkAnimation !== animation) return;
            blinkAnimation = null;

            if (!animationEligible) return;

            const shouldDoubleBlink = !isDouble && Math.random() < DOUBLE_BLINK_CHANCE;
            scheduleBlink(shouldDoubleBlink ? DOUBLE_BLINK_DELAY : BLINK_DELAY, shouldDoubleBlink);
          },
          { once: true },
        );
      }, randomDelay(delayRange));
    };

    const syncMotion = () => {
      const shouldAnimate = !readerOpen && !document.hidden && !reducedMotion.matches;
      animationEligible = shouldAnimate;
      setMotionActive(shouldAnimate);
      clearBlink();

      if (shouldAnimate) {
        scheduleBlink(FIRST_BLINK_DELAY);
      }
    };

    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);

    return () => {
      animationEligible = false;
      clearBlink();
      reducedMotion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
    };
  }, [readerOpen]);

  const companionStyle = {
    "--totoro-art": `url("${totoroSeated}")`,
  } as CSSProperties;

  return (
    <div
      className={`totoro-companion${motionActive ? " is-motion-active" : ""}`}
      style={companionStyle}
      aria-hidden="true"
    >
      <div className="totoro-anchor">
        <span className="totoro-contact-shadow" />
        <div className="totoro-breathe">
          <div className="totoro-settle">
            <div className="totoro-body">
              <img
                className="totoro-image totoro-image-open"
                src={totoroSeated}
                alt=""
                width="1254"
                height="1254"
                draggable="false"
              />
              <img
                ref={blinkLayerRef}
                className="totoro-image totoro-image-closed"
                src={totoroBlink}
                alt=""
                width="1024"
                height="1024"
                draggable="false"
              />
              <span className="totoro-lighting" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
