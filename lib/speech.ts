// Read-aloud utility with a privacy-gated hosted-voice enhancement. Browser
// speech synthesis remains the always-available fallback, so an assessment is
// still fully usable before a Deepgram key is configured or if a provider
// is temporarily unavailable.

export type SpeechOptions = {
  /** Must come from VoiceInputContext; otherwise text never leaves Otis. */
  allowHosted?: boolean;
  /** Retained for call-site compatibility; audio authorization is cookie-based. */
  memberId?: string;
};

/**
 * Browser-only signal used by the read-aloud control when an opted-in hosted
 * request cannot be played. It deliberately carries no provider, response,
 * participant, or message information.
 */
export const HOSTED_SPEECH_UNAVAILABLE_EVENT = "otis-hosted-speech-unavailable";

function reportHostedSpeechUnavailable() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOSTED_SPEECH_UNAVAILABLE_EVENT));
}

let _cached: SpeechSynthesisVoice[] = [];
let _activeAudio: HTMLAudioElement | null = null;
let _activeAudioUrl: string | null = null;
let _audioContext: AudioContext | null = null;
let _activeAudioSource: AudioBufferSourceNode | null = null;
// Streaming PCM playback schedules many short buffers back-to-back; hold them
// all so cancelSpeech can stop the ones that have not finished playing yet.
let _activePcmSources: Set<AudioBufferSourceNode> | null = null;
let _activeFetch: AbortController | null = null;
let _speechRequestId = 0;

// Auto-read queue. Several ChatBubbles can mount together (e.g. an intro line
// plus a question); each enqueues its text and they are spoken one after
// another instead of each canceling the previous. Click-to-replay uses
// speakText, which clears the queue and speaks a single line immediately.
type QueueItem = { text: string; rate: number; options: SpeechOptions };
let _speechQueue: QueueItem[] = [];
let _queueRunning = false;
let _currentDrainId = 0;

// Resolve when `isDone()` returns true, or bail early if this request has been
// superseded (cancelSpeech / a newer line bumps _speechRequestId). This keeps
// the queue cancellation-safe without relying on onended, which we null during
// teardown. Polling at 60ms is inaudible for gapless scheduling.
async function waitForPlayback(requestId: number, isDone: () => boolean): Promise<void> {
  while (requestId === _speechRequestId && !isDone()) {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length) {
    _cached = immediate;
    return Promise.resolve(immediate);
  }
  if (_cached.length) return Promise.resolve(_cached);

  return new Promise((resolve) => {
    const handler = () => {
      _cached = window.speechSynthesis.getVoices();
      resolve(_cached);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true });
    // Safety fallback — some browsers never fire voiceschanged.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

export function pickMaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  const keywords = ["male", "david", "daniel", "james", "mark", "google uk english male"];
  for (const kw of keywords) {
    const v = voices.find(
      (voice) => voice.lang.startsWith("en") && voice.name.toLowerCase().includes(kw)
    );
    if (v) return v;
  }
  return voices.find((voice) => voice.lang.startsWith("en"));
}

function clearHostedAudio() {
  if (_activeAudioSource) {
    _activeAudioSource.onended = null;
    try {
      _activeAudioSource.stop();
    } catch {
      // It may already have ended; either way it can be disconnected safely.
    }
    _activeAudioSource.disconnect();
    _activeAudioSource = null;
  }
  if (_activePcmSources) {
    _activePcmSources.forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already ended.
      }
      source.disconnect();
    });
    _activePcmSources = null;
  }
  if (_activeAudio) {
    _activeAudio.onended = null;
    _activeAudio.onerror = null;
    _activeAudio.pause();
    _activeAudio.src = "";
    _activeAudio.load();
    _activeAudio = null;
  }
  if (_activeAudioUrl) {
    URL.revokeObjectURL(_activeAudioUrl);
    _activeAudioUrl = null;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_audioContext) return _audioContext;
  const BrowserAudioContext = window.AudioContext || (
    window as unknown as { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;
  if (!BrowserAudioContext) return null;
  try {
    _audioContext = new BrowserAudioContext();
    return _audioContext;
  } catch {
    return null;
  }
}

/**
 * Play raw signed-16-bit PCM as it streams in, so a higher-quality voice can
 * start speaking about a second after the request instead of after the whole
 * clip is generated. Each network chunk becomes a short AudioBuffer scheduled
 * immediately after the previous one, giving gapless playback. Requires a
 * running AudioContext (primed by the read-aloud gesture); returns false if it
 * cannot start, so the caller can fall back to a buffered MP3.
 */
async function streamPcmAudio(
  stream: ReadableStream<Uint8Array>,
  sampleRate: number,
  requestId: number
): Promise<boolean> {
  const context = getAudioContext();
  if (!context || context.state !== "running") return false;

  const sources = new Set<AudioBufferSourceNode>();
  _activePcmSources = sources;

  const reader = stream.getReader();
  let nextStartTime = 0;
  let started = false;
  // PCM samples are 2 bytes; a chunk can end mid-sample, so carry the odd byte.
  let leftover: Uint8Array | null = null;

  try {
    while (true) {
      if (requestId !== _speechRequestId) {
        reader.cancel().catch(() => {});
        return started;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      let bytes = value;
      if (leftover) {
        const merged = new Uint8Array(leftover.length + bytes.length);
        merged.set(leftover);
        merged.set(bytes, leftover.length);
        bytes = merged;
        leftover = null;
      }
      const usableLength = bytes.length - (bytes.length % 2);
      if (usableLength < bytes.length) leftover = bytes.slice(usableLength);
      if (usableLength === 0) continue;

      const sampleCount = usableLength / 2;
      const audioBuffer = context.createBuffer(1, sampleCount, sampleRate);
      const channel = audioBuffer.getChannelData(0);
      const view = new DataView(bytes.buffer, bytes.byteOffset, usableLength);
      for (let i = 0; i < sampleCount; i++) {
        channel[i] = view.getInt16(i * 2, true) / 0x8000;
      }

      if (requestId !== _speechRequestId) {
        reader.cancel().catch(() => {});
        return started;
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
      };

      // A small lead-in absorbs scheduling jitter on the first chunk. If the
      // network ever falls behind playback, clamp to "now" to avoid overlap.
      if (!started) {
        nextStartTime = context.currentTime + 0.12;
        started = true;
      }
      const startAt = Math.max(nextStartTime, context.currentTime);
      source.start(startAt);
      nextStartTime = startAt + audioBuffer.duration;
      sources.add(source);
    }
    // Download and scheduling are done; wait out the remaining playback so the
    // queue does not start the next line while this one is still speaking.
    if (started) {
      await waitForPlayback(requestId, () => context.currentTime >= nextStartTime - 0.02);
    }
    return started;
  } catch {
    return started;
  }
}

async function playHostedAudio(blob: Blob, requestId: number): Promise<boolean> {
  const context = getAudioContext();
  // The context may have been suspended after idle time even though it was
  // running when the fetch started. Try to resume it now; if it succeeds the
  // AudioContext decode path below gives better gapless queue behaviour.
  if (context?.state === "suspended") {
    try { await context.resume(); } catch { /* ignore */ }
  }
  if (context?.state === "running") {
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      if (requestId !== _speechRequestId) return false;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (_activeAudioSource === source) {
          source.disconnect();
          _activeAudioSource = null;
        }
      };
      _activeAudioSource = source;
      const endTime = context.currentTime + buffer.duration;
      source.start();
      await waitForPlayback(requestId, () => context.currentTime >= endTime - 0.02);
      return true;
    } catch {
      // Some older browsers cannot decode a given output codec. Fall through
      // to an HTMLAudioElement, which has its own platform decoder.
    }
  }

  if (requestId !== _speechRequestId) return false;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  let ended = false;
  audio.onended = () => {
    ended = true;
    if (_activeAudio === audio) clearHostedAudio();
  };
  audio.onerror = () => {
    ended = true;
    if (_activeAudio === audio) clearHostedAudio();
  };

  _activeAudio = audio;
  _activeAudioUrl = url;
  try {
    await audio.play();
    await waitForPlayback(requestId, () => ended);
    return true;
  } catch {
    if (_activeAudio === audio) clearHostedAudio();
    return false;
  }
}

async function speakWithBrowser(text: string, rate: number, requestId: number): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = await loadVoices();
  if (requestId !== _speechRequestId) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  const voice = pickMaleVoice(voices);
  if (voice) utterance.voice = voice;
  let ended = false;
  utterance.onend = () => { ended = true; };
  utterance.onerror = () => { ended = true; };
  window.speechSynthesis.speak(utterance);
  await waitForPlayback(requestId, () => ended);
}

function parsePcmSampleRate(contentType: string): number | null {
  // Deepgram returns "audio/l16;rate=24000" for raw PCM.
  if (!/\baudio\/l16\b/i.test(contentType)) return null;
  const match = /rate=(\d+)/i.exec(contentType);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isInteger(rate) && rate > 0 ? rate : 24_000;
}

async function speakWithHostedVoice(
  text: string,
  requestId: number
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Prefer the progressive PCM path, but only if a running Web Audio context is
  // available to play it. Resume the context first (it was primed by the
  // read-aloud gesture); if it will not run, ask the server for a self-contained
  // MP3 we can buffer and play through an <audio> element instead.
  const context = getAudioContext();
  if (context?.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Ignore; state check below decides the format.
    }
  }
  const canStreamPcm = context?.state === "running";
  const format = canStreamPcm ? "pcm" : "mp3";

  const controller = new AbortController();
  _activeFetch = controller;
  try {
    const response = await fetch("/api/audio/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, format }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok || requestId !== _speechRequestId) return false;

    const sampleRate = parsePcmSampleRate(response.headers.get("content-type") || "");
    if (canStreamPcm && sampleRate && response.body) {
      // Committed to the streaming path: the body is raw PCM, so it cannot be
      // replayed as an <audio> blob. The fetch controller stays referenced so
      // cancelSpeech can abort mid-playback; a false result (nothing ever
      // scheduled) surfaces to the browser-voice fallback in speakText.
      return streamPcmAudio(response.body, sampleRate, requestId);
    }

    // MP3 (or any non-PCM) response: buffer and play through the decoder.
    const blob = await response.blob();
    if (!blob.size || requestId !== _speechRequestId) return false;

    _activeFetch = null;
    return playHostedAudio(blob, requestId);
  } catch {
    return false;
  } finally {
    if (_activeFetch === controller) _activeFetch = null;
  }
}

// Speak a single line and resolve only once it has finished playing (or been
// superseded). Shared by the queue and by click-to-replay.
async function playOne(text: string, rate: number, options: SpeechOptions): Promise<void> {
  const requestId = ++_speechRequestId;

  // `allowHosted` is supplied only by components inside VoiceInputProvider.
  // Do not infer consent from read-aloud alone.
  if (options.allowHosted) {
    const played = await speakWithHostedVoice(text, requestId);
    if (played || requestId !== _speechRequestId) return;
    // Do not silently make a Deepgram failure look like success. We still
    // provide the device voice as a resilient fallback, but the UI can now
    // clearly tell the participant which one is being used.
    reportHostedSpeechUnavailable();
  }

  if (requestId === _speechRequestId) await speakWithBrowser(text, rate, requestId);
}

async function drainQueue(drainId: number): Promise<void> {
  try {
    while (_speechQueue.length > 0) {
      // A new drainQueue call (from queueSpeech after cancelSpeech) replaced us.
      if (drainId !== _currentDrainId) return;
      const item = _speechQueue.shift()!;
      await playOne(item.text, item.rate, item.options);
    }
  } finally {
    if (drainId === _currentDrainId) _queueRunning = false;
  }
}

/**
 * Enqueue a message to be read after any already-queued lines. Use this for
 * automatic read-aloud, so a screen that shows several bubbles at once speaks
 * them in order instead of only the last one. Hosted speech is opt-in per call.
 */
export function queueSpeech(
  text: string,
  rate = 0.95,
  options: SpeechOptions = {}
): void {
  const message = text.trim();
  if (!message || typeof window === "undefined") return;
  _speechQueue.push({ text: message, rate, options });
  if (!_queueRunning) {
    _queueRunning = true;
    const drainId = ++_currentDrainId;
    void drainQueue(drainId);
  }
}

/**
 * Read a single message aloud immediately, cancelling anything queued or
 * playing first. Use this for a deliberate replay (e.g. clicking a bubble).
 */
export async function speakText(
  text: string,
  rate = 0.95,
  options: SpeechOptions = {}
): Promise<void> {
  const message = text.trim();
  if (!message || typeof window === "undefined") return;

  cancelSpeech();
  await playOne(message, rate, options);
}

// Call this synchronously inside the click/tap that turns read-aloud ON. Some
// browsers (Chrome) only allow speechSynthesis to start from a user gesture; if
// the first real utterance is fired later from an effect, it can be silently
// dropped. Speaking a tiny empty utterance here "unlocks" the API so the first
// message (e.g. the Welcome-back line) can use the browser fallback.
export function primeSpeech(): void {
  if (typeof window === "undefined") return;
  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.resume();
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch {
      /* no-op */
    }
  }
}

export function cancelSpeech(): void {
  _speechQueue = [];
  _queueRunning = false;
  _speechRequestId += 1;
  _activeFetch?.abort();
  _activeFetch = null;
  clearHostedAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
