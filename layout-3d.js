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

  /* ---------- procedural furniture factory (visual layer only) ----------
   * Builds recognizable, multi-part meshes (not flat boxes) from the SAME
   * geometry spec the engine produces. The visual model is scaled to the
   * verified footprint; collision/seat/obstruction logic keeps using the pure
   * box specs (addendum §6: visual ≠ geometry). No external assets are fetched,
   * so there is no asset-licensing dependency and nothing to fail to load. */
  // Procedural warm-wood floor texture (no external asset, no license dependency).
  function makeFloorTexture(THREE) {
    try {
      var c = document.createElement("canvas"); c.width = c.height = 512; var x = c.getContext("2d");
      x.fillStyle = "#d9c7a8"; x.fillRect(0, 0, 512, 512);
      var planks = 8, ph = 512 / planks;
      for (var i = 0; i < planks; i++) {
        var y = i * ph;
        x.fillStyle = i % 2 ? "#d3be9c" : "#ddcbae"; x.fillRect(0, y, 512, ph);
        x.strokeStyle = "rgba(120,95,60,.22)"; x.lineWidth = 2; x.strokeRect(0.5, y + 0.5, 511, ph - 1);
        for (var g = 0; g < 46; g++) {
          x.strokeStyle = "rgba(150,120,80," + (0.03 + Math.random() * 0.06) + ")"; x.lineWidth = 1; x.beginPath();
          var yy = y + Math.random() * ph; x.moveTo(0, yy);
          x.bezierCurveTo(170, yy + (Math.random() * 6 - 3), 340, yy + (Math.random() * 6 - 3), 512, yy); x.stroke();
        }
      }
      var t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (THREE.SRGBColorSpace && "colorSpace" in t) { try { t.colorSpace = THREE.SRGBColorSpace; } catch (e) {} }
      return t;
    } catch (e) { return null; }
  }
  function partBox(THREE, H, w, h, l, color, rough, metal, emis) {
    var m = new THREE.Mesh(H.boxGeo(w, h, l), H.mat(color, rough, metal, emis));
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function partCyl(THREE, H, rt, rb, h, color, rough, metal, seg) {
    var m = new THREE.Mesh(H.cylGeo(rt, rb, h, seg), H.mat(color, rough, metal));
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function chairMesh(THREE, H, s, g) {
    var w = s.w || 1.6, l = s.l || 1.6;
    if (s.type === "BARSTOOL") {
      var sh = s.h || 2.5, rad = (s.d || 1.4) / 2 * 0.82;
      var seat = partCyl(THREE, H, rad, rad, 0.18, 0x5b7bb0, 0.6, 0.1, 18); seat.position.y = sh; g.add(seat);
      var pole = partCyl(THREE, H, 0.09, 0.09, sh, 0x2e3b4e, 0.4, 0.6, 10); pole.position.y = sh / 2; g.add(pole);
      var base = partCyl(THREE, H, rad * 0.9, rad * 0.95, 0.08, 0x2e3b4e, 0.4, 0.6, 18); base.position.y = 0.04; g.add(base);
      return { obj: g, seatMesh: seat, floorAnchor: true };
    }
    var seatH = 1.45, seatT = 0.16, legT = 0.09, fabric = 0x6f94c4, frame = 0x2e3b4e;
    var seat2 = partBox(THREE, H, w * 0.9, seatT, l * 0.82, fabric, 0.75, 0); seat2.position.set(0, seatH, 0.03 * l); g.add(seat2);
    var back = partBox(THREE, H, w * 0.9, 1.15, 0.14, fabric, 0.75, 0); back.position.set(0, seatH + 0.6, l * 0.40); g.add(back);
    var lx = w * 0.38, lz = l * 0.36;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (p) {
      var lg = partBox(THREE, H, legT, seatH, legT, frame, 0.5, 0.2); lg.position.set(p[0], seatH / 2, p[1]); g.add(lg);
    });
    return { obj: g, seatMesh: seat2, floorAnchor: true };
  }
  function tableMesh(THREE, H, s, g) {
    var topH = s.h || 2.5, linen = 0xf3efe6, wood = 0xb98a52, woodDark = 0x6f5436;
    if (s.kind === "cyl") {
      var d = s.d || 5, r = d / 2;
      if (s.type === "HIGHTOP") {
        var top = partCyl(THREE, H, r, r, 0.14, 0x4a3b2a, 0.5, 0.1, 24); top.position.y = topH; g.add(top);
        var pole = partCyl(THREE, H, 0.12, 0.12, topH, 0x3a3f47, 0.4, 0.6, 12); pole.position.y = topH / 2; g.add(pole);
        var base = partCyl(THREE, H, r * 0.55, r * 0.62, 0.1, 0x3a3f47, 0.4, 0.6, 20); base.position.y = 0.05; g.add(base);
        return { obj: g, floorAnchor: true };
      }
      var cloth = partCyl(THREE, H, r * 0.98, r * 1.02, topH, linen, 0.9, 0, 26); cloth.position.y = topH / 2; g.add(cloth);
      var topr = partCyl(THREE, H, r * 1.02, r * 1.02, 0.08, linen, 0.85, 0, 28); topr.position.y = topH + 0.02; g.add(topr);
      // simple floral centerpiece → realism cue on banquet rounds
      var vase = partCyl(THREE, H, 0.22, 0.28, 0.55, 0xeef2f4, 0.25, 0.1, 12); vase.position.y = topH + 0.3; g.add(vase);
      try {
        var floral = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), H.mat(0x7d9e63, 0.85, 0));
        floral.position.y = topH + 0.95; floral.castShadow = true; g.add(floral);
      } catch (e) {}
      return { obj: g, floorAnchor: true };
    }
    var w = s.w || 6, l = s.l || 2.5;
    var skirted = /^TBL_|DISPLAY_TBL|REG_TABLE|BUFFET|COFFEE|CATERING|CRESCENT|HALFRND/.test(s.type || "");
    if (skirted) {
      var clothb = partBox(THREE, H, w, topH, l, linen, 0.9, 0); clothb.position.y = topH / 2; g.add(clothb);
      var topb = partBox(THREE, H, w + 0.06, 0.08, l + 0.06, linen, 0.85, 0); topb.position.y = topH + 0.02; g.add(topb);
      return { obj: g, floorAnchor: true };
    }
    var topT = 0.14;
    var topw = partBox(THREE, H, w, topT, l, wood, 0.55, 0.05); topw.position.y = topH; g.add(topw);
    var lxx = w * 0.44, lzz = l * 0.40, legT2 = 0.14, legH = topH - topT / 2;
    [[-lxx, -lzz], [lxx, -lzz], [-lxx, lzz], [lxx, lzz]].forEach(function (p) {
      var lg = partBox(THREE, H, legT2, legH, legT2, woodDark, 0.5, 0.1); lg.position.set(p[0], legH / 2, p[1]); g.add(lg);
    });
    return { obj: g, floorAnchor: true };
  }
  function equipMesh(THREE, H, s, g) {
    var t = s.type || "", h = s.h || 3, w = s.w || 3, l = s.l || 2;
    if (t === "STAGE" || t === "RISER" || t === "STAGE_STAIRS") {
      var deck = partBox(THREE, H, w, h, l, 0x3b4654, 0.85, 0); deck.position.y = h / 2; g.add(deck);
      var topc = partBox(THREE, H, w - 0.2, 0.08, l - 0.2, 0x59677a, 0.8, 0); topc.position.y = h + 0.01; g.add(topc);
      var steps = 2; for (var i = 0; i < steps; i++) { var shh = h * (i + 1) / (steps + 1); var st = partBox(THREE, H, Math.min(w * 0.4, 5), shh, 0.9, 0x3b4654, 0.85, 0); st.position.set(0, shh / 2, -l / 2 - 0.5 - i * 0.9); g.add(st); }
      return { obj: g, floorAnchor: true };
    }
    if (t === "SCREEN") {
      var sh = h, sw = w, lift = 1.0;
      var frame = partBox(THREE, H, sw + 0.2, sh + 0.2, 0.1, 0x22262b, 0.5, 0.3); frame.position.y = sh / 2 + lift; g.add(frame);
      var surf = partBox(THREE, H, sw, sh, 0.06, 0xf7f7fb, 0.3, 0, 0xaab4c6); surf.position.set(0, sh / 2 + lift, 0.06); g.add(surf);
      [-sw * 0.35, sw * 0.35].forEach(function (x) { var lg = partBox(THREE, H, 0.1, lift, 0.1, 0x22262b, 0.4, 0.4); lg.position.set(x, lift / 2, 0); g.add(lg); });
      return { obj: g, floorAnchor: true };
    }
    if (t === "LED_WALL") {
      var panel = partBox(THREE, H, w, h, 0.4, 0x0a0e14, 0.3, 0.2, 0x1b3b6b); panel.position.y = h / 2 + 0.5; g.add(panel);
      var bz = partBox(THREE, H, w + 0.2, h + 0.2, 0.2, 0x16181c, 0.5, 0.4); bz.position.y = h / 2 + 0.5; g.add(bz);
      return { obj: g, floorAnchor: true };
    }
    if (t === "TV_MONITOR") {
      var pw = Math.min(w, 4.5), ph = pw * 0.56;
      var pole = partBox(THREE, H, 0.16, h, 0.16, 0x2b2f36, 0.4, 0.5); pole.position.y = h / 2; g.add(pole);
      var base = partBox(THREE, H, w * 0.7, 0.1, l * 0.7, 0x2b2f36, 0.4, 0.5); base.position.y = 0.05; g.add(base);
      var panelm = partBox(THREE, H, pw, ph, 0.14, 0x0a0e14, 0.3, 0.2, 0x16304f); panelm.position.y = h - ph * 0.5 - 0.3; g.add(panelm);
      return { obj: g, floorAnchor: true };
    }
    if (t === "PODIUM") {
      var body = partBox(THREE, H, w * 0.8, h * 0.72, l * 0.7, 0x6f5436, 0.6, 0); body.position.y = h * 0.36; g.add(body);
      var top = partBox(THREE, H, w, 0.12, l * 0.8, 0x4a3b2a, 0.5, 0); top.position.y = h * 0.78; top.rotation.x = -0.18; g.add(top);
      return { obj: g, floorAnchor: true };
    }
    if (t === "SPEAKER" || t === "MIC_STAND" || t === "CAMERA" || t === "LIGHT" || t === "PROJECTOR" || t === "SIGNAGE") {
      var pl = partBox(THREE, H, 0.12, h, 0.12, 0x2b2f36, 0.4, 0.5); pl.position.y = h / 2; g.add(pl);
      var bs = partCyl(THREE, H, Math.max(w, l) * 0.32, Math.max(w, l) * 0.4, 0.08, 0x2b2f36, 0.4, 0.5, 16); bs.position.y = 0.04; g.add(bs);
      var hh = Math.min(h * 0.3, 2);
      var head = partBox(THREE, H, w * 0.8, hh, l * 0.8, 0x3a3f47, 0.5, 0.2); head.position.y = h - hh * 0.5 - 0.2; g.add(head);
      return { obj: g, floorAnchor: true };
    }
    if (t === "DRAPE" || t === "PARTITION") {
      var pw2 = partBox(THREE, H, w, h, Math.max(s.l || 0.6, 0.3), (t === "DRAPE" ? 0x3a4256 : 0xd8d2c4), 0.9, 0); pw2.position.y = h / 2; g.add(pw2);
      return { obj: g, floorAnchor: true };
    }
    if (t === "AV_BOOTH" || t === "BAR" || t === "WATER" || t === "BOOTH") {
      var bd = partBox(THREE, H, w, h, l, 0x8a93a3, 0.7, 0.1); bd.position.y = h / 2; g.add(bd);
      var tp = partBox(THREE, H, w + 0.1, 0.1, l + 0.1, 0x5b6472, 0.6, 0.2); tp.position.y = h + 0.05; g.add(tp);
      return { obj: g, floorAnchor: true };
    }
    var body2 = partBox(THREE, H, w, h, l, s.color || 0xb9a7e0, 0.8, 0); body2.position.y = h / 2; g.add(body2);
    return { obj: g, floorAnchor: true };
  }
  function buildFurniture(THREE, s, H) {
    if (s.role === "floor") { var fm = new THREE.Mesh(H.boxGeo(s.w, s.h, s.l), H.mat(0xe9e0cb, 0.95, 0)); fm.receiveShadow = true; return { obj: fm, floorAnchor: false }; }
    if (s.role === "wall") { var wm = new THREE.Mesh(H.boxGeo(s.w, s.h, s.l), H.mat(0xeef0f3, 0.9, 0)); wm.receiveShadow = true; return { obj: wm, floorAnchor: false }; }
    if (s.role === "column") { var cm = partBox(THREE, H, s.w, s.h, s.l, 0xb9b2a4, 0.9, 0); return { obj: cm, floorAnchor: false }; }
    var g = new THREE.Group();
    if (s.role === "chair") return chairMesh(THREE, H, s, g);
    if (s.role === "table") return tableMesh(THREE, H, s, g);
    if (s.role === "equipment") return equipMesh(THREE, H, s, g);
    var fb = partBox(THREE, H, s.w || s.d || 2, s.h || 2.5, s.l || s.d || 2, s.color || 0xcccccc, 0.8, 0);
    fb.position.y = (s.h || 2.5) / 2; g.add(fb); return { obj: g, floorAnchor: true };
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
    scene.background = new THREE.Color(0x101c2e);
    var farD = Math.max(rm.W, rm.L);
    scene.fog = new THREE.Fog(0x101c2e, farD * 1.3, farD * 3.4);
    // Lighting: soft ambient + hemisphere sky/ground + warm key with shadows + cool fill
    var hemi = new THREE.HemisphereLight(0xfdfbf5, 0x39414f, 0.55); scene.add(hemi);
    var amb = new THREE.AmbientLight(0xffffff, 0.32); scene.add(amb);
    var key = new THREE.DirectionalLight(0xfff3df, 0.95);
    key.position.set(rm.W * 0.5, rm.ceil * 2.4, rm.L * 0.38);
    key.castShadow = true;
    key.shadow.mapSize.width = key.shadow.mapSize.height = 2048;
    var sr = Math.max(rm.W, rm.L) * 0.8;
    key.shadow.camera.left = -sr; key.shadow.camera.right = sr;
    key.shadow.camera.top = sr; key.shadow.camera.bottom = -sr;
    key.shadow.camera.near = 1; key.shadow.camera.far = rm.ceil * 6;
    key.shadow.bias = -0.0004; key.shadow.radius = 3;
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xdbe4f2, 0.28); fill.position.set(-rm.W * 0.45, rm.ceil * 1.6, -rm.L * 0.45); scene.add(fill);

    var W = wrap.clientWidth, H = wrap.clientHeight;
    var cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) { try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch (e) {} }
    // photographic tone mapping → warmer, more realistic gradients (Prismm-like)
    if (THREE.ACESFilmicToneMapping != null) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
    renderer.domElement.style.cssText = "position:absolute;inset:0";
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    // geometry + material caches → lite instancing (shared geo/mat, per-object matrix)
    var GC = {}, MC = {};
    var H3 = {
      mat: function (color, rough, metal, emis) {
        var k = color + "_" + (rough == null ? 0.85 : rough) + "_" + (metal || 0) + "_" + (emis || 0);
        if (MC[k]) return MC[k];
        var m = new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0 });
        if (emis) { m.emissive = new THREE.Color(emis); m.emissiveIntensity = 0.85; }
        MC[k] = m; return m;
      },
      boxGeo: function (w, h, l) { var k = "b" + w.toFixed(3) + "_" + h.toFixed(3) + "_" + l.toFixed(3); return GC[k] || (GC[k] = new THREE.BoxGeometry(w, h, l)); },
      cylGeo: function (rt, rb, h, seg) { var k = "c" + rt.toFixed(3) + "_" + rb.toFixed(3) + "_" + h.toFixed(3) + "_" + (seg || 20); return GC[k] || (GC[k] = new THREE.CylinderGeometry(rt, rb, h, seg || 20)); }
    };

    // realistic wood floor (procedural texture → no external asset)
    var floorMat = new THREE.MeshStandardMaterial({ map: makeFloorTexture(THREE), roughness: 0.82, metalness: 0.04 });
    if (floorMat.map) { floorMat.map.repeat.set(Math.max(2, rm.W / 8), Math.max(2, rm.L / 8)); }

    // ceiling (visual only — kept out of pure specs so engine/tests are unchanged)
    var ceilMesh = new THREE.Mesh(H3.boxGeo(rm.W, 0.2, rm.L), H3.mat(0xf6f3ec, 0.95, 0));
    ceilMesh.position.set(0, rm.ceil, 0); ceilMesh.receiveShadow = true; scene.add(ceilMesh);

    // build meshes via furniture factory
    var seatMeshes = [];
    var meshById = {};
    var wallMeshes = [];
    specs.forEach(function (s) {
      var node = buildFurniture(THREE, s, H3);
      if (!node) return;
      node.obj.position.set(s.x, node.floorAnchor ? 0 : s.y, s.z);
      if (s.rot) node.obj.rotation.y = -s.rot * Math.PI / 180;
      node.obj.userData = s;
      scene.add(node.obj);
      if (s.id) meshById[s.id] = node.obj;
      if (s.seat && node.seatMesh) { node.seatMesh.userData = s; seatMeshes.push(node.seatMesh); }
      if (s.role === "wall") { node.obj.userData = s; wallMeshes.push(node.obj); }
      if (s.role === "floor") { node.obj.material = floorMat; node.obj.receiveShadow = true; }
    });

    V = { THREE: THREE, wrap: wrap, scene: scene, cam: cam, renderer: renderer, specs: specs, rm: rm,
      seatMeshes: seatMeshes, meshById: meshById, wallMeshes: wallMeshes, ceilMesh: ceilMesh, mode: null, raf: 0,
      orbit: { az: 0.6, pol: 0.9, rad: Math.max(rm.W, rm.L) * 1.1, tx: 0, ty: 3, tz: 0 },
      walk: { x: 0, y: EYE_STAND, z: rm.L / 2 - 4, yaw: 0, pitch: -0.05 },
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
  // Dollhouse cutaway: in orbit, hide the 2 walls + ceiling nearest the camera so
  // the furnished interior is always visible; inside modes (walk/seat) keep them.
  function updateWalls() {
    if (!V || !V.wallMeshes) return;
    var inside = (V.mode === "walk" || V.mode === "seat");
    var cx = V.cam.position.x, cz = V.cam.position.z;
    V.wallMeshes.forEach(function (m) {
      var s = m.userData || {};
      if (inside) { m.visible = true; return; }
      if (Math.abs(s.x) > 0.1) m.visible = !(Math.sign(s.x) === Math.sign(cx));
      else if (Math.abs(s.z) > 0.1) m.visible = !(Math.sign(s.z) === Math.sign(cz));
      else m.visible = true;
    });
    if (V.ceilMesh) V.ceilMesh.visible = inside;
  }
  function loop() {
    if (!V) return;
    V.raf = requestAnimationFrame(loop);
    if (V.mode !== "seat") updateCamera();
    updateWalls();
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
