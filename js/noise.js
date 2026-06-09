/* Seeded value noise + fbm helpers. 2D variants wrap horizontally (period px)
   so equirectangular planet textures are seamless at the date line. */
const NZ = (function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(ix, iy, seed) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function hash3(ix, iy, iz, seed) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647) + Math.imul(seed, 1442695041)) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function vnoise2(x, y, px, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const ux = fade(x - ix), uy = fade(y - iy);
    const x0 = ((ix % px) + px) % px, x1 = (((ix + 1) % px) + px) % px;
    const a = hash2(x0, iy, seed), b = hash2(x1, iy, seed);
    const c = hash2(x0, iy + 1, seed), d = hash2(x1, iy + 1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm2(x, y, oct, px, seed, gain) {
    gain = gain === undefined ? 0.5 : gain;
    let amp = 1, sum = 0, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * vnoise2(x * f, y * f, px * f, seed + o * 101);
      norm += amp; amp *= gain; f *= 2;
    }
    return sum / norm;
  }

  /* ridged fbm — sharp crests, good for clouds and ice cracks */
  function rfbm2(x, y, oct, px, seed) {
    let amp = 0.55, sum = 0, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      const n = 1 - Math.abs(2 * vnoise2(x * f, y * f, px * f, seed + o * 137) - 1);
      sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  function vnoise3(x, y, z, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const ux = fade(x - ix), uy = fade(y - iy), uz = fade(z - iz);
    function c(dx, dy, dz) { return hash3(ix + dx, iy + dy, iz + dz, seed); }
    const n00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * ux;
    const n10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * ux;
    const n01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * ux;
    const n11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * ux;
    const n0 = n00 + (n10 - n00) * uy, n1 = n01 + (n11 - n01) * uy;
    return n0 + (n1 - n0) * uz;
  }

  function fbm3(x, y, z, oct, seed) {
    let amp = 1, sum = 0, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * vnoise3(x * f, y * f, z * f, seed + o * 101);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* Multi-stop gradient: stops = [[pos, '#rrggbb'], ...] sorted by pos. Returns [r,g,b] 0..255 */
  function palette(stops) {
    const parsed = stops.map(s => {
      const c = s[1];
      return [s[0], parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    });
    return function (t) {
      t = clamp(t, 0, 1);
      let i = 0;
      while (i < parsed.length - 2 && t > parsed[i + 1][0]) i++;
      const a = parsed[i], b = parsed[i + 1];
      const u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    };
  }

  return { mulberry32, hash2, vnoise2, fbm2, rfbm2, vnoise3, fbm3, clamp, lerp, smoothstep, palette };
})();
