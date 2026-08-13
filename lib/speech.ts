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
let _activeFetch: AbortController | null = null;
let _speechRequestId = 0;

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

async function playHostedAudio(blob: Blob, requestId: number): Promise<boolean> {
  const context = getAudioContext();
  // `primeSpeech` resumes this context within the participant's deliberate
  // read-aloud gesture. AudioContext playback then stays permitted when a TTS
  // response arrives asynchronously — especially important on iOS Safari.
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
      source.start();
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
  audio.onended = () => {
    if (_activeAudio === audio) clearHostedAudio();
  };
  audio.onerror = () => {
    if (_activeAudio === audio) clearHostedAudio();
  };

  _activeAudio = audio;
  _activeAudioUrl = url;
  try {
    await audio.play();
    return true;
  } catch {
    if (_activeAudio === audio) clearHostedAudio();
    return false;
  }
}

async function speakWithBrowser(text: string, rate: number): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = await loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  const voice = pickMaleVoice(voices);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

async function speakWithHostedVoice(
  text: string,
  requestId: number
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const controller = new AbortController();
  _activeFetch = controller;
  try {
    const response = await fetch("/api/audio/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok || requestId !== _speechRequestId) return false;

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

/**
 * Read a message aloud. Hosted speech is deliberately opt-in per invocation:
 * callers without VoiceInputContext permission always remain in the browser.
 */
export async function speakText(
  text: string,
  rate = 0.95,
  options: SpeechOptions = {}
): Promise<void> {
  const message = text.trim();
  if (!message || typeof window === "undefined") return;

  cancelSpeech();
  const requestId = ++_speechRequestId;

  // `allowHosted` is supplied only by components inside VoiceInputProvider.
  // Do not infer consent from read-aloud alone.
  if (options.allowHosted) {
    const played = await speakWithHostedVoice(message, requestId);
    if (played || requestId !== _speechRequestId) return;
    // Do not silently make a Deepgram failure look like success. We still
    // provide the device voice as a resilient fallback, but the UI can now
    // clearly tell the participant which one is being used.
    reportHostedSpeechUnavailable();
  }

  if (requestId === _speechRequestId) await speakWithBrowser(message, rate);
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
  _speechRequestId += 1;
  _activeFetch?.abort();
  _activeFetch = null;
  clearHostedAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
