import { useEffect, useRef, useState } from "react";

/**
 * Record a voice note with MediaRecorder. stop() resolves with the audio
 * Blob; cancel() discards the recording.
 */
export default function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const resolveRef = useRef(null);

  const cleanup = () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    recorder.onstop = () => {
      const blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null;
      resolveRef.current?.(blob);
      resolveRef.current = null;
      cleanup();
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () =>
    new Promise((resolve) => {
      if (!recorderRef.current) return resolve(null);
      resolveRef.current = resolve;
      recorderRef.current.stop();
    });

  const cancel = () => {
    resolveRef.current = null;
    if (recorderRef.current) {
      recorderRef.current.onstop = cleanup;
      recorderRef.current.stop();
    }
  };

  return { recording, seconds, start, stop, cancel };
}
