/**
 * Pop-up alert tones.
 *
 * Corner pop-ups from that era always announced themselves. Both tones are
 * synthesised through Web Audio rather than shipped as audio files: the
 * recognisable messenger sounds of the period are someone's copyrighted
 * assets, and a square-wave blip lands the same joke without redistributing
 * them. It also keeps the bundle free of binary media and the page free of an
 * audio element.
 *
 * The two species sound different on purpose — the corner pop-up gets a short
 * two-note message blip, the bottom-left takeover gets a repeating two-tone
 * ring — so the heavier interruption is audibly the heavier one.
 *
 * Playback is best-effort by construction: browsers refuse to start an
 * AudioContext before the page has been interacted with, and a silent first
 * pop-up is far better than a thrown error inside a render tree.
 */

/** Peak gain of every tone. Audible, never startling. */
const PEAK_GAIN = 0.11

/** Lazily created context, reused across pop-ups. */
let shared: AudioContext | undefined

/** One scheduled note. */
interface Note {
  /** Frequency in Hz. */
  readonly freq: number
  /** Offset from the start of the sequence, in seconds. */
  readonly at: number
  /** Duration, in seconds. */
  readonly dur: number
}

/** Short rising blip pair — the "you have a message" shape. */
const MESSAGE: readonly Note[] = [
  { freq: 1244.51, at: 0, dur: 0.075 },
  { freq: 1661.22, at: 0.09, dur: 0.11 },
]

/**
 * Two-tone ring repeated twice — the "someone is calling" shape. The gap
 * between bursts is what makes it read as a ring rather than as a longer blip.
 */
const RING: readonly Note[] = [
  { freq: 987.77, at: 0, dur: 0.1 },
  { freq: 1318.51, at: 0.11, dur: 0.1 },
  { freq: 987.77, at: 0.34, dur: 0.1 },
  { freq: 1318.51, at: 0.45, dur: 0.1 },
]

/**
 * Play a note sequence.
 * @param notes - the sequence to schedule.
 * @returns nothing; failures are swallowed.
 */
function play(notes: readonly Note[]): void {
  try {
    const Ctor = globalThis.AudioContext
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (Ctor === undefined) return
    shared ??= new Ctor()
    const ctx = shared
    for (const note of notes) {
      const at = ctx.currentTime + note.at
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      // Square wave: the buzzy, band-limited character of a small speaker
      // playing a low-bitrate alert, which a pure sine does not have.
      osc.type = 'square'
      osc.frequency.value = note.freq
      // Percussive envelope: instant attack, exponential tail. A raw
      // start/stop on an oscillator clicks audibly at both ends.
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + note.dur)
    }
  } catch {
    // Swallowed: every failure mode here (no AudioContext constructor, a
    // context still suspended by the autoplay policy, a hostile embedder)
    // means "no sound this time", and nothing else in the layer depends on it.
  }
}

/** Play the corner pop-up's message blip. */
export function playChime(): void {
  play(MESSAGE)
}

/** Play the bottom-left takeover's two-tone ring. */
export function playRing(): void {
  play(RING)
}
