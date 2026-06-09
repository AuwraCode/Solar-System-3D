/* Camera rig: follow-orbit around a target with smooth fly-to transitions,
   plus a free-flight mode (WASD). Distances auto-scale near small bodies. */
class Rig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'orbit';
    this.target = null;
    this.theta = 0.7; this.phi = 1.15;
    this.dist = 950; this.distGoal = 950;
    this.minDist = 1; this.maxDist = 60000;
    this.vTheta = 0; this.vPhi = 0;
    this.trans = null;
    this.keys = new Set();
    this.flyVel = new THREE.Vector3();
    this.flySpeedMul = 1;
    this.autoDrift = false;
    this.lastLook = new THREE.Vector3();
    this._off = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this.pointers = new Map();
    this.pinchStart = 0;
    this.pinchDist0 = 0;
    this._bind();
  }

  setTarget(body, opts = {}) {
    opts = opts || {};
    this.mode = 'orbit';
    this.target = body;
    const endDist = opts.dist !== undefined ? opts.dist : Math.max(body.dispRad * 3.9, 0.16);
    this.minDist = body.dispRad * 1.32 + 0.012;
    const off = this._off.copy(this.camera.position).sub(body.wp);
    if (off.lengthSq() < 1e-8) off.set(1, 0.6, 1);
    const sph = new THREE.Spherical().setFromVector3(off);
    this.theta = sph.theta;
    this.phi = NZ.clamp(sph.phi, 0.05, Math.PI - 0.05);
    /* arrive on the sunlit side: bias view direction toward the sun-facing hemisphere */
    const wantSunward = opts.sunward === true || (!opts.instant && opts.sunward !== false);
    if (wantSunward && body.wp.lengthSq() > 4) {
      const sunSph = new THREE.Spherical().setFromVector3(this._look.copy(body.wp).negate());
      this.theta = sunSph.theta + 0.62;
      this.phi = NZ.clamp(sunSph.phi - 0.2, 0.35, Math.PI - 0.35);
    }
    this.dist = NZ.clamp(endDist, this.minDist, this.maxDist);
    this.distGoal = this.dist;
    if (opts.instant) {
      if (!wantSunward) {
        this.dist = NZ.clamp(opts.dist !== undefined ? opts.dist : off.length(), this.minDist, this.maxDist);
        this.distGoal = this.dist;
      }
      this.trans = null;
      return;
    }
    const travel = this.camera.position.distanceTo(body.wp);
    const dur = NZ.clamp(0.8 + Math.log10(1 + travel) * 0.5, 1.0, 3.2);
    this.trans = {
      t: 0, dur,
      fromPos: this.camera.position.clone(),
      fromLook: this.lastLook.clone()
    };
  }

  enterFly() {
    this.mode = 'fly';
    this.trans = null;
    this.flyVel.set(0, 0, 0);
  }

  exitFly(nearestBody) {
    if (nearestBody) {
      this.setTarget(nearestBody, { instant: true, dist: this.camera.position.distanceTo(nearestBody.wp) });
    }
    this.mode = 'orbit';
  }

  nearestSurface(bodies) {
    let best = 1e9;
    for (const b of bodies) {
      if (b.def.kind === 'region') continue;
      const d = this.camera.position.distanceTo(b.wp) - b.dispRad;
      if (d < best) best = d;
    }
    return best;
  }

  nearestBody(bodies) {
    let best = null, bd = 1e18;
    for (const b of bodies) {
      if (b.def.kind === 'region') continue;
      const d = this.camera.position.distanceTo(b.wp);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  update(dt, bodies) {
    const cam = this.camera;
    if (this.mode === 'fly') {
      const sp = NZ.clamp(this.nearestSurface(bodies) * 0.9, 0.04, 8000) *
        (this.keys.has('shift') ? 5 : 1) * this.flySpeedMul;
      const d = new THREE.Vector3();
      if (this.keys.has('w')) d.z -= 1;
      if (this.keys.has('s')) d.z += 1;
      if (this.keys.has('a')) d.x -= 1;
      if (this.keys.has('d')) d.x += 1;
      if (this.keys.has('q')) d.y -= 1;
      if (this.keys.has('e')) d.y += 1;
      if (d.lengthSq() > 0) d.normalize().multiplyScalar(sp);
      d.applyQuaternion(cam.quaternion);
      this.flyVel.lerp(d, Math.min(1, dt * 5));
      cam.position.addScaledVector(this.flyVel, dt);
      this.lastLook.copy(cam.position).add(new THREE.Vector3(0, 0, -10).applyQuaternion(cam.quaternion));
      return;
    }

    const t = this.target;
    if (!t) return;

    this.theta += this.vTheta;
    this.phi = NZ.clamp(this.phi + this.vPhi, 0.04, Math.PI - 0.04);
    const decay = Math.exp(-dt * 6);
    this.vTheta *= decay; this.vPhi *= decay;
    if (this.autoDrift && !this.trans) this.theta += dt * 0.05;
    this.dist += (this.distGoal - this.dist) * Math.min(1, dt * 8);

    this._off.setFromSphericalCoords(this.dist, this.phi, this.theta);

    if (this.trans) {
      this.trans.t += dt;
      let s = Math.min(1, this.trans.t / this.trans.dur);
      s = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      this._end.copy(t.wp).add(this._off);
      cam.position.lerpVectors(this.trans.fromPos, this._end, s);
      this._look.lerpVectors(this.trans.fromLook, t.wp, s);
      cam.lookAt(this._look);
      this.lastLook.copy(this._look);
      if (this.trans.t >= this.trans.dur) this.trans = null;
    } else {
      cam.position.copy(t.wp).add(this._off);
      cam.lookAt(t.wp);
      this.lastLook.copy(t.wp);
    }
  }

  zoomBy(factor) {
    this.distGoal = NZ.clamp(this.distGoal * factor, this.minDist, this.maxDist);
  }

  _bind() {
    const dom = this.dom;
    dom.addEventListener('contextmenu', e => e.preventDefault());

    dom.addEventListener('pointerdown', e => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        this.pinchDist0 = this.distGoal;
      }
      dom.setPointerCapture(e.pointerId);
    });

    dom.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const len = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchStart > 0 && len > 0) {
          this.distGoal = NZ.clamp(this.pinchDist0 * this.pinchStart / len, this.minDist, this.maxDist);
        }
        return;
      }

      if (this.mode === 'fly') {
        this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -dx * 0.0032);
        this.camera.rotateX(-dy * 0.0032);
      } else {
        this.theta -= dx * 0.0046;
        this.phi = NZ.clamp(this.phi - dy * 0.0046, 0.04, Math.PI - 0.04);
        this.vTheta = -dx * 0.0046 * 0.12;
        this.vPhi = -dy * 0.0046 * 0.12;
        this.autoDrift = false;
      }
    });

    const up = e => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = 0;
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);

    dom.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.mode === 'fly') {
        this.flySpeedMul = NZ.clamp(this.flySpeedMul * Math.exp(-e.deltaY * 0.001), 0.05, 40);
      } else {
        this.distGoal = NZ.clamp(this.distGoal * Math.exp(e.deltaY * 0.0011), this.minDist, this.maxDist);
      }
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
}
