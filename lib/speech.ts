// Shared speech synthesis utility. Voices load asynchronously in most browsers
// — this module caches them and waits for the voiceschanged event when needed.

let _cached: SpeechSynthesisVoice[] = [];

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
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes(kw)
    );
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en"));
}

export async function speakText(text: string, rate = 0.95): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = await loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  const voice = pickMaleVoice(voices);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

// Call this synchronously inside the click/tap that turns read-aloud ON. Some
// browsers (Chrome) only allow speechSynthesis to start from a user gesture; if
// the first real utterance is fired later from an effect, it can be silently
// dropped. Speaking a tiny empty utterance here "unlocks" the API so the first
// message (e.g. the Welcome-back line) actually plays.
export function primeSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.resume();
    const warm = new SpeechSynthesisUtterance(" ");
    warm.volume = 0;
    window.speechSynthesis.speak(warm);
  } catch {
    /* no-op */
  }
}

export function cancelSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
