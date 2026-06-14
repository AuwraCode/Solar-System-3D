/* UI: nav drawer, info panel, time controls, tour, toasts. */
const UI = (function () {
  const SPEEDS = [
    { s: 1, label: 'Real time' },
    { s: 60, label: '1 min / sec' },
    { s: 3600, label: '1 hour / sec' },
    { s: 86400, label: '1 day / sec' },
    { s: 604800, label: '1 week / sec' },
    { s: 2629800, label: '1 month / sec' },
    { s: 31557600, label: '1 year / sec' }
  ];
  const TOUR = ['sun', 'mercury', 'venus', 'earth', 'iss', 'luna', 'mars', 'jupiter', 'io', 'europa',
    'saturn', 'titan', 'enceladus', 'uranus', 'neptune', 'triton', 'pluto', 'halley', 'voyager1',
    'betelgeuse', 'orionneb', 'sgra', 'andromeda'];

  let hooks = null;
  let speedIdx = 3, paused = false, reversed = false;
  let tourTimer = null, tourIdx = 0;
  let toastTimer = null;
  const $ = id => document.getElementById(id);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtDate(jd) {
    const ms = (jd - 2440587.5) * 86400000;
    if (!isFinite(ms) || Math.abs(ms) > 8.6e15) return '—';
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${y}`;
    if (Math.abs(currentScale()) < 86400 * 2 && !paused) {
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      return `${base} · ${hh}:${mm}:${ss} UTC`;
    }
    return base;
  }

  function currentScale() {
    if (paused) return 0;
    return SPEEDS[speedIdx].s * (reversed ? -1 : 1);
  }

  function pushTime() {
    hooks.setTimeScale(currentScale());
    $('speedLabel').textContent = paused ? 'Paused' : (reversed ? '◀ ' : '') + SPEEDS[speedIdx].label;
    $('btnPause').textContent = paused ? '▶' : '⏸';
    $('btnReverse').classList.toggle('active', reversed);
  }

  function setSpeedIdx(i) {
    speedIdx = NZ.clamp(i, 0, SPEEDS.length - 1);
    paused = false;
    pushTime();
  }

  function kindLabel(def) {
    return { star: 'Star', planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon', comet: 'Comet', craft: 'Spacecraft', region: 'Region', galaxy: 'Galaxy', blackhole: 'Black hole', nebula: 'Nebula' }[def.kind] || '';
  }

  function cssColor(c) { return '#' + c.toString(16).padStart(6, '0'); }

  function buildNav() {
    const groups = [
      ['The Sun', d => d.id === 'sun'],
      ['Planets', d => d.kind === 'planet'],
      ['Dwarf planets', d => d.kind === 'dwarf'],
      ['Moons', d => d.kind === 'moon'],
      ['Spacecraft', d => d.kind === 'craft'],
      ['Comets', d => d.kind === 'comet'],
      ['Regions', d => d.kind === 'region'],
      ['Stars', d => d.kind === 'star' && d.id !== 'sun'],
      ['Nebulae', d => d.kind === 'nebula'],
      ['Black holes', d => d.kind === 'blackhole'],
      ['Galaxies', d => d.kind === 'galaxy']
    ];
    const box = $('navList');
    box.innerHTML = '';
    for (const [title, filt] of groups) {
      const defs = DATA.bodies.filter(filt);
      if (!defs.length) continue;
      const h = document.createElement('div');
      h.className = 'nav-head';
      h.textContent = title;
      box.appendChild(h);
      for (const d of defs) {
        const row = document.createElement('div');
        row.className = 'nav-row';
        row.dataset.name = d.name.toLowerCase();
        const sub = d.parent ? ` <span class="nav-sub">· ${DATA.byId[d.parent].name}</span>` : '';
        row.innerHTML = `<span class="dot" style="background:${cssColor(d.color)}"></span>${d.name}${sub}`;
        row.addEventListener('click', () => {
          hooks.select(d.id);
          toggleDrawer(false);
        });
        box.appendChild(row);
      }
    }
    $('navSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      for (const row of box.querySelectorAll('.nav-row')) {
        row.style.display = !q || row.dataset.name.includes(q) ? '' : 'none';
      }
      for (const head of box.querySelectorAll('.nav-head')) {
        let n = head.nextElementSibling, any = false;
        while (n && !n.classList.contains('nav-head')) {
          if (n.style.display !== 'none') any = true;
          n = n.nextElementSibling;
        }
        head.style.display = any ? '' : 'none';
      }
    });
  }

  /* ---------- size comparison ---------- */

  function buildSizes() {
    const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const SCALE = 330 / (2 * DATA.byId.jupiter.radiusKm);
    const row = $('scRow');
    row.innerHTML = '';
    for (const id of order) {
      const d = DATA.byId[id];
      if (!d) continue;
      const px = Math.max(6, Math.round(2 * d.radiusKm * SCALE));
      const hex = cssColor(d.color);
      const km = Math.round(2 * d.radiusKm).toLocaleString('en-US');
      const item = document.createElement('div');
      item.className = 'sc-item';
      item.innerHTML =
        `<div class="sc-ball${d.rings === 'saturn' ? ' ringed' : ''}" style="width:${px}px;height:${px}px;` +
        `background:radial-gradient(circle at 34% 30%, rgba(255,255,255,0.5), ${hex} 58%, rgba(0,0,0,0.35));"></div>` +
        `<div class="sc-cap"><b>${d.name}</b><span>${km} km</span></div>`;
      row.appendChild(item);
    }
  }

  function openSizes() { $('sizeCompare').classList.add('open'); }
  function closeSizes() { $('sizeCompare').classList.remove('open'); }

  /* ---------- measure distance ---------- */

  function buildMeasure() {
    const groups = [
      ['Sun & planets', d => d.id === 'sun' || d.kind === 'planet'],
      ['Dwarf planets', d => d.kind === 'dwarf'],
      ['Moons', d => d.kind === 'moon'],
      ['Spacecraft', d => d.kind === 'craft'],
      ['Comets', d => d.kind === 'comet']
    ];
    const opts = groups.map(([title, filt]) => {
      const rows = DATA.bodies.filter(filt)
        .map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      return rows ? `<optgroup label="${title}">${rows}</optgroup>` : '';
    }).join('');
    $('measA').innerHTML = opts;
    $('measB').innerHTML = opts;
    $('measA').value = 'earth';
    $('measB').value = 'mars';
    const apply = () => hooks.setMeasure($('measA').value, $('measB').value);
    $('measA').addEventListener('change', apply);
    $('measB').addEventListener('change', apply);
  }

  function toggleMeasure() {
    const m = $('measure');
    const open = m.classList.toggle('open');
    if (open) hooks.setMeasure($('measA').value, $('measB').value);
    else { hooks.setMeasure(null, null); $('measReadout').textContent = ''; }
  }

  function updateMeasureReadout(info) {
    if (!$('measure').classList.contains('open')) return;
    const el = $('measReadout');
    if (!info) { el.textContent = ''; return; }
    const au = info.au < 0.01 ? info.au.toFixed(5) : info.au.toFixed(info.au < 10 ? 3 : 2);
    el.innerHTML = `<b>${info.a} → ${info.b}</b><br>${info.km}<br>${au} AU · ${info.light}`;
  }

  function toggleDrawer(open) {
    const d = $('drawer');
    const want = open === undefined ? !d.classList.contains('open') : open;
    d.classList.toggle('open', want);
  }

  function showInfo(def) {
    const p = $('infoPanel');
    $('infoTitle').innerHTML = `<span class="dot big" style="background:${cssColor(def.color)}"></span>${def.name}`;
    $('infoKind').textContent = kindLabel(def);
    const rows = (def.rows || []).map(r =>
      `<div class="ir"><div class="ik">${r[0]}</div><div class="iv">${r[1]}</div></div>`).join('');
    const fun = (def.fun || []).map(f => `<li>${f}</li>`).join('');
    $('infoBody').innerHTML =
      `<div class="live" id="infoLive"></div>` +
      `<p class="blurb">${def.blurb || ''}</p>` +
      `<div class="rows">${rows}</div>` +
      (fun ? `<div class="fun-head">Did you know?</div><ul class="fun">${fun}</ul>` : '');
    p.classList.add('open');
  }

  function hideInfo() { $('infoPanel').classList.remove('open'); }

  function setLive(txt) {
    const el = $('infoLive');
    if (el) el.textContent = txt || '';
  }

  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 4200);
  }

  function setBreadcrumb(txt) { $('crumb').textContent = txt; }

  /* ---------- tour ---------- */

  function tourRunning() { return tourTimer !== null; }

  function startTour() {
    tourIdx = 0;
    $('btnTour').classList.add('active');
    toast('Grand tour started — sit back. Click anywhere or press Esc to stop.');
    tourStep();
  }

  function tourStep() {
    if (tourIdx >= TOUR.length) { stopTour(); hooks.overview(); return; }
    hooks.select(TOUR[tourIdx], { fromTour: true });
    hooks.setDrift(true);
    tourIdx++;
    tourTimer = setTimeout(tourStep, 9000);
  }

  function stopTour(silent) {
    if (tourTimer === null) return;
    clearTimeout(tourTimer);
    tourTimer = null;
    hooks.setDrift(false);
    $('btnTour').classList.remove('active');
    if (!silent) toast('Tour stopped — the system is yours.');
  }

  /* ---------- init ---------- */

  function init(h) {
    hooks = h;
    buildNav();
    buildSizes();
    $('btnSizes').addEventListener('click', openSizes);
    $('btnCloseSizes').addEventListener('click', closeSizes);
    buildMeasure();
    $('btnMeasure').addEventListener('click', toggleMeasure);

    $('btnNav').addEventListener('click', () => toggleDrawer());
    $('btnCloseDrawer').addEventListener('click', () => toggleDrawer(false));
    $('btnHelp').addEventListener('click', () => $('help').classList.toggle('open'));
    $('btnCloseHelp').addEventListener('click', () => $('help').classList.remove('open'));
    $('btnCloseInfo').addEventListener('click', () => { hideInfo(); });
    $('btnOverview').addEventListener('click', () => { stopTour(true); hooks.overview(); });
    $('btnTour').addEventListener('click', () => tourRunning() ? stopTour() : startTour());

    $('btnZoomIn').addEventListener('click', () => hooks.zoom(0.45));
    $('btnZoomOut').addEventListener('click', () => hooks.zoom(2.2));

    $('btnSlower').addEventListener('click', () => setSpeedIdx(speedIdx - 1));
    $('btnFaster').addEventListener('click', () => setSpeedIdx(speedIdx + 1));
    $('btnPause').addEventListener('click', () => { paused = !paused; pushTime(); });
    $('btnReverse').addEventListener('click', () => { reversed = !reversed; pushTime(); });
    $('btnNow').addEventListener('click', () => { hooks.resetTime(); toast('Time reset to now.'); });

    $('chkLabels').addEventListener('change', e => hooks.setLabels(e.target.checked));
    $('chkOrbits').addEventListener('change', e => hooks.setOrbits(e.target.checked));

    $('btnLayers').addEventListener('click', () => $('layers').classList.toggle('open'));
    for (const cb of document.querySelectorAll('#layers input[data-layer]')) {
      cb.addEventListener('change', e => hooks.setLayer(e.target.dataset.layer, e.target.checked));
    }

    pushTime();
  }

  function tick(simJD) {
    $('dateLabel').textContent = fmtDate(simJD);
  }

  return {
    init, tick, showInfo, hideInfo, setLive, toast, setBreadcrumb,
    startTour, stopTour, tourRunning, openSizes, updateMeasureReadout,
    setSpeedIdx, get paused() { return paused; },
    speeds: SPEEDS
  };
})();
