/* Procedural texture generation for every body — no image files needed.
   All maps are equirectangular canvases turned into THREE.CanvasTexture. */
const TEX = (function () {
  const { fbm2, rfbm2, fbm3, mulberry32, clamp, lerp, smoothstep, palette } = NZ;

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return { cv, ctx: cv.getContext('2d') };
  }

  let maxAniso = 4;
  function setAniso(a) { maxAniso = a; }

  function toTexture(cv, srgb) {
    const t = new THREE.CanvasTexture(cv);
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    return t;
  }

  /* Per-pixel pass over an equirect canvas. fn(lonFrac 0..1, latRad -pi/2..pi/2, gx, gy) -> [r,g,b] */
  function pixelPass(w, h, gridW, fn) {
    const { cv, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const gridH = gridW / 2;
    for (let y = 0; y < h; y++) {
      const lat = (0.5 - y / h) * Math.PI;
      const gy = y / h * gridH;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const c = fn(x / w, lat, x / w * gridW, gy);
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv, ctx };
  }

  /* Craters drawn as soft radial gradients; horizontally wrapped, stretched near poles */
  function drawCraters(ctx, w, h, count, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed);
    const rMin = opts.rMin || 1.5, rMax = opts.rMax || w * 0.022;
    const dark = opts.dark === undefined ? 0.30 : opts.dark;
    const rim = opts.rim === undefined ? 0.16 : opts.rim;
    for (let i = 0; i < count; i++) {
      const u = rng();
      const lat = Math.asin(2 * rng() - 1);
      const x = u * w;
      const y = (0.5 - lat / Math.PI) * h;
      const r = rMin + Math.pow(rng(), 2.6) * (rMax - rMin);
      const sx = 1 / Math.max(0.3, Math.cos(lat));
      for (const ox of [-w, 0, w]) {
        ctx.save();
        ctx.translate(x + ox, y);
        ctx.scale(sx, 1);
        const g = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
        g.addColorStop(0, `rgba(0,0,0,${dark})`);
        g.addColorStop(0.68, `rgba(0,0,0,${dark * 0.35})`);
        g.addColorStop(0.8, `rgba(255,255,255,${rim})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
  }

  function blotches(ctx, w, h, count, seed, colors, rMinF, rMaxF, alpha) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const x = rng() * w, y = (0.12 + 0.76 * rng()) * h;
      const r = (rMinF + rng() * (rMaxF - rMinF)) * w;
      const col = colors[(rng() * colors.length) | 0];
      for (const ox of [-w, 0, w]) {
        const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        g.addColorStop(0, col + Math.round((alpha) * 255).toString(16).padStart(2, '0'));
        g.addColorStop(1, col + '00');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
  }

  /* ---------- individual bodies ---------- */

  function texSun() {
    /* static fallback face for the sun mesh; real surface is a shader */
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 2, gy * 2, 4, 16, 991);
      const v = 0.75 + n * 0.25;
      return [255 * v, 200 * v, 90 * v];
    });
    return toTexture(cv);
  }

  function texMercury() {
    const pal = palette([[0, '#5d5851'], [0.45, '#8a847a'], [0.75, '#9b958b'], [1, '#b0a99e']]);
    const { cv, ctx } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx, gy, 5, 8, 31);
      const m = fbm2(gx * 3 + 7, gy * 3, 4, 24, 77);
      return pal(clamp(n * 0.8 + m * 0.25, 0, 1));
    });
    drawCraters(ctx, 1024, 512, 270, 12, { rMax: 20 });
    drawCraters(ctx, 1024, 512, 8, 13, { rMin: 18, rMax: 34, dark: 0.22, rim: 0.12 });
    return toTexture(cv);
  }

  function texVenus() {
    const pal = palette([[0, '#b88a4a'], [0.3, '#d8b176'], [0.55, '#e8cf9d'], [0.78, '#f0dfb5'], [1, '#cda05f']]);
    const { cv } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const q = fbm2(gx * 1.2 + 11, gy * 1.2, 4, 9.6, 41);
      /* diagonal shear gives the chevron cloud pattern of Venus */
      const t = fbm2(gx * 1.5 + (gy - 2) * 1.4 + q * 2.5, gy * 4 + q, 5, 12, 42);
      return pal(clamp(t, 0, 1));
    });
    return toTexture(cv);
  }

  /* Coarse real-world continent mask, 96×48 equirect cells (north→south rows).
     Each row lists [colStart,colEnd] land spans; col 0 = 180°W, col 48 = 0°,
     so the map reads Pacific · Americas · Atlantic · Africa/Europe · Asia ·
     Australia. Bilinear-sampled then domain-warped into detailed coastlines. */
  const EARTH_LAND = [
    [], [],
    [[18, 28], [30, 40], [60, 80]],
    [[14, 30], [29, 42], [50, 52], [58, 85]],
    [[8, 32], [30, 43], [48, 90]],
    [[0, 6], [8, 34], [31, 44], [46, 92]],
    [[0, 7], [8, 36], [32, 45], [46, 94]],
    [[0, 8], [9, 37], [34, 44], [45, 95]],
    [[1, 9], [9, 38], [35, 43], [46, 95]],
    [[2, 9], [8, 39], [44, 60], [60, 95]],
    [[7, 40], [44, 66], [66, 95]],
    [[6, 41], [45, 68], [66, 95]],
    [[6, 42], [46, 70], [70, 95]],
    [[7, 42], [46, 74], [74, 95]],
    [[8, 42], [45, 50], [52, 95]],
    [[9, 41], [44, 62], [62, 95]],
    [[11, 40], [43, 66], [60, 95]],
    [[13, 39], [42, 68], [60, 95]],
    [[14, 37], [41, 70], [67, 90]],
    [[16, 34], [40, 72], [67, 92]],
    [[17, 30], [38, 74], [80, 92]],
    [[18, 28], [37, 76], [82, 92]],
    [[24, 36], [38, 74], [84, 92]],
    [[23, 38], [40, 70], [80, 93]],
    [[22, 39], [42, 66], [80, 94]],
    [[21, 40], [44, 64], [82, 92]],
    [[22, 41], [45, 63], [84, 93]],
    [[23, 41], [46, 62], [84, 90]],
    [[24, 41], [47, 60], [82, 91]],
    [[25, 40], [48, 59], [80, 92]],
    [[26, 40], [49, 58], [80, 92]],
    [[27, 39], [50, 57], [80, 91]],
    [[28, 38], [51, 56], [81, 90]],
    [[29, 37], [52, 55], [83, 89], [92, 94]],
    [[30, 36], [84, 88], [92, 94]],
    [[31, 35], [92, 94]],
    [[31, 34]], [[31, 33]], [[31, 33]], [[31, 32]],
    [],
    [[28, 32]],
    [[0, 95]], [[0, 95]], [[0, 95]], [[0, 95]], [[0, 95]], [[0, 95]]
  ];

  function texEarth() {
    const W = 2048, H = 1024, seed = 7;
    const GW = 96, GH = 48;
    const land = new Float32Array(GW * GH);
    for (let r = 0; r < GH; r++) {
      for (const [c0, c1] of (EARTH_LAND[r] || [])) {
        for (let c = c0; c <= c1; c++) land[r * GW + ((c % GW) + GW) % GW] = 1;
      }
    }
    function landAt(u, v) {
      const fx = u * GW - 0.5, fy = v * GH - 0.5;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const yA = clamp(y0, 0, GH - 1), yB = clamp(y0 + 1, 0, GH - 1);
      const xA = ((x0 % GW) + GW) % GW, xB = (((x0 + 1) % GW) + GW) % GW;
      const a = land[yA * GW + xA], b = land[yA * GW + xB];
      const c = land[yB * GW + xA], d = land[yB * GW + xB];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }

    const day = makeCanvas(W, H), night = makeCanvas(W, H);
    const spec = makeCanvas(W, H), height = makeCanvas(W, H);
    const di = day.ctx.createImageData(W, H), si = spec.ctx.createImageData(W, H);
    const hi = height.ctx.createImageData(W, H);
    const dd = di.data, sd = si.data, hd = hi.data;
    const lights = [];
    const rngL = mulberry32(99);

    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      const absLat = Math.abs(lat), latDeg = absLat * 57.2958;
      const v = y / H, gy = v * 6;
      for (let x = 0; x < W; x++) {
        const u = x / W, gx = u * 12;
        /* warp the coarse mask so coastlines turn fractal, not blocky */
        const wx = fbm2(gx * 0.9 + 11, gy * 0.9 + 3, 3, 12, seed + 1) - 0.5;
        const wy = fbm2(gx * 0.9 + 31, gy * 0.9 + 7, 3, 12, seed + 2) - 0.5;
        const cn = fbm2(gx * 2.2, gy * 2.2, 5, 26, seed + 5);
        let e = landAt(u + wx * 0.028, clamp(v + wy * 0.018, 0, 1));
        e = clamp(e + (cn - 0.5) * 0.36, 0, 1);
        const isLand = e > 0.5;
        const detail = fbm2(gx * 4, gy * 4, 4, 48, seed + 7);
        const i = (y * W + x) * 4;
        let r, g, b, sv, hv;

        if (isLand && (absLat > 1.20 + (cn - 0.5) * 0.12 || (latDeg > 62 && e > 0.6))) {
          /* ice sheets: Antarctica, Greenland, high-Arctic land */
          const w = 232 + detail * 22; r = w; g = w + 2; b = w + 8; sv = 60; hv = 150 + e * 60;
        } else if (isLand) {
          const mtn = fbm2(gx * 3 + 5, gy * 3 + 2, 4, 36, seed + 9);
          const mountain = e > 0.62 && mtn > 0.60;
          const desert = latDeg > 14 && latDeg < 34 && detail > 0.42 && cn < 0.62;
          const cold = latDeg > 50;
          const elevH = clamp((e - 0.5) * 2, 0, 1);
          if (mountain) {
            const m = (mtn - 0.6) * 700;
            r = 130 + m + detail * 26; g = 120 + m + detail * 22; b = 104 + m + detail * 20;
            hv = 180 + elevH * 60 + mtn * 30;
          } else if (desert) {
            r = 192 + detail * 34; g = 160 + detail * 28; b = 104 + detail * 20; hv = 120 + elevH * 40;
          } else if (cold) {
            r = 70 + detail * 26; g = 92 + detail * 30; b = 58 + detail * 20; hv = 116 + elevH * 40;
          } else {
            r = 58 + detail * 40; g = 110 + detail * 44; b = 50 + detail * 26; hv = 116 + elevH * 50;
          }
          sv = 8;
          /* city lights weighted to temperate, low, non-desert land */
          const popLat = Math.exp(-Math.pow((lat - 0.78) / 0.5, 2));
          let w = 0.020 * popLat;
          if (desert || mountain) w *= 0.25;
          if (latDeg > 66) w *= 0.08;
          if (rngL() < w) lights.push([x, y]);
        } else {
          /* ocean: turquoise shelves over a darkening abyss, polar sea ice */
          const shelf = clamp((e - 0.34) * 5, 0, 1);
          const depth = clamp(cn * 0.55 + (1 - shelf) * 0.45, 0, 1);
          if (shelf > 0.55) { r = 46 + 52 * shelf; g = 120 + 52 * shelf; b = 160 + 30 * shelf; }
          else { r = lerp(28, 9, depth); g = lerp(80, 36, depth); b = lerp(152, 96, depth); }
          if (absLat > 1.30) {
            const k = smoothstep(1.30, 1.42, absLat) * (0.6 + detail * 0.4);
            r = lerp(r, 236, k); g = lerp(g, 240, k); b = lerp(b, 246, k);
          }
          sv = 255; hv = 64 - depth * 44;
        }
        dd[i] = r; dd[i + 1] = g; dd[i + 2] = b; dd[i + 3] = 255;
        sd[i] = sv; sd[i + 1] = sv; sd[i + 2] = sv; sd[i + 3] = 255;
        hd[i] = hv; hd[i + 1] = hv; hd[i + 2] = hv; hd[i + 3] = 255;
      }
    }
    day.ctx.putImageData(di, 0, 0);
    spec.ctx.putImageData(si, 0, 0);
    height.ctx.putImageData(hi, 0, 0);

    /* night side city lights clustered around sampled population points */
    night.ctx.fillStyle = '#000000';
    night.ctx.fillRect(0, 0, W, H);
    const rng = mulberry32(123);
    for (const [cx, cy] of lights) {
      const cluster = 2 + (rng() * 8) | 0;
      for (let k = 0; k < cluster; k++) {
        const x = cx + (rng() - 0.5) * 24, yy = cy + (rng() - 0.5) * 13;
        const rr = 0.6 + rng() * 1.7;
        const g = night.ctx.createRadialGradient(x, yy, 0, x, yy, rr * 2.6);
        g.addColorStop(0, 'rgba(255,216,150,0.95)');
        g.addColorStop(1, 'rgba(255,180,90,0)');
        night.ctx.fillStyle = g;
        night.ctx.fillRect(x - rr * 3, yy - rr * 3, rr * 6, rr * 6);
      }
    }

    /* clouds: ridged fbm with equatorial + mid-latitude storm banding */
    const cl = makeCanvas(W, H);
    const ci = cl.ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      const gy = y / H * 5;
      const band = 0.74 + 0.5 * Math.cos(lat * 2.2) * Math.cos(lat * 2.2) + 0.18 * Math.cos(lat * 6);
      for (let x = 0; x < W; x++) {
        const gx = x / W * 10;
        const q = fbm2(gx + 3.1, gy + 6.4, 3, 10, 201);
        const c = rfbm2(gx * 1.6 + 2.2 * (q - 0.5), gy * 1.6 + 13, 5, 16, 202);
        const a = smoothstep(0.42, 0.78, c * band) * 240;
        const i = (y * W + x) * 4;
        ci.data[i] = a; ci.data[i + 1] = a; ci.data[i + 2] = a; ci.data[i + 3] = 255;
      }
    }
    cl.ctx.putImageData(ci, 0, 0);

    return {
      day: toTexture(day.cv),
      night: toTexture(night.cv),
      spec: toTexture(spec.cv, false),
      height: toTexture(height.cv, false),
      clouds: toTexture(cl.cv, false)
    };
  }

  function texMars() {
    const pal = palette([[0, '#6e3520'], [0.35, '#a3522c'], [0.6, '#c4703f'], [0.8, '#d98e5e'], [1, '#e8b287']]);
    const { cv, ctx } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx, gy, 6, 8, 19);
      const dark = fbm2(gx * 0.8 + 4, gy * 0.8 + 2, 3, 6.4, 23);
      let c = pal(clamp(n, 0, 1));
      if (dark > 0.62) {
        const k = smoothstep(0.62, 0.75, dark) * 0.55;
        c = [c[0] * (1 - k) + 60 * k, c[1] * (1 - k) + 36 * k, c[2] * (1 - k) + 26 * k];
      }
      const absLat = Math.abs(lat);
      if (absLat > 1.32 + (n - 0.5) * 0.1) {
        const k = smoothstep(1.32, 1.42, absLat);
        c = [lerp(c[0], 245, k), lerp(c[1], 240, k), lerp(c[2], 235, k)];
      }
      return c;
    });
    drawCraters(ctx, 1024, 512, 130, 5, { rMax: 12, dark: 0.18, rim: 0.1 });
    /* Valles Marineris scar + Tharsis volcano spots */
    ctx.save();
    ctx.strokeStyle = 'rgba(40,18,10,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(240, 282); ctx.quadraticCurveTo(310, 290, 392, 276);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(40,18,10,0.4)';
    ctx.beginPath(); ctx.moveTo(252, 290); ctx.quadraticCurveTo(316, 298, 380, 286); ctx.stroke();
    for (const [vx, vy, vr] of [[176, 250, 9], [157, 268, 7], [196, 268, 7], [126, 244, 12]]) {
      const g = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
      g.addColorStop(0, 'rgba(70,32,18,0.85)');
      g.addColorStop(0.35, 'rgba(226,150,100,0.7)');
      g.addColorStop(1, 'rgba(226,150,100,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(vx, vy, vr, 0, 7); ctx.fill();
    }
    ctx.restore();
    return toTexture(cv);
  }

  function texJupiter() {
    const pal = palette([
      [0, '#b49a7c'], [0.08, '#8a5f40'], [0.16, '#e8d6b4'], [0.25, '#9c6444'],
      [0.34, '#f0ddbe'], [0.43, '#b07a52'], [0.5, '#f4e6c8'], [0.57, '#a86e4a'],
      [0.67, '#ecd9b4'], [0.78, '#8f5f42'], [0.89, '#dcc49e'], [1, '#a8896a']
    ]);
    const { cv, ctx } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const turb = fbm2(gx * 2.4, gy * 2.4, 5, 19.2, 61);
      const fine = fbm2(gx * 7, gy * 2.2, 3, 56, 67);
      const t = clamp(gy / 4 + (turb - 0.5) * 0.09, 0, 1);
      const c = pal(t);
      const m = 0.9 + fine * 0.2;
      return [c[0] * m, c[1] * m, c[2] * m];
    });
    /* Great Red Spot at ~22 degrees south */
    const sx = 318, sy = 332;
    const spot = [[34, 19, '#c9885f', 0.75], [26, 14, '#b3543a', 0.9], [17, 9, '#d96c4a', 0.95], [7, 4, '#e9a07f', 0.95]];
    for (const [rx, ry, col, a] of spot) {
      ctx.save();
      ctx.translate(sx, sy); ctx.scale(rx / ry, 1);
      const g = ctx.createRadialGradient(0, 0, ry * 0.2, 0, 0, ry);
      g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0'));
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, ry, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(240,228,200,0.35)';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(sx - 60 - i * 22, sy + 4 + Math.sin(i) * 5, 14, 3.5, 0, 0, 7);
      ctx.fill();
    }
    return toTexture(cv);
  }

  function texSaturn() {
    const pal = palette([
      [0, '#b69b6c'], [0.12, '#cdb281'], [0.25, '#dcc494'], [0.38, '#cab078'],
      [0.5, '#e8d6a4'], [0.62, '#d3ba85'], [0.75, '#dfc795'], [0.88, '#c6ab77'], [1, '#ab905f']
    ]);
    const { cv } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const turb = fbm2(gx * 2, gy * 2, 4, 16, 71);
      const fine = fbm2(gx * 5, gy * 5, 3, 40, 73);
      const t = clamp(gy / 4 + (turb - 0.5) * 0.07, 0, 1);
      const c = pal(t);
      const m = 0.96 + fine * 0.08;
      return [c[0] * m, c[1] * m, c[2] * m];
    });
    return toTexture(cv);
  }

  function texUranus() {
    const { cv } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.5, gy * 1.5, 4, 12, 81);
      const band = Math.sin(lat * 5) * 0.02;
      const t = 0.62 + (n - 0.5) * 0.05 + band;
      const polar = smoothstep(0.7, 1.4, Math.abs(lat)) * 0.07;
      return [(140 + 30 * t) * (1 + polar * 0.3), 205 + 18 * t + polar * 22, 214 + 16 * t + polar * 14];
    });
    return toTexture(cv);
  }

  function texNeptune() {
    const pal = palette([[0, '#2547b8'], [0.3, '#2f56c9'], [0.5, '#3a66d8'], [0.7, '#3058cb'], [1, '#243f9e']]);
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const turb = fbm2(gx * 2, gy * 2, 4, 16, 91);
      const t = clamp(gy / 4 + (turb - 0.5) * 0.1, 0, 1);
      const c = pal(t);
      const m = 0.94 + turb * 0.12;
      return [c[0] * m, c[1] * m, c[2] * m];
    });
    /* dark storm + bright methane cirrus */
    ctx.save();
    ctx.translate(300, 96); ctx.scale(1.9, 1);
    let g = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    g.addColorStop(0, 'rgba(16,28,90,0.85)'); g.addColorStop(1, 'rgba(16,28,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(225,238,255,0.5)';
    ctx.lineWidth = 1.4;
    for (const [x1, y1, len] of [[260, 78, 46], [318, 116, 60], [180, 150, 40], [380, 70, 34]]) {
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1 + len / 2, y1 - 3, x1 + len, y1);
      ctx.stroke();
    }
    return toTexture(cv);
  }

  function texMoon() {
    const pal = palette([[0, '#7b766e'], [0.5, '#a8a298'], [1, '#c8c2b6']]);
    const { cv, ctx } = pixelPass(1024, 512, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx, gy, 5, 8, 121);
      return pal(clamp(n, 0, 1));
    });
    blotches(ctx, 1024, 512, 9, 122, ['#5d5a55', '#666258', '#55524e'], 0.04, 0.1, 0.55);
    drawCraters(ctx, 1024, 512, 330, 123, { rMax: 16 });
    /* Tycho with rays */
    ctx.save();
    ctx.translate(420, 430);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
    g.addColorStop(0, 'rgba(235,232,225,0.95)'); g.addColorStop(1, 'rgba(235,232,225,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(225,222,215,0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 130, Math.sin(a) * 75);
      ctx.stroke();
    }
    ctx.restore();
    return toTexture(cv);
  }

  function texIo() {
    const pal = palette([[0, '#a8852e'], [0.4, '#d9c25a'], [0.7, '#e8d98a'], [1, '#f2ecc2']]);
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.5, gy * 1.5, 5, 12, 131);
      let c = pal(clamp(n, 0, 1));
      const polar = smoothstep(0.85, 1.4, Math.abs(lat));
      return [lerp(c[0], 150, polar * 0.4), lerp(c[1], 140, polar * 0.4), lerp(c[2], 100, polar * 0.4)];
    });
    blotches(ctx, 512, 256, 26, 132, ['#fff8d0', '#e8a83a', '#c2611f', '#8a3a1a', '#f4e8b0'], 0.015, 0.07, 0.5);
    const rng = mulberry32(133);
    for (let i = 0; i < 24; i++) {
      const x = rng() * 512, y = 30 + rng() * 196, r = 1.5 + rng() * 2.8;
      ctx.fillStyle = 'rgba(60,26,14,0.9)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(180,60,30,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, 7); ctx.stroke();
    }
    return toTexture(cv);
  }

  function texEuropa() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 2, gy * 2, 4, 16, 141);
      const v = 208 + n * 36;
      return [v, v - 4, v - 14];
    });
    const rng = mulberry32(142);
    for (let i = 0; i < 30; i++) {
      const y0 = 30 + rng() * 196, amp = 8 + rng() * 36, ph = rng() * 7, fr = 1 + (rng() * 2.5) | 0;
      ctx.strokeStyle = `rgba(${150 + rng() * 40 | 0},${70 + rng() * 30 | 0},${45 + rng() * 20 | 0},${0.3 + rng() * 0.35})`;
      ctx.lineWidth = 0.7 + rng() * 1.7;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = y0 + Math.sin(x / 512 * Math.PI * 2 * fr + ph) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    drawCraters(ctx, 512, 256, 8, 143, { rMax: 4, dark: 0.12, rim: 0.18 });
    return toTexture(cv);
  }

  function texGanymede() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const region = fbm2(gx * 0.9 + 3, gy * 0.9, 4, 7.2, 151);
      const grooves = fbm2(gx * 7, gy * 1.6, 3, 56, 153);
      if (region > 0.52) {
        const v = 158 + grooves * 44;
        return [v, v - 10, v - 26];
      }
      const v = 96 + grooves * 26;
      return [v, v - 8, v - 18];
    });
    drawCraters(ctx, 512, 256, 90, 154, { rMax: 7, dark: 0.16, rim: 0.2 });
    return toTexture(cv);
  }

  function texCallisto() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.6, gy * 1.6, 5, 12.8, 161);
      const v = 70 + n * 40;
      return [v + 14, v + 4, v - 8];
    });
    drawCraters(ctx, 512, 256, 300, 162, { rMax: 6, dark: 0.2, rim: 0.22 });
    const rng = mulberry32(163);
    ctx.fillStyle = 'rgba(228,220,205,0.5)';
    for (let i = 0; i < 130; i++) {
      ctx.beginPath();
      ctx.arc(rng() * 512, 20 + rng() * 216, 0.6 + rng() * 1.2, 0, 7);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(210,200,185,0.1)';
    for (let i = 1; i <= 4; i++) {
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(150, 115, i * 11, 0, 7); ctx.stroke();
    }
    return toTexture(cv);
  }

  function texTitan() {
    const { cv } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.2, gy * 1.2, 4, 9.6, 171);
      let r = 216 + n * 22, g = 163 + n * 18, b = 60 + n * 14;
      if (Math.abs(lat) < 0.3) {
        const dune = fbm2(gx * 4, gy * 6, 4, 32, 172);
        if (dune > 0.55) {
          const k = smoothstep(0.55, 0.7, dune) * 0.45;
          r = lerp(r, 120, k); g = lerp(g, 88, k); b = lerp(b, 40, k);
        }
      }
      if (lat > 1.25) {
        const lake = fbm2(gx * 3, gy * 3, 3, 24, 173);
        if (lake > 0.6) { r = 47; g = 74; b = 85; }
      }
      return [r, g, b];
    });
    return toTexture(cv);
  }

  function texEnceladus() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 2, gy * 2, 4, 16, 181);
      const v = 236 + n * 19;
      return [v - 6, v - 2, v];
    });
    ctx.strokeStyle = 'rgba(120,170,210,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = 224 + i * 7;
      ctx.beginPath();
      ctx.moveTo(60 + i * 30, y);
      ctx.quadraticCurveTo(256, y + 6, 460 - i * 30, y - 3);
      ctx.stroke();
    }
    drawCraters(ctx, 512, 256, 40, 182, { rMax: 4, dark: 0.07, rim: 0.1 });
    return toTexture(cv);
  }

  function genericIce(seed, base, warm) {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.4, gy * 1.4, 5, 11.2, seed);
      const v = base + n * 46;
      return warm ? [v + 12, v + 2, v - 10] : [v, v + 1, v + 4];
    });
    drawCraters(ctx, 512, 256, 150, seed + 1, { rMax: 6, dark: 0.16, rim: 0.16 });
    return toTexture(cv);
  }

  function texMiranda() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const region = fbm2(gx * 1.1, gy * 1.1, 3, 8.8, 191);
      const tone = region > 0.55 ? 150 : (region > 0.45 ? 122 : 100);
      const fine = fbm2(gx * 6, gy * 6, 3, 48, 192);
      const v = tone + fine * 30;
      return [v, v - 2, v - 6];
    });
    ctx.strokeStyle = 'rgba(230,228,222,0.5)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(200, 196); ctx.lineTo(236, 156); ctx.lineTo(272, 196); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,28,26,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(90, 120); ctx.quadraticCurveTo(160, 132, 210, 116); ctx.stroke();
    drawCraters(ctx, 512, 256, 70, 193, { rMax: 5 });
    return toTexture(cv);
  }

  function texTriton() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.6, gy * 1.6, 5, 12.8, 211);
      let r = 212 + n * 26, g = 192 + n * 22, b = 172 + n * 20;
      if (lat < -0.25) {
        const k = smoothstep(-0.25, -0.6, lat);
        r = lerp(r, 242, k); g = lerp(g, 232, k); b = lerp(b, 214, k);
      }
      if (lat > 0.1) {
        const dimple = fbm2(gx * 7, gy * 7, 3, 56, 212);
        const m = 1 - smoothstep(0.5, 0.8, dimple) * 0.12;
        r *= m; g *= m; b *= m;
      }
      return [r, g, b];
    });
    const rng = mulberry32(213);
    ctx.strokeStyle = 'rgba(50,40,36,0.5)';
    for (let i = 0; i < 14; i++) {
      const x = rng() * 512, y = 190 + rng() * 50;
      ctx.lineWidth = 1 + rng();
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + rng() * 16, y - 2 - rng() * 4);
      ctx.stroke();
    }
    return toTexture(cv);
  }

  function texPluto() {
    const pal = palette([[0, '#6e4a30'], [0.4, '#a07050'], [0.7, '#c9a06e'], [1, '#e0c49a']]);
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.3, gy * 1.3, 5, 10.4, 221);
      let c = pal(clamp(n, 0, 1));
      if (lat > 1.1) {
        const k = smoothstep(1.1, 1.4, lat);
        c = [lerp(c[0], 222, k), lerp(c[1], 206, k), lerp(c[2], 184, k)];
      }
      return c;
    });
    /* Sputnik Planitia heart */
    ctx.save();
    ctx.translate(290, 140);
    ctx.rotate(0.15);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    g.addColorStop(0, 'rgba(244,234,216,0.96)');
    g.addColorStop(0.7, 'rgba(238,224,200,0.85)');
    g.addColorStop(1, 'rgba(238,224,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(-12, -6, 26, 30, -0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(14, -4, 24, 32, 0.25, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 12, 30, 26, 0, 0, 7); ctx.fill();
    ctx.restore();
    blotches(ctx, 512, 256, 5, 222, ['#3a2114', '#4a2c1c'], 0.04, 0.09, 0.55);
    return toTexture(cv);
  }

  function texCharon() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.5, gy * 1.5, 4, 12, 231);
      const v = 130 + n * 40;
      return [v + 4, v, v - 4];
    });
    const g = ctx.createRadialGradient(256, 16, 0, 256, 16, 70);
    g.addColorStop(0, 'rgba(122,62,40,0.75)');
    g.addColorStop(1, 'rgba(122,62,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 90);
    drawCraters(ctx, 512, 256, 70, 232, { rMax: 6 });
    ctx.strokeStyle = 'rgba(40,36,34,0.4)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(120, 128); ctx.quadraticCurveTo(260, 138, 400, 126); ctx.stroke();
    return toTexture(cv);
  }

  function texCeres() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.5, gy * 1.5, 5, 12, 241);
      const v = 104 + n * 36;
      return [v + 6, v + 2, v - 6];
    });
    drawCraters(ctx, 512, 256, 180, 242, { rMax: 7 });
    /* Occator bright spots */
    for (const [x, y, r] of [[230, 102, 2.6], [236, 106, 1.4]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      g.addColorStop(0, 'rgba(250,250,242,0.98)');
      g.addColorStop(1, 'rgba(250,250,242,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 7); ctx.fill();
    }
    return toTexture(cv);
  }

  function texEris() {
    const { cv, ctx } = pixelPass(512, 256, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 1.6, gy * 1.6, 4, 12.8, 251);
      const v = 222 + n * 26;
      return [v, v, v + 4];
    });
    drawCraters(ctx, 512, 256, 30, 252, { rMax: 4, dark: 0.08, rim: 0.08 });
    return toTexture(cv);
  }

  function texComet() {
    const { cv } = pixelPass(256, 128, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 2, gy * 2, 4, 16, 261);
      const v = 42 + n * 34;
      return [v + 6, v + 2, v - 2];
    });
    return toTexture(cv);
  }

  function texPhobos() {
    const { cv, ctx } = pixelPass(256, 128, 8, (u, lat, gx, gy) => {
      const n = fbm2(gx * 2, gy * 2, 4, 16, 271);
      const v = 92 + n * 34;
      return [v + 8, v + 2, v - 6];
    });
    drawCraters(ctx, 256, 128, 60, 272, { rMax: 10 });
    return toTexture(cv);
  }

  /* ---------- galaxies (face-on textures; 3D tilt handles inclination) ---------- */

  function texGalaxy(opts) {
    opts = opts || {};
    const S = 512, cx = S / 2, cy = S / 2;
    const { cv, ctx } = makeCanvas(S, S);
    ctx.clearRect(0, 0, S, S);
    const rng = mulberry32(opts.seed || 1);
    const type = opts.type || 'spiral';
    const coreCol = opts.core || '255,238,200';
    const armCol = opts.arm || '170,200,255';
    const hiiCol = opts.hii || '255,150,190';
    ctx.globalCompositeOperation = 'lighter';

    /* faint disk haze */
    const hz = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.48);
    hz.addColorStop(0, `rgba(${coreCol},0.45)`);
    hz.addColorStop(0.3, `rgba(${armCol},0.10)`);
    hz.addColorStop(1, `rgba(${armCol},0)`);
    ctx.fillStyle = hz; ctx.fillRect(0, 0, S, S);

    if (type === 'elliptical') {
      for (let i = 0; i < 4; i++) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * (0.16 + i * 0.1));
        g.addColorStop(0, `rgba(${coreCol},${0.4 - i * 0.08})`);
        g.addColorStop(1, `rgba(${coreCol},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      }
      for (let i = 0; i < 1500; i++) {
        const a = rng() * 6.2832, rr = Math.pow(rng(), 0.6) * S * 0.44;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.78;
        ctx.fillStyle = `rgba(255,242,214,${0.12 + rng() * 0.28})`;
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (type === 'irregular') {
      for (let k = 0; k < 16; k++) {
        const bx = cx + (rng() - 0.5) * S * 0.62, by = cy + (rng() - 0.5) * S * 0.5;
        const br = 12 + rng() * 46, hii = rng() < 0.4;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `rgba(${hii ? hiiCol : armCol},${0.16 + rng() * 0.22})`);
        g.addColorStop(1, `rgba(${hii ? hiiCol : armCol},0)`);
        ctx.fillStyle = g; ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      for (let i = 0; i < 1600; i++) {
        const x = cx + (rng() - 0.5) * S * 0.72, y = cy + (rng() - 0.5) * S * 0.6;
        ctx.fillStyle = `rgba(${armCol},${0.08 + rng() * 0.4})`;
        ctx.fillRect(x, y, 1, 1);
      }
    } else {
      /* spiral / barred */
      const arms = opts.arms || 2, turns = opts.turns || 3.0;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.17);
      core.addColorStop(0, `rgba(${coreCol},0.98)`);
      core.addColorStop(0.5, `rgba(${coreCol},0.5)`);
      core.addColorStop(1, `rgba(${coreCol},0)`);
      ctx.fillStyle = core; ctx.fillRect(0, 0, S, S);
      if (opts.barred) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(0.3);
        const bg = ctx.createLinearGradient(-S * 0.2, 0, S * 0.2, 0);
        bg.addColorStop(0, `rgba(${coreCol},0)`);
        bg.addColorStop(0.5, `rgba(${coreCol},0.55)`);
        bg.addColorStop(1, `rgba(${coreCol},0)`);
        ctx.fillStyle = bg; ctx.fillRect(-S * 0.2, -S * 0.045, S * 0.4, S * 0.09);
        ctx.restore();
      }
      for (let arm = 0; arm < arms; arm++) {
        const off = arm / arms * 6.2832;
        for (let t = 0; t < 1; t += 0.0035) {
          const th = t * turns * 6.2832;
          const rr = S * 0.07 + t * S * 0.4;
          const ang = off + th;
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
          const spread = 3 + t * 16;
          for (let s = 0; s < 2; s++) {
            const sx = x + (rng() - 0.5) * spread, sy = y + (rng() - 0.5) * spread;
            const bright = (1 - t * 0.65) * (0.35 + rng() * 0.6);
            ctx.fillStyle = `rgba(${armCol},${bright * 0.5})`;
            ctx.fillRect(sx, sy, 1.4, 1.4);
          }
          if (rng() < 0.035) {
            const hr = 2 + rng() * 5;
            const hg = ctx.createRadialGradient(x, y, 0, x, y, hr);
            hg.addColorStop(0, `rgba(${hiiCol},${0.5 * (1 - t)})`);
            hg.addColorStop(1, `rgba(${hiiCol},0)`);
            ctx.fillStyle = hg; ctx.fillRect(x - hr, y - hr, hr * 2, hr * 2);
          }
        }
      }
    }

    /* equatorial dust lane (Sombrero / Centaurus A) */
    if (opts.dust) {
      ctx.globalCompositeOperation = 'source-over';
      const dg = ctx.createLinearGradient(0, cy - S * 0.5, 0, cy + S * 0.5);
      dg.addColorStop(0.42, 'rgba(8,6,10,0)');
      dg.addColorStop(0.50, 'rgba(5,3,7,0.88)');
      dg.addColorStop(0.58, 'rgba(8,6,10,0)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, S, S);
    }

    ctx.globalCompositeOperation = 'source-over';
    return toTexture(cv, false);
  }

  /* ---------- rings ---------- */

  function texSaturnRings() {
    const W = 1024, H = 16;
    const { cv, ctx } = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const n = fbm2(u * 90, 0.5, 4, 720, 281);
      const n2 = fbm2(u * 300, 0.5, 2, 2400, 282);
      let alpha = 0, r = 205, g = 182, b = 142;
      if (u > 0.04 && u < 0.22) { alpha = 0.18 + n * 0.15; r = 150; g = 132; b = 104; }
      else if (u >= 0.22 && u < 0.59) { alpha = 0.72 + n * 0.28; const m = 0.82 + n2 * 0.36; r = 212 * m; g = 188 * m; b = 148 * m; }
      else if (u >= 0.59 && u < 0.65) { alpha = 0.06 + n * 0.05; }
      else if (u >= 0.65 && u < 0.91) {
        alpha = 0.5 + n * 0.22;
        const m = 0.85 + n2 * 0.3; r = 198 * m; g = 176 * m; b = 140 * m;
        if (u > 0.855 && u < 0.868) alpha *= 0.25;
      }
      else if (u >= 0.955 && u < 0.965) { alpha = 0.4; r = 190; g = 175; b = 150; }
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = alpha * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = toTexture(cv);
    t.wrapS = THREE.ClampToEdgeWrapping;
    return t;
  }

  function texUranusRings() {
    const W = 512, H = 8;
    const { cv, ctx } = makeCanvas(W, H);
    ctx.clearRect(0, 0, W, H);
    function band(u0, u1, a) {
      ctx.fillStyle = `rgba(168,182,196,${a})`;
      ctx.fillRect(u0 * W, 0, (u1 - u0) * W, H);
    }
    band(0.3, 0.33, 0.18); band(0.5, 0.52, 0.15); band(0.78, 0.84, 0.5); band(0.9, 0.91, 0.2);
    const t = toTexture(cv);
    t.wrapS = THREE.ClampToEdgeWrapping;
    return t;
  }

  /* ---------- sky ---------- */

  function texMilkyWay() {
    const W = 2048, H = 1024;
    const { cv, ctx } = makeCanvas(W, H);
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, W, H);
    const rng = mulberry32(301);
    ctx.globalCompositeOperation = 'lighter';
    /* main band */
    for (let i = 0; i < 420; i++) {
      const x = rng() * W;
      const y = H / 2 + (rng() + rng() + rng() - 1.5) * 90 + Math.sin(x / W * Math.PI * 2) * 24;
      const r = 30 + rng() * 110;
      const warm = rng() > 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = warm ? '255,232,205' : '198,212,255';
      g.addColorStop(0, `rgba(${col},${0.018 + rng() * 0.02})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* a few colorful nebula smudges */
    for (const [fx, fy, fr, col] of [[0.2, 0.46, 50, '255,160,160'], [0.62, 0.55, 42, '160,190,255'], [0.84, 0.44, 36, '255,200,150'], [0.42, 0.58, 30, '210,160,255']]) {
      const g = ctx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr);
      g.addColorStop(0, `rgba(${col},0.05)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(fx * W - fr, fy * H - fr, fr * 2, fr * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    /* dust lanes */
    for (let i = 0; i < 90; i++) {
      const x = rng() * W;
      const y = H / 2 + (rng() - 0.5) * 60 + Math.sin(x / W * Math.PI * 2) * 24;
      const r = 18 + rng() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(2,3,8,${0.12 + rng() * 0.12})`);
      g.addColorStop(1, 'rgba(2,3,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* faint background stars baked in */
    for (let i = 0; i < 2600; i++) {
      const x = rng() * W, y = rng() * H;
      const nearBand = Math.exp(-Math.pow((y - H / 2 - Math.sin(x / W * Math.PI * 2) * 24) / 130, 2));
      if (rng() > 0.25 + nearBand * 0.75) continue;
      const v = 90 + rng() * 165;
      ctx.fillStyle = `rgba(${v},${v},${Math.min(255, v + 20)},${0.5 + rng() * 0.5})`;
      const s = rng() < 0.93 ? 1 : 2;
      ctx.fillRect(x, y, s, s);
    }
    /* Andromeda smudge */
    ctx.save();
    ctx.translate(0.73 * W, 0.24 * H);
    ctx.rotate(-0.5);
    const ag = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    ag.addColorStop(0, 'rgba(225,222,255,0.4)');
    ag.addColorStop(1, 'rgba(225,222,255,0)');
    ctx.fillStyle = ag;
    ctx.scale(2.6, 1);
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.restore();
    return toTexture(cv);
  }

  /* ---------- sprites ---------- */

  function spriteGlow(inner, mid) {
    const s = 256;
    const { cv, ctx } = makeCanvas(s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)');
    g.addColorStop(0.18, mid || 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return toTexture(cv);
  }

  function spriteSun() {
    const s = 512;
    const { cv, ctx } = makeCanvas(s, s);
    const c = s / 2;
    let g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,252,240,1)');
    g.addColorStop(0.1, 'rgba(255,238,180,0.9)');
    g.addColorStop(0.25, 'rgba(255,190,90,0.38)');
    g.addColorStop(0.55, 'rgba(255,140,50,0.1)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    /* horizontal + vertical flare streaks */
    ctx.globalCompositeOperation = 'lighter';
    for (const rot of [0, Math.PI / 2]) {
      ctx.save();
      ctx.translate(c, c); ctx.rotate(rot); ctx.scale(1, 0.035);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, c * 0.96);
      fg.addColorStop(0, 'rgba(255,240,210,0.5)');
      fg.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, 0, c * 0.96, 0, 7); ctx.fill();
      ctx.restore();
    }
    return toTexture(cv);
  }

  function spriteDot() {
    const s = 64;
    const { cv, ctx } = makeCanvas(s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return toTexture(cv);
  }

  const registry = {
    sun: texSun, mercury: texMercury, venus: texVenus, mars: texMars,
    jupiter: texJupiter, saturn: texSaturn, uranus: texUranus, neptune: texNeptune,
    luna: texMoon, io: texIo, europa: texEuropa, ganymede: texGanymede, callisto: texCallisto,
    titan: texTitan, enceladus: texEnceladus,
    rhea: () => genericIce(401, 168, false),
    iapetus: () => {
      /* two-tone: dark leading hemisphere painted over an icy base */
      const t = genericIce(411, 150, true);
      const cv = t.image, ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(52,34,22,0.82)';
      ctx.fillRect(cv.width * 0.25, 0, cv.width * 0.5, cv.height);
      const g = ctx.createLinearGradient(cv.width * 0.18, 0, cv.width * 0.32, 0);
      g.addColorStop(0, 'rgba(52,34,22,0)'); g.addColorStop(1, 'rgba(52,34,22,0.82)');
      ctx.fillStyle = g; ctx.fillRect(cv.width * 0.18, 0, cv.width * 0.14, cv.height);
      const g2 = ctx.createLinearGradient(cv.width * 0.68, 0, cv.width * 0.82, 0);
      g2.addColorStop(0, 'rgba(52,34,22,0.82)'); g2.addColorStop(1, 'rgba(52,34,22,0)');
      ctx.fillStyle = g2; ctx.fillRect(cv.width * 0.68, 0, cv.width * 0.14, cv.height);
      t.needsUpdate = true;
      return t;
    },
    miranda: texMiranda,
    titania: () => genericIce(421, 142, true),
    oberon: () => genericIce(431, 118, true),
    triton: texTriton, pluto: texPluto, charon: texCharon,
    ceres: texCeres, eris: texEris,
    phobos: texPhobos, deimos: texPhobos, comet: texComet
  };

  return {
    setAniso, registry, texEarth, texSaturnRings, texUranusRings, texMilkyWay,
    texGalaxy, spriteGlow, spriteSun, spriteDot, toTexture, makeCanvas
  };
})();
