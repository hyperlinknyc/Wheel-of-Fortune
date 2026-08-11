// Voice-activity detection: energy only, never words.
//
// The one thing worth knowing about a bonus round is how long she went quiet.
// No speech-to-text -- iOS Safari support for it is unreliable and the words
// are not the point. This measures RMS against a calibrated noise floor and
// reports total silence.

let stream = null;
let ctx = null;

export const micSupported = () =>
  !!(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));

/** Must be called from a user gesture. Resolves true if the mic is usable. */
export async function requestMic() {
  if (!micSupported()) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

/**
 * Measures silence over `durationMs`. Returns a handle whose result() resolves
 * to { silenceMs, voicedMs, ok }. Degrades to ok:false rather than throwing --
 * a mic problem must never interrupt a drill.
 */
export function measureSilence(durationMs) {
  if (!stream || !ctx || ctx.state !== 'running') {
    return { result: async () => ({ ok: false, silenceMs: null, voicedMs: null }) };
  }

  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.2;
  src.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  const SAMPLE_MS = 20;
  const CALIBRATE_MS = 400;

  let floor = 0;
  let floorSamples = 0;
  let voicedMs = 0;
  let voiced = false;
  let elapsed = 0;

  const rms = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  const done = new Promise((resolve) => {
    const iv = setInterval(() => {
      elapsed += SAMPLE_MS;
      const level = rms();

      if (elapsed <= CALIBRATE_MS) {
        floor = (floor * floorSamples + level) / (floorSamples + 1);
        floorSamples++;
      } else {
        // Hysteresis so a breath between words does not read as silence.
        const high = Math.max(floor * 3.5, 0.012);
        const low = Math.max(floor * 2.0, 0.007);
        if (!voiced && level > high) voiced = true;
        else if (voiced && level < low) voiced = false;
        if (voiced) voicedMs += SAMPLE_MS;
      }

      if (elapsed >= durationMs) {
        clearInterval(iv);
        try { src.disconnect(); } catch { /* already gone */ }
        const measured = Math.max(0, durationMs - CALIBRATE_MS);
        resolve({
          ok: true,
          voicedMs,
          // Calibration time is credited as speaking, so the number never
          // punishes her for the app's own setup window.
          silenceMs: Math.max(0, measured - voicedMs),
        });
      }
    }, SAMPLE_MS);
  });

  return { result: () => done };
}
