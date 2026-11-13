/*
 * Label Manager loop harness — injected into the page by run-loop.ps1.
 * Implements docs/loop-engineering.md §3 (invariants) and §4 (operations).
 * Never point this at the production server: it creates and deletes data.
 */
(function () {
  if (window.__loop) return;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- instrumentation ---------- */
  const rawFetch = window.fetch.bind(window);
  let inflight = 0;
  const responses = [];          // {method,url,status}
  const jsErrors = [];
  const toasts = [];              // {type,msg}
  window.fetch = async (url, opts = {}) => {
    inflight++;
    try {
      const res = await rawFetch(url, opts);
      responses.push({ method: (opts.method || 'GET'), url: String(url), status: res.status });
      return res;
    } finally { inflight--; }
  };
  window.addEventListener('error', e => jsErrors.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', e => jsErrors.push('unhandledrejection: ' + String(e.reason && e.reason.message || e.reason)));
  new MutationObserver(() => {
    const t = $('#toast');
    if (!t.classList.contains('hidden') && t.textContent) {
      const type = t.classList.contains('error') ? 'error' : t.classList.contains('success') ? 'success' : 'info';
      const last = toasts[toasts.length - 1];
      if (!last || last.msg !== t.textContent || last.type !== type) toasts.push({ type, msg: t.textContent });
    }
  }).observe($('#toast'), { attributes: true, childList: true, characterData: true, subtree: true });

  /* ---------- PRNG ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  /* ---------- helpers ---------- */
  async function waitFor(cond, timeout = 4000, label = 'condition') {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { if (cond()) return true; } catch (e) {}
      await sleep(20);
    }
    throw new Error('timeout waiting for ' + label);
  }
  const modalOpen = sel => { const m = $(sel); return !m.classList.contains('hidden') && !m.classList.contains('closing'); };
  const anyModalVisible = () => $$('.modal').some(m => !m.classList.contains('hidden'));

  async function settle() {
    let quiet = 0;
    const t0 = performance.now();
    while (quiet < 4) {
      if (performance.now() - t0 > 8000) throw new Error('page never settled');
      const busy = document.body.classList.contains('busy') || inflight > 0 ||
        document.body.classList.contains('is-dragging') || $$('.modal.closing').length > 0;
      quiet = busy ? 0 : quiet + 1;
      await sleep(40);
    }
  }
  async function api(path) { const r = await rawFetch(path); return r.json(); }
  function setInput(el, v) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const visibleShelves = () => $$('#shelves > .shelf');
  const cardsIn = sec => [...sec.querySelectorAll('.rack > .item-card')];
  async function confirmAsk(ok = true) {
    await waitFor(() => modalOpen('#ask'), 3000, '#ask open');
    (ok ? $('#ask-ok') : $('#ask-cancel')).click();
    await settle();
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function diffDays(a, b) { return Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000); }

  /* pointer helpers for real drag code paths */
  function ptr(type, target, x, y) {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse',
      isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
    }));
  }
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  async function dragPath(startEl, sx, sy, tx, ty) {
    ptr('pointerdown', startEl, sx, sy);
    await frame();
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      ptr('pointermove', window, sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps);
      await frame();
    }
    // hold still: the placeholder slot must converge and then stay put (no jitter)
    const sig = () => {
      const s = $('.slot');
      if (!s || !s.parentNode) return 'none';
      return (s.parentNode.dataset.shelfId || 'shelves') + ':' +
        [...s.parentNode.children].map(c => c === s ? 'SLOT' : (c.dataset.id || c.dataset.shelfId || '')).join(',');
    };
    const sigs = [];
    for (let i = 0; i < 8; i++) { ptr('pointermove', window, tx, ty); await frame(); sigs.push(sig()); }
    const tail = sigs.slice(-4);
    const jitter = tail.some(s => s !== tail[0]);
    const slot = $('.slot');
    const parent = slot && slot.parentNode;
    let order = null, shelfId = null;
    if (parent) {
      shelfId = parent.dataset.shelfId ? +parent.dataset.shelfId : null;
      const lifted = $('#drag-layer > .lifted');
      const liftedId = lifted ? +(lifted.dataset.id || lifted.dataset.shelfId) : null;
      order = [...parent.children]
        .filter(c => c === slot || c.classList.contains('item-card') || c.classList.contains('shelf'))
        .map(c => c === slot ? liftedId : +(c.dataset.id || c.dataset.shelfId));
    }
    ptr('pointerup', window, tx, ty);
    await sleep(380);        // settle animation 320ms
    await settle();
    return { order, shelfId, jitter, sigs: tail };
  }

  /* ---------- invariants (§3) ---------- */
  async function checkInvariants(ctx) {
    const errs = [];
    const [shelves, sum] = await Promise.all([api('/api/shelves'), api('/api/status/summary')]);
    const items = shelves.flatMap(s => s.items);
    const today = sum.today;

    // I-01
    const dom = { green: +$('#cnt-green').textContent, yellow: +$('#cnt-yellow').textContent, red: +$('#cnt-red').textContent };
    ['green', 'yellow', 'red'].forEach(k => { if (dom[k] !== sum[k]) errs.push(`I-01 ${k} dom=${dom[k]} api=${sum[k]}`); });
    const cnt = { green: 0, yellow: 0, red: 0 };
    items.forEach(i => cnt[i.statusColor.toLowerCase()]++);
    ['green', 'yellow', 'red'].forEach(k => { if (cnt[k] !== sum[k]) errs.push(`I-01 ${k} items=${cnt[k]} summary=${sum[k]}`); });

    // I-02
    const byId = new Map(shelves.map(s => [s.id, s]));
    visibleShelves().forEach(sec => {
      const s = byId.get(+sec.dataset.shelfId);
      if (!s) { errs.push(`I-02 dom shelf ${sec.dataset.shelfId} missing in api`); return; }
      const domIds = cardsIn(sec).map(c => +c.dataset.id).join(',');
      const apiIds = s.items.map(i => i.id).join(',');
      if (domIds !== apiIds) errs.push(`I-02 shelf ${s.id} dom=[${domIds}] api=[${apiIds}]`);
      if (sec.querySelector('.shelf-name').value !== s.name && document.activeElement !== sec.querySelector('.shelf-name'))
        errs.push(`I-02 shelf ${s.id} name dom="${sec.querySelector('.shelf-name').value}" api="${s.name}"`);
    });

    // I-03 / I-04 / I-11
    const seen = new Set();
    shelves.forEach(s => {
      s.items.forEach((it, idx) => {
        if (seen.has(it.id)) errs.push(`I-11 duplicate item id ${it.id}`);
        seen.add(it.id);
        if (it.sortOrder !== idx) errs.push(`I-11 shelf ${s.id} item ${it.id} sortOrder=${it.sortOrder} idx=${idx}`);
        if (it.shelfId !== s.id) errs.push(`I-11 item ${it.id} shelfId=${it.shelfId} in shelf ${s.id}`);
        if (it.openDate !== addDays(it.thawDate, it.thawDays)) errs.push(`I-03 item ${it.id} openDate`);
        if (it.discardDate !== addDays(it.openDate, it.keepDays)) errs.push(`I-03 item ${it.id} discardDate`);
        const rem = diffDays(it.discardDate, today);
        const want = rem >= 2 ? 'GREEN' : rem === 1 ? 'YELLOW' : 'RED';
        if (it.remainingDays !== rem) errs.push(`I-04 item ${it.id} remainingDays=${it.remainingDays} want ${rem}`);
        if (it.statusColor !== want) errs.push(`I-04 item ${it.id} color=${it.statusColor} want ${want}`);
      });
    });
    shelves.forEach((s, i) => { if (s.sortOrder !== i + 1) errs.push(`I-11 shelf ${s.id} sortOrder=${s.sortOrder} idx=${i + 1}`); });

    // I-05
    let pages = [], spm = {};
    try { pages = JSON.parse(localStorage.getItem('lm_pages') || '[]'); spm = JSON.parse(localStorage.getItem('lm_spm') || '{}'); } catch (e) { errs.push('I-05 localStorage unreadable'); }
    const pageIds = new Set(pages.map(p => p.id));
    shelves.forEach(s => {
      if (!(s.id in spm)) errs.push(`I-05 shelf ${s.id} unassigned`);
      else if (!pageIds.has(spm[s.id])) errs.push(`I-05 shelf ${s.id} on missing page ${spm[s.id]}`);
    });
    Object.keys(spm).forEach(k => { if (!byId.has(+k)) errs.push(`I-05 orphan spm ${k}`); });
    if ($$('#pages .page-tab').length !== pages.length) errs.push('I-05 page tab count mismatch');
    const selTab = $('#pages .page-tab[aria-selected="true"]');
    if (!selTab) errs.push('I-05 no selected page tab');
    else {
      const cur = +selTab.dataset.pageId;
      const want = shelves.filter(s => spm[s.id] === cur).map(s => s.id).join(',');
      const got = visibleShelves().map(s => +s.dataset.shelfId).join(',');
      if (want !== got) errs.push(`I-05 page ${cur} shows shelves [${got}] but owns [${want}]`);
    }

    // I-06 / I-07
    if (document.body.classList.contains('busy')) errs.push('I-06 body.busy left');
    if (document.body.classList.contains('is-dragging')) errs.push('I-06 is-dragging left');
    if ($('#drag-layer').children.length) errs.push('I-06 drag-layer not empty');
    if ($$('.slot').length) errs.push('I-06 slot left');
    if (!ctx || !ctx.allowModal) {
      if (anyModalVisible()) errs.push('I-07 modal still visible: ' + $$('.modal:not(.hidden)').map(m => m.id).join(','));
      if (document.body.style.overflow) errs.push('I-07 body overflow=' + document.body.style.overflow);
    }

    // I-08
    if (jsErrors.length) errs.push('I-08 js errors: ' + jsErrors.splice(0).join(' | '));

    // I-10
    const th = document.documentElement.getAttribute('data-theme');
    const ac = $('#theme-switch').getAttribute('aria-checked');
    if (th !== 'light' && th !== 'dark') errs.push('I-10 data-theme=' + th);
    if ((th === 'dark') !== (ac === 'true')) errs.push(`I-10 theme=${th} aria-checked=${ac}`);
    const stored = localStorage.getItem('lm_theme');
    if (stored && stored !== th) errs.push(`I-10 stored=${stored} theme=${th}`);
    const night = getComputedStyle(document.documentElement).getPropertyValue('--night').trim();
    if ((th === 'dark') !== (night === '1')) errs.push(`I-10 --night=${night} theme=${th}`);

    return { errs, shelves, sum, items, today };
  }

  /* ---------- operations (§4) ---------- */
  const NAMES = ['火腿', 'BBQ醬', '鹽烤鱈魚', '起司', '培根', '雞胸肉', '奶油', '番茄醬', '洋蔥圈', '豬排', '蝦仁', '玉米'];
  let st = null;   // latest invariant snapshot
  let notes = [];

  function currentPageShelfSecs() { return visibleShelves(); }

  async function ensureShelfOnPage() {
    if (currentPageShelfSecs().length) return;
    await opAddShelf();
  }

  async function opAddItem() {
    await ensureShelfOnPage();
    const sec = pick(currentPageShelfSecs());
    const before = cardsIn(sec).length;
    sec.querySelector('.add-item').click();
    await waitFor(() => modalOpen('#add'), 3000, '#add open');
    const name = pick(NAMES) + ri(1, 99);
    setInput($('#f-name'), name);
    setInput($('#f-thaw'), String(ri(0, 3)));
    setInput($('#f-keep'), String(ri(0, 8)));
    if (rnd() < 0.3) $(`[data-inc="f-keep"]`).click();
    if (rnd() < 0.3) $(`[data-dec="f-thaw"]`).click();
    if (rnd() < 0.3 && st) $('#f-date').value = addDays(st.today, -ri(0, 6));
    const shelfId = +sec.dataset.shelfId;
    $('button[form="add-form"]').click();
    await settle();
    const s = (await api('/api/shelves')).find(x => x.id === shelfId);
    if (!s || s.items.length !== before + 1) return `OP-01 expected ${before + 1} items on shelf ${shelfId}, got ${s && s.items.length}`;
    if (s.items[s.items.length - 1].name !== name) return `OP-01 last item name ${s.items[s.items.length - 1].name} != ${name}`;
  }

  async function opAddItemInvalid() {
    await ensureShelfOnPage();
    const sec = pick(currentPageShelfSecs());
    const shelfId = +sec.dataset.shelfId;
    const before = cardsIn(sec).length;
    sec.querySelector('.add-item').click();
    await waitFor(() => modalOpen('#add'), 3000, '#add open');
    const mode = ri(0, 3);
    setInput($('#f-name'), mode === 0 ? '   ' : mode === 3 ? 'x'.repeat(30) + 'y' : '測試');
    setInput($('#f-thaw'), mode === 1 ? '31' : '1');
    setInput($('#f-keep'), mode === 2 ? (rnd() < .5 ? '' : '366') : '2');
    if (mode === 3) $('#f-name').removeAttribute('maxlength');
    $('button[form="add-form"]').click();
    await sleep(60);
    $('#f-name').setAttribute('maxlength', '30');
    const errShown = ['#e-name', '#e-thaw', '#e-keep'].some(s => $(s).textContent.trim());
    const stillOpen = modalOpen('#add');
    $('[data-close]').click();
    await settle();
    const s = (await api('/api/shelves')).find(x => x.id === shelfId);
    if (!errShown) return `OP-02 mode ${mode}: no field error shown`;
    if (!stillOpen) return `OP-02 mode ${mode}: modal closed on invalid input`;
    if (s.items.length !== before) return `OP-02 mode ${mode}: item was created`;
  }

  async function opRetag() {
    const cards = currentPageShelfSecs().flatMap(cardsIn);
    if (!cards.length) return opAddItem();
    const c = pick(cards);
    const id = +c.dataset.id;
    c.querySelector('.retag').click();
    await confirmAsk(true);
    const it = (await api('/api/shelves')).flatMap(s => s.items).find(i => i.id === id);
    if (!it) return `OP-03 item ${id} vanished`;
    if (it.thawDate !== st.today) return `OP-03 item ${id} thawDate=${it.thawDate} today=${st.today}`;
  }

  async function opDeleteItem() {
    const cards = currentPageShelfSecs().flatMap(cardsIn);
    if (!cards.length) return opAddItem();
    const c = pick(cards);
    const id = +c.dataset.id;
    const sec = c.closest('.shelf');
    const shelfId = +sec.dataset.shelfId;
    const remainingOrder = cardsIn(sec).map(x => +x.dataset.id).filter(x => x !== id).join(',');
    if (rnd() < 0.15) {           // cancel path
      c.querySelector('.ic-x').click();
      await confirmAsk(false);
      const still = (await api('/api/shelves')).flatMap(s => s.items).some(i => i.id === id);
      if (!still) return `OP-04 cancel still deleted ${id}`;
      return;
    }
    c.querySelector('.ic-x').click();
    await confirmAsk(true);
    const s = (await api('/api/shelves')).find(x => x.id === shelfId);
    if (s.items.some(i => i.id === id)) return `OP-04 item ${id} not deleted`;
    if (s.items.map(i => i.id).join(',') !== remainingOrder) return `OP-04 order changed after delete`;
  }

  async function opDragItem(cross) {
    const secs = currentPageShelfSecs();
    const withCards = secs.filter(s => cardsIn(s).length);
    if (!withCards.length) return opAddItem();
    const src = pick(withCards);
    const card = pick(cardsIn(src));
    const id = +card.dataset.id;
    let dst = src;
    if (cross && secs.length > 1) dst = pick(secs.filter(s => s !== src));
    // choose drop target inside dst
    const targets = cardsIn(dst).filter(c => c !== card);
    const dropBefore = targets.length && rnd() < 0.75 ? pick(targets) : null;  // null → end (add-item)
    const anchor = dropBefore || dst.querySelector('.add-item');
    anchor.scrollIntoView({ block: 'center' });
    await frame();
    const cr = card.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    if (cr.bottom < 0 || cr.top > innerHeight) { card.scrollIntoView({ block: 'center' }); await frame(); }
    const c2 = card.getBoundingClientRect();
    const a2 = anchor.getBoundingClientRect();
    const tx = dropBefore ? a2.left + Math.min(20, a2.width / 4) : a2.left + a2.width / 2;
    const ty = a2.top + a2.height / 2;
    if (ty < 100 || ty > innerHeight - 100) return 'SKIP';   // would trigger edge auto-scroll
    // expected final order of dst
    const dstIds = cardsIn(dst).map(c => +c.dataset.id).filter(x => x !== id);
    let pos = dropBefore ? dstIds.indexOf(+dropBefore.dataset.id) : dstIds.length;
    dstIds.splice(pos, 0, id);
    const res = await dragPath(card, c2.left + 30, c2.top + 60, tx, ty);
    void ar;
    const code = `OP-0${cross ? 6 : 5}`;
    if (res.jitter) return `${code} drag item ${id}: slot jitters while pointer is still [${res.sigs.join(" / ")}]`;
    if (!res.order) return `${code} drag item ${id}: no slot at drop`;
    const shelves = await api("/api/shelves");
    const d = shelves.find(s => s.id === res.shelfId);
    const got = d.items.map(i => i.id).join(",");
    if (got !== res.order.join(",")) return `${code} drag item ${id} → shelf ${d.id}: slot showed [${res.order}] saved [${got}]`;
    if (res.shelfId !== +dst.dataset.shelfId || got !== dstIds.join(",")) notes.push(`${code} intent drift: aimed shelf ${dst.dataset.shelfId} [${dstIds}], slot landed shelf ${res.shelfId} [${res.order}]`);
    if (shelves.flatMap(s => s.items).filter(i => i.id === id).length !== 1) return `${code} item ${id} duplicated or lost`;
  }

  async function opAddShelf(name) {
    const before = (await api('/api/shelves')).length;
    $('#btn-add-shelf').click();
    await waitFor(() => modalOpen('#shelf-modal'), 3000, '#shelf-modal open');
    const n = name || ('層' + ri(1, 999));
    setInput($('#s-name'), n);
    $('button[form="shelf-form"]').click();
    await settle();
    const after = await api('/api/shelves');
    if (after.length !== before + 1) return `OP-07 shelves ${before} → ${after.length}`;
    const last = after[after.length - 1];
    if (last.name !== n) return `OP-07 last shelf name ${last.name} != ${n}`;
    const spm = JSON.parse(localStorage.getItem('lm_spm'));
    if (!visibleShelves().some(s => +s.dataset.shelfId === last.id)) return `OP-07 new shelf ${last.id} not on current page (page ${spm[last.id]})`;
  }

  async function opRenameShelf() {
    await ensureShelfOnPage();
    const sec = pick(currentPageShelfSecs());
    const id = +sec.dataset.shelfId;
    const inp = sec.querySelector('.shelf-name');
    const old = inp.value;
    if (rnd() < 0.2) {           // empty → must be rejected and restored
      inp.value = '  ';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      const s = (await api('/api/shelves')).find(x => x.id === id);
      if (s.name !== old) return `OP-08 empty rename changed name to ${s.name}`;
      if (inp.value !== old && document.contains(inp)) return `OP-08 input not restored`;
      return;
    }
    const n = '架' + ri(1, 9999);
    inp.value = n;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const s = (await api('/api/shelves')).find(x => x.id === id);
    if (s.name !== n) return `OP-08 rename want ${n} got ${s.name}`;
  }

  async function opDeleteShelf() {
    const all = await api('/api/shelves');
    if (all.length <= 2) return opAddShelf();
    const secs = currentPageShelfSecs();
    if (!secs.length) return opAddShelf();
    const sec = pick(secs);
    const id = +sec.dataset.shelfId;
    const n = cardsIn(sec).length;
    sec.querySelector('.shelf-handle').click();
    if (n > 0) {
      await sleep(60);
      if (modalOpen('#ask')) return `OP-09 non-empty shelf ${id} asked for delete`;
      const last = toasts[toasts.length - 1];
      if (!last || last.type !== 'error') return `OP-09 non-empty shelf ${id}: no error toast`;
      toasts.push({ type: 'expected' });   // mark consumed
      await settle();
      return;
    }
    await confirmAsk(true);
    const after = await api('/api/shelves');
    if (after.some(s => s.id === id)) return `OP-09 shelf ${id} not deleted`;
  }

  async function opDragShelf() {
    const secs = currentPageShelfSecs();
    if (secs.length < 2) return opAddShelf();
    const src = pick(secs);
    const others = secs.filter(s => s !== src);
    const target = rnd() < 0.8 ? pick(others) : null;    // null → after last
    const handle = src.querySelector('.shelf-handle');
    const expected = secs.map(s => +s.dataset.shelfId).filter(x => x !== +src.dataset.shelfId);
    const pos = target ? expected.indexOf(+target.dataset.shelfId) : expected.length;
    expected.splice(pos, 0, +src.dataset.shelfId);
    (target || others[others.length - 1]).scrollIntoView({ block: 'center' });
    await frame();
    const hr = handle.getBoundingClientRect();
    if (hr.bottom < 0 || hr.top > innerHeight) { handle.scrollIntoView({ block: 'center' }); await frame(); }
    const h2 = handle.getBoundingClientRect();
    let ty;
    if (target) {
      const tr = target.getBoundingClientRect();
      ty = tr.top + Math.min(30, tr.height / 4);
    } else {
      const lr = others[others.length - 1].getBoundingClientRect();
      ty = lr.bottom - 10;
    }
    if (ty < 100 || ty > innerHeight - 100) return 'SKIP';
    const res = await dragPath(handle, h2.left + h2.width / 2, h2.top + h2.height / 2, h2.left + h2.width / 2, ty);
    if (res.jitter) return `OP-10 drag shelf ${src.dataset.shelfId}: slot jitters [${res.sigs.join(" / ")}]`;
    if (!res.order) return `OP-10 drag shelf ${src.dataset.shelfId}: no slot at drop`;
    const after = await api("/api/shelves");
    const spm = JSON.parse(localStorage.getItem("lm_spm"));
    const page = spm[+src.dataset.shelfId];
    const got = after.filter(s => spm[s.id] === page).map(s => s.id).join(",");
    if (got !== res.order.join(",")) return `OP-10 drag shelf ${src.dataset.shelfId}: slot showed [${res.order}] saved [${got}]`;
    if (got !== expected.join(",")) notes.push(`OP-10 intent drift: aimed [${expected}] slot [${res.order}]`);
  }

  async function opPages() {
    const tabs = $$('#pages .page-tab');
    const r = rnd();
    if (r < 0.5 && tabs.length > 1) {                         // switch
      const t = pick(tabs.filter(x => x.getAttribute('aria-selected') !== 'true'));
      t.click();
      await settle();
      if ($(`#pages .page-tab[data-page-id="${t.dataset.pageId}"]`).getAttribute('aria-selected') !== 'true') return 'OP-11 switch failed';
      return;
    }
    if (r < 0.65 && tabs.length < 4) {                        // add page
      $('#pages .page-add').click();
      await waitFor(() => !$('#page-modal').classList.contains('hidden'), 2000, 'page-modal');
      setInput($('#page-name-input'), '頁' + ri(1, 99));
      $('#page-modal-save').click();
      await sleep(260);
      await settle();
      return;
    }
    if (r < 0.85) {                                          // rename current
      const cur = $('#pages .page-tab[aria-selected="true"]');
      cur.click();
      await waitFor(() => !$('#page-modal').classList.contains('hidden'), 2000, 'page-modal');
      const n = 'P' + ri(1, 99);
      setInput($('#page-name-input'), n);
      $('#page-modal-save').click();
      await sleep(260);
      await settle();
      const now = $('#pages .page-tab[aria-selected="true"]');
      if (now.textContent !== n) return `OP-11 rename want ${n} got ${now.textContent}`;
      return;
    }
    // delete current page (only if empty and >1)
    if (tabs.length < 2) return;
    const cur = $('#pages .page-tab[aria-selected="true"]');
    const id = cur.dataset.pageId;
    cur.click();
    await waitFor(() => !$('#page-modal').classList.contains('hidden'), 2000, 'page-modal');
    const hasShelves = currentPageShelfSecs().length > 0;
    $('#page-delete-btn').click();
    await sleep(60);
    if (hasShelves) {
      if (!$('#page-delete-err').textContent) return 'OP-11 non-empty page delete: no error';
      $('#page-modal-cancel').click();
      await sleep(260);
      await settle();
      return;
    }
    await waitFor(() => modalOpen('#ask'), 2000, 'ask 1'); $('#ask-ok').click();
    await sleep(250);
    await waitFor(() => modalOpen('#ask'), 2000, 'ask 2'); $('#ask-ok').click();
    await sleep(260);
    await settle();
    if ($(`#pages .page-tab[data-page-id="${id}"]`)) return `OP-11 page ${id} not deleted`;
  }

  async function opRapidClicks() {
    await ensureShelfOnPage();
    if (rnd() < 0.5) {
      const sec = pick(currentPageShelfSecs());
      const shelfId = +sec.dataset.shelfId;
      const before = cardsIn(sec).length;
      sec.querySelector('.add-item').click();
      await waitFor(() => modalOpen('#add'), 3000, '#add open');
      setInput($('#f-name'), '連點' + ri(1, 99));
      const btn = $('button[form="add-form"]');
      for (let i = 0; i < 5; i++) btn.click();
      await settle();
      const s = (await api('/api/shelves')).find(x => x.id === shelfId);
      if (s.items.length !== before + 1) return `OP-12 add-item x5 created ${s.items.length - before}`;
    } else {
      const before = (await api('/api/shelves')).length;
      if (before >= 12) return;
      $('#btn-add-shelf').click();
      await waitFor(() => modalOpen('#shelf-modal'), 3000, 'shelf modal');
      setInput($('#s-name'), '連' + ri(1, 99));
      const btn = $('button[form="shelf-form"]');
      for (let i = 0; i < 5; i++) btn.click();
      await settle();
      const after = (await api('/api/shelves')).length;
      if (after !== before + 1) return `OP-12 add-shelf x5 created ${after - before}`;
    }
  }

  async function opTheme() {
    const sw = $('#theme-switch');
    const before = document.documentElement.getAttribute('data-theme');
    const want = before === 'dark' ? 'light' : 'dark';
    const mode = ri(0, 2);
    if (mode === 0) {
      sw.click();
    } else {
      // drag the knob across (synthetic pointer events; no click follows)
      const r = sw.getBoundingClientRect();
      const from = before === 'dark' ? r.right - 14 : r.left + 14;
      const to = before === 'dark' ? r.left + 4 : r.right - 4;
      sw.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, clientX: from, clientY: r.top + 10 }));
      // mode 1: drag all the way across → toggles; mode 2: drag under halfway → snaps back
      const end = mode === 1 ? to : from + (to - from) * 0.3;
      for (let i = 1; i <= 5; i++)
        sw.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, pointerType: 'mouse', buttons: 1, clientX: from + (end - from) * i / 5, clientY: r.top + 10 }));
      sw.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'mouse', clientX: end, clientY: r.top + 10 }));
      await sleep(450);           // let click-suppression window expire
    }
    await sleep(30);
    const now = document.documentElement.getAttribute('data-theme');
    const expect = mode === 2 ? before : want;
    if (now !== expect) return `OP-13 mode ${mode} theme ${before} → ${now}, want ${expect}`;
    if (mode === 2) return;
    if (localStorage.getItem('lm_theme') !== now) return `OP-13 not persisted`;
    if (sw.style.getPropertyValue('--knob-x')) return 'OP-13 knob inline position left behind';
    if (sw.classList.contains('pressed') || sw.classList.contains('dragging')) return 'OP-13 pressed/dragging class left';
  }

  async function opBadApi() {
    const cases = [
      ['PUT', '/api/items/987654321/retag', null],
      ['DELETE', '/api/items/987654321', null],
      ['DELETE', '/api/shelves/987654321', null],
      ['PUT', '/api/shelves/987654321/name', { name: 'x' }],
      ['POST', '/api/shelves/987654321/items', { name: 'x', thawDays: 1, keepDays: 1 }],
      ['PUT', '/api/items/move', { itemId: 987654321, targetShelfId: 1, targetIndex: 0 }],
      ['PUT', '/api/shelves/move', { shelfId: 987654321, targetIndex: 0 }],
      ['POST', '/api/shelves', '{bad json'],
      ['PUT', '/api/items/move', {}],
      ['PUT', '/api/shelves/move', {}],
    ];
    if (st && st.shelves.length) {
      const sid = st.shelves[0].id;
      cases.push(['POST', `/api/shelves/${sid}/items`, { name: '', thawDays: 1, keepDays: 1 }]);
      cases.push(['POST', `/api/shelves/${sid}/items`, { name: 'x', thawDays: -1, keepDays: 1 }]);
      cases.push(['POST', `/api/shelves/${sid}/items`, { name: 'x', thawDays: 1, keepDays: 999 }]);
      cases.push(['POST', `/api/shelves/${sid}/items`, { name: 'x', keepDays: 1 }]);
      cases.push(['POST', `/api/shelves/${sid}/items`, { name: 'x', thawDays: 'abc', keepDays: 1 }]);
      cases.push(['PUT', `/api/shelves/${sid}/name`, { name: 'x'.repeat(21) }]);
    }
    const fails = [];
    for (const [m, u, b] of cases) {
      const res = await rawFetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b === null ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)) });
      let body = {};
      try { body = await res.json(); } catch (e) {}
      const tag = `${m} ${u} ${typeof b === 'string' ? b : JSON.stringify(b)}`;
      if (res.status >= 500) fails.push(`${tag} → ${res.status} ${JSON.stringify(body)}`);
      else if (res.status < 400) fails.push(`${tag} accepted with ${res.status}`);
      else if (!body.error) fails.push(`${tag} → ${res.status} without {error}`);
    }
    if (fails.length) return 'OP-15 ' + fails.join(' || ');
  }

  /* weighted operation table */
  function chooseOp() {
    const nItems = st ? st.items.length : 0;
    const nShelves = st ? st.shelves.length : 0;
    const table = [
      ['OP-01', nItems > 30 ? 2 : 14, opAddItem],
      ['OP-02', 4, opAddItemInvalid],
      ['OP-03', 10, opRetag],
      ['OP-04', nItems > 30 ? 16 : 6, opDeleteItem],
      ['OP-05', 10, () => opDragItem(false)],
      ['OP-06', 10, () => opDragItem(true)],
      ['OP-07', nShelves > 10 ? 0 : 4, () => opAddShelf()],
      ['OP-08', 5, opRenameShelf],
      ['OP-09', nShelves > 9 ? 8 : 3, opDeleteShelf],
      ['OP-10', 7, opDragShelf],
      ['OP-11', 6, opPages],
      ['OP-12', 3, opRapidClicks],
      ['OP-13', 6, opTheme],
      ['OP-15', 5, opBadApi],
    ];
    const total = table.reduce((n, t) => n + t[1], 0);
    let r = rnd() * total;
    for (const t of table) { if ((r -= t[1]) < 0) return t; }
    return table[0];
  }

  async function runChunk(seed, ops) {
    rnd = mulberry32(seed);
    const log = [];
    const counts = {};
    const skipped = {};
    const toastStart = toasts.length;
    notes = [];
    await settle();
    st = await checkInvariants();
    if (st.errs.length) log.push({ i: -1, op: 'initial', errs: st.errs });
    for (let i = 0; i < ops; i++) {
      const [code, , fn] = chooseOp();
      counts[code] = (counts[code] || 0) + 1;
      const respStart = responses.length;
      const toastMark = toasts.length;
      let err = null;
      try { err = await fn(); } catch (e) { err = `${code} threw: ${e && e.message || e}`; }
      if (err === 'SKIP') { err = null; skipped[code] = (skipped[code] || 0) + 1; }
      try { await settle(); } catch (e) { err = (err ? err + ' | ' : '') + e.message; }
      if (anyModalVisible()) {              // close stray modal so later ops keep working
        if (!err) err = `${code} left modal open: ` + $$('.modal:not(.hidden)').map(m => m.id).join(',');
        $$('.modal:not(.hidden)').forEach(m => { m.classList.add('hidden'); m.classList.remove('closing'); });
        document.body.style.overflow = '';
      }
      st = await checkInvariants();
      const errs = st.errs.slice();
      if (err) errs.unshift(err);
      // I-09: legit UI ops must not get any 4xx/5xx (OP-15 uses rawFetch and is excluded)
      responses.slice(respStart).forEach(r => {
        if (r.status >= 400) errs.push(`I-09 ${r.method} ${r.url} → ${r.status}`);
        if (r.status >= 500) errs.push(`I-09 500 ${r.method} ${r.url}`);
      });
      // unexpected error toasts
      toasts.slice(toastMark).forEach((t, k, arr) => {
        if (t.type !== 'error') return;
        if (arr[k + 1] && arr[k + 1].type === 'expected') return;
        if (code === 'OP-08' && t.msg.includes('不可為空')) return;
        errs.push(`toast error: ${t.msg}`);
      });
      if (errs.length) log.push({ i, op: code, errs });
    }
    return {
      seed, ops, counts, skipped, errors: log, notes,
      final: { shelves: st.shelves.length, items: st.items.length, today: st.today, theme: document.documentElement.getAttribute('data-theme') },
      toastsSeen: toasts.length - toastStart,
    };
  }

  function snapshot() {
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      lm_theme: localStorage.getItem('lm_theme'),
      lm_pages: localStorage.getItem('lm_pages'),
      lm_spm: localStorage.getItem('lm_spm'),
      page: ($('#pages .page-tab[aria-selected="true"]') || {}).textContent || null,
    };
  }

  async function verifySnapshot(s) {
    await settle();
    const now = snapshot();
    const errs = [];
    if (now.theme !== s.theme) errs.push(`OP-14 theme after reload ${now.theme} != ${s.theme}`);
    if (now.lm_theme !== s.lm_theme) errs.push('OP-14 lm_theme changed');
    if (now.lm_pages !== s.lm_pages) errs.push('OP-14 lm_pages changed');
    if (now.lm_spm !== s.lm_spm) errs.push('OP-14 lm_spm changed');
    const inv = await checkInvariants();
    return errs.concat(inv.errs);
  }

  window.__loop = { runChunk, snapshot, verifySnapshot, checkInvariants: async () => (await checkInvariants()).errs };
})();
