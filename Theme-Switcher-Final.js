
// TeFinanza Theme Switcher - Studio (Quiet) <-> Casa (Paper) - v106 - non tocca logica core
(function(){
  const KEY='tf_theme';
  function applyTheme(name){
    document.body.classList.toggle('theme-paper', name==='paper');
    document.body.classList.toggle('theme-quiet', name!=='paper');
    const btn = document.getElementById('themeToggleBtn');
    if(btn){
      btn.textContent = name==='paper' ? '🏠 Casa' : '🏦 Studio';
      btn.setAttribute('data-theme', name);
      btn.title = name==='paper' ? 'Passa a Studio' : 'Passa a Casa';
    }
  }
  function createToggle(){
    if(document.getElementById('themeToggleBtn')) return;
    const topbarActions = document.querySelector('.topbar-actions') || document.querySelector('.app-topbar');
    if(!topbarActions) return;
    const btn = document.createElement('button');
    btn.id='themeToggleBtn';
    btn.className='top-icon';
    btn.type='button';
    btn.style.minWidth='92px';
    btn.style.border='1px solid var(--border, #EDE9E3)';
    btn.style.borderRadius='999px';
    btn.style.padding='6px 12px';
    btn.style.fontSize='13px';
    btn.style.fontWeight='600';
    btn.onclick=()=>{
      const next = document.body.classList.contains('theme-paper') ? 'quiet' : 'paper';
      localStorage.setItem(KEY, next);
      applyTheme(next);
    };
    // Insert as first in topbar-actions
    topbarActions.insertBefore(btn, topbarActions.firstChild);
    applyTheme(localStorage.getItem(KEY) || 'quiet');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', createToggle);
  else createToggle();
  // Apply early to avoid flash
  const saved = localStorage.getItem(KEY);
  if(saved) document.addEventListener('DOMContentLoaded', ()=>applyTheme(saved));
})();
