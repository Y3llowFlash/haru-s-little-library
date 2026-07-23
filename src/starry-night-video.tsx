"use client";

import { useEffect, useRef, useState } from "react";
import starryBackgroundPoster from "./assets/night-library/starry-background-poster.png";
import starryBackground from "./assets/night-library/starry_background.mp4";

function safelyPlay(video: HTMLVideoElement) {
  const playRequest = video.play();
  if (playRequest) {
    void playRequest.catch(() => {
      // Decorative media can remain on its current frame when autoplay is unavailable.
    });
  }
}

export default function StarryNightVideo({ readerOpen }: { readerOpen: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncSourceWithPreference = () => {
      const allowMotion = !reducedMotion.matches;
      setMotionAllowed(allowMotion);

      if (allowMotion) {
        video.preload = "metadata";
        if (video.getAttribute("src") !== starryBackground) {
          video.src = starryBackground;
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

    syncSourceWithPreference();
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

  return (
    <video
      ref={videoRef}
      className="starry-night-video"
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster={starryBackgroundPoster}
      controls={false}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    />
  );
}
