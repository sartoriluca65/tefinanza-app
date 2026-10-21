'use strict';

(() => {
  const preferenceKey = 'tefinanza-ambient-audio-v1';
  const migrationKey = `${preferenceKey}-v32`;
  const youtubePlaylist = 'PLf5748RjOaOikKzt-WOzSoMYIwf6HfcpJ';
  const youtubeVideo = 'qbSGk7Pd9os';
  const defaultPreferences = { enabled: true, volume: 0.10, track: 'youtube_video' };
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
    },
    youtube: { label: 'Playlist YouTube · Relax soft' },
    youtube_video: { label: 'Mental Overload Reset · Theta Focus', title: 'Mental Overload Reset | Calm Focus Music to Reduce Work Anxiety | Theta Monaural Beats' }
  };

  const control = document.getElementById('ambientPlayer');
  const toggle = document.getElementById('ambientToggle');
  const toggleIcon = toggle?.querySelector('[aria-hidden="true"]');
  const slider = document.getElementById('ambientVolume');
  const status = document.getElementById('ambientStatus');
  const selector = document.getElementById('ambientTrack');
  const youtubePanel = document.getElementById('ambientYoutubePanel');
  const youtubeFrame = document.getElementById('ambientYoutubeFrame');
  const youtubeClose = document.getElementById('ambientYoutubeClose');
  if (!control || !toggle || !slider || !status || !selector || !youtubePanel || !youtubeFrame) return;

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
      const firstV30Visit = localStorage.getItem(migrationKey) !== 'done';
      const track = firstV30Visit ? defaultPreferences.track : (tracks[saved?.track] ? saved.track : defaultPreferences.track);
      localStorage.setItem(migrationKey, 'done');
      return {
        enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : defaultPreferences.enabled,
        volume: Number.isFinite(saved?.volume) ? Math.min(1, Math.max(0, saved.volume)) : defaultPreferences.volume,
        track
      };
    } catch { return { ...defaultPreferences }; }
  }

  let preferences = readPreferences();
  let audioContext = null, master = null, compressor = null, convolver = null, padFilter = null;
  let voices = [], chordTimer = 0, scoreTimer = 0, chordIndex = 0, scoreIndex = 0, playing = false;
  let playbackRequest = 0, playbackPending = false;
  let youtubeApiPromise = null;

  function savePreferences() {
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
  }

  function updateUI() {
    const active = playing || playbackPending;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', active ? 'Metti in pausa la musica di sottofondo' : 'Riprendi la musica di sottofondo');
    toggle.title = active ? 'Pausa' : 'Riproduci';
    if (toggleIcon) toggleIcon.textContent = active ? 'Ⅱ' : '▶';
    slider.value = String(Math.round(preferences.volume * 100));
    selector.value = preferences.track;
    status.textContent = playbackPending ? 'Avvio in corso · premi per fermare' : playing ? (preferences.track === 'youtube' ? 'Playlist YouTube in riproduzione' : preferences.track === 'youtube_video' ? 'Video e musica in riproduzione' : preferences.volume === 0 ? 'Volume zero · audio attivo' : 'Riproduzione in corso') : 'In pausa';
    control.dataset.playing = String(active);
    youtubePanel.hidden = !['youtube', 'youtube_video'].includes(preferences.track);
    const youtubeTitle = document.getElementById('ambientYoutubeTitle');
    if (youtubeTitle) youtubeTitle.textContent = tracks[preferences.track]?.title || tracks[preferences.track]?.label || 'Playlist audio';
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
    if (!audioContext || !tracks[preferences.track].chords) return;
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
      if (playing) setChord(chordIndex + 1);
    }, tracks[preferences.track].tempo * 2);

    const playNote = () => {
      if (!playing || !audioContext) return;
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

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => {
        youtubeApiPromise = null;
        reject(new Error('YouTube non disponibile. Riprova tra poco.'));
      }, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        if (typeof previousReady === 'function') { try { previousReady(); } catch {} }
        resolve(window.YT);
      };
      if (!document.querySelector('script[data-tefinanza-youtube-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.tefinanzaYoutubeApi = 'true';
        script.onerror = () => { clearTimeout(timeout); youtubeApiPromise = null; reject(new Error('Impossibile caricare YouTube.')); };
        document.head.appendChild(script);
      }
    });
    return youtubeApiPromise;
  }

  function destroyYouTubePlayer() {
    if (youtubePlayer) {
      try { youtubePlayer.stopVideo(); youtubePlayer.destroy(); } catch {}
      youtubePlayer = null;
      youtubePlayerTrack = null;
    }
    youtubeFrame.replaceChildren();
    if (preferences.track === 'youtube_video') {
      const poster = document.createElement('img');
      poster.className = 'ambient-youtube-poster';
      poster.src = `https://i.ytimg.com/vi/${youtubeVideo}/hqdefault.jpg`;
      poster.alt = 'Anteprima del video Mental Overload Reset';
      youtubeFrame.appendChild(poster);
    } else {
      const poster = document.createElement('div');
      poster.className = 'ambient-youtube-playlist-poster';
      poster.textContent = 'Playlist YouTube · Relax soft';
      youtubeFrame.appendChild(poster);
    }
  }

  let youtubePlayer = null, youtubePlayerTrack = null;
  async function startYouTube(request) {
    const api = await loadYouTubeApi();
    if (request !== playbackRequest || !preferences.enabled) return;
    youtubePanel.hidden = false;
    if (youtubePlayer && youtubePlayerTrack === preferences.track) {
      youtubePlayer.setVolume(Math.round(preferences.volume * 100));
      youtubePlayer.playVideo();
      return;
    }
    if (youtubePlayer) destroyYouTubePlayer();
    const selectedTrack = preferences.track;
    const isPlaylist = selectedTrack === 'youtube';
    const videoId = isPlaylist ? '' : youtubeVideo;
    const playerVars = isPlaylist
      ? { listType: 'playlist', list: youtubePlaylist, playlist: youtubePlaylist, loop: 1, autoplay: 1, controls: 1, playsinline: 1, origin: location.origin }
      : { loop: 1, playlist: videoId, autoplay: 1, controls: 1, playsinline: 1, origin: location.origin };
    youtubeFrame.replaceChildren();
    const placeholder = document.createElement('div');
    placeholder.id = 'ambientYoutubePlayer';
    youtubeFrame.appendChild(placeholder);
    youtubePlayerTrack = selectedTrack;
    youtubePlayer = new api.Player(placeholder, {
      width: '280', height: '200', ...(isPlaylist ? {} : { videoId }), playerVars,
      events: {
        onReady: (event) => {
          if (youtubePlayer !== event.target || !preferences.enabled) { event.target.pauseVideo(); return; }
          event.target.getIframe().title = isPlaylist ? tracks.youtube.label : tracks.youtube_video.title;
          event.target.setVolume(Math.round(preferences.volume * 100));
          event.target.playVideo();
        },
        onStateChange: (event) => {
          if (youtubePlayer !== event.target) { if (event.data === api.PlayerState.PLAYING) event.target.pauseVideo(); return; }
          playing = event.data === api.PlayerState.PLAYING;
          if (playing) playbackPending = false;
          updateUI();
        },
        onError: (event) => {
          if (youtubePlayer !== event.target) return;
          playing = false;
          playbackPending = false;
          status.textContent = 'Playlist YouTube non disponibile';
          updateUI();
        }
      }
    });
  }

  async function startAudio() {
    const request = ++playbackRequest;
    playing = false;
    playbackPending = true;
    updateUI();
    try {
      if (preferences.track === 'youtube' || preferences.track === 'youtube_video') {
        if (audioContext?.state === 'running') {
          master.gain.cancelScheduledValues(audioContext.currentTime);
          master.gain.setValueAtTime(0, audioContext.currentTime);
          await audioContext.suspend();
        }
        clearInterval(chordTimer);
        clearTimeout(scoreTimer);
        await startYouTube(request);
        if (request !== playbackRequest || !preferences.enabled) return;
      } else {
        destroyYouTubePlayer();
        youtubePanel.hidden = true;
        if (!audioContext) createGraph();
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (request !== playbackRequest || !preferences.enabled) return;
        playing = true;
        playbackPending = false;
        master.gain.cancelScheduledValues(audioContext.currentTime);
        master.gain.setTargetAtTime(preferences.volume * 0.38, audioContext.currentTime, 2.2);
        scheduleBed();
      }
      updateUI();
    } catch (error) {
      if (request !== playbackRequest) return;
      playing = false;
      playbackPending = false;
      preferences.enabled = false;
      savePreferences();
      status.textContent = error.message || 'Audio non disponibile';
      updateUI();
    }
  }

  function pauseAudio() {
    ++playbackRequest;
    preferences.enabled = false;
    playbackPending = false;
    savePreferences();
    if (youtubePlayer) { try { youtubePlayer.pauseVideo(); } catch {} }
    clearInterval(chordTimer);
    clearTimeout(scoreTimer);
    if (audioContext && master) {
      master.gain.cancelScheduledValues(audioContext.currentTime);
      master.gain.setValueAtTime(0, audioContext.currentTime);
      audioContext.suspend().catch(() => {});
    }
    playing = false;
    updateUI();
  }

  toggle.addEventListener('click', () => {
    if (playing || playbackPending) pauseAudio();
    else { preferences.enabled = true; savePreferences(); startAudio(); }
  });
  slider.addEventListener('input', () => {
    preferences.volume = Number(slider.value) / 100;
    savePreferences();
    if (playing && (preferences.track === 'youtube' || preferences.track === 'youtube_video') && youtubePlayer) youtubePlayer.setVolume(Math.round(preferences.volume * 100));
    else if (playing && master) {
      master.gain.cancelScheduledValues(audioContext.currentTime);
      master.gain.setTargetAtTime(preferences.volume * 0.38, audioContext.currentTime, 0.4);
    }
    updateUI();
  });
  selector.addEventListener('change', () => {
    preferences.track = tracks[selector.value] ? selector.value : defaultPreferences.track;
    scoreIndex = 0;
    savePreferences();
    setChord(0);
    if (playing || playbackPending) startAudio();
    else { destroyYouTubePlayer(); updateUI(); }
  });
  youtubeClose?.addEventListener('click', pauseAudio);

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
