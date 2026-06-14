/* Bootstrap: renderer, simulation loop, picking, keyboard, UI hooks. */
(function () {
  const errBox = document.getElementById('errbox');
  window.addEventListener('error', e => {
    errBox.style.display = 'block';
    errBox.textContent = 'Error: ' + (e.message || e.error || 'unknown');
  });

  if (typeof THREE === 'undefined') {
    errBox.style.display = 'block';
    errBox.textContent = 'three.js failed to load. Keep js/vendor/three.min.js next to index.html, or connect to the internet once.';
    document.getElementById('loading').style.display = 'none';
    return;
  }

  const STATE = {
    simJD: ORB.jdNow(),
    timeScale: 86400,
    selected: null,
    showLabels: true,
    showOrbits: true
  };

  let renderer, scene, camera, rig, clock;
  let liveTimer = 0;

  function setupRenderer() {
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    document.getElementById('app').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000003);
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.02, 300000);
    camera.position.set(2600, 1750, 2600);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function viewDist(body) {
    const def = body.def;
    if (def.kind === 'region') return def.view.dist;
    if (def.kind === 'craft') return 0.55;
    if (def.kind === 'comet') return 2.6;
    if (def.kind === 'star') return def.id === 'sun' ? 30 : Math.max(body.dispRad * 4, 48);
    if (def.kind === 'galaxy') return Math.max(body.dispRad * 2.6, 600);
    if (def.kind === 'blackhole') return Math.max(body.dispRad * 4.5, 360);
    if (def.kind === 'nebula') return Math.max(body.dispRad * 3, 600);
    if (def.kind === 'pulsar') return Math.max(body.dispRad * 6, 420);
    return Math.max(body.dispRad * 3.9, 0.16);
  }

  const speedHinted = {};
  function maybeSpeedHint(body) {
    /* fast orbiters (ISS, Phobos…) are a blur at high time speeds — hint once */
    const orb = body.def.orbit;
    if (!orb || speedHinted[body.id]) return;
    if (Math.abs(STATE.timeScale) * 8 > orb.periodD * 86400) {
      speedHinted[body.id] = true;
      UI.toast(`⏱ ${body.def.name} orbits quickly — slow time down (− button or ,) to watch it glide.`, 6000);
    }
  }

  function select(idOrBody, opts) {
    const body = typeof idOrBody === 'string' ? SCENE.byId[idOrBody] : idOrBody;
    if (!body) return;
    if (!(opts && opts.fromTour)) UI.stopTour(true);
    STATE.selected = body;
    UI.showInfo(body.def);
    rig.setTarget(body, {
      dist: viewDist(body),
      instant: opts && opts.instant,
      sunward: opts && opts.instant ? true : undefined
    });
    updateCrumb();
    maybeSpeedHint(body);
    try { history.replaceState(null, '', '#' + body.id); } catch (e) { /* file:// quirks */ }
  }

  function overview() {
    STATE.selected = null;
    UI.hideInfo();
    rig.setTarget(SCENE.byId.sun, { dist: 980 });
    UI.setBreadcrumb('Solar System');
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// quirks */ }
  }

  function updateCrumb() {
    const b = STATE.selected;
    if (!b) { UI.setBreadcrumb('Solar System'); return; }
    let extra = '';
    if (b.def.kind === 'moon' || (b.def.kind === 'craft' && b.def.parent)) {
      extra = ` — orbiting ${DATA.byId[b.def.parent] ? DATA.byId[b.def.parent].name : ''}`;
    } else if (b.def.elements || b.def.ray) {
      extra = ` — ${(b.wp.length() / DATA.AU).toFixed(b.wp.length() / DATA.AU > 9 ? 1 : 2)} AU from Sun`;
    }
    UI.setBreadcrumb(b.def.name + extra);
  }

  /* ---------- picking ---------- */

  function setupPicking() {
    const el = renderer.domElement;
    let downX = 0, downY = 0, moved = false, downCount = 0;

    el.addEventListener('pointerdown', e => {
      downX = e.clientX; downY = e.clientY; moved = false;
      downCount++;
      if (UI.tourRunning()) UI.stopTour();
    });
    el.addEventListener('pointermove', e => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
    });
    el.addEventListener('pointerup', e => {
      downCount = Math.max(0, downCount - 1);
      if (moved || rig.pointers.size > 0) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const ndc = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
      let body = SCENE.raycastPick(ndc, camera);
      if (!body) body = SCENE.screenPick(x, y, camera, rect.width, rect.height);
      if (body) select(body);
    });
    el.addEventListener('dblclick', () => rig.zoomBy(0.42));
  }

  function setupKeys() {
    const planetKeys = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        UI.stopTour(true);
        if (document.getElementById('help').classList.contains('open')) {
          document.getElementById('help').classList.remove('open');
        } else if (document.getElementById('drawer').classList.contains('open')) {
          document.getElementById('drawer').classList.remove('open');
        } else overview();
      }
      else if (k >= '0' && k <= '9') select(planetKeys[+k]);
      else if (k === 'f') {
        if (rig.mode === 'fly') {
          rig.exitFly(rig.nearestBody(SCENE.bodies));
          UI.toast('Follow mode — drag to orbit, scroll to zoom.');
        } else {
          rig.enterFly();
          UI.toast('Free flight: WASD move · Q/E down/up · Shift boost · drag to look · F to exit.');
        }
      }
      else if (k === 'l') {
        STATE.showLabels = !STATE.showLabels;
        document.getElementById('chkLabels').checked = STATE.showLabels;
      }
      else if (k === 'o') {
        STATE.showOrbits = !STATE.showOrbits;
        document.getElementById('chkOrbits').checked = STATE.showOrbits;
      }
      else if (k === ' ') { e.preventDefault(); document.getElementById('btnPause').click(); }
      else if (k === ',') document.getElementById('btnSlower').click();
      else if (k === '.') document.getElementById('btnFaster').click();
      else if (k === 'h' || k === '?') document.getElementById('help').classList.toggle('open');
      else if (k === 't') document.getElementById('btnTour').click();
    });
  }

  /* ---------- main loop ---------- */

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    STATE.simJD += STATE.timeScale * dt / 86400;
    SCENE.update(STATE.simJD, dt, STATE.timeScale);
    rig.update(dt, SCENE.bodies);
    camera.updateMatrixWorld();
    SCENE.updateView(camera, STATE.selected, STATE.showLabels, STATE.showOrbits,
      window.innerWidth, window.innerHeight);

    liveTimer -= dt;
    if (liveTimer <= 0) {
      liveTimer = 0.25;
      UI.tick(STATE.simJD);
      const b = STATE.selected;
      if (b && (b.def.elements || b.def.ray)) {
        const au = b.wp.length() / DATA.AU;
        UI.setLive(`Currently ${au.toFixed(au > 9 ? 1 : 3)} AU from the Sun (live)`);
        updateCrumb();
      } else if (b && b.def.kind === 'craft') {
        UI.setLive('');
      }
    }

    renderer.render(scene, camera);
  }

  /* ---------- boot ---------- */

  async function boot() {
    const status = document.getElementById('loadStatus');
    const bar = document.getElementById('loadBar');
    let step = 0;
    const totalSteps = 18;

    try {
      setupRenderer();
    } catch (err) {
      document.getElementById('loading').style.display = 'none';
      errBox.style.display = 'block';
      errBox.textContent = 'WebGL is not available in this browser: ' + err.message;
      return;
    }

    await SCENE.build(scene, renderer, camera, msg => {
      status.textContent = msg;
      step++;
      bar.style.width = Math.min(100, step / totalSteps * 100) + '%';
    });

    rig = new Rig(camera, renderer.domElement);
    SCENE.onSelect = b => select(b);

    UI.init({
      select,
      overview,
      zoom: f => rig.zoomBy(f),
      setTimeScale: s => { STATE.timeScale = s; },
      resetTime: () => { STATE.simJD = ORB.jdNow(); },
      setLabels: v => { STATE.showLabels = v; },
      setOrbits: v => { STATE.showOrbits = v; },
      setDrift: v => { rig.autoDrift = v; }
    });

    setupPicking();
    setupKeys();

    SCENE.update(STATE.simJD, 0, STATE.timeScale); /* prime positions before first camera placement */
    const hash = location.hash.replace('#', '');
    if (hash && SCENE.byId[hash]) select(hash, { instant: true });
    else overview();
    clock = new THREE.Clock();
    animate();

    const lo = document.getElementById('loading');
    lo.classList.add('done');
    setTimeout(() => lo.style.display = 'none', 900);

    setTimeout(() => UI.toast('Drag to orbit · scroll to zoom · click any world or label to travel to it.'), 1100);
    setTimeout(() => {
      if (!STATE.selected) UI.toast('Try the ▶ Tour button, or press T. Time controls are at the bottom.');
    }, 9000);
  }

  boot();
})();
