import { useCallback, useEffect, useRef, useState } from "react";

const SLOTS = 3;
const INTERVAL_MS = 1000;

// Camera burst: three frames, one second apart, with a retake per slot.
export default function useBurstCamera(active) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState(() => new Array(SLOTS).fill(null));
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("No camera on this device. You can still submit without photos.");
      return undefined;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        // The sheet can mount a frame after the stream arrives, so keep trying to attach.
        let attempts = 0;
        const attach = () => {
          if (cancelled || !videoRef.current) {
            attempts += 1;
            if (attempts < 10) setTimeout(attach, 100);
            return;
          }
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setReady(true);
        };
        attach();
      })
      .catch(() => setError("Camera unavailable. You can still submit without photos."));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [active]);

  const captureFrame = useCallback(
    () =>
      new Promise((resolve) => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => resolve(blob ? { blob, url: URL.createObjectURL(blob) } : null),
          "image/jpeg",
          0.82
        );
      }),
    []
  );

  const fireBurst = useCallback(async () => {
    if (firing) return;
    setFiring(true);
    for (let index = 0; index < SLOTS; index += 1) {
      const shot = await captureFrame();
      if (shot) {
        setSlots((previous) => {
          const next = [...previous];
          next[index] = shot;
          return next;
        });
      }
      if (index < SLOTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      }
    }
    setFiring(false);
  }, [captureFrame, firing]);

  const retake = useCallback(
    async (index) => {
      const shot = await captureFrame();
      if (!shot) return;
      setSlots((previous) => {
        const next = [...previous];
        next[index] = shot;
        return next;
      });
    },
    [captureFrame]
  );

  const reset = useCallback(() => {
    setSlots((previous) => {
      previous.forEach((slot) => {
        if (slot?.url) URL.revokeObjectURL(slot.url);
      });
      return new Array(SLOTS).fill(null);
    });
  }, []);

  return { videoRef, ready, error, slots, firing, fireBurst, retake, reset };
}