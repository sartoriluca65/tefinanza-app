'use strict';

(() => {
  const preferenceKey = 'tefinanza-ambient-audio-v1';
  const playlistUrl = 'https://www.youtube.com/playlist?list=PLf5748RjOaOikKzt-WOzSoMYIwf6HfcpJ';
  const preferences = { enabled: false, volume: 0.10, source: playlistUrl };
  const control = document.getElementById('ambientPlayer');
  const toggle = document.getElementById('ambientToggle');
  const toggleIcon = toggle?.querySelector('[aria-hidden="true"]');
  const slider = document.getElementById('ambientVolume');
  const status = document.getElementById('ambientStatus');
  const sourceInput = document.getElementById('ambientSource');
  const sourceApply = document.getElementById('ambientSourceApply');
  const youtubePanel = document.getElementById('ambientYoutubePanel');
  const youtubeFrame = document.getElementById('ambientYoutubeFrame');
  const youtubeClose = document.getElementById('ambientYoutubeClose');
  if (!control || !toggle || !slider || !status || !sourceInput || !sourceApply || !youtubePanel || !youtubeFrame) return;

  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    if (typeof saved?.enabled === 'boolean') preferences.enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) preferences.volume = Math.min(1, Math.max(0, saved.volume));
    if (typeof saved?.source === 'string') preferences.source = saved.source;
  } catch {}

  let player = null;
  let apiPromise = null;
  let playing = false;
  let playbackPending = false;
  let playbackRequest = 0;

  function savePreferences() {
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
  }

  function parseYouTubeSource(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error('Incolla un link YouTube valido.'); }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) throw new Error('Il link deve provenire da YouTube.');
    const list = url.searchParams.get('list');
    let video = url.searchParams.get('v');
    if (!video && host === 'youtu.be') video = url.pathname.split('/').filter(Boolean)[0];
    if (!video) video = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || '';
    if (list && /^[\w-]+$/.test(list)) return { kind: 'playlist', id: list };
    if (video && /^[\w-]{11}$/.test(video)) return { kind: 'video', id: video };
    throw new Error('Il link non contiene un video o una playlist utilizzabile.');
  }

  function updateUI() {
    const active = playing || playbackPending;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', active ? 'Metti in pausa la musica di sottofondo' : 'Riprendi la musica di sottofondo');
    toggle.title = active ? 'Pausa' : 'Riproduci';
    if (toggleIcon) toggleIcon.textContent = active ? 'Ⅱ' : '▶';
    slider.value = String(Math.round(preferences.volume * 100));
    if (document.activeElement !== sourceInput) sourceInput.value = preferences.source;
    control.dataset.playing = String(active);
    if (playbackPending) status.textContent = 'Avvio YouTube… · premi per fermare';
    else if (playing) status.textContent = 'Riproduzione YouTube in corso · ripetizione attiva';
    else if (status.dataset.error) status.textContent = status.dataset.error;
    else status.textContent = 'Pronto · premi musica per avviare';
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => { apiPromise = null; reject(new Error('YouTube non disponibile. Riprova tra poco.')); }, 15000);
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
        script.onerror = () => { clearTimeout(timeout); apiPromise = null; reject(new Error('Impossibile caricare YouTube.')); };
        document.head.appendChild(script);
      }
    });
    return apiPromise;
  }

  function stopPlayer() {
    if (player) { try { player.stopVideo(); player.destroy(); } catch {} }
    player = null;
    youtubeFrame.replaceChildren();
  }

  async function startYouTube(request) {
    const source = parseYouTubeSource(preferences.source);
    youtubePanel.hidden = false;
    youtubePanel.dataset.userOpened = 'true';
    const api = await loadYouTubeApi();
    if (request !== playbackRequest || !preferences.enabled) return;
    stopPlayer();
    const placeholder = document.createElement('div');
    placeholder.id = 'ambientYoutubePlayer';
    youtubeFrame.appendChild(placeholder);
    const title = document.getElementById('ambientYoutubeTitle');
    if (title) title.textContent = source.kind === 'playlist' ? 'Playlist YouTube scelta' : 'Video YouTube scelto';
    const playerVars = source.kind === 'playlist'
      ? { listType: 'playlist', list: source.id, loop: 1, autoplay: 1, controls: 1, playsinline: 1, origin: location.origin }
      : { videoId: source.id, playlist: source.id, loop: 1, autoplay: 1, controls: 1, playsinline: 1, origin: location.origin };
    player = new api.Player(placeholder, {
      width: '280', height: '158', ...(source.kind === 'video' ? { videoId: source.id } : {}), playerVars,
      events: {
        onReady: (event) => {
          if (player !== event.target || request !== playbackRequest || !preferences.enabled) { event.target.pauseVideo(); return; }
          event.target.setVolume(Math.round(preferences.volume * 100));
          event.target.playVideo();
        },
        onStateChange: (event) => {
          if (player !== event.target) return;
          playing = event.data === api.PlayerState.PLAYING;
          if (playing) { playbackPending = false; status.dataset.error = ''; }
          updateUI();
        },
        onError: () => {
          playing = false;
          playbackPending = false;
          status.dataset.error = 'Contenuto YouTube non disponibile o non incorporabile.';
          updateUI();
        }
      }
    });
  }

  async function play() {
    const request = ++playbackRequest;
    preferences.enabled = true;
    playbackPending = true;
    status.dataset.error = '';
    savePreferences();
    updateUI();
    try { await startYouTube(request); }
    catch (error) {
      if (request !== playbackRequest) return;
      preferences.enabled = false;
      playbackPending = false;
      playing = false;
      status.dataset.error = error.message || 'Audio non disponibile.';
      savePreferences();
      updateUI();
    }
  }

  function pause() {
    ++playbackRequest;
    preferences.enabled = false;
    playbackPending = false;
    playing = false;
    savePreferences();
    if (player) { try { player.pauseVideo(); } catch {} }
    youtubePanel.hidden = true;
    updateUI();
  }

  toggle.addEventListener('click', () => playing || playbackPending ? pause() : play());
  slider.addEventListener('input', () => {
    preferences.volume = Number(slider.value) / 100;
    savePreferences();
    if (player && playing) player.setVolume(Math.round(preferences.volume * 100));
    updateUI();
  });
  sourceApply.addEventListener('click', () => {
    try {
      parseYouTubeSource(sourceInput.value);
      preferences.source = sourceInput.value.trim();
      status.dataset.error = '';
      savePreferences();
      if (playing || playbackPending) play();
      else { stopPlayer(); updateUI(); }
    } catch (error) {
      status.dataset.error = error.message;
      updateUI();
      sourceInput.focus();
    }
  });
  sourceInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); sourceApply.click(); } });
  youtubeClose?.addEventListener('click', pause);

    updateUI();
})();
