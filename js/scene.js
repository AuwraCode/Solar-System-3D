/* Scene construction + per-frame simulation updates. */
const SCENE = (function () {
  const bodies = [];          // runtime body objects
  const byId = {};
  const pickMeshes = [];
  let root, rendererRef, labelBox, camRef;
  let sunUniforms, earthUniforms, sunCorona, sunCore;
  let ringShadow = null;       // Saturn's shadow cast across its rings
  let beltMesh, beltData, kuiperPts;
  let lastBeltDays = NaN;      // sim-day stamp of the last belt rebuild
  let sunProms = [], meteors = [], bhDisks = [], fountains = [], flareSprites = [];
  const starTwinkle = { value: 0 };
  const comets = [];
  let raycaster = null;
  const tmpV = null;

  /* <common> is required: the logdepth chunks call isPerspectiveMatrix() from it,
     and ShaderMaterial does not get it automatically like built-ins do */
  const LOGDEPTH_V = `
    #include <common>
    #include <logdepthbuf_pars_vertex>`;
  const LOGDEPTH_V_MAIN = `
    #include <logdepthbuf_vertex>`;
  const LOGDEPTH_F = `
    #include <common>
    #include <logdepthbuf_pars_fragment>`;
  const LOGDEPTH_F_MAIN = `
    #include <logdepthbuf_fragment>`;

  /* ---------- shaders ---------- */

  const SUN_VERT = `
    varying vec3 vN; varying vec3 vPos;
    ${LOGDEPTH_V}
    void main(){
      vN = normalize(normalMatrix * normal);
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      ${LOGDEPTH_V_MAIN}
    }`;

  const SUN_FRAG = `
    uniform float uTime;
    varying vec3 vN; varying vec3 vPos;
    ${LOGDEPTH_F}
    float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0;
      return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x),
                     mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                 mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),
                     mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z); }
    float fbm(vec3 p){ float s = 0.0; float a = 0.5;
      for(int i=0;i<5;i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      ${LOGDEPTH_F_MAIN}
      vec3 p = normalize(vPos);
      float n = fbm(p*6.0 + vec3(uTime*0.02, uTime*0.013, -uTime*0.011));
      float n2 = fbm(p*16.0 - vec3(uTime*0.03, 0.0, uTime*0.022));
      float gran = fbm(p*40.0 + vec3(0.0, uTime*0.05, 0.0));
      float v = n*0.72 + n2*0.40 + gran*0.10;
      vec3 col = mix(vec3(0.95,0.30,0.02), vec3(1.0,0.80,0.32), smoothstep(0.26,0.72,v));
      col = mix(col, vec3(1.0,0.97,0.84), smoothstep(0.70,0.95,v));
      /* migrating sunspots: dark umbra ringed by a warm penumbra */
      float spot = fbm(p*2.4 + vec3(13.0,-7.0,uTime*0.006));
      float umbra = smoothstep(0.34,0.24,spot);
      float pen = smoothstep(0.44,0.34,spot) * (1.0-umbra);
      col = mix(col, vec3(0.32,0.12,0.03), pen*0.5);
      col = mix(col, vec3(0.12,0.04,0.02), umbra);
      float lim = pow(max(dot(normalize(vN), vec3(0.0,0.0,1.0)), 0.0), 0.55);
      /* faculae: bright granular network, strongest toward the limb */
      float fac = smoothstep(0.60,0.82,n2) * (0.4+0.6*(1.0-lim));
      col += vec3(0.30,0.22,0.10)*fac;
      col *= 0.5 + 0.55*lim;
      gl_FragColor = vec4(col*1.32, 1.0);
    }`;

  const ATMO_VERT = `
    varying vec3 vN; varying vec3 vV;
    ${LOGDEPTH_V}
    void main(){
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
      ${LOGDEPTH_V_MAIN}
    }`;

  const ATMO_FRAG = `
    uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
    varying vec3 vN; varying vec3 vV;
    ${LOGDEPTH_F}
    void main(){
      ${LOGDEPTH_F_MAIN}
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
      gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);
    }`;

  const EARTH_VERT = `
    varying vec2 vUv; varying vec3 vNw; varying vec3 vWp; varying float vLat;
    ${LOGDEPTH_V}
    void main(){
      vUv = uv;
      vNw = normalize(mat3(modelMatrix) * normal);
      vLat = normalize(position).y;          /* sin(geographic latitude) */
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWp = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
      ${LOGDEPTH_V_MAIN}
    }`;

  const EARTH_FRAG = `
    uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D specMap;
    uniform sampler2D heightMap; uniform sampler2D cloudMap;
    uniform vec3 sunDir; uniform float uTime; uniform vec2 texel;
    varying vec2 vUv; varying vec3 vNw; varying vec3 vWp; varying float vLat;
    ${LOGDEPTH_F}
    /* sRGB maps are hardware-decoded to linear; encode our output back manually
       (three's encodings chunk is unavailable inside ShaderMaterial in r147) */
    vec3 lin2srgb(vec3 c){ return pow(max(c, vec3(0.0)), vec3(0.4545)); }
    float ahash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float anoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(ahash(i), ahash(i+vec2(1,0)), f.x),
                 mix(ahash(i+vec2(0,1)), ahash(i+vec2(1,1)), f.x), f.y); }
    float afbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*anoise(p); p*=2.0; a*=0.5; } return s; }
    void main(){
      ${LOGDEPTH_F_MAIN}
      vec3 Ng = normalize(vNw);
      float ocean = texture2D(specMap, vUv).r;
      /* tangent frame on the sphere, for height-field bump + cloud shadows */
      vec3 up = abs(Ng.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 east = normalize(cross(up, Ng));
      vec3 north = cross(Ng, east);
      float hL = texture2D(heightMap, vUv - vec2(texel.x, 0.0)).r;
      float hR = texture2D(heightMap, vUv + vec2(texel.x, 0.0)).r;
      float hD = texture2D(heightMap, vUv - vec2(0.0, texel.y)).r;
      float hU = texture2D(heightMap, vUv + vec2(0.0, texel.y)).r;
      float bump = (1.0 - ocean) * 2.4;       /* relief on land only */
      vec3 N = normalize(Ng - (east * (hR - hL) + north * (hU - hD)) * bump);

      float dayMix = smoothstep(-0.06, 0.22, dot(Ng, sunDir));
      vec3 day = texture2D(dayMap, vUv).rgb;
      vec3 night = texture2D(nightMap, vUv).rgb;
      /* clouds drifting overhead cast soft shadows toward the terminator */
      vec2 sunUv = vec2(dot(sunDir, east), dot(sunDir, north)) * texel * 7.0;
      float cloudHere = texture2D(cloudMap, vUv).g;
      float cloudShadow = texture2D(cloudMap, vUv - sunUv).g;

      float diff = max(dot(N, sunDir), 0.0);
      vec3 col = day * (0.05 + 1.3 * diff * (1.0 - cloudShadow * 0.55));
      col += night * 1.7 * (1.0 - dayMix) * (1.0 - cloudHere * 0.8);
      vec3 V = normalize(cameraPosition - vWp);
      vec3 Hh = normalize(sunDir + V);
      float spec = pow(max(dot(Ng, Hh), 0.0), 80.0) * ocean * dayMix;
      col += vec3(1.0, 0.96, 0.86) * spec * 0.7;
      float fres = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
      col += vec3(0.16, 0.36, 0.92) * fres * (0.16 + 0.5 * dayMix);

      /* auroras: green/violet curtains over the night-side poles */
      float polar = smoothstep(0.68, 0.94, abs(vLat));
      float nightf = 1.0 - dayMix;
      if (polar * nightf > 0.001) {
        float au = afbm(vec2(vUv.x * 42.0 + uTime * 0.30, abs(vLat) * 60.0 - uTime * 0.18));
        au *= afbm(vec2(vUv.x * 12.0 - uTime * 0.12, vLat * 22.0));
        float curtain = smoothstep(0.34, 0.80, au) + 0.18 * smoothstep(0.2, 0.6, au);
        vec3 aur = mix(vec3(0.10, 0.95, 0.45), vec3(0.55, 0.22, 0.95),
                       0.5 + 0.5 * sin(vUv.x * 9.0 + uTime * 0.4));
        col += aur * curtain * polar * nightf * 1.15;
      }
      gl_FragColor = vec4(lin2srgb(col), 1.0);
    }`;

  const STAR_VERT = `
    attribute float phase;
    attribute vec3 color;
    uniform float uTime; uniform float uSize;
    varying vec3 vColor; varying float vTw;
    ${LOGDEPTH_V}
    void main(){
      vColor = color;
      float tw = 0.5 + 0.35*sin(uTime*1.8 + phase) + 0.15*sin(uTime*4.7 + phase*1.7);
      vTw = clamp(tw, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * (0.8 + 0.45*vTw);
      ${LOGDEPTH_V_MAIN}
    }`;

  const STAR_FRAG = `
    uniform sampler2D uMap;
    varying vec3 vColor; varying float vTw;
    ${LOGDEPTH_F}
    void main(){
      ${LOGDEPTH_F_MAIN}
      vec4 t = texture2D(uMap, gl_PointCoord);
      gl_FragColor = vec4(vColor, t.a * (0.35 + 0.65*vTw));
    }`;

  const BH_VERT = `
    varying vec3 vPos;
    ${LOGDEPTH_V}
    void main(){
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      ${LOGDEPTH_V_MAIN}
    }`;

  const BH_FRAG = `
    uniform float uTime; uniform float uInner; uniform float uOuter;
    varying vec3 vPos;
    ${LOGDEPTH_F}
    float bh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float bn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(bh(i), bh(i+vec2(1,0)), f.x), mix(bh(i+vec2(0,1)), bh(i+vec2(1,1)), f.x), f.y); }
    float bfbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*bn(p); p*=2.0; a*=0.5; } return s; }
    void main(){
      ${LOGDEPTH_F_MAIN}
      float r = length(vPos.xy);
      float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
      float ang = atan(vPos.y, vPos.x);
      /* logarithmic-spiral turbulence streaming inward over time */
      float swirl = bfbm(vec2(ang * 2.5 - log(r + 1.0) * 5.0 - uTime * 1.1, t * 5.0 + uTime * 0.2));
      vec3 hot = vec3(1.0, 0.96, 0.86), mid = vec3(1.0, 0.55, 0.16), cool = vec3(0.66, 0.12, 0.04);
      vec3 col = mix(hot, mid, smoothstep(0.0, 0.4, t));
      col = mix(col, cool, smoothstep(0.4, 1.0, t));
      float doppler = 0.45 + 0.95 * (0.5 + 0.5 * cos(ang - 1.0));
      float dens = (0.45 + 0.8 * swirl) * smoothstep(1.0, 0.8, t) * smoothstep(0.0, 0.06, t);
      float bright = dens * doppler;
      gl_FragColor = vec4(col * bright * 1.7, clamp(bright * 1.25, 0.0, 1.0));
    }`;

  /* ---------- helpers ---------- */

  function lumpyGeometry(r, detail, seed, amp) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const n = NZ.fbm3(v.x * 2.3 + 9, v.y * 2.3 + 9, v.z * 2.3 + 9, 4, seed);
      const k = 1 + (n - 0.5) * (amp || 0.7);
      pos.setXYZ(i, v.x * r * k, v.y * r * k, v.z * r * k);
    }
    g.computeVertexNormals();
    return g;
  }

  function ringGeometry(inner, outer) {
    const g = new THREE.RingGeometry(inner, outer, 220, 1);
    const pos = g.attributes.position, uv = g.attributes.uv;
    const v = new THREE.Vector2();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i));
      uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
    }
    return g;
  }

  /* Patch a ring's Lambert material so fragments lying in the planet's
     cylindrical shadow (anti-sun side, within the planet's silhouette) darken —
     the iconic black band Saturn casts across its rings. Returns the live
     uniform whose uSunLocal the per-frame loop points away from the Sun. */
  function applyRingShadow(mat, shadowR) {
    const uni = {
      uSunLocal: { value: new THREE.Vector3(1, 0, 0) },
      uShadowR: { value: shadowR }
    };
    mat.onBeforeCompile = shader => {
      shader.uniforms.uSunLocal = uni.uSunLocal;
      shader.uniforms.uShadowR = uni.uShadowR;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRingPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRingPos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>',
          '#include <common>\nvarying vec3 vRingPos;\nuniform vec3 uSunLocal;\nuniform float uShadowR;')
        .replace('#include <output_fragment>',
          'float _pd = dot(vRingPos, uSunLocal);\n' +
          'if (_pd < 0.0) {\n' +
          '  float _perp = length(vRingPos - _pd * uSunLocal);\n' +
          '  outgoingLight *= mix(0.12, 1.0, smoothstep(uShadowR * 0.92, uShadowR * 1.2, _perp));\n' +
          '}\n' +
          '#include <output_fragment>');
    };
    mat.customProgramCacheKey = () => 'ringShadow';
    return uni;
  }

  function makeAtmo(r, opts) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(opts.color) },
        uPower: { value: opts.power },
        uIntensity: { value: opts.intensity }
      },
      transparent: true, blending: THREE.AdditiveBlending,
      side: THREE.BackSide, depthWrite: false
    });
    return new THREE.Mesh(new THREE.SphereGeometry(r * opts.size, 48, 32), mat);
  }

  function cssColor(c) { return '#' + c.toString(16).padStart(6, '0'); }

  function makeLabel(body) {
    const el = document.createElement('div');
    el.className = 'label kind-' + body.def.kind;
    el.innerHTML = `<span class="dot" style="background:${cssColor(body.def.color)}"></span><span class="txt">${body.def.name}</span>`;
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (SCENE.onSelect) SCENE.onSelect(body);
    });
    labelBox.appendChild(el);
    return el;
  }

  function registerBody(def, group, mesh, parentRt) {
    const b = {
      def, group, mesh,
      id: def.id,
      dispRad: def.dispRad || 0.05,
      parent: parentRt || null,
      wp: new THREE.Vector3(),
      marker: null, labelEl: null,
      sysR: 0,
      orbitLine: null, moonLine: null,
      visible: true,
      /* deep-sky objects are pinned to the sky and never move — their world
         position is cached once and skipped by the per-frame update */
      fixed: def.kind === 'galaxy' || def.kind === 'nebula' ||
        def.kind === 'blackhole' || def.kind === 'region' ||
        (def.kind === 'star' && def.id !== 'sun')
    };
    bodies.push(b);
    byId[def.id] = b;
    if (mesh) { mesh.userData.bodyId = def.id; pickMeshes.push(mesh); }
    if (def.kind !== 'region') {
      const mat = new THREE.SpriteMaterial({
        map: TEX.markerTex, color: def.color, transparent: true,
        opacity: 0.9, depthWrite: false, depthTest: false
      });
      b.marker = new THREE.Sprite(mat);
      b.marker.renderOrder = 6;
      b.marker.scale.set(1, 1, 1);
      group.add(b.marker);
      b.labelEl = makeLabel(b);
    }
    return b;
  }

  function hitSphere(b, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }));
    m.userData.bodyId = b.id;
    b.group.add(m);
    pickMeshes.push(m);
  }

  /* ---------- spacecraft mini-models ---------- */

  const MAT = {};
  function craftMats() {
    MAT.white = new THREE.MeshLambertMaterial({ color: 0xd8dde2, emissive: 0x222426 });
    MAT.gray = new THREE.MeshLambertMaterial({ color: 0x8a9098, emissive: 0x16181a });
    MAT.gold = new THREE.MeshLambertMaterial({ color: 0xc8a838, emissive: 0x4a3c10 });
    MAT.panel = new THREE.MeshLambertMaterial({ color: 0x7a4a28, emissive: 0x301808, side: THREE.DoubleSide });
    MAT.shield = new THREE.MeshLambertMaterial({ color: 0xe0c8d8, emissive: 0x403040, side: THREE.DoubleSide });
  }

  function modelISS() {
    const g = new THREE.Group(), s = 0.018;
    const truss = new THREE.Mesh(new THREE.BoxGeometry(7 * s, 0.22 * s, 0.22 * s), MAT.gray);
    g.add(truss);
    for (const x of [-3.1, -2.2, 2.2, 3.1]) {
      for (const z of [1, -1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.03 * s, 1.5 * s), MAT.panel);
        p.position.set(x * s, 0, z * 1.05 * s);
        g.add(p);
      }
    }
    for (const [len, z] of [[2.6, 0], [1.4, 1.1], [1.0, -0.9]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, len * s, 10), MAT.white);
      m.rotation.x = Math.PI / 2;
      m.position.set(0, 0.22 * s, z * s * 0.6);
      g.add(m);
    }
    const rad = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.02 * s, 0.7 * s), MAT.white);
    rad.position.set(-1.1 * s, -0.3 * s, 0);
    g.add(rad);
    return g;
  }

  function modelProbe() {
    const g = new THREE.Group(), s = 0.012;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * s, 0.18 * s, 0.34 * s, 24, 1, true), MAT.white);
    dish.rotation.x = Math.PI / 2; /* opening toward +z — lookAt points it at the Sun/Earth */
    dish.position.z = 0.25 * s;
    g.add(dish);
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.26 * s, 10), MAT.gold);
    bus.rotation.x = Math.PI / 2;
    bus.position.z = -0.1 * s;
    g.add(bus);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 3.4 * s, 6), MAT.gray);
    boom.rotation.z = Math.PI / 2;
    boom.position.x = 1.7 * s;
    g.add(boom);
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.5 * s, 8), MAT.gray);
    rtg.rotation.z = Math.PI / 2;
    rtg.position.x = -0.8 * s;
    g.add(rtg);
    return g;
  }

  function modelJWST() {
    /* built so the sunshield normal is +z — lookAt(sun) gives the real attitude */
    const g = new THREE.Group(), s = 0.016;
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * s, 1.6 * s), MAT.shield);
      sh.rotation.z = Math.PI / 4;
      sh.position.z = i * 0.045 * s;
      g.add(sh);
    }
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.05 * s, 6), MAT.gold);
    mirror.position.z = -0.4 * s;
    mirror.rotation.x = Math.PI / 2 + 0.3;
    g.add(mirror);
    const sec = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.7 * s, 6), MAT.gray);
    sec.position.set(0, 0.3 * s, -0.75 * s);
    sec.rotation.x = 0.9;
    g.add(sec);
    return g;
  }

  /* ---------- comet tails ---------- */

  function makeTrail(max, size, colorA) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    const mat = new THREE.PointsMaterial({
      size, map: TEX.particleTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    return {
      pts, max, n: 0,
      pos: geo.attributes.position.array,
      col: geo.attributes.color.array,
      vel: new Float32Array(max * 3),
      age: new Float32Array(max),
      life: new Float32Array(max),
      base: new THREE.Color(colorA),
      acc: 0
    };
  }

  function trailUpdate(tr, dt) {
    let i = 0;
    while (i < tr.n) {
      tr.age[i] += dt;
      if (tr.age[i] >= tr.life[i]) {
        const last = tr.n - 1;
        for (let k = 0; k < 3; k++) {
          tr.pos[i * 3 + k] = tr.pos[last * 3 + k];
          tr.vel[i * 3 + k] = tr.vel[last * 3 + k];
        }
        tr.age[i] = tr.age[last]; tr.life[i] = tr.life[last];
        tr.n--;
        continue;
      }
      tr.pos[i * 3] += tr.vel[i * 3] * dt;
      tr.pos[i * 3 + 1] += tr.vel[i * 3 + 1] * dt;
      tr.pos[i * 3 + 2] += tr.vel[i * 3 + 2] * dt;
      const f = 1 - tr.age[i] / tr.life[i];
      tr.col[i * 3] = tr.base.r * f;
      tr.col[i * 3 + 1] = tr.base.g * f;
      tr.col[i * 3 + 2] = tr.base.b * f;
      i++;
    }
    tr.pts.geometry.attributes.position.needsUpdate = true;
    tr.pts.geometry.attributes.color.needsUpdate = true;
    tr.pts.geometry.setDrawRange(0, tr.n);
  }

  function trailSpawn(tr, origin, dir, spread, speed, lifeBase, count, tangent, tanAmt) {
    for (let c = 0; c < count; c++) {
      if (tr.n >= tr.max) break;
      const i = tr.n++;
      tr.pos[i * 3] = origin.x + (Math.random() - 0.5) * spread;
      tr.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
      tr.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      const sp = speed * (0.55 + Math.random() * 0.9);
      tr.vel[i * 3] = dir.x * sp + (Math.random() - 0.5) * speed * 0.16 + (tangent ? tangent.x * tanAmt * sp : 0);
      tr.vel[i * 3 + 1] = dir.y * sp + (Math.random() - 0.5) * speed * 0.16 + (tangent ? tangent.y * tanAmt * sp : 0);
      tr.vel[i * 3 + 2] = dir.z * sp + (Math.random() - 0.5) * speed * 0.16 + (tangent ? tangent.z * tanAmt * sp : 0);
      tr.age[i] = 0;
      tr.life[i] = lifeBase * (0.6 + Math.random() * 0.8);
    }
  }

  /* ---------- surface eruptions: Io's volcanoes, Enceladus' geysers ---------- */

  /* A ballistic particle fountain living in the moon's spinning local frame, so
     its vents stay anchored to the terrain as the moon rotates. Particles shoot
     radially out of fixed vents, are pulled back toward the centre, and fade. */
  function makeFountain(host, r, opts) {
    const n = opts.n;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: opts.size, map: TEX.particleTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true
    }));
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    host.add(pts);
    const sys = {
      pts, n, r, vents: opts.vents,
      pos: geo.attributes.position.array,
      col: geo.attributes.color.array,
      vel: new Float32Array(n * 3),
      age: new Float32Array(n),
      life: new Float32Array(n),
      speed: opts.speed, lifeBase: opts.life, grav: opts.grav, spread: opts.spread,
      hot: new THREE.Color(opts.hot), cool: new THREE.Color(opts.cool)
    };
    for (let i = 0; i < n; i++) fountainSpawn(sys, i, Math.random() * sys.lifeBase);
    return sys;
  }

  function fountainSpawn(sys, i, age0) {
    const v = sys.vents[(Math.random() * sys.vents.length) | 0];
    const j = sys.r * 0.05;
    const jx = Math.random() - 0.5, jy = Math.random() - 0.5, jz = Math.random() - 0.5;
    sys.pos[i * 3] = v.x * sys.r + jx * j;
    sys.pos[i * 3 + 1] = v.y * sys.r + jy * j;
    sys.pos[i * 3 + 2] = v.z * sys.r + jz * j;
    const sp = sys.speed * (0.5 + Math.random() * 0.6);
    sys.vel[i * 3] = v.x * sp + jx * sys.spread * sp;
    sys.vel[i * 3 + 1] = v.y * sp + jy * sys.spread * sp;
    sys.vel[i * 3 + 2] = v.z * sp + jz * sys.spread * sp;
    sys.age[i] = age0;
    sys.life[i] = sys.lifeBase * (0.6 + Math.random() * 0.8);
  }

  function fountainStep(sys, dt) {
    const { pos, vel, age, life, col, n, grav, hot, cool } = sys;
    for (let i = 0; i < n; i++) {
      age[i] += dt;
      if (age[i] >= life[i]) { fountainSpawn(sys, i, 0); continue; }
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const d = Math.sqrt(x * x + y * y + z * z) || 1e-4;
      vel[i * 3] -= (x / d) * grav * dt;
      vel[i * 3 + 1] -= (y / d) * grav * dt;
      vel[i * 3 + 2] -= (z / d) * grav * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = age[i] / life[i], b = 1 - f;
      col[i * 3] = (hot.r * b + cool.r * f) * b;
      col[i * 3 + 1] = (hot.g * b + cool.g * f) * b;
      col[i * 3 + 2] = (hot.b * b + cool.b * f) * b;
    }
    sys.pts.geometry.attributes.position.needsUpdate = true;
    sys.pts.geometry.attributes.color.needsUpdate = true;
  }

  function buildFountain(rt, mesh, def, seed) {
    const r = def.dispRad, vents = [];
    const prng = NZ.mulberry32(def.id.length * 131 + seed);
    let opts;
    if (def.plumes.type === 'geyser') {
      /* clustered around the south pole, like Enceladus' tiger-stripe jets */
      for (let k = 0; k < 5; k++) {
        vents.push(new THREE.Vector3().setFromSphericalCoords(1, Math.PI - prng() * 0.55, prng() * 6.2832));
      }
      opts = { n: 170, size: r * 0.10, speed: r * 3.6, life: 1.6, grav: r * 8.0,
        spread: 0.14, hot: 0xeafcff, cool: 0x5fa8ff, vents };
    } else {
      /* scattered volcanoes across the whole globe, sulfur-hot */
      for (let k = 0; k < 4; k++) {
        vents.push(new THREE.Vector3().setFromSphericalCoords(1, Math.acos(2 * prng() - 1), prng() * 6.2832));
      }
      opts = { n: 200, size: r * 0.085, speed: r * 3.0, life: 1.3, grav: r * 9.0,
        spread: 0.12, hot: 0xffd884, cool: 0xc62a08, vents };
    }
    fountains.push({ rt, sys: makeFountain(mesh, r, opts) });
  }

  /* ---------- build ---------- */

  async function build(scene, renderer, camera, progress) {
    root = scene; rendererRef = renderer; camRef = camera;
    labelBox = document.getElementById('labels');
    raycaster = new THREE.Raycaster();
    TEX.setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    TEX.markerTex = TEX.spriteDot();
    TEX.particleTex = TEX.spriteDot();
    craftMats();
    const tick = () => new Promise(r => setTimeout(r, 0));

    /* Objects that never move once placed: collected here, then frozen at the
       end of build() so the per-frame scene-graph matrix update skips them.
       staticObjs = fully static subtrees; staticLocal = static position but an
       animated child (e.g. a spinning galaxy disk) keeps updating. */
    const staticObjs = [];
    const staticLocal = [];

    /* sky */
    progress('Painting the Milky Way…');
    await tick();
    const milky = new THREE.Mesh(
      new THREE.SphereGeometry(92000, 48, 32),
      new THREE.MeshBasicMaterial({ map: TEX.texMilkyWay(), side: THREE.BackSide, depthWrite: false })
    );
    milky.rotation.z = THREE.MathUtils.degToRad(60.2);
    milky.rotation.y = 1.7;
    milky.renderOrder = -10;
    scene.add(milky);
    staticObjs.push(milky);

    const starGroups = [[2600, 1.3, 0.75], [2600, 2.0, 0.9], [900, 3.0, 1.0]];
    const rng = NZ.mulberry32(555);
    for (const [count, size, bright] of starGroups) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const pha = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const u = rng() * 2 - 1, ph = rng() * Math.PI * 2;
        const rr = Math.sqrt(1 - u * u);
        const d = 30000 + rng() * 52000;
        pos[i * 3] = rr * Math.cos(ph) * d;
        pos[i * 3 + 1] = u * d;
        pos[i * 3 + 2] = rr * Math.sin(ph) * d;
        const t = rng();
        let r = 1, g = 1, b = 1;
        if (t < 0.12) { r = 0.72; g = 0.82; b = 1; }
        else if (t < 0.24) { r = 1; g = 0.88; b = 0.7; }
        else if (t < 0.3) { r = 1; g = 0.72; b = 0.6; }
        const v = (0.55 + rng() * 0.45) * bright;
        col[i * 3] = r * v; col[i * 3 + 1] = g * v; col[i * 3 + 2] = b * v;
        pha[i] = rng() * 6.2832;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('phase', new THREE.BufferAttribute(pha, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: starTwinkle, uSize: { value: size }, uMap: { value: TEX.markerTex } },
        vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      const p = new THREE.Points(geo, mat);
      p.renderOrder = -9;
      p.frustumCulled = false;
      scene.add(p);
      staticObjs.push(p);
    }

    /* shooting stars: brief additive streaks that cross the sky now and then */
    meteors = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      line.frustumCulled = false;
      line.renderOrder = 3;
      line.visible = false;
      scene.add(line);
      staticObjs.push(line);
      meteors.push({
        line, pos: new THREE.Vector3(), vel: new THREE.Vector3(), color: new THREE.Color(),
        len: 1, life: 1, age: 0, active: false, delay: 1 + Math.random() * 8
      });
    }

    /* lighting */
    scene.add(new THREE.AmbientLight(0x3a4254, 0.5));
    const sunLight = new THREE.PointLight(0xfff4e0, 1.5, 0, 0);
    scene.add(sunLight);

    /* sun */
    progress('Igniting the Sun…');
    await tick();
    const sunDef = DATA.byId.sun;
    const sunGroup = new THREE.Group();
    sunUniforms = { uTime: { value: 0 } };
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(sunDef.dispRad, 64, 48),
      new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: sunUniforms })
    );
    sunGroup.add(sunMesh);
    sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.spriteGlow('rgba(255,250,235,1)', 'rgba(255,210,120,0.6)'),
      color: 0xffeecc, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false
    }));
    sunCore.scale.set(26, 26, 1);
    sunCore.renderOrder = 5;
    sunGroup.add(sunCore);
    sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.spriteSun(), color: 0xffffff, transparent: true, opacity: 0.9,
      depthWrite: false, depthTest: false
    }));
    sunCorona.scale.set(60, 60, 1);
    sunCorona.renderOrder = 5;
    sunGroup.add(sunCorona);

    /* solar prominences: glowing plasma loops anchored at the limb that
       flicker and breathe, with the odd one flaring up */
    sunProms = [];
    const promRng = NZ.mulberry32(4242);
    for (let i = 0; i < 9; i++) {
      const R = sunDef.dispRad * (0.32 + promRng() * 0.5);
      const tube = R * (0.05 + promRng() * 0.06);
      const arc = Math.PI * (0.62 + promRng() * 0.6);
      const geo = new THREE.TorusGeometry(R, tube, 8, 44, arc);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.025 + promRng() * 0.04, 1.0, 0.6),
        transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI / 2 - arc / 2;        /* centre the apex on +Y */
      const holder = new THREE.Group();
      const dir = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(2 * promRng() - 1), promRng() * 6.2832);
      holder.position.copy(dir).multiplyScalar(sunDef.dispRad * 0.96);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      holder.rotateY(promRng() * 6.2832);             /* random tangential heading */
      holder.add(mesh);
      sunGroup.add(holder);
      sunProms.push({ mat, holder, base: 0.32 + promRng() * 0.3, phase: promRng() * 6.2832, freq: 0.5 + promRng() * 1.1 });
    }

    scene.add(sunGroup);
    registerBody(sunDef, sunGroup, sunMesh, null);

    /* lens flare: additive ghosts strung along the line from the Sun through the
       screen centre, plus an anamorphic streak. Positioned in screen space each
       frame and shown only when the Sun is in view and unobstructed. */
    const flareTex = TEX.spriteGlow('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
    flareSprites = [];
    const flareDefs = [
      { t: 1.00, size: 0.42, color: 0x9ec2ff, op: 0.32, streak: true },
      { t: 0.64, size: 0.05, color: 0xffd9a0, op: 0.30 },
      { t: 0.40, size: 0.10, color: 0x6fa8ff, op: 0.18 },
      { t: 0.18, size: 0.035, color: 0xfff0c8, op: 0.34 },
      { t: -0.22, size: 0.13, color: 0x9b7bff, op: 0.14 },
      { t: -0.46, size: 0.06, color: 0xffcaa0, op: 0.24 },
      { t: -0.72, size: 0.18, color: 0x6fd0ff, op: 0.12 },
      { t: -1.06, size: 0.08, color: 0xffe0b0, op: 0.20 }
    ];
    for (const fd of flareDefs) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flareTex, color: fd.color, transparent: true, depthWrite: false,
        depthTest: false, blending: THREE.AdditiveBlending, opacity: 0
      }));
      spr.renderOrder = 7;
      spr.visible = false;
      scene.add(spr);
      flareSprites.push({ spr, t: fd.t, size: fd.size, op: fd.op, streak: fd.streak });
    }

    /* planets & dwarfs */
    const helioDefs = DATA.bodies.filter(d => d.elements && (d.kind === 'planet' || d.kind === 'dwarf'));
    for (const def of helioDefs) {
      progress(`Forming ${def.name}…`);
      await tick();
      const group = new THREE.Group();
      const tiltG = new THREE.Group();
      tiltG.rotation.z = THREE.MathUtils.degToRad(def.tilt || 0);
      group.add(tiltG);

      let mesh, cloudMesh = null;
      if (def.special === 'earth') {
        /* day/night stay sRGB: r147 hardware-decodes them to linear in the shader,
           and the encodings_fragment include re-encodes our output like built-ins */
        const maps = TEX.texEarth();
        earthUniforms = {
          dayMap: { value: maps.day }, nightMap: { value: maps.night },
          specMap: { value: maps.spec }, heightMap: { value: maps.height },
          cloudMap: { value: maps.clouds }, sunDir: { value: new THREE.Vector3(1, 0, 0) },
          uTime: { value: 0 }, texel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) }
        };
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.dispRad, 64, 48),
          new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: earthUniforms })
        );
        cloudMesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.dispRad * 1.014, 48, 32),
          new THREE.MeshLambertMaterial({ color: 0xffffff, alphaMap: maps.clouds, transparent: true, depthWrite: false })
        );
        tiltG.add(cloudMesh);
      } else {
        const tex = TEX.registry[def.id] ? TEX.registry[def.id]() : null;
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.dispRad, def.kind === 'planet' ? 56 : 40, def.kind === 'planet' ? 40 : 28),
          new THREE.MeshLambertMaterial(tex ? { map: tex } : { color: def.color })
        );
      }
      tiltG.add(mesh);

      if (def.atmo) tiltG.add(makeAtmo(def.dispRad, def.atmo));

      if (def.rings === 'saturn') {
        const ringMat = new THREE.MeshLambertMaterial({
          map: TEX.texSaturnRings(), transparent: true, side: THREE.DoubleSide,
          depthWrite: false, alphaTest: 0.02, emissive: 0x2a2418
        });
        const ring = new THREE.Mesh(ringGeometry(def.dispRad * 1.24, def.dispRad * 2.27), ringMat);
        ring.rotation.x = -Math.PI / 2;
        tiltG.add(ring);
        /* ring world-rotation is constant (Rz(tilt) then Rx(-90)); cache its
           inverse so we can drop the world sun-direction into ring-local space */
        const tiltRad = THREE.MathUtils.degToRad(def.tilt || 0);
        const qWorld = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 0, 1), tiltRad)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
        ringShadow = { uni: applyRingShadow(ringMat, def.dispRad), invQ: qWorld.invert(), id: def.id };
      } else if (def.rings === 'uranus') {
        const ring = new THREE.Mesh(ringGeometry(def.dispRad * 1.55, def.dispRad * 2.05),
          new THREE.MeshLambertMaterial({
            map: TEX.texUranusRings(), transparent: true, side: THREE.DoubleSide,
            depthWrite: false, emissive: 0x1a2026
          }));
        ring.rotation.x = -Math.PI / 2;
        tiltG.add(ring);
      }

      scene.add(group);
      const rt = registerBody(def, group, mesh, null);
      rt.tiltG = tiltG;
      rt.spinMesh = mesh;
      rt.cloudMesh = cloudMesh;

      /* heliocentric orbit line */
      const pts = ORB.orbitPoints(def.elements, def.kind === 'dwarf' ? 360 : 280);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
        color: def.color, transparent: true, opacity: 0.28, depthWrite: false
      }));
      line.renderOrder = -5;
      scene.add(line);
      staticObjs.push(line);
      rt.orbitLine = line;
    }

    /* moons + ISS */
    progress('Carving the moons…');
    await tick();
    let mi = 0;
    for (const def of DATA.bodies.filter(d => d.orbit)) {
      mi++;
      if (mi % 5 === 0) { progress(`Carving the moons… (${def.name})`); await tick(); }
      const parentRt = byId[def.parent];
      const orbG = new THREE.Group();
      orbG.rotation.x = THREE.MathUtils.degToRad(def.orbit.incl || 0);
      orbG.rotation.y = NZ.hash2(mi, 3, 17) * Math.PI * 2;
      const host = (def.orbit.inTilt === false) ? parentRt.group : parentRt.tiltG;
      host.add(orbG);
      const group = new THREE.Group();
      orbG.add(group);

      let mesh;
      if (def.craft === 'iss') {
        mesh = modelISS();
        const rt0 = registerBody(def, group, null, parentRt);
        group.add(mesh);
        rt0.orbG = orbG;
        rt0.orbitR = parentRt.dispRad * def.orbit.distF;
        rt0.spinMesh = mesh;
        hitSphere(rt0, 0.1);
        parentRt.sysR = Math.max(parentRt.sysR, rt0.orbitR);
        const circle = moonCircle(rt0.orbitR, 0xffd166, 0.3);
        orbG.add(circle);
        rt0.moonLine = circle;
        continue;
      }

      if (def.lumpy) {
        mesh = new THREE.Mesh(lumpyGeometry(def.dispRad, 3, 31 + mi, 0.55),
          new THREE.MeshLambertMaterial({ map: TEX.registry.phobos() }));
      } else {
        const tex = TEX.registry[def.id] ? TEX.registry[def.id]() : null;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(def.dispRad, 36, 26),
          new THREE.MeshLambertMaterial(tex ? { map: tex } : { color: def.color }));
      }
      group.add(mesh);
      if (def.atmo) group.add(makeAtmo(def.dispRad, def.atmo));
      const rt = registerBody(def, group, mesh, parentRt);
      rt.orbG = orbG;
      rt.orbitR = parentRt.dispRad * def.orbit.distF;
      rt.spinMesh = mesh;
      if (def.plumes) buildFountain(rt, mesh, def, mi);
      parentRt.sysR = Math.max(parentRt.sysR, rt.orbitR);
      const circle = moonCircle(rt.orbitR, def.color, 0.22);
      orbG.add(circle);
      rt.moonLine = circle;
    }

    function moonCircle(r, color, opacity) {
      const n = 128;
      const pts = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        pts[k * 3] = Math.cos(a) * r;
        pts[k * 3 + 2] = -Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity, depthWrite: false
      }));
    }

    /* comets */
    progress('Releasing the comets…');
    await tick();
    for (const def of DATA.bodies.filter(d => d.kind === 'comet')) {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(lumpyGeometry(0.05, 2, 77 + comets.length, 0.8),
        new THREE.MeshLambertMaterial({ map: TEX.registry.comet() }));
      group.add(mesh);
      const coma = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX.spriteGlow('rgba(220,245,255,0.9)', 'rgba(150,200,255,0.4)'),
        color: 0xcfe8ff, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false
      }));
      coma.renderOrder = 4;
      coma.scale.set(0.3, 0.3, 1);
      group.add(coma);
      scene.add(group);
      const rt = registerBody(def, group, mesh, null);
      rt.spinMesh = mesh;
      hitSphere(rt, 0.5);

      const ion = makeTrail(420, 0.5, 0x66aaff);
      const dust = makeTrail(420, 0.85, 0xfff0cc);
      scene.add(ion.pts); scene.add(dust.pts);
      staticObjs.push(ion.pts, dust.pts);   /* identity transform; only geometry updates */
      comets.push({ rt, coma, ion, dust });

      const pts = ORB.orbitPoints(def.elements, 512);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
        color: 0x6699cc, transparent: true, opacity: 0.22, depthWrite: false
      }));
      line.renderOrder = -5;
      scene.add(line);
      staticObjs.push(line);
      rt.orbitLine = line;
    }

    /* deep-space probes + JWST */
    progress('Launching the spacecraft…');
    await tick();
    for (const def of DATA.bodies.filter(d => d.craft === 'probe' || d.craft === 'jwst')) {
      const group = new THREE.Group();
      const mesh = def.craft === 'jwst' ? modelJWST() : modelProbe();
      group.add(mesh);
      scene.add(group);
      const parentRt = def.parent ? byId[def.parent] : null;
      const rt = registerBody(def, group, null, parentRt);
      rt.model = mesh;
      hitSphere(rt, 0.08);
      if (def.craft === 'jwst' && parentRt) {
        parentRt.sysR = Math.max(parentRt.sysR, 2.8);
      }
      if (def.ray) {
        rt.rayDir = ORB.eclDir(def.ray.lon, def.ray.lat);
        /* faded approximate trajectory: out from the inner system, bending to the current line */
        const pts = [];
        const fr = [[1.1, -40, 0.05], [5.2, -19, 0.3], [9.6, -8, 0.6], [26, -2.5, 0.88], [70, -0.4, 0.99], [def.ray.r0, 0, 1], [240, 0, 1]];
        for (const [r, dl, lf] of fr) {
          pts.push(ORB.eclDir(def.ray.lon + dl, def.ray.lat * lf).multiplyScalar(r * DATA.AU));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220));
        const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
          color: 0xc9b06a, transparent: true, opacity: 0.22, depthWrite: false
        }));
        line.renderOrder = -5;
        scene.add(line);
        staticObjs.push(line);
        rt.orbitLine = line;
      } else if (def.elements) {
        /* a craft that orbits the Sun (e.g. Parker Solar Probe) gets a real
           heliocentric orbit line, like the planets */
        const pts = ORB.orbitPoints(def.elements, 256);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
          color: def.color, transparent: true, opacity: 0.32, depthWrite: false
        }));
        line.renderOrder = -5;
        scene.add(line);
        staticObjs.push(line);
        rt.orbitLine = line;
      }
    }

    /* asteroid belt */
    progress('Scattering the asteroid belt…');
    await tick();
    const N = 2300;
    const rockGeo = lumpyGeometry(1, 1, 99, 0.8);
    beltMesh = new THREE.InstancedMesh(rockGeo,
      new THREE.MeshLambertMaterial({ color: 0x9a8d7c }), N);
    beltMesh.frustumCulled = false;
    beltData = [];
    const brng = NZ.mulberry32(808);
    const bcol = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = 2.12 + Math.pow(brng(), 0.9) * 1.22;
      const incl = (brng() - 0.5) * 0.32;
      const phase = brng() * Math.PI * 2;
      const node = brng() * Math.PI * 2;
      beltData.push({
        R: a * DATA.AU,
        n: 2 * Math.PI / (365.25 * Math.pow(a, 1.5)),
        phase, incl, node,
        s: 0.02 + Math.pow(brng(), 2) * 0.075,
        tx: brng() * Math.PI * 2, ty: brng() * Math.PI * 2,
        tr: 0.1 + brng() * 0.6
      });
      const v = 0.65 + brng() * 0.5;
      bcol.setRGB(0.62 * v, 0.55 * v, 0.47 * v);
      beltMesh.setColorAt(i, bcol);
    }
    if (beltMesh.instanceColor) beltMesh.instanceColor.needsUpdate = true;
    scene.add(beltMesh);

    /* kuiper belt */
    progress('Freezing the Kuiper Belt…');
    await tick();
    const KN = 3400;
    const kpos = new Float32Array(KN * 3);
    const krng = NZ.mulberry32(909);
    for (let i = 0; i < KN; i++) {
      const a = (32 + Math.pow(krng(), 1.1) * 20) * DATA.AU;
      const ph = krng() * Math.PI * 2;
      const yy = (krng() + krng() + krng() - 1.5) * 0.09 * a;
      kpos[i * 3] = Math.cos(ph) * a;
      kpos[i * 3 + 1] = yy;
      kpos[i * 3 + 2] = -Math.sin(ph) * a;
    }
    const kgeo = new THREE.BufferGeometry();
    kgeo.setAttribute('position', new THREE.BufferAttribute(kpos, 3));
    kuiperPts = new THREE.Points(kgeo, new THREE.PointsMaterial({
      color: 0x8fa8cc, size: 1.7, sizeAttenuation: false, map: TEX.markerTex,
      transparent: true, opacity: 0.5, depthWrite: false
    }));
    scene.add(kuiperPts);

    /* region pseudo-bodies */
    for (const def of DATA.bodies.filter(d => d.kind === 'region')) {
      const group = new THREE.Group();
      group.position.set(def.view.pos[0] * DATA.AU, def.view.pos[1] * DATA.AU, def.view.pos[2] * DATA.AU);
      scene.add(group);
      const rt = registerBody(def, group, null, null);
      rt.dispRad = def.id === 'belt' ? 5 : 60;
      staticObjs.push(group);
    }

    /* galaxies — distant disks on the celestial sphere, facing the inner system */
    progress('Hanging the distant galaxies…');
    await tick();
    for (const def of DATA.bodies.filter(d => d.kind === 'galaxy')) {
      const group = new THREE.Group();
      const dir = ORB.eclDir(def.sky.lon, def.sky.lat);
      group.position.copy(dir).multiplyScalar(def.sky.dist);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(def.dispRad * 2, def.dispRad * 2),
        new THREE.MeshBasicMaterial({
          map: TEX.texGalaxy(def.galaxy), transparent: true, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
      const roll = def.galaxy.roll !== undefined ? def.galaxy.roll : NZ.hash2(def.id.length * 5, 7, 3) * 6.2832;
      plane.rotateZ(roll);
      plane.rotateX(THREE.MathUtils.degToRad(def.galaxy.incl || 0));
      group.add(plane);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX.spriteGlow('rgba(255,246,220,1)', 'rgba(255,222,166,0.5)'),
        color: 0xfff2d6, transparent: true, opacity: 0.85, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      core.scale.set(def.dispRad * 0.85, def.dispRad * 0.85, 1);
      group.add(core);
      scene.add(group);
      const rt = registerBody(def, group, plane, null);
      rt.galaxyPlane = plane;
      rt.galaxySpin = def.galaxy.spin || 0;
      hitSphere(rt, def.dispRad * 0.85);
      staticLocal.push(group);   /* fixed in the sky; only the disk plane spins */
    }

    /* famous stars — bright named suns on a distant celestial shell, placed
       by real RA/Dec so the constellations keep their true shapes */
    progress('Lighting the famous stars…');
    await tick();
    const STAR_SHELL = 6500;
    const starTex = TEX.spriteStar();
    for (const def of DATA.bodies.filter(d => d.kind === 'star' && d.id !== 'sun')) {
      const s = def.star;
      def.dispRad = NZ.clamp(26 - s.mag * 6, 7, 34);
      const group = new THREE.Group();
      group.position.copy(ORB.eclDir(s.ra, s.dec)).multiplyScalar(STAR_SHELL);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: starTex, color: new THREE.Color(s.spect || '#ffffff'), transparent: true,
        opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      const gs = def.dispRad * 2.4;
      glow.scale.set(gs, gs, 1);
      glow.renderOrder = 2;
      group.add(glow);
      scene.add(group);
      const rt = registerBody(def, group, null, null);
      rt.starGlow = glow;
      hitSphere(rt, def.dispRad * 1.5);
      staticObjs.push(group);
    }

    /* constellation lines tracing Orion and the Big Dipper */
    for (const con of (DATA.constellations || [])) {
      const verts = [];
      for (const [a, b] of con.pairs) {
        const A = byId[a], B = byId[b];
        if (!A || !B) continue;
        verts.push(A.group.position.x, A.group.position.y, A.group.position.z,
          B.group.position.x, B.group.position.y, B.group.position.z);
      }
      if (!verts.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color: 0x8fb0e0, transparent: true, opacity: 0.16, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      line.renderOrder = -7;
      line.frustumCulled = false;
      scene.add(line);
      staticObjs.push(line);
    }

    /* black holes — event horizon shadow + swirling accretion disk + photon ring */
    progress('Warping spacetime…');
    await tick();
    bhDisks = [];
    const ringTex = TEX.texPhotonRing();
    for (const def of DATA.bodies.filter(d => d.kind === 'blackhole')) {
      const bh = def.bh;
      const group = new THREE.Group();
      group.position.copy(ORB.eclDir(bh.ra, bh.dec)).multiplyScalar(bh.dist);
      const Rsh = def.dispRad * 0.5;
      const horizon = new THREE.Mesh(new THREE.SphereGeometry(Rsh, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000 }));
      horizon.renderOrder = 1;
      group.add(horizon);
      const uni = { uTime: { value: 0 }, uInner: { value: Rsh * 1.25 }, uOuter: { value: Rsh * 4.2 } };
      const disk = new THREE.Mesh(
        new THREE.RingGeometry(Rsh * 1.25, Rsh * 4.2, 160, 8),
        new THREE.ShaderMaterial({
          vertexShader: BH_VERT, fragmentShader: BH_FRAG, uniforms: uni,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        })
      );
      disk.rotation.x = THREE.MathUtils.degToRad(bh.tilt || 72);
      disk.rotation.z = NZ.hash2(def.id.length * 3, 5, 2) * 6.2832;
      disk.renderOrder = 2;
      group.add(disk);
      bhDisks.push(uni);
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTex, color: new THREE.Color(bh.disk || '#ffd0a0'), transparent: true,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.95
      }));
      ring.scale.set(Rsh * 3.0, Rsh * 3.0, 1);
      ring.renderOrder = 3;
      group.add(ring);
      scene.add(group);
      const rt = registerBody(def, group, horizon, null);
      hitSphere(rt, def.dispRad);
      staticObjs.push(group);   /* disk swirl is shader-driven, not transform-driven */
    }

    /* nebulae — glowing clouds of gas and newborn (or dead) stars */
    for (const def of DATA.bodies.filter(d => d.kind === 'nebula')) {
      const group = new THREE.Group();
      group.position.copy(ORB.eclDir(def.neb.ra, def.neb.dec)).multiplyScalar(def.neb.dist);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX.texNebula(def.neb), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.95
      }));
      const sz = def.dispRad * 2.4;
      spr.scale.set(sz, sz, 1);
      group.add(spr);
      scene.add(group);
      const rt = registerBody(def, group, null, null);
      hitSphere(rt, def.dispRad);
      staticObjs.push(group);
    }

    /* freeze the static set: bake their world matrices once and stop them from
       being touched by every frame's scene-graph traversal */
    for (const o of staticObjs) {
      o.updateMatrixWorld(true);
      o.matrixAutoUpdate = false;
      o.matrixWorldAutoUpdate = false;
    }
    for (const o of staticLocal) {
      o.updateMatrix();          /* bake local transform from its position */
      o.matrixAutoUpdate = false; /* keep matrixWorldAutoUpdate so children animate */
    }

    /* cache the fixed (sky-pinned) bodies' world positions once; the per-frame
       loop then only recomputes movers */
    root.updateMatrixWorld();
    for (const b of bodies) if (b.fixed) b.wp.setFromMatrixPosition(b.group.matrixWorld);

    progress('Ready');
  }

  /* ---------- per-frame ---------- */

  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _m = new THREE.Object3D();
  const _vm1 = new THREE.Vector3(), _vm2 = new THREE.Vector3();

  function updateMeteors(dt) {
    const camPos = camRef.position;
    for (const m of meteors) {
      if (!m.active) {
        m.delay -= dt;
        if (m.delay > 0) continue;
        const dir = _vm1.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
        dir.normalize();
        const dist = 1400 + Math.random() * 3200;
        m.pos.copy(camPos).addScaledVector(dir, dist);
        const vdir = _vm2.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        vdir.addScaledVector(dir, -vdir.dot(dir));            /* tangential to the line of sight */
        if (vdir.lengthSq() < 1e-4) vdir.set(dir.y, -dir.x, 0);
        vdir.normalize();
        m.vel.copy(vdir).multiplyScalar(dist * (1.0 + Math.random() * 1.4));
        m.len = dist * (0.08 + Math.random() * 0.06);
        m.life = 0.5 + Math.random() * 0.7;
        m.age = 0; m.active = true;
        const warm = Math.random();
        m.color.setRGB(warm < 0.7 ? 0.8 : 1.0, 0.92, warm < 0.7 ? 1.0 : 0.72);
        m.line.visible = true;
      }
      m.age += dt;
      if (m.age >= m.life) {
        m.active = false; m.line.visible = false;
        m.delay = 2.5 + Math.random() * 9;
        continue;
      }
      m.pos.addScaledVector(m.vel, dt);
      const f = 1 - m.age / m.life;
      const tail = _vm1.copy(m.vel).normalize().multiplyScalar(-m.len * f);
      const p = m.line.geometry.attributes.position.array;
      const c = m.line.geometry.attributes.color.array;
      p[0] = m.pos.x; p[1] = m.pos.y; p[2] = m.pos.z;
      p[3] = m.pos.x + tail.x; p[4] = m.pos.y + tail.y; p[5] = m.pos.z + tail.z;
      const b = f * f;
      c[0] = m.color.r * b; c[1] = m.color.g * b; c[2] = m.color.b * b;
      m.line.geometry.attributes.position.needsUpdate = true;
      m.line.geometry.attributes.color.needsUpdate = true;
    }
  }

  function update(simJD, dtReal, timeScale) {
    const simDays = simJD - ORB.J2000;

    for (const b of bodies) {
      const def = b.def;
      if (b.fixed) {
        /* pinned to the sky: only a spinning galaxy disk still needs a nudge */
        if (def.kind === 'galaxy' && b.galaxySpin) b.galaxyPlane.rotateZ(b.galaxySpin * dtReal);
        continue;
      }
      if (def.elements) ORB.helioPos(def.elements, simJD, b.group.position);
      if (def.rotH && b.spinMesh && !def.sync) {
        b.spinMesh.rotation.y = 2 * Math.PI * simDays * 24 / def.rotH;
      }
      if (b.cloudMesh) b.cloudMesh.rotation.y = 2 * Math.PI * simDays * 24 / (def.rotH * 1.18) + 2;
      if (def.orbit) {
        const dir = def.retro ? -1 : 1;
        const ang = 2 * Math.PI * (simDays / def.orbit.periodD) * dir + NZ.hash2(def.id.length * 7, 11, 5) * 6.28;
        b.group.position.set(Math.cos(ang) * b.orbitR, 0, -Math.sin(ang) * b.orbitR);
        if (def.sync && b.spinMesh) b.spinMesh.rotation.y = ang + Math.PI;
        if (def.craft === 'iss') b.spinMesh.rotation.y = ang;
      }
      if (def.craft === 'jwst') {
        const earth = byId.earth;
        _v1.copy(earth.group.position);
        _v2.copy(_v1).normalize();
        b.group.position.copy(_v1).addScaledVector(_v2, 2.8);
        b.group.position.y += Math.sin(simDays * 0.035) * 0.2;
        b.model.lookAt(0, 0, 0);
      }
      if (def.ray) {
        const yrs = (simJD - def.ray.jd0) / 365.25;
        const r = Math.max(8, def.ray.r0 + def.ray.rate * yrs);
        b.group.position.copy(b.rayDir).multiplyScalar(r * DATA.AU);
        b.model.lookAt(0, 0, 0);
      }
    }

    /* sun surface + glow flicker */
    sunUniforms.uTime.value += dtReal;
    const sunT = sunUniforms.uTime.value;
    const pulse = 1 + Math.sin(sunT * 1.7) * 0.012;
    sunCore.scale.set(26 * pulse, 26 * pulse, 1);

    /* prominences flicker/breathe; twinkling stars + shooting stars advance */
    for (const pr of sunProms) {
      const flick = pr.base * (0.5 + 0.5 * Math.sin(sunT * pr.freq + pr.phase))
        + 0.14 * Math.max(0, Math.sin(sunT * pr.freq * 0.37 + pr.phase));
      pr.mat.opacity = Math.max(0.04, flick);
      pr.holder.scale.setScalar(1 + 0.1 * Math.sin(sunT * pr.freq * 0.8 + pr.phase));
    }
    starTwinkle.value = sunT;
    for (const u of bhDisks) u.uTime.value = sunT;
    updateMeteors(dtReal);

    /* earth day/night terminator + animated clouds/auroras */
    if (earthUniforms) {
      earthUniforms.sunDir.value.copy(byId.earth.group.position).negate().normalize();
      earthUniforms.uTime.value = sunUniforms.uTime.value;
    }

    /* Saturn's shadow on its rings: shadow axis points away from the Sun, in
       the ring's local frame */
    if (ringShadow) {
      _v1.copy(byId[ringShadow.id].group.position).negate().normalize().applyQuaternion(ringShadow.invQ);
      ringShadow.uni.uSunLocal.value.copy(_v1);
    }

    /* comets */
    for (const c of comets) {
      const p = c.rt.group.position;
      const rAU = p.length() / DATA.AU;
      const act = Math.pow(NZ.clamp((4.6 - rAU) / 3.8, 0, 1), 1.4);
      const cs = 0.14 + act * 3.2;
      c.coma.scale.set(cs, cs, 1);
      c.coma.material.opacity = 0.12 + act * 0.75;
      if (act > 0.01) {
        const sunDir = _v1.copy(p).normalize();
        const tangent = _v2.set(-p.z, 0, p.x).normalize();
        c.ion.acc += act * 110 * dtReal;
        c.dust.acc += act * 70 * dtReal;
        const ionN = Math.floor(c.ion.acc); c.ion.acc -= ionN;
        const dustN = Math.floor(c.dust.acc); c.dust.acc -= dustN;
        trailSpawn(c.ion, p, sunDir, 0.12, 5.5 * (0.4 + act), 2.4, ionN, null, 0);
        trailSpawn(c.dust, p, sunDir, 0.2, 1.8 * (0.4 + act), 4.6, dustN, tangent, 0.35);
      }
      trailUpdate(c.ion, dtReal);
      trailUpdate(c.dust, dtReal);
    }

    /* asteroid belt + Kuiper Belt — rebuilding 2300 instance matrices is the
       heaviest CPU step, so only do it when sim time actually advanced (skips it
       entirely whenever time is paused) */
    if (simDays !== lastBeltDays) {
      lastBeltDays = simDays;
      for (let i = 0; i < beltData.length; i++) {
        const a = beltData[i];
        const ang = a.phase + a.n * simDays;
        const x0 = Math.cos(ang) * a.R, z0 = -Math.sin(ang) * a.R;
        const y = Math.sin(ang + a.node) * a.incl * a.R * 0.5;
        _m.position.set(x0, y, z0);
        _m.rotation.set(a.tx + simDays * a.tr * 0.2, a.ty + simDays * a.tr * 0.13, 0);
        _m.scale.setScalar(a.s);
        _m.updateMatrix();
        beltMesh.setMatrixAt(i, _m.matrix);
      }
      beltMesh.instanceMatrix.needsUpdate = true;
      kuiperPts.rotation.y = simDays * 2 * Math.PI / (365.25 * 270);
    }

    /* cache world positions — non-forced so the frozen static subtrees (galaxies,
       stars, nebulae, orbit lines, sky) are skipped; movers still propagate via
       their dirty flags */
    root.updateMatrixWorld();
    for (const b of bodies) if (!b.fixed) b.wp.setFromMatrixPosition(b.group.matrixWorld);

    /* surface eruptions: only stir the particles when the camera is close enough
       to actually see them (they're tiny specks from across a planet's system) */
    for (const f of fountains) {
      const close = camRef.position.distanceTo(f.rt.wp) < Math.max(8, f.rt.dispRad * 90);
      f.sys.pts.visible = close;
      if (close) fountainStep(f.sys, dtReal);
    }
  }

  /* ---------- view-dependent: markers, labels, fades ---------- */

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3(), _up = new THREE.Vector3();
  const placed = [];

  function updateView(camera, selected, showLabels, showOrbits, w, h) {
    camera.getWorldDirection(_fwd);
    const camPos = camera.position;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    placed.length = 0;
    const candidates = [];

    /* sun corona occlusion + distance scaling */
    const sunDist = camPos.length();
    const coronaScale = Math.max(46, sunDist * 0.085);
    sunCorona.scale.set(coronaScale, coronaScale, 1);
    let occluded = false;
    if (sunDist > 12) {
      /* analytic ray-vs-sphere test toward the Sun — far cheaper than raycasting
         the full-resolution planet meshes every frame, and visually identical */
      const dir = _v1.copy(byId.sun.wp).sub(camPos);
      const sunRay = dir.length();
      dir.multiplyScalar(1 / sunRay);
      const maxT = sunRay - 4;
      for (const b of bodies) {
        if (b.def.kind !== 'planet') continue;
        const oc = _v2.copy(b.wp).sub(camPos);
        const t = oc.dot(dir);
        if (t <= 0 || t >= maxT) continue;
        if (oc.lengthSq() - t * t < b.dispRad * b.dispRad) { occluded = true; break; }
      }
    }
    sunCorona.material.opacity = occluded ? 0 : 0.9;
    sunCore.material.opacity = occluded ? 0 : 0.95;

    for (const b of bodies) {
      if (!b.marker && !b.labelEl) continue;
      const dist = camPos.distanceTo(b.wp);
      const meshPx = b.dispRad / (Math.max(dist, 0.001) * tanHalf) * (h / 2);

      /* children only shown near their parent system (or when selected) */
      let sysVis = true;
      if (b.parent) {
        const pd = camPos.distanceTo(b.parent.wp);
        const thresh = b.parent.sysR * 6 + b.parent.dispRad * 10;
        sysVis = pd < thresh || selected === b;
        if (b.moonLine) b.moonLine.visible = sysVis && showOrbits;
      }

      const inFront = _v1.copy(b.wp).sub(camPos).dot(_fwd) > 0;

      if (b.marker) {
        const mScale = dist * (b.def.kind === 'planet' || b.def.kind === 'star' ? 0.011 : 0.008);
        b.marker.scale.set(mScale, mScale, 1);
        let op = NZ.clamp((11 - meshPx) / 8, 0, 1) * 0.85;
        if (!sysVis) op = 0;
        if (b.def.kind === 'star' || b.def.kind === 'galaxy'
          || b.def.kind === 'blackhole' || b.def.kind === 'nebula') op = 0;
        b.marker.material.opacity = op;
        b.marker.visible = op > 0.02;
      }

      if (b.labelEl) {
        let show = showLabels && sysVis && inFront && meshPx < h * 0.45;
        if (b.def.kind === 'star' && dist < 40) show = false;
        if (show) {
          _v1.copy(b.wp).project(camera);
          if (_v1.x > -1.15 && _v1.x < 1.15 && _v1.y > -1.15 && _v1.y < 1.15) {
            const sx = (_v1.x * 0.5 + 0.5) * w;
            const sy = (-_v1.y * 0.5 + 0.5) * h - Math.max(10, meshPx * 0.85) - 6;
            let pri = 30;
            if (b.def.kind === 'star') pri = b.def.id === 'sun' ? 95 : 52;
            else if (b.def.kind === 'blackhole') pri = 58;
            else if (b.def.kind === 'nebula') pri = 46;
            else if (b.def.kind === 'galaxy') pri = 48;
            else if (b.def.kind === 'planet') pri = 60 + b.dispRad;
            else if (b.def.kind === 'dwarf') pri = 40;
            else if (b.def.kind === 'comet') pri = 36;
            else if (b.def.kind === 'craft') pri = 34;
            if (selected === b) pri = 200;
            candidates.push({ b, sx, sy, pri });
            show = false; /* applied after declutter */
          } else show = false;
        }
        if (!show) b.labelEl.style.display = 'none';
        b._labelPending = false;
      }

      if (b.orbitLine && !b.parent) {
        const isSel = selected === b;
        const near = dist < b.dispRad * 14;
        b.orbitLine.visible = showOrbits && !near;
        if (b.orbitLine.material) {
          b.orbitLine.material.opacity = isSel ? 0.5 : (b.def.kind === 'comet' ? 0.2 : 0.26);
        }
      }
    }

    /* greedy declutter, high priority first */
    candidates.sort((a, b) => b.pri - a.pri);
    for (const c of candidates) {
      let ok = true;
      for (const p of placed) {
        if (Math.abs(c.sx - p.sx) < 86 && Math.abs(c.sy - p.sy) < 20) { ok = false; break; }
      }
      if (!ok) { c.b.labelEl.style.display = 'none'; continue; }
      placed.push(c);
      const el = c.b.labelEl;
      el.style.display = 'block';
      el.style.transform = `translate(-50%,-100%) translate(${c.sx.toFixed(1)}px,${c.sy.toFixed(1)}px)`;
      el.classList.toggle('selected', selected === c.b);
    }

    /* lens flare: ghosts along the Sun -> screen-centre line, fading as the Sun
       drifts off-centre, hidden when it's behind us or blocked by a planet */
    if (flareSprites.length) {
      const inFrontSun = _v2.copy(byId.sun.wp).sub(camPos).dot(_fwd) > 0;
      _v1.copy(byId.sun.wp).project(camera);
      const onScreen = inFrontSun && Math.abs(_v1.x) < 1.5 && Math.abs(_v1.y) < 1.5;
      const off = Math.hypot(_v1.x, _v1.y);
      const intensity = onScreen && !occluded ? NZ.clamp(1.15 - off * 0.7, 0, 1) : 0;
      if (intensity > 0.01) {
        _right.setFromMatrixColumn(camera.matrixWorld, 0);
        _up.setFromMatrixColumn(camera.matrixWorld, 1);
        const D = 30, halfH = D * tanHalf, halfW = halfH * (w / h);
        for (const f of flareSprites) {
          f.spr.position.copy(camPos)
            .addScaledVector(_fwd, D)
            .addScaledVector(_right, _v1.x * f.t * halfW)
            .addScaledVector(_up, _v1.y * f.t * halfH);
          const sz = f.size * halfH * 2;
          if (f.streak) f.spr.scale.set(sz * 4.5, sz * 0.16, 1);
          else f.spr.scale.set(sz, sz, 1);
          f.spr.material.opacity = f.op * intensity;
          f.spr.visible = true;
        }
      } else {
        for (const f of flareSprites) f.spr.visible = false;
      }
    }
  }

  /* screen-space pick fallback: nearest labelled body within px radius */
  function screenPick(x, y, camera, w, h) {
    let best = null, bestD = 26;
    for (const b of bodies) {
      if (b.def.kind === 'region') continue;
      if (b.marker && !b.marker.visible && b.labelEl.style.display === 'none') {
        /* still allow planets/sun when mesh is big on screen */
        const dist = camera.position.distanceTo(b.wp);
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const meshPx = b.dispRad / (Math.max(dist, 0.001) * tanHalf) * (h / 2);
        if (meshPx < 6) continue;
      }
      _v1.copy(b.wp).sub(camera.position);
      camera.getWorldDirection(_v2);
      if (_v1.dot(_v2) <= 0) continue;
      _v1.copy(b.wp).project(camera);
      const sx = (_v1.x * 0.5 + 0.5) * w, sy = (-_v1.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function raycastPick(ndc, camera) {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickMeshes, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.bodyId) o = o.parent;
      if (o) return byId[o.userData.bodyId];
    }
    return null;
  }

  return {
    build, update, updateView, screenPick, raycastPick,
    bodies, byId,
    onSelect: null
  };
})();
