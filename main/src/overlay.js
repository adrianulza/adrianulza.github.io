// Labels that follow the 3D landmarks, drawn as callouts on an engineering
// drawing: a hairline leaves the orb at 45°, turns into a horizontal shelf,
// and the title sits on the shelf with the kind of work beneath it. The same
// 45°-then-straight trace as the network's circuit lines. They are real buttons,
// so the page works by keyboard and screen reader as well as by pointer.

const LEG = 26, LEG_PHONE = 14;   // length of the 45° leg, in CSS px
const S2 = Math.SQRT1_2;

export class Overlay {
  constructor(root, person, memories, { onHover, onSelect }) {
    this.root = root;
    this.items = [];
    const make = (cls, n, title, kind, label) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `entity mem-btn ${cls}`;
      b.setAttribute('aria-label', label);
      b.innerHTML = `<i class="leg" aria-hidden="true"></i><span class="callout"><span class="row"><span class="n">${n}</span><span class="t">${title}</span></span><span class="k">${kind}</span></span>`;
      return b;
    };
    this.items.push({ el: make('core-btn', '00', person.name, 'Where every thought begins', `About ${person.name}`), id: 'core', kind: 'core' });
    memories.forEach((m, i) => {
      this.items.push({ el: make('', String(i + 1).padStart(2, '0'), m.title, `${m.kind} · ${m.year}`, `${m.title}, ${m.kind}, ${m.year}`), id: m.id, kind: 'memory', index: i });
    });
    root.classList.add('intro');
    for (const it of this.items) {
      it.el.hidden = true;   // positioned (and revealed) by the first update
      it.leg = it.el.querySelector('.leg');
      it.call = it.el.querySelector('.callout');
      root.appendChild(it.el);
      const hi = () => onHover(it.kind === 'memory' ? it.index : -1, it);
      it.el.addEventListener('pointerenter', hi);
      it.el.addEventListener('focus', hi);
      it.el.addEventListener('pointerleave', () => onHover(null, it));
      it.el.addEventListener('blur', () => onHover(null, it));
      it.el.addEventListener('click', () => onSelect(it.kind === 'core' ? { kind: 'core' } : { kind: 'memory', id: it.id }));
    }
  }

  // Callout sizes are measured once (and again after a resize, a mode change or
  // the web font arriving), never in the frame loop.
  measure() {
    for (const it of this.items) {
      const el = it.el, wasHidden = el.hidden;
      el.hidden = false; el.style.visibility = 'hidden';
      it.bw = it.call.offsetWidth; it.bh = it.call.offsetHeight;
      it.h1 = it.call.querySelector('.row').offsetHeight;   // height above the shelf
      el.style.visibility = ''; el.hidden = wasHidden;
    }
    this.measured = true;
  }

  // marks: screen state from the Hud. quiet hides labels (away or flying).
  update(marks, { quiet, selectedId, hover, w, h, panelRect, intro, leadRect, narrow }) {
    if (!this.measured) this.measure();
    this.root.classList.toggle('quiet', quiet);
    this.root.classList.toggle('intro', intro);
    this.root.classList.toggle('narrow', narrow);

    // Areas no callout may enter: the left column and the screen edges.
    const pad = 16, blocked = [];
    if (leadRect) blocked.push({ l: leadRect.left - pad, t: leadRect.top - pad, r: leadRect.right + pad, b: leadRect.bottom + pad });
    const hits = (q, list) => list.some(o => q.l < o.r && q.r > o.l && q.t < o.b && q.b > o.t);
    const top = 24, bottom = 24;
    // The core's label (the name) may come closer to the edge, so it fits on a phone.
    const inside = (q, e = pad) => q.l >= e && q.r <= w - e && q.t >= top && q.b <= h - bottom;
    const placed = [];
    // Every visible orb is an obstacle too, so a callout never covers another work.
    const orbs = marks.map(m => (m.visible && m.dist <= 15 ? { l: m.x - m.r, r: m.x + m.r, t: m.y - m.r, b: m.y + m.r } : null));

    // The core first, then works from nearest to farthest.
    const order = this.items.map((_, i) => i).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : marks[a].dist - marks[b].dist));
    for (const i of order) {
      const it = this.items[i], m = marks[i], el = it.el;
      const r = Math.max(8, m.r);
      const size = Math.max(40, Math.min(160, r * 2 + 8));
      const off = !m.visible || m.x < -200 || m.x > w + 200 || m.y < -200 || m.y > h + 200 || m.dist > 15;
      const covered = panelRect && m.x > panelRect.left && m.x < panelRect.right && m.y > panelRect.top && m.y < panelRect.bottom;
      if (off || covered) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.setProperty('--fade', Math.max(0, Math.min(1, (15 - m.dist) / 5)).toFixed(3));
      el.classList.toggle('chosen', selectedId === it.id);
      el.classList.toggle('hot', it.kind === 'memory' && hover === it.index);
      el.style.width = el.style.height = `${size}px`;
      el.style.transform = `translate3d(${m.x - size / 2}px, ${m.y - size / 2}px, 0)`;

      // Try the four diagonals. A callout keeps the side it already has while
      // that side stays free (hysteresis), so it never jumps back and forth as
      // the view sways; the outward side is preferred for a new placement.
      const L = narrow ? LEG_PHONE : LEG, outward = m.x > w / 2 ? 1 : -1;
      const base = [[outward, -1], [outward, 1], [-outward, -1], [-outward, 1]];
      const tries = it.dir ? [it.dir, ...base.filter(d => d[0] !== it.dir[0] || d[1] !== it.dir[1])] : base;
      const others = orbs.filter((o, j) => o && j !== i);
      const geom = (dx, dy) => {
        const sx = dx * r * S2, sy = dy * r * S2, ex = sx + dx * L * S2, ey = sy + dy * L * S2;
        const left = dx > 0 ? ex : ex - it.bw, topY = ey - it.h1;
        return { dx, dy, sx, sy, left, topY, q: { l: m.x + left, r: m.x + left + it.bw, t: m.y + topY, b: m.y + topY + it.bh } };
      };
      // The core carries the name, so it may sit over an orb; works must keep clear.
      const free = g => inside(g.q, it.kind === 'core' ? 6 : pad) && !hits(g.q, blocked) && !hits(g.q, placed) && (it.kind === 'core' || !hits(g.q, others));
      let pick = null;
      for (const [dx, dy] of tries) { const g = geom(dx, dy); if (free(g)) { pick = g; break; } }
      // Debounce showing and hiding: a label hides only after 12 blocked frames
      // in a row, and returns only after 8 free frames in a row.
      if (pick) { it.miss = 0; it.hit = (it.hit || 0) + 1; } else { it.hit = 0; it.miss = (it.miss || 0) + 1; }
      if (!pick && it.dir && it.miss < 12) pick = geom(it.dir[0], it.dir[1]);
      const showing = !el.classList.contains('nolabel');
      const show = pick && (showing || it.hit >= 8);
      el.classList.toggle('nolabel', !show);
      if (!show) continue;
      it.dir = [pick.dx, pick.dy];
      const c = size / 2;
      it.leg.style.width = `${L}px`;
      it.leg.style.transform = `translate(${c + pick.sx}px, ${c + pick.sy}px) rotate(${pick.dx > 0 ? (pick.dy < 0 ? -45 : 45) : (pick.dy < 0 ? -135 : 135)}deg)`;
      it.call.style.transform = `translate(${c + pick.left}px, ${c + pick.topY}px)`;
      el.dataset.dir = pick.dx > 0 ? 'right' : 'left';
      placed.push({ l: pick.q.l - 8, t: pick.q.t - 6, r: pick.q.r + 8, b: pick.q.b + 6 });
    }
  }
}
