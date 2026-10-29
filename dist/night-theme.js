'use strict';

(() => {
  const button = document.getElementById('nightThemeToggle');
  if (!button) return;

  const key = 'tefinanza-theme-night-v1';
  let enabled = false;
  try { enabled = localStorage.getItem(key) === 'true'; } catch {}

  function render() {
    document.body.classList.toggle('theme-night', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Disattiva tema notte' : 'Attiva tema notte');
    button.title = enabled ? 'Disattiva tema notte' : 'Attiva tema notte';
    button.querySelector('[aria-hidden="true"]').textContent = enabled ? '☀' : '☾';
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(key, String(enabled)); } catch {}
    render();
  });

  render();
})();
