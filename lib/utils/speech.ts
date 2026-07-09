// Speaks Bangla text using a real Bangla system voice only. Browsers fall
// back to whatever the OS default voice is (usually English) when no voice
// matches the requested language, which mangles Bangla script into an
// English-accented reading — worse than not speaking at all — so we
// require an actual bn/bn-BD/bn-IN voice and report back if none exists.
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const handle = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        window.speechSynthesis.removeEventListener("voiceschanged", handle);
        resolve(voices);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", handle);
    // Some browsers never fire voiceschanged (or already had an empty list) —
    // don't hang forever waiting for a voice that isn't coming.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
  return voicesPromise;
}

function findBanglaVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("bn")) ??
    voices.find((v) => /bangla|bengali/i.test(v.name))
  );
}

export async function speakBangla(text: string, onNoVoice?: () => void): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onNoVoice?.();
    return;
  }
  const voices = await loadVoices();
  const bnVoice = findBanglaVoice(voices);
  window.speechSynthesis.cancel();
  if (!bnVoice) {
    onNoVoice?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = bnVoice;
  utterance.lang = bnVoice.lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
