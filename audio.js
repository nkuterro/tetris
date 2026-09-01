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
  let musicLevelTarget = 1;
  let musicState = {
    danger: 0,
    clearedLines: 0,
    combo: 0
  };

  const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const chordProgression = [
    { root: 36, notes: [48, 51, 55, 58] },
    { root: 32, notes: [56, 60, 63, 67] },
    { root: 41, notes: [53, 56, 60, 63] },
    { root: 43, notes: [55, 59, 62, 65] }
  ];
  const minorScale = [60, 62, 63, 65, 67, 68, 70, 72, 74, 75, 77, 79];
  const bassPatterns = [
    [0, 0, 7, 5, 0, 3, 5, 7],
    [0, 7, 5, 3, 0, 5, 7, 5],
    [0, 0, 5, 7, 0, 3, 7, 5],
    [0, 5, 7, 5, 0, 7, 5, 3]
  ];
  const melodyPatterns = [
    [0, 2, 4, 2, 5, 4, 2, 1],
    [4, 2, 5, 7, 4, 2, 1, 2],
    [0, 4, 2, 5, 7, 5, 4, 2],
    [5, 4, 2, 1, 2, 4, 5, 7]
  ];

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
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(getMusicOutput(pan));
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function playSynthLead(midi, duration, when, pan = 0, gainValue = 0.03) {
    if (!context || !musicFilter) return;

    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const frequency = midiToFreq(midi);
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(2.2, when);
    filter.frequency.setValueAtTime(420, when);
    filter.frequency.exponentialRampToValueAtTime(
      2400 + musicState.danger * 1800,
      when + 0.012
    );
    filter.frequency.exponentialRampToValueAtTime(650, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(getMusicOutput(pan));
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function playChordPad(chord, when, level) {
    chord.notes.forEach((midi, index) => {
      playMusicTone(
        midiToFreq(midi),
        0.7,
        index === 0 ? 'sine' : 'triangle',
        level,
        when,
        index === 0 ? 0.018 : 0.013,
        (index - 1.5) * 0.22
      );
    });
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

    if (Math.abs(musicLevel - musicLevelTarget) > 0.01) {
      musicLevel += (musicLevelTarget - musicLevel) * 0.08;
      updateMusicFilter();
    } else {
      musicLevel = musicLevelTarget;
    }

    const stepDuration = 60 / (104 + Math.min(musicLevel - 1, 10) * 4) / 4;
    while (nextMusicTime < context.currentTime + 0.18) {
      const step = musicStep % 64;
      const measure = Math.floor(step / 8);
      const bar = measure % chordProgression.length;
      const beat = step % 8;
      const chord = chordProgression[bar];
      const phrase = Math.floor(musicStep / 64) % melodyPatterns.length;
      const pattern = melodyPatterns[phrase];
      const bassLine = bassPatterns[phrase];
      const melodyIndex = (pattern[beat] + (musicState.danger > 0.75 ? 2 : 0)) % minorScale.length;
      const melodyMidi = minorScale[melodyIndex] + 12;
      const bassMidi = chord.root + bassLine[beat];
      const section = Math.floor(musicStep / 64) % 4;
      const melodyActive = section !== 1 || musicState.danger > 0.55;
      const padActive = section !== 0 || musicLevel >= 2;

      if (beat === 0 || beat === 3 || beat === 6) {
        playMusicTone(midiToFreq(bassMidi - 12), 0.24, 'sine', musicLevel, nextMusicTime, 0.13, -0.18);
        playMusicTone(midiToFreq(bassMidi), 0.16, 'triangle', musicLevel, nextMusicTime, 0.04, -0.1);
      }
      if (beat === 0 && padActive) {
        playChordPad(chord, nextMusicTime, musicLevel);
      }
      if (beat === 2 || beat === 6) {
        playMusicNoise(0.08, nextMusicTime, 0.038, 0.2);
      }
      if (musicStep % 2 === 0 || (musicLevel >= 3 && beat === 3)) {
        playMusicNoise(0.025, nextMusicTime, musicLevel >= 3 ? 0.024 : 0.014, -0.35);
      }
      if (melodyActive && musicStep % 2 === 0) {
        playSynthLead(melodyMidi, 0.12, nextMusicTime, Math.sin(musicStep * 0.7) * 0.4, musicLevel >= 3 ? 0.034 : 0.026);
      }
      if (musicLevel >= 2 && (beat === 3 || (musicState.danger > 0.75 && beat === 7))) {
        playSynthLead(chord.notes[2] + 12, 0.1, nextMusicTime, 0.35, 0.016);
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
    musicLevelTarget = Math.max(1, Number(level) || 1);
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
