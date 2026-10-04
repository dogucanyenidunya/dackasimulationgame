// In-page yes/no dialog (browser confirm() is blocked on some hosts, e.g. shared links).
export function askConfirm(message: string, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay confirm-overlay';
    wrap.innerHTML = `<div class="card modal-card" role="dialog" aria-modal="true"><p class="modal-body"></p><div class="confirm-row"><button type="button" class="secondary" data-no></button><button type="button" class="primary" data-yes></button></div></div>`;
    wrap.querySelector('p')!.textContent = message;
    (wrap.querySelector('[data-yes]') as HTMLElement).textContent = yes;
    (wrap.querySelector('[data-no]') as HTMLElement).textContent = no;
    const done = (v: boolean) => { wrap.remove(); window.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    wrap.querySelector('[data-yes]')!.addEventListener('click', () => done(true));
    wrap.querySelector('[data-no]')!.addEventListener('click', () => done(false));
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    (wrap.querySelector('[data-yes]') as HTMLElement).focus();
  });
}
