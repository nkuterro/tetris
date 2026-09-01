const gameAudio = (() => {
  let context = null;
  let masterGain = null;
  let muted = false;
  let volume = 1;
  let musicTimer = null;
  let musicStep = 0;
  let musicLevel = 1;
  let nextMusicTime = 0;
  let musicGain = null;
  let musicDelay = null;
  let musicFeedback = null;
  let musicFilter = null;
  let musicState = {
    danger: 0,
    clearedLines: 0,
    combo: 0
  };

  const chordRoots = [130.81, 155.56, 174.61, 116.54, 130.81, 174.61, 155.56, 116.54];
  const scale = [1, 1.1225, 1.1892, 1.3348, 1.4983, 1.6818, 1.7818, 2, 2.2449, 2.5198];
  const bassPattern = [0, 0, 7, 5, 0, 3, 5, 7];

  function getMusicOutput(pan = 0) {
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(pan, context.currentTime);
    panner.connect(musicFilter);
    return panner;
  }

  function playMusicTone(frequency, duration, type, level, when, gainValue, pan = 0) {
    if (!context || !musicGain) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * (1 + Math.min(level - 1, 10) * 0.008), when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(getMusicOutput(pan));
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function playMusicNoise(duration, when, gainValue, pan = 0) {
    const bufferSize = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, when);
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(getMusicOutput(pan));
    source.start(when);
  }

  function scheduleMusic() {
    if (!context || !musicTimer) return;

    const stepDuration = 60 / (104 + Math.min(musicLevel - 1, 10) * 4) / 4;
    while (nextMusicTime < context.currentTime + 0.18) {
      const step = musicStep % 32;
      const bar = Math.floor(step / 8) % chordRoots.length;
      const beat = step % 8;
      const root = chordRoots[bar];
      const tension = musicState.danger > 0.65 ? 2 : 0;
      const noteIndex = (musicStep + musicLevel * 2 + tension) % scale.length;
      const note = root * scale[noteIndex];
      const counterNote = root * scale[(scale.length - 1 - noteIndex + musicLevel) % scale.length] * 2;
      const bassNote = root * scale[bassPattern[beat] % scale.length] / 2;

      if (beat === 0 || beat === 4) {
        playMusicTone(bassNote, 0.2, 'sine', musicLevel, nextMusicTime, 0.08, -0.15);
        playMusicTone(root, 0.12, 'square', musicLevel, nextMusicTime, 0.018, 0.1);
      }
      if (beat === 2 || beat === 6) {
        playMusicNoise(0.08, nextMusicTime, 0.045, 0.2);
      }
      if (musicStep % 2 === 0) {
        playMusicNoise(0.025, nextMusicTime, musicLevel >= 3 ? 0.022 : 0.014, -0.35);
      }
      if (musicStep % 2 === 0) {
        playMusicTone(note, 0.11, 'triangle', musicLevel, nextMusicTime, 0.04, Math.sin(musicStep) * 0.45);
      }
      if (musicStep % 4 === 2 || musicState.combo > 0) {
        playMusicTone(counterNote, 0.09, 'sine', musicLevel, nextMusicTime, 0.022, 0.42);
      }
      if (musicLevel >= 2 && (beat === 3 || (musicState.danger > 0.75 && beat === 7))) {
        playMusicTone(root * 2, 0.16, 'sawtooth', musicLevel, nextMusicTime, 0.018, 0.35);
      }

      musicStep += 1;
      nextMusicTime += stepDuration;
    }
  }

  function ensureStarted() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      masterGain = context.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.62;
      musicFilter = context.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 1800;
      musicFilter.Q.value = 0.7;
      musicDelay = context.createDelay(0.35);
      musicFeedback = context.createGain();
      musicFeedback.gain.value = 0.18;
      musicGain.connect(musicFilter);
      musicFilter.connect(masterGain);
      musicGain.connect(musicDelay);
      musicDelay.connect(musicFeedback);
      musicFeedback.connect(musicDelay);
      musicDelay.connect(masterGain);
    }

    if (context.state === 'suspended') {
      context.resume();
    }

    return true;
  }

  function tone(frequency, duration, type = 'sine', volume = 0.12, endFrequency = frequency) {
    if (muted || !ensureStarted()) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function noise(duration = 0.08, volume = 0.08) {
    if (muted || !ensureStarted()) return;

    const bufferSize = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  function setMuted(value) {
    muted = value;
    if (masterGain) {
      masterGain.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.02);
    }
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    if (masterGain && !muted) {
      masterGain.gain.setTargetAtTime(volume, context.currentTime, 0.02);
    }
  }

  function startMusic() {
    if (!ensureStarted() || musicTimer) return;
    musicStep = 0;
    nextMusicTime = context.currentTime + 0.03;
    musicTimer = window.setInterval(scheduleMusic, 80);
    scheduleMusic();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMusicLevel(level) {
    musicLevel = Math.max(1, Number(level) || 1);
    updateMusicFilter();
  }

  function updateMusicFilter() {
    if (!musicFilter || !context) return;
    const cutoff = 1400 + musicState.danger * 4200 + Math.min(musicLevel - 1, 10) * 120;
    musicFilter.frequency.setTargetAtTime(cutoff, context.currentTime, 0.08);
  }

  function setMusicState(state = {}) {
    musicState = {
      danger: Math.max(0, Math.min(1, Number(state.danger) || 0)),
      clearedLines: Math.max(0, Number(state.clearedLines) || 0),
      combo: Math.max(0, Number(state.combo) || 0)
    };
    updateMusicFilter();
  }

  function preview(value) {
    if (muted || !ensureStarted()) return;
    tone(220 + value * 660, 0.12, 'triangle', 0.16, 220 + value * 660);
  }

  return {
    start: ensureStarted,
    toggleMute() {
      setMuted(!muted);
      return muted;
    },
    isMuted() {
      return muted;
    },
    setVolume,
    preview,
    startMusic,
    stopMusic,
    setMusicLevel,
    setMusicState,
    move() {
      tone(180, 0.035, 'square', 0.045, 230);
    },
    rotate() {
      tone(420, 0.08, 'triangle', 0.07, 620);
    },
    softDrop() {
      tone(120, 0.045, 'sine', 0.055, 90);
    },
    hardDrop() {
      tone(110, 0.13, 'sawtooth', 0.13, 52);
      noise(0.07, 0.055);
    },
    hold() {
      tone(330, 0.08, 'triangle', 0.07, 520);
    },
    clear(count) {
      const notes = count === 4 ? [392, 523, 659, 784] : [392, 523, 659].slice(0, count);
      notes.forEach((note, index) => {
        window.setTimeout(() => tone(note, 0.18, 'square', 0.09, note * 1.03), index * 45);
      });
      noise(0.11, 0.08);
    },
    tetris() {
      [523, 659, 784, 1047, 1319].forEach((note, index) => {
        window.setTimeout(() => tone(note, 0.24, 'square', 0.12, note * 1.04), index * 70);
      });
      noise(0.18, 0.1);
    },
    gameOver() {
      stopMusic();
      tone(220, 0.35, 'sawtooth', 0.1, 110);
      window.setTimeout(() => tone(140, 0.45, 'sawtooth', 0.08, 55), 160);
    }
  };
})();
