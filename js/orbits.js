/* Keplerian orbit propagation from J2000 mean elements.
   Ecliptic frame mapping to scene: world.x = ecl.x, world.y = ecl.z, world.z = -ecl.y
   (ecliptic north = +Y up, planets orbit counter-clockwise seen from above). */
const ORB = (function () {
  const J2000 = 2451545.0;
  const D2R = Math.PI / 180;

  function jdNow() { return Date.now() / 86400000 + 2440587.5; }
  function dateFromJD(jd) { return new Date((jd - 2440587.5) * 86400000); }

  function solveKepler(M, e) {
    M = M % (2 * Math.PI);
    if (M < 0) M += 2 * Math.PI;
    let E = e > 0.8 ? Math.PI : M;
    for (let i = 0; i < 12; i++) {
      const f = E - e * Math.sin(E) - M;
      E -= f / (1 - e * Math.cos(E));
    }
    return E;
  }

  /* Rotate in-plane coords (xp, yp) by argument of perihelion w, inclination i,
     ascending node O — all in degrees except w (radians, precomputed). */
  function orient(el, xp, yp, w, out) {
    const O = D2R * el.O, inc = D2R * el.i;
    const cO = Math.cos(O), sO = Math.sin(O);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const cw = Math.cos(w), sw = Math.sin(w);
    const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
    const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
    const z = (sw * si) * xp + (cw * si) * yp;
    const AU = DATA.AU;
    return out.set(x * AU, z * AU, -y * AU);
  }

  function argPeri(el) {
    return el.L !== undefined ? D2R * (el.wbar - el.O) : D2R * el.w;
  }

  /* Heliocentric position at julian date jd, in scene units. el:
     planets — {a, e, i, O, wbar, L, P}  (L = mean longitude at J2000, P in days)
     comets  — {a, e, i, O, w, Tp, P}    (Tp = perihelion julian date) */
  function helioPos(el, jd, out) {
    out = out || new THREE.Vector3();
    let M;
    if (el.L !== undefined) {
      M = D2R * (el.L - el.wbar) + (2 * Math.PI / el.P) * (jd - J2000);
    } else {
      M = 2 * Math.PI * ((jd - el.Tp) / el.P);
    }
    const e = el.e;
    const E = solveKepler(M, e);
    const xp = el.a * (Math.cos(E) - e);
    const yp = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
    return orient(el, xp, yp, argPeri(el), out);
  }

  /* Full ellipse as Float32Array of xyz triplets, sampled uniformly in true anomaly */
  function orbitPoints(el, n) {
    n = n || 256;
    const pts = new Float32Array(n * 3);
    const w = argPeri(el);
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const nu = 2 * Math.PI * k / n;
      const r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
      orient(el, r * Math.cos(nu), r * Math.sin(nu), w, v);
      pts[k * 3] = v.x; pts[k * 3 + 1] = v.y; pts[k * 3 + 2] = v.z;
    }
    return pts;
  }

  /* Unit direction from ecliptic longitude/latitude in degrees (for the deep-space probes) */
  function eclDir(lonDeg, latDeg, out) {
    out = out || new THREE.Vector3();
    const lon = D2R * lonDeg, lat = D2R * latDeg;
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.cos(lat) * Math.sin(lon);
    const z = Math.sin(lat);
    return out.set(x, z, -y);
  }

  return { J2000, jdNow, dateFromJD, solveKepler, helioPos, orbitPoints, eclDir };
})();
