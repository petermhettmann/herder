import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { base44 } from "@/api/base44Client";
import { transcribeNote } from "@/lib/voice";

// Records a voice note, stores it privately and drops the transcript into the note field.
export default function VoiceNote({ onTranscript }) {
  const transcribe = useServerFn(transcribeNote);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setState("transcribing");
        try {
          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({
            file: new File([blob], "note.webm", { type: blob.type }),
          });
          const { text } = await transcribe({ data: { fileUri: file_uri } });
          if (text) onTranscript(text);
        } catch {
          setError("Could not transcribe that note.");
        }
        setState("idle");
      };
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      setError("Microphone unavailable.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div>
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "transcribing"}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      >
        {state === "recording" ? (
          <Square className="h-3.5 w-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Mic className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        )}
        {state === "recording" ? "Stop and transcribe" : state === "transcribing" ? "Transcribing..." : "Voice note"}
      </button>
      {error && <p className="mt-1 text-[11px] text-call-stop">{error}</p>}
    </div>
  );
}