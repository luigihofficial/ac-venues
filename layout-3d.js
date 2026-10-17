/* ============================================================================
 * AC VENUES — 3D VISUALIZATION (orbit + walkthrough + View-From-Seat)
 * Reads the SAME geometry model the 2D editor uses (one shared source of truth,
 * addendum §3). Three.js is loaded on demand from CDN; if WebGL/THREE is
 * unavailable the module degrades to a clear message and the 2D planner stays
 * fully usable (spec §7, 2D fallback).
 * Coordinate mapping (feet): room x → X, room y → Z, object height → Y (up).
 * Scene is centered so the room middle is at the origin.
 * ==========================================================================*/
(function (root) {
  "use strict";
  var E = root.LayoutEngine;
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js";
  var EYE_SEATED = 3.9;   // seated eye height (ft)
  var EYE_STAND = 5.6;    // standing/walkthrough eye height (ft)

  /* ---------- pure geometry mapping (testable without WebGL) ---------- */
  // Returns render specs in FEET, centered at room middle. Y is up.
  function buildMeshSpecs(objects, roomRaw) {
    var room = E.normalizeRoom(roomRaw);
    var W = room.width, L = room.length, cx = W / 2, cz = L / 2;
    var ceil = room.ceilingHeight || 12;
    var specs = [];
    specs.push({ kind: "floor", x: 0, y: -0.05, z: 0, w: W, h: 0.1, l: L, color: 0xefe7d2, role: "floor" });
    // walls (thin), 4 sides
    var wt = 0.3, wh = Math.min(ceil, 10);
    specs.push({ kind: "box", x: 0, y: wh / 2, z: -cz, w: W, h: wh, l: wt, color: 0xe6ddca, role: "wall" });
    specs.push({ kind: "box", x: 0, y: wh / 2, z: cz, w: W, h: wh, l: wt, color: 0xe6ddca, role: "wall" });
    specs.push({ kind: "box", x: -cx, y: wh / 2, z: 0, w: wt, h: wh, l: L, color: 0xe6ddca, role: "wall" });
    specs.push({ kind: "box", x: cx, y: wh / 2, z: 0, w: wt, h: wh, l: L, color: 0xe6ddca, role: "wall" });
    // structural columns / obstructions — full height
    (room.obstructions || []).forEach(function (o) {
      var h = o.h || ceil;
      specs.push({ kind: "box", id: o.id, x: o.x - cx, y: h / 2, z: o.y - cz, w: o.w, h: h, l: o.l, color: 0xcf7f7f, role: "column", label: o.label || "Column" });
    });
    // placed objects
    (objects || []).forEach(function (o) {
      var h = o.h != null ? o.h : 2.5;
      var color = o.category === "chair" ? 0x6f94c4 : o.category === "equipment" ? 0xb9a7e0 : 0xd8c79a;
      var base = { id: o.id, x: o.x - cx, z: o.y - cz, h: h, color: color, role: o.category,
        type: o.type, label: o.label || o.type, rot: (o.r || 0) };
      if (o.kind === "circle") {
        base.kind = "cyl"; base.d = o.d; base.y = h / 2;
      } else {
        base.kind = "box"; base.w = o.w; base.l = o.l; base.y = h / 2;
      }
      specs.push(base);
      if (o.category === "chair") {
        base.seat = true;
        base.eye = { x: o.x - cx, y: EYE_SEATED, z: o.y - cz };
      }
    });
    specs._room = { W: W, L: L, ceil: ceil, cx: cx, cz: cz };
    return specs;
  }

  // Front/presenter target the seated viewer faces (front of room = small y → -Z).
  function frontTarget(specs) {
    var rm = specs._room;
    // prefer a screen/stage if present
    var focus = null;
    specs.forEach(function (s) {
      if (focus) return;
      if (s.type === "SCREEN" || s.type === "LED_WALL" || s.type === "TV_MONITOR" || s.type === "STAGE" || s.type === "PODIUM") focus = s;
    });
    if (focus) return { x: focus.x, y: Math.max(4, (focus.h || 6) * 0.7), z: focus.z };
    return { x: 0, y: 5, z: -rm.L / 2 + 1 };  // front-center wall
  }

  /* ---------- obstruction detection (pure; segment vs AABB) ---------- */
  function segAABB(p0, p1, box) {
    // box: {x,y,z,w,h,l} centered. Slab method with the segment param t in [0,1].
    var min = [box.x - box.w / 2, box.y - box.h / 2, box.z - box.l / 2];
    var max = [box.x + box.w / 2, box.y + box.h / 2, box.z + box.l / 2];
    var o = [p0.x, p0.y, p0.z], d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
    var tmin = 0, tmax = 1;
    for (var i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < min[i] || o[i] > max[i]) return false;
      } else {
        var t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
        if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
      }
    }
    return true;
  }
  function specBox(s) {
    if (s.kind === "cyl") return { x: s.x, y: s.y, z: s.z, w: s.d, h: s.h, l: s.d };
    return { x: s.x, y: s.y, z: s.z, w: s.w, h: s.h, l: s.l };
  }
  // Which objects sit on the sightline between a seat's eye and the front target.
  // Only things that can actually block a seated view count (columns, tall
  // equipment, and seats/tables taller than the sight path). This is a SIMULATED
  // sightline from entered geometry — not verified visibility.
  function obstructionsForSeat(seatSpec, specs) {
    var eye = seatSpec.eye, target = frontTarget(specs);
    var out = [];
    specs.forEach(function (s) {
      if (s === seatSpec || s.role === "floor" || s.role === "wall") return;
      if (s.id && seatSpec.id && s.id === seatSpec.id) return;
      // skip the focus target itself
      if (s.type === "SCREEN" || s.type === "LED_WALL" || s.type === "STAGE" || s.type === "PODIUM" || s.type === "TV_MONITOR") return;
      // a blocker must rise above the sightline near its location to matter
      var box = specBox(s);
      // ignore very short items (tables/low) unless taller than seated eye near the path
      if ((box.y + box.h / 2) < EYE_SEATED - 0.2 && s.role !== "column") return;
      if (segAABB(eye, target, box)) {
        out.push({ id: s.id, type: s.type || s.role, label: s.label || s.type || s.role });
      }
    });
    return out;
  }

  /* ---------- WebGL availability ---------- */
  function webglOk() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch (e) { return false; }
  }
  function loadThree(cb) {
    if (root.THREE) { cb(true); return; }
    if (document.getElementById("three-cdn")) { var w = 0, iv = setInterval(function () { if (root.THREE) { clearInterval(iv); cb(true); } else if (++w > 60) { clearInterval(iv); cb(false); } }, 100); return; }
    var s = document.createElement("script"); s.id = "three-cdn"; s.src = THREE_URL;
    s.onload = function () { cb(!!root.THREE); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }

  /* ---------- overlay + renderer ---------- */
  var V = null; // active viewer state

  function overlayHtml() {
    return '<div id="l3d-bar" style="position:absolute;top:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 12px;background:rgba(20,38,63,.92);color:#fff;z-index:2">' +
      '<b style="margin-right:6px">3D</b>' +
      '<button data-m="orbit" class="l3d-b">Orbit</button>' +
      '<button data-m="walk" class="l3d-b">Walkthrough</button>' +
      '<button data-m="seat" class="l3d-b">View from seat</button>' +
      '<select id="l3d-seat" class="l3d-b" style="display:none"></select>' +
      '<label id="l3d-eyewrap" style="display:none;font-size:12px;gap:4px;align-items:center">eye <input id="l3d-eye" type="range" min="2.5" max="6.5" step="0.1" style="vertical-align:middle"></label>' +
      '<span id="l3d-hint" style="font-size:12px;color:#cdd6e2;margin-left:4px"></span>' +
      '<button id="l3d-close" class="l3d-b" style="margin-left:auto;background:#b8860b">Close ✕</button>' +
      '</div>' +
      '<div id="l3d-info" style="position:absolute;left:12px;bottom:12px;max-width:380px;background:rgba(255,255,255,.95);border-radius:10px;padding:10px 12px;font-size:12.5px;color:#22303f;z-index:2;display:none"></div>';
  }
  function injectCss() {
    if (document.getElementById("l3d-css")) return;
    var s = document.createElement("style"); s.id = "l3d-css";
    s.textContent = ".l3d-b{background:#223a5e;color:#fff;border:1px solid #33507a;border-radius:7px;padding:5px 10px;font-size:12.5px;cursor:pointer;font-weight:600}.l3d-b:hover{background:#2d4a73}#l3d-seat{color:#22303f}";
    document.head.appendChild(s);
  }

  function open(mode, objects, room, params, opts) {
    opts = opts || {};
    injectCss();
    if (!webglOk()) { fallback("This device/browser can’t render 3D (no WebGL). The 2D planner remains fully usable."); return; }
    loadThree(function (ok) {
      if (!ok || !root.THREE) { fallback("Couldn’t load the 3D library (offline or blocked). The 2D planner remains fully usable."); return; }
      start(mode || "orbit", objects, room, params, opts);
    });
  }
  function fallback(message) {
    var m = document.createElement("div");
    m.id = "l3d-fallback";
    m.style.cssText = "position:fixed;inset:0;background:rgba(20,38,63,.6);display:flex;align-items:center;justify-content:center;z-index:9998";
    m.innerHTML = '<div style="background:#fff;border-radius:12px;padding:20px 22px;max-width:360px;text-align:center;font-family:sans-serif"><p style="margin:0 0 12px;color:#22303f">' + message + '</p><button style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">OK</button></div>';
    m.querySelector("button").onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  }

  function start(mode, objects, room, params, opts) {
    var THREE = root.THREE;
    close(); // clean any prior
    var wrap = document.createElement("div");
    wrap.id = "l3d-wrap";
    wrap.style.cssText = "position:fixed;inset:0;background:#0d1826;z-index:9997";
    wrap.innerHTML = overlayHtml();
    document.body.appendChild(wrap);

    var specs = buildMeshSpecs(objects, room);
    var rm = specs._room;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1826);
    var amb = new THREE.AmbientLight(0xffffff, 0.75); scene.add(amb);
    var dir = new THREE.DirectionalLight(0xffffff, 0.75); dir.position.set(rm.W * 0.4, rm.ceil * 2, rm.L * 0.4); scene.add(dir);

    var W = wrap.clientWidth, H = wrap.clientHeight;
    var cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.cssText = "position:absolute;inset:0";
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    // build meshes
    var seatMeshes = [];
    var meshById = {};
    specs.forEach(function (s) {
      var geo, mat = new THREE.MeshLambertMaterial({ color: s.color });
      if (s.kind === "cyl") geo = new THREE.CylinderGeometry(s.d / 2, s.d / 2, s.h, 20);
      else geo = new THREE.BoxGeometry(s.w, s.h, s.l);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, s.y, s.z);
      if (s.rot) mesh.rotation.y = -s.rot * Math.PI / 180;
      mesh.userData = s;
      scene.add(mesh);
      if (s.id) meshById[s.id] = mesh;
      if (s.seat) seatMeshes.push(mesh);
    });

    V = { THREE: THREE, wrap: wrap, scene: scene, cam: cam, renderer: renderer, specs: specs, rm: rm,
      seatMeshes: seatMeshes, meshById: meshById, mode: null, raf: 0,
      orbit: { az: 0.6, pol: 0.9, rad: Math.max(rm.W, rm.L) * 1.1, tx: 0, ty: 3, tz: 0 },
      walk: { x: 0, y: EYE_STAND, z: rm.L / 2 - 3, yaw: Math.PI, pitch: -0.05 },
      keys: {}, seatIdx: (opts && opts.seatIndex) || 0, eye: EYE_SEATED };

    buildSeatSelect();
    wireOverlay();
    onResize();
    window.addEventListener("resize", onResize);
    setMode(mode);
    loop();
  }

  function buildSeatSelect() {
    var sel = V.wrap.querySelector("#l3d-seat");
    sel.innerHTML = V.seatMeshes.map(function (m, i) { return '<option value="' + i + '">Seat ' + (i + 1) + "</option>"; }).join("");
  }
  function wireOverlay() {
    var wrap = V.wrap;
    wrap.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { setMode(b.getAttribute("data-m")); }; });
    wrap.querySelector("#l3d-close").onclick = close;
    var sel = wrap.querySelector("#l3d-seat");
    sel.onchange = function () { V.seatIdx = +sel.value; applySeat(); };
    var eye = wrap.querySelector("#l3d-eye");
    eye.value = V.eye;
    eye.oninput = function () { V.eye = +eye.value; if (V.mode === "seat") applySeat(); else if (V.mode === "walk") { V.walk.y = V.eye; } };
    // pointer controls on canvas
    var cv = V.renderer.domElement;
    cv.addEventListener("pointerdown", onPD);
    window.addEventListener("pointermove", onPM);
    window.addEventListener("pointerup", onPU);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
  }

  function setMode(m) {
    if (!V) return;
    V.mode = m;
    var showSeat = m === "seat";
    V.wrap.querySelector("#l3d-seat").style.display = showSeat ? "" : "none";
    V.wrap.querySelector("#l3d-eyewrap").style.display = (showSeat || m === "walk") ? "inline-flex" : "none";
    V.wrap.querySelectorAll("[data-m]").forEach(function (b) { b.style.outline = b.getAttribute("data-m") === m ? "2px solid #e3b23c" : "none"; });
    var hint = V.wrap.querySelector("#l3d-hint");
    if (m === "orbit") { hint.textContent = "Drag to rotate · scroll to zoom"; resetOrbit(); hideInfo(); }
    else if (m === "walk") { hint.textContent = "W/A/S/D or arrows to move · drag to look"; V.walk.y = V.eye = Math.max(V.eye, EYE_STAND); V.wrap.querySelector("#l3d-eye").value = V.walk.y; hideInfo(); }
    else if (m === "seat") { hint.textContent = "Camera at the seated eye level · pick a seat · click any chair"; if (V.eye < 3) { V.eye = EYE_SEATED; } V.wrap.querySelector("#l3d-eye").value = V.eye; applySeat(); }
  }
  function resetOrbit() { V.orbit.az = 0.6; V.orbit.pol = 0.9; V.orbit.rad = Math.max(V.rm.W, V.rm.L) * 1.1; V.orbit.tx = 0; V.orbit.ty = 3; V.orbit.tz = 0; }

  function applySeat() {
    if (!V || !V.seatMeshes.length) { showInfo("No chairs in this layout to view from."); return; }
    var i = Math.max(0, Math.min(V.seatIdx, V.seatMeshes.length - 1));
    var s = V.seatMeshes[i].userData;
    var eye = { x: s.eye.x, y: V.eye, z: s.eye.z };
    var tgt = frontTarget(V.specs);
    V.cam.position.set(eye.x, eye.y, eye.z);
    V.cam.lookAt(tgt.x, tgt.y, tgt.z);
    var seatForObs = { eye: eye, id: s.id };
    var obs = obstructionsForSeat(seatForObs, V.specs);
    var html = "<b>View from Seat " + (i + 1) + "</b> · eye " + V.eye.toFixed(1) + " ft<br>";
    if (obs.length) {
      html += '<span style="color:#a52a22;font-weight:700">⚠ Possible obstruction(s):</span> ' + obs.map(function (o) { return esc(o.label); }).join(", ") + ".";
    } else {
      html += '<span style="color:#1f6b4a;font-weight:700">Clear sightline to the front</span> (by geometry).';
    }
    html += '<br><span style="color:#6b7480;font-size:11.5px">Simulated sightline from entered geometry — not verified visibility. Confirm on site.</span>';
    showInfo(html);
  }
  function showInfo(html) { var i = V.wrap.querySelector("#l3d-info"); i.style.display = ""; i.innerHTML = html; }
  function hideInfo() { var i = V.wrap.querySelector("#l3d-info"); if (i) i.style.display = "none"; }

  /* ---------- camera update per mode ---------- */
  function updateCamera() {
    var c = V.cam;
    if (V.mode === "orbit") {
      var o = V.orbit;
      c.position.set(o.tx + o.rad * Math.sin(o.pol) * Math.cos(o.az), o.ty + o.rad * Math.cos(o.pol), o.tz + o.rad * Math.sin(o.pol) * Math.sin(o.az));
      c.lookAt(o.tx, o.ty, o.tz);
    } else if (V.mode === "walk") {
      var w = V.walk;
      // movement
      var sp = 0.22, mv = { x: 0, z: 0 };
      if (V.keys["w"] || V.keys["arrowup"]) { mv.x += Math.sin(w.yaw); mv.z += -Math.cos(w.yaw); }
      if (V.keys["s"] || V.keys["arrowdown"]) { mv.x -= Math.sin(w.yaw); mv.z -= -Math.cos(w.yaw); }
      if (V.keys["a"] || V.keys["arrowleft"]) { mv.x += -Math.cos(w.yaw); mv.z += -Math.sin(w.yaw); }
      if (V.keys["d"] || V.keys["arrowright"]) { mv.x += Math.cos(w.yaw); mv.z += Math.sin(w.yaw); }
      var nx = w.x + mv.x * sp, nz = w.z + mv.z * sp;
      if (!blocked(nx, w.z)) w.x = nx;
      if (!blocked(w.x, nz)) w.z = nz;
      // clamp to room
      var hw = V.rm.W / 2 - 0.6, hl = V.rm.L / 2 - 0.6;
      w.x = Math.max(-hw, Math.min(hw, w.x)); w.z = Math.max(-hl, Math.min(hl, w.z));
      c.position.set(w.x, w.y, w.z);
      c.lookAt(w.x + Math.sin(w.yaw) * Math.cos(w.pitch), w.y + Math.sin(w.pitch), w.z - Math.cos(w.yaw) * Math.cos(w.pitch));
    }
    // seat mode: camera is fixed by applySeat (+ look drag adjusts via orbit-of-head handled in onPM)
  }
  function blocked(x, z) {
    // simple collision: inside any solid footprint (grown) in XZ
    var hit = false;
    V.specs.forEach(function (s) {
      if (hit || s.role === "floor") return;
      if (s.role === "wall") return;
      var box = specBox(s), g = 0.5;
      if (x > box.x - box.w / 2 - g && x < box.x + box.w / 2 + g && z > box.z - box.l / 2 - g && z < box.z + box.l / 2 + g) {
        if ((box.y + box.h / 2) > 1.0) hit = true; // only things tall enough to block walking
      }
    });
    return hit;
  }

  /* ---------- input ---------- */
  function onPD(e) { V.drag = { x: e.clientX, y: e.clientY, moved: false }; }
  function onPM(e) {
    if (!V || !V.drag) return;
    var dx = e.clientX - V.drag.x, dy = e.clientY - V.drag.y; V.drag.x = e.clientX; V.drag.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) V.drag.moved = true;
    if (V.mode === "orbit") { V.orbit.az += dx * 0.01; V.orbit.pol = Math.max(0.15, Math.min(Math.PI / 2 - 0.02, V.orbit.pol - dy * 0.01)); }
    else if (V.mode === "walk" || V.mode === "seat") {
      var w = V.mode === "walk" ? V.walk : (V.look || (V.look = { yaw: 0, pitch: 0 }));
      if (V.mode === "seat") { // rotate the seat head: adjust lookAt by temporary yaw/pitch
        V.seatYaw = (V.seatYaw || 0) + dx * 0.005; V.seatPitch = Math.max(-0.6, Math.min(0.6, (V.seatPitch || 0) - dy * 0.005));
        var s = V.seatMeshes[V.seatIdx] && V.seatMeshes[V.seatIdx].userData;
        if (s) { var tgt = frontTarget(V.specs); var baseYaw = Math.atan2(tgt.x - s.eye.x, -(tgt.z - s.eye.z)); var yaw = baseYaw + V.seatYaw;
          V.cam.position.set(s.eye.x, V.eye, s.eye.z);
          V.cam.lookAt(s.eye.x + Math.sin(yaw), V.eye + V.seatPitch, s.eye.z - Math.cos(yaw)); }
      } else { w.yaw += dx * 0.005; w.pitch = Math.max(-0.9, Math.min(0.9, w.pitch - dy * 0.005)); }
    }
  }
  function onPU() { if (V) V.drag = null; }
  function onWheel(e) { if (!V) return; e.preventDefault(); if (V.mode === "orbit") { V.orbit.rad = Math.max(3, Math.min(400, V.orbit.rad * (e.deltaY > 0 ? 1.1 : 0.9))); } }
  function onClick(e) {
    if (!V || (V.drag && V.drag.moved)) return;
    var THREE = V.THREE, rect = V.renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    var rc = new THREE.Raycaster(); rc.setFromCamera(mouse, V.cam);
    var hits = rc.intersectObjects(V.seatMeshes, false);
    if (hits.length) {
      var idx = V.seatMeshes.indexOf(hits[0].object);
      if (idx >= 0) { V.seatIdx = idx; V.wrap.querySelector("#l3d-seat").value = idx; setMode("seat"); }
    }
  }
  function onKey(e) { if (!V) return; var k = (e.key || "").toLowerCase(); V.keys[k] = true; if (k === "escape") close(); if ((k === "w" || k === "a" || k === "s" || k === "d" || k.indexOf("arrow") === 0) && V.mode === "walk") e.preventDefault(); }
  function onKeyUp(e) { if (!V) return; V.keys[(e.key || "").toLowerCase()] = false; }
  function onResize() {
    if (!V) return;
    var W = V.wrap.clientWidth, H = V.wrap.clientHeight;
    V.cam.aspect = W / H; V.cam.updateProjectionMatrix(); V.renderer.setSize(W, H);
  }
  function loop() {
    if (!V) return;
    V.raf = requestAnimationFrame(loop);
    if (V.mode !== "seat") updateCamera();
    V.renderer.render(V.scene, V.cam);
  }
  function close() {
    if (!V) { var f = document.getElementById("l3d-wrap"); if (f) f.remove(); return; }
    cancelAnimationFrame(V.raf);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPM);
    window.removeEventListener("pointerup", onPU);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
    try { V.renderer.dispose(); } catch (e) {}
    if (V.wrap && V.wrap.parentNode) V.wrap.parentNode.removeChild(V.wrap);
    V = null;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  /* ---------- public ---------- */
  var Layout3D = {
    open: open, close: close,
    seatView: function (objects, room, params, seatIndex) { open("seat", objects, room, params, {}); if (V) { V.seatIdx = seatIndex || 0; applySeat(); } },
    // pure helpers (testable)
    buildMeshSpecs: buildMeshSpecs, obstructionsForSeat: obstructionsForSeat, frontTarget: frontTarget, segAABB: segAABB
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Layout3D;
  root.Layout3D = Layout3D;
})(typeof window !== "undefined" ? window : globalThis);
