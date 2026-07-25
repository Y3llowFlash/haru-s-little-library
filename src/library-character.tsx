import { useEffect, useRef, useState } from "react";
import howlCastle from "./assets/night-library/howl_castle_transparent.webm";
import TotoroShelfCompanion from "./totoro-shelf-companion";

export type LibraryCharacterChoice = "totoro" | "howl";

const CHARACTER_STORAGE_KEY = "haru-library-character";
const TRANSITION_HALF_DURATION = 180;

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
  onHowlUnavailable,
}: {
  choice: LibraryCharacterChoice;
  readerOpen: boolean;
  onHowlUnavailable: () => void;
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
        <HowlCastleCharacter readerOpen={readerOpen} onUnavailable={onHowlUnavailable} />
      )}
    </div>
  );
}

function HowlCastleCharacter({
  readerOpen,
  onUnavailable,
}: {
  readerOpen: boolean;
  onUnavailable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTriggered = useRef(false);

  const fallbackToTotoro = () => {
    if (fallbackTriggered.current) return;
    fallbackTriggered.current = true;
    onUnavailable();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (readerOpen) {
      video.pause();
      return;
    }

    const playAttempt = video.play();
    playAttempt?.catch(fallbackToTotoro);
  }, [readerOpen]);

  return (
    <div className={`howl-castle-companion${readerOpen ? " is-paused" : ""}`} aria-hidden="true">
      <div className="howl-castle-traveller">
        <video
          ref={videoRef}
          className="howl-castle-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          onError={fallbackToTotoro}
        >
          {/* A HEVC-with-alpha source can be added before this source when one is available. */}
          <source src={howlCastle} type="video/webm; codecs=vp9" />
        </video>
      </div>
    </div>
  );
}
