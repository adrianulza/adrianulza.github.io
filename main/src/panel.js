// The reading panel: About, each work, the publication list and the books.
// On phones it becomes a bottom sheet that can be dragged down to close.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ext = href => (href.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"');
const linksHtml = (links, i) => `<p class="links r" style="--i:${i}">${links.map(l => `<a href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a>`).join('')}</p>`;
const ARROW_L = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const ARROW_R = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

export class Panel {
  constructor(el, { person, memories, publications, books, root = '' }, { onNavigate, onClose }) {
    Object.assign(this, { el, person, memories, publications, books, root, onNavigate, onClose });
    this.order = [{ kind: 'core' }, ...memories.map(m => ({ kind: 'memory', id: m.id }))];
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-go]');
      if (b) { const k = +b.dataset.go; this.onNavigate(this.order[k]); }
      if (e.target.closest('[data-close]')) this.onClose();
    });
    this.sheetGestures();
  }

  indexOf(state) { return state.kind === 'core' ? 0 : 1 + this.memories.findIndex(m => m.id === state.id); }

  rail(current) {
    const n = this.order.length, prev = (current - 1 + n) % n, next = (current + 1) % n;
    const nums = this.order.map((_, i) => `<li><button type="button" data-go="${i}"${i === current ? ' aria-current="true"' : ''} aria-label="${i === 0 ? 'About' : esc(this.memories[i - 1].title)}"><span>${String(i).padStart(2, '0')}</span></button></li>`).join('');
    return `<nav class="rail r" style="--i:9" aria-label="Contents">
      <button type="button" class="close" data-close>${CLOSE}<span>Network</span></button>
      <button type="button" class="step" data-go="${prev}" aria-label="Previous">${ARROW_L}</button>
      <ol>${nums}</ol>
      <button type="button" class="step" data-go="${next}" aria-label="Next">${ARROW_R}</button>
    </nav>`;
  }

  showCore() {
    const p = this.person;
    this.mount(`
      <h2 class="r" style="--i:1" tabindex="-1">${esc(p.name)}</h2>
      <p class="formal r" style="--i:2">${esc(p.formal)}</p>
      <ul class="roles r" style="--i:3">${p.roles.map(r => `<li><strong>${esc(r.title)}</strong><span>${esc(r.org)}</span></li>`).join('')}</ul>
      <div class="interests r" style="--i:4"><p class="sub">Interests</p><ul>${p.interests.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
      ${linksHtml(p.links, 5)}
      ${this.rail(0)}`);
  }

  showMemory(id) {
    const i = this.memories.findIndex(m => m.id === id), m = this.memories[i];
    let body;
    if (m.id === 'publications') body = this.papersHtml();
    else if (m.id === 'books') body = this.booksHtml();
    else body = `
      ${m.media ? `<figure class="shot r" style="--i:3"><img src="${esc(this.root + m.media.src)}" alt="${esc(m.media.alt)}" loading="lazy" decoding="async"></figure>` : ''}
      <dl class="facts r" style="--i:4">${m.facts.map(f => `<div><dt>${esc(f.value)}</dt><dd>${esc(f.label)}</dd></div>`).join('')}</dl>
      ${linksHtml(m.links, 5)}`;
    this.mount(`
      <p class="eyebrow r" style="--i:0">${esc(m.kind)} · ${esc(m.year)}</p>
      <h2 class="r" style="--i:1" tabindex="-1">${esc(m.title)}</h2>
      <p class="pitch r" style="--i:2">${esc(m.pitch)}</p>
      ${body}
      ${this.rail(i + 1)}`);
  }

  papersHtml() {
    const years = [...new Set(this.publications.map(p => p.year))];
    return `<div class="papers r" style="--i:3">${years.map(y => `<section class="year"><h3>${y}</h3><ol>${this.publications.filter(p => p.year === y).map(p => `
      <li><a href="${esc(p.href)}" target="_blank" rel="noopener"><span class="pt">${esc(p.title)}</span><span class="pv">${esc(p.venue)}</span><span class="pa">${esc(p.authors)}</span></a></li>`).join('')}</ol></section>`).join('')}</div>`;
  }

  booksHtml() {
    return `<div class="books r" style="--i:3">${this.books.map((b, i) => `
      <article class="book">
        <a class="cover c${i % 2}" href="${esc(b.href)}" target="_blank" rel="noopener" aria-label="${esc(b.title)} at ${esc(b.publisher)}">
          <span class="ct">${esc(b.title)}</span><span class="ca">Adrian Ulza</span><span class="cp">${esc(b.publisher)}</span>
        </a>
        <div class="bt"><h3>${esc(b.title)}</h3>
          <p class="bm">${[b.publisher, b.year, b.pages && `${b.pages} pages`, b.isbn && `ISBN ${b.isbn}`].filter(Boolean).map(esc).join(' / ')}</p>
          <p class="bb">${esc(b.blurb)}</p>
          <p class="links"><a href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.publisher)}</a></p>
        </div>
      </article>`).join('')}</div>`;
  }

  mount(html) {
    clearTimeout(this.hideT);
    const el = this.el;
    el.classList.remove('in', 'out');
    el.style.removeProperty('--drag');
    el.innerHTML = html;
    el.hidden = false;
    el.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  }

  focus() { this.el.querySelector('h2')?.focus({ preventScroll: true }); }

  hide() {
    const el = this.el;
    if (el.hidden) return;
    el.classList.remove('in'); el.classList.add('out');
    this.hideT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); el.innerHTML = ''; }, 220);
  }

  get open() { return !this.el.hidden; }

  // On narrow screens, drag the sheet down to dismiss it.
  sheetGestures() {
    const el = this.el;
    let y0 = 0, t0 = 0, dragging = false, dy = 0;
    el.addEventListener('pointerdown', e => {
      if (innerWidth > 700 || e.pointerType === 'mouse' || el.scrollTop > 0 || e.target.closest('a,button')) return;
      dragging = true; y0 = e.clientY; t0 = performance.now(); dy = 0;
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - y0);
      if (dy > 4) { el.classList.add('dragging'); el.style.setProperty('--drag', `${dy}px`); }
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; el.classList.remove('dragging');
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > el.offsetHeight / 3 || v > 0.5) this.onClose();
      else el.style.setProperty('--drag', '0px');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
