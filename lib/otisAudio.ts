/**
 * Shared, browser-safe contracts for Otis's optional hosted audio features.
 *
 * Audio is intentionally recorded in short, on-demand clips. The clip only
 * lives in memory long enough to be sent to the same-origin transcription
 * route; Otis never writes it to a database or object store.
 */

export const OTIS_AUDIO_LIMITS = {
  /** Keep a single spoken answer short enough for a responsive mobile flow. */
  maxRecordingDurationMs: 60_000,
  /** Ignore accidental taps that do not contain a meaningful recording. */
  minRecordingDurationMs: 500,
  /** Below Vercel's request-body limit, with room for multipart overhead. */
  maxRecordingBytes: 4 * 1024 * 1024,
  /**
   * Deepgram Aura's REST endpoint accepts at most 2,000 characters per
   * request. Keeping Otis below that provider boundary prevents a long
   * message from quietly falling back to the device voice.
   */
  maxSynthesisCharacters: 2_000,
} as const;

export type HostedAudioCapabilities = {
  transcription: boolean;
  synthesis: boolean;
};

export const NO_HOSTED_AUDIO: HostedAudioCapabilities = {
  transcription: false,
  synthesis: false,
};

// The browser decides which of these it can actually encode. Chrome/Edge
// generally choose WebM/Opus; current Safari chooses MP4/AAC.
const RECORDING_MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function canRecordAudioInBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Return a browser-supported MIME type, or let MediaRecorder choose one. */
export function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDING_MIME_PREFERENCES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function isSupportedRecordingMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().split(";", 1)[0].trim();
  return [
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
  ].includes(normalized);
}
