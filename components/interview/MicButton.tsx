"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "@/components/interview/icons";

// Minimal shape of the bits of the (non-standard, vendor-prefixed) Web
// Speech API we actually use — there's no official lib.dom typing for it.
type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRecognitionErrorEvent = {
  error: string;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Gentle mic affordance for any text field — tap to speak instead of type.
// Renders nothing if the browser doesn't support speech recognition, so it
// never shows up as a broken control.
export default function MicButton({
  onResult,
}: {
  onResult: (transcript: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.error("[voice] SpeechRecognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = (event) => {
      console.error("[voice] speech recognition error:", event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {listening && (
        <span className="text-xs text-[var(--color-purple)]">
          listening...
        </span>
      )}
      <button
        type="button"
        onClick={toggleListening}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak your answer"}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
          listening
            ? "bg-[var(--color-purple)] text-white"
            : "text-[var(--color-grey)] hover:text-[var(--color-ink)]"
        }`}
      >
        <MicIcon />
      </button>
    </span>
  );
}
