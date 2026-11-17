// All sound is synthesised with WebAudio: no audio files, no network.
// The engine hum, the police siren, gunfire, explosions, pickups and the
// mission jingle are all oscillators and filtered noise, built lazily on
// the first user gesture (browsers block audio before one).

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  /** Build the context. Call from a user gesture; safe to call twice. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return true;
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function isMuted() {
    return muted;
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, volume, lowFreq) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  /** The engine drone follows the car's speed; call every frame while driving. */
  function engine(speedRatio) {
    if (!context || muted) return;
    if (!engineOsc) {
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    const target = speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 110, context.currentTime, 0.08);
  }

  function engineOff() {
    if (engineGain && context) engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
  }

  /** A two-tone siren that wails while any police unit is close. */
  function siren(on) {
    if (!context) return;
    if (on && !sirenOsc) {
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0.045;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } else if (!on && sirenOsc) {
      const osc = sirenOsc;
      const lfo = sirenLfo;
      const gain = sirenGain;
      sirenOsc = null;
      sirenLfo = null;
      sirenGain = null;
      gain.gain.setTargetAtTime(0, context.currentTime, 0.1);
      window.setTimeout(() => {
        try { osc.stop(); lfo.stop(); } catch { /* already stopped */ }
      }, 400);
    }
  }

  return {
    ensure,
    setMuted,
    isMuted,
    engine,
    engineOff,
    siren,
    gunshot() {
      noise(0.14, 0.5, 1800);
      tone(180, 0.08, 'square', 0.25, 60);
    },
    enemyShot() {
      noise(0.12, 0.22, 1400);
    },
    explosion() {
      noise(0.7, 0.8, 500);
      tone(90, 0.6, 'sine', 0.6, 30);
    },
    crash() {
      noise(0.25, 0.4, 900);
      tone(120, 0.2, 'square', 0.2, 50);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.3, 1320);
    },
    cash() {
      tone(660, 0.09, 'sine', 0.28);
      window.setTimeout(() => tone(990, 0.12, 'sine', 0.28), 70);
    },
    denied() {
      tone(160, 0.16, 'square', 0.25, 110);
    },
    click() {
      tone(520, 0.05, 'sine', 0.2);
    },
    missionDone() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.3), i * 110);
      });
    },
    missionFail() {
      tone(392, 0.25, 'sawtooth', 0.25, 196);
      window.setTimeout(() => tone(311, 0.4, 'sawtooth', 0.25, 155), 200);
    },
    busted() {
      tone(440, 0.2, 'square', 0.25, 330);
      window.setTimeout(() => tone(330, 0.35, 'square', 0.25, 220), 180);
    },
  };
}
