'use strict';

(() => {
  const preferenceKey = 'tefinanza-ambient-audio-v1';
  const defaultPreferences = { enabled: true, volume: 0.10, track: 'rain' };
  const tracks = {
    rain: {
      label: 'Pianoforte soffuso · sera', tempo: 12000,
      chords: [[130.81, 164.81, 196, 246.94], [110, 130.81, 164.81, 196], [87.31, 130.81, 164.81, 196], [98, 146.83, 196, 246.94]],
      notes: [392, 329.63, 293.66, 329.63, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63, 293.66]
    },
    ocean: {
      label: 'Onde lente · armonia', tempo: 14500,
      chords: [[146.83, 174.61, 220, 261.63], [130.81, 164.81, 196, 246.94], [98, 146.83, 174.61, 220], [110, 146.83, 174.61, 220]],
      notes: [293.66, 349.23, 392, 349.23, 261.63, 293.66, 349.23, 293.66, 261.63, 293.66, 349.23, 392]
    },
    focus: {
      label: 'Respiro · note morbide', tempo: 16500,
      chords: [[116.54, 146.83, 174.61, 233.08], [130.81, 164.81, 196, 261.63], [98, 146.83, 174.61, 233.08], [116.54, 146.83, 174.61, 220]],
      notes: [233.08, 293.66, 349.23, 293.66, 261.63, 293.66, 349.23, 392, 349.23, 293.66, 261.63, 233.08]
    }
  };

  const control = document.getElementById('ambientPlayer');
  const toggle = document.getElementById('ambientToggle');
  const slider = document.getElementById('ambientVolume');
  const status = document.getElementById('ambientStatus');
  const selector = document.getElementById('ambientTrack');
  if (!control || !toggle || !slider || !status || !selector) return;

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
      return {
        enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : defaultPreferences.enabled,
        volume: Number.isFinite(saved?.volume) ? Math.min(1, Math.max(0, saved.volume)) : defaultPreferences.volume,
        track: tracks[saved?.track] ? saved.track : defaultPreferences.track
      };
    } catch { return { ...defaultPreferences }; }
  }

  let preferences = readPreferences();
  let audioContext = null, master = null, compressor = null, convolver = null, padFilter = null;
  let voices = [], chordTimer = 0, scoreTimer = 0, chordIndex = 0, scoreIndex = 0, playing = false;

  function savePreferences() {
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
  }

  function updateUI() {
    toggle.setAttribute('aria-pressed', String(preferences.enabled));
    toggle.setAttribute('aria-label', preferences.enabled ? 'Disattiva audio ambientale' : 'Attiva audio ambientale');
    slider.value = String(Math.round(preferences.volume * 100));
    selector.value = preferences.track;
    status.textContent = !preferences.enabled ? 'In pausa' : !playing ? 'Avvio al primo tocco' : preferences.volume === 0 ? 'Volume zero · audio attivo' : 'Riproduzione in corso';
    control.dataset.playing = String(playing && preferences.enabled);
  }

  function makeImpulse(ctx) {
    const length = Math.floor(ctx.sampleRate * 2.8);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4) * (channel ? 0.72 : 1);
    }
    return buffer;
  }

  function createGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio non supportato in questo browser.');
    audioContext = new AudioContextClass();
    master = audioContext.createGain();
    master.gain.value = 0;
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 16;
    compressor.ratio.value = 1.6;
    compressor.attack.value = 0.3;
    compressor.release.value = 1.2;
    master.connect(compressor);
    compressor.connect(audioContext.destination);

    convolver = audioContext.createConvolver();
    convolver.buffer = makeImpulse(audioContext);
    const wet = audioContext.createGain();
    wet.gain.value = 0.12;
    master.connect(convolver);
    convolver.connect(wet);
    wet.connect(compressor);

    padFilter = audioContext.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 760;
    padFilter.Q.value = 0.25;
    const padLevel = audioContext.createGain();
    padLevel.gain.value = 0.4;
    padFilter.connect(padLevel);
    padLevel.connect(master);

    for (let i = 0; i < 4; i++) {
      const base = audioContext.createOscillator();
      const harmonic = audioContext.createOscillator();
      const baseGain = audioContext.createGain();
      const harmonicGain = audioContext.createGain();
      base.type = 'sine';
      harmonic.type = 'sine';
      harmonic.detune.value = i % 2 ? 2 : -2;
      baseGain.gain.value = 0.17;
      harmonicGain.gain.value = 0.025;
      base.connect(baseGain);
      harmonic.connect(harmonicGain);
      baseGain.connect(padFilter);
      harmonicGain.connect(padFilter);
      base.start();
      harmonic.start();
      voices.push({ base, harmonic });
    }
    setChord(0);
  }

  function setChord(index) {
    if (!audioContext) return;
    const chord = tracks[preferences.track].chords[index % tracks[preferences.track].chords.length];
    const now = audioContext.currentTime;
    chordIndex = index % tracks[preferences.track].chords.length;
    chord.forEach((frequency, i) => {
      voices[i].base.frequency.setTargetAtTime(frequency, now, 8);
      voices[i].harmonic.frequency.setTargetAtTime(frequency * 1.5, now, 8);
    });
  }

  function scheduleBed() {
    clearInterval(chordTimer);
    clearTimeout(scoreTimer);
    chordTimer = setInterval(() => {
      if (preferences.enabled) setChord(chordIndex + 1);
    }, tracks[preferences.track].tempo * 2);

    const playNote = () => {
      if (!preferences.enabled || !audioContext) return;
      const notes = tracks[preferences.track].notes;
      const now = audioContext.currentTime;
      const frequency = notes[scoreIndex++ % notes.length];
      const tone = audioContext.createOscillator();
      const softHarmonic = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      const harmonicLevel = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      tone.type = 'triangle';
      tone.frequency.value = frequency;
      softHarmonic.type = 'sine';
      softHarmonic.frequency.value = frequency * 2;
      harmonicLevel.gain.value = 0.12;
      filter.type = 'lowpass';
      filter.frequency.value = 980;
      filter.Q.value = 0.2;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.05, now + 2.2);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 10.5);
      tone.connect(filter);
      softHarmonic.connect(harmonicLevel);
      harmonicLevel.connect(filter);
      filter.connect(envelope);
      envelope.connect(master);
      tone.start(now);
      softHarmonic.start(now);
      tone.stop(now + 10.6);
      softHarmonic.stop(now + 10.6);
      scoreTimer = setTimeout(playNote, tracks[preferences.track].tempo + 1800);
    };
    scoreTimer = setTimeout(playNote, 5000);
  }

  async function startAudio() {
    try {
      if (!audioContext) createGraph();
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (!preferences.enabled) return;
      playing = true;
      master.gain.cancelScheduledValues(audioContext.currentTime);
      master.gain.setTargetAtTime(preferences.volume * 0.38, audioContext.currentTime, 2.2);
      scheduleBed();
      updateUI();
    } catch (error) {
      playing = false;
      preferences.enabled = false;
      savePreferences();
      status.textContent = error.message || 'Audio non disponibile';
      updateUI();
    }
  }

  function pauseAudio() {
    preferences.enabled = false;
    savePreferences();
    if (audioContext && master) {
      master.gain.cancelScheduledValues(audioContext.currentTime);
      master.gain.setTargetAtTime(0, audioContext.currentTime, 0.45);
    }
    clearInterval(chordTimer);
    clearTimeout(scoreTimer);
    playing = false;
    updateUI();
  }

  toggle.addEventListener('click', () => {
    if (preferences.enabled) pauseAudio();
    else { preferences.enabled = true; savePreferences(); updateUI(); startAudio(); }
  });
  slider.addEventListener('input', () => {
    preferences.volume = Number(slider.value) / 100;
    savePreferences();
    if (preferences.enabled && playing && master) {
      master.gain.cancelScheduledValues(audioContext.currentTime);
      master.gain.setTargetAtTime(preferences.volume * 0.38, audioContext.currentTime, 0.4);
    }
  });
  selector.addEventListener('change', () => {
    preferences.track = tracks[selector.value] ? selector.value : defaultPreferences.track;
    scoreIndex = 0;
    savePreferences();
    setChord(0);
    if (playing) scheduleBed();
  });

  function startAfterGesture(event) {
    if (event.target.closest?.('#ambientPlayer')) return;
    document.removeEventListener('pointerdown', startAfterGesture);
    document.removeEventListener('keydown', startAfterGesture);
    if (preferences.enabled) startAudio();
  }
  document.addEventListener('pointerdown', startAfterGesture, { passive: true });
  document.addEventListener('keydown', startAfterGesture);
  updateUI();
})();
