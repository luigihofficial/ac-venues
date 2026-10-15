/* ============================================================================
 * AC VENUES — LAYOUT EDITOR UI (2D, true-scale SVG, vanilla, no libraries)
 * Depends on window.LayoutEngine. Call LayoutUI.render(mountEl) to build it.
 * Shares ONE geometry model (feet). Interactions: zoom/pan/drag/rotate/snap/
 * duplicate/delete/undo-redo, live recalculation, published/estimated/validated.
 * Persistence hooks: LayoutUI.onSave / onLoad (wired to Supabase at integration).
 * ==========================================================================*/
(function (root) {
  "use strict";
  var E = root.LayoutEngine;
  var CSS_ID = "lay-css";

  var LAYOUT_OPTS = [
    "THEATER", "CLASSROOM", "U_SHAPE", "DOUBLE_U", "TRIPLE_U", "BOARDROOM",
    "HOLLOW_SQUARE", "BANQUET", "CABARET", "CHEVRON", "PODS", "SEMICIRCLE", "RECEPTION"
  ];

  // module state
  var L = {
    mount: null, svg: null, g: null, built: false,
    room: { name: "", venue: "", unit: "ft", width: 45, length: 50, ceilingHeight: 12, wallClearance: 1, obstructions: [], doors: [], reservedZones: [] },
    params: { layout: "DOUBLE_U", target: 40, stage: false, screen: true, av: true, aisle: 3.5, rowGap: 2.2, chairGap: 0.2, tableGap: 1.0, chairClear: 2.0 },
    published: null,
    objects: [],
    sel: null,
    view: { scale: 10, ox: 20, oy: 20 },
    hist: [], redo: [],
    drag: null
  };

  /* ---------- CSS ---------- */
  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style"); s.id = CSS_ID;
    s.textContent = [
      ".lay-wrap{display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start}",
      "@media(max-width:860px){.lay-wrap{grid-template-columns:1fr}}",
      ".lay-panel{background:var(--card,#fffdf8);border:1px solid var(--line,#e6ddca);border-radius:12px;padding:14px}",
      ".lay-panel h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold,#b8860b)}",
      ".lay-f{display:block;font-size:11.5px;font-weight:700;color:var(--navy,#1e3a5f);margin:8px 0 3px}",
      ".lay-panel input,.lay-panel select{width:100%;padding:7px 9px;border:1px solid var(--line,#e6ddca);border-radius:8px;font-size:13px;background:#fff;color:#22303f}",
      ".lay-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".lay-chk{display:flex;align-items:center;gap:6px;font-size:12.5px;margin:6px 0;font-weight:600;color:#22303f}",
      ".lay-chk input{width:auto}",
      ".lay-btn{background:linear-gradient(135deg,var(--navy,#1e3a5f),var(--navyd,#14263f));color:#fff;border:none;border-radius:9px;padding:10px 14px;font-size:13.5px;font-weight:700;cursor:pointer;width:100%;margin-top:10px}",
      ".lay-btn.ghost{background:#fff;border:1px solid var(--line,#e6ddca);color:var(--navy,#1e3a5f)}",
      ".lay-stage{position:relative}",
      ".lay-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}",
      ".lay-tools button{background:#fff;border:1px solid var(--line,#e6ddca);border-radius:8px;padding:6px 10px;font-size:12.5px;cursor:pointer;color:#22303f;font-weight:600}",
      ".lay-tools button:hover{background:#f3eee2}",
      "#layCanvas{width:100%;height:560px;background:#fcfaf4;border:1px solid var(--line,#e6ddca);border-radius:12px;touch-action:none;display:block}",
      ".lay-room{fill:#ffffff;stroke:#8a7a4a;stroke-width:2;vector-effect:non-scaling-stroke}",
      ".lay-grid{stroke:#eee3c9;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tbl{fill:#d8c79a;stroke:#9c853f;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-chair{fill:#6f94c4;stroke:#3c5f91;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-equip{fill:#c9b8e0;stroke:#7a5fae;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-obst{fill:#d98b8b;stroke:#9c3f3f;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-door{fill:none;stroke:#2e7d5b;stroke-width:3;vector-effect:non-scaling-stroke}",
      ".lay-bad{fill:#e2574f !important;stroke:#a52a22 !important}",
      ".lay-sel{stroke:#b8860b !important;stroke-width:2.5 !important}",
      ".lay-dim{font-size:12px;fill:#6b7480}",
      "#layReadout{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px}",
      ".lay-stat{background:var(--card,#fffdf8);border:1px solid var(--line,#e6ddca);border-radius:10px;padding:8px 12px;min-width:120px}",
      ".lay-stat .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#8a9199;font-weight:700}",
      ".lay-stat .v{font-size:19px;font-weight:800;color:var(--navy,#1e3a5f)}",
      ".lay-stat small{display:block;font-size:10.5px;color:#8a9199;font-weight:600}",
      ".lay-fit{font-weight:800;padding:8px 12px;border-radius:10px;font-size:14px}",
      ".fit-FIT{background:#e4f1ea;color:#1f6b4a;border:1px solid #bfe0cf}",
      ".fit-CONDITIONAL{background:#fbf4e2;color:#8a6a20;border:1px solid #e6d6bb}",
      ".fit-DOES_NOT_FIT{background:#fbe6e4;color:#a52a22;border:1px solid #e9c4c0}",
      ".fit-UNKNOWN{background:#eef0f3;color:#5b6472;border:1px solid #dde1e7}",
      ".lay-warn{font-size:12px;color:#a52a22;margin-top:6px}",
      ".lay-note{font-size:11.5px;color:#6b7480;margin-top:8px;line-height:1.5}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---------- build DOM ---------- */
  function buildUI(mount) {
    injectCss();
    var opts = LAYOUT_OPTS.map(function (id) {
      var m = E.LAYOUT_META[id] || { name: id };
      return '<option value="' + id + '"' + (id === L.params.layout ? " selected" : "") + ">" + m.name + (m.priority ? " ★" : "") + "</option>";
    }).join("");
    mount.innerHTML =
      '<h2 style="margin:0 0 4px">Meeting Room Layout &amp; Capacity</h2>' +
      '<p class="lay-note" style="margin:0 0 12px">Planning tool. A room’s published capacity is <b>not</b> proof a layout fits — the engine reports published, estimated and <b>geometrically validated</b> capacity, and never claims an official fire/occupancy approval.</p>' +
      '<div class="lay-wrap">' +
        '<div>' +
          '<div class="lay-panel">' +
            "<h3>Room</h3>" +
            '<label class="lay-f">Venue / hotel</label><input id="layVenue">' +
            '<label class="lay-f">Room name</label><input id="layRoom">' +
            '<div class="lay-row"><div><label class="lay-f">Width</label><input id="layW" type="number" step="0.1"></div>' +
              '<div><label class="lay-f">Length</label><input id="layL" type="number" step="0.1"></div></div>' +
            '<div class="lay-row"><div><label class="lay-f">Unit</label><select id="layUnit"><option value="ft">feet</option><option value="m">meters</option></select></div>' +
              '<div><label class="lay-f">Ceiling</label><input id="layCeil" type="number" step="0.1"></div></div>' +
            '<div class="lay-row"><div><label class="lay-f">Perimeter clearance</label><input id="layWall" type="number" step="0.1"></div>' +
              '<div><label class="lay-f">Published cap.</label><input id="layPub" type="number" step="1" placeholder="optional"></div></div>' +
            '<label class="lay-f">Columns / obstacles (x,y,w,l ; one per line, in unit)</label><input id="layObst" placeholder="e.g. 22,25,2,2">' +
          "</div>" +
          '<div class="lay-panel" style="margin-top:12px">' +
            "<h3>Event &amp; layout</h3>" +
            '<label class="lay-f">Layout</label><select id="layType">' + opts + "</select>" +
            '<div class="lay-row"><div><label class="lay-f">Attendees</label><input id="layTarget" type="number" step="1"></div>' +
              '<div><label class="lay-f">High-tops (reception)</label><input id="layHigh" type="number" step="1" value="0"></div></div>' +
            '<label class="lay-chk"><input type="checkbox" id="layStage"> Stage</label>' +
            '<label class="lay-chk"><input type="checkbox" id="layScreen"> Projection screen</label>' +
            '<label class="lay-chk"><input type="checkbox" id="layAv"> AV / control booth</label>' +
          "</div>" +
          '<div class="lay-panel" style="margin-top:12px">' +
            "<h3>Spacing (ft)</h3>" +
            '<div class="lay-row"><div><label class="lay-f">Aisle</label><input id="layAisle" type="number" step="0.1"></div>' +
              '<div><label class="lay-f">Row gap</label><input id="layRowGap" type="number" step="0.1"></div></div>' +
            '<div class="lay-row"><div><label class="lay-f">Chair clearance</label><input id="layChairClear" type="number" step="0.1"></div>' +
              '<div><label class="lay-f">Table gap</label><input id="layTableGap" type="number" step="0.1"></div></div>' +
            '<button class="lay-btn" id="layGen">Generate layout</button>' +
            '<button class="lay-btn ghost" id="laySave">Save to venue</button>' +
            '<div class="lay-row" style="margin-top:8px"><button class="lay-btn ghost" id="layLoad" style="margin-top:0">Load saved</button>' +
              '<button class="lay-btn ghost" id="layJson" style="margin-top:0">Export JSON</button></div>' +
            '<button class="lay-btn ghost" id="layPng">Export PNG</button>' +
          "</div>" +
        "</div>" +
        '<div class="lay-stage">' +
          '<div class="lay-tools">' +
            '<button data-z="in">+ Zoom</button><button data-z="out">− Zoom</button><button data-z="fit">Fit</button>' +
            '<button id="layRot">Rotate 15°</button><button id="layDup">Duplicate</button><button id="layDel">Delete</button>' +
            '<button id="layUndo">Undo</button><button id="layRedo">Redo</button>' +
          "</div>" +
          '<svg id="layCanvas"></svg>' +
          '<div id="layReadout"></div>' +
          '<div class="lay-warn" id="layWarn"></div>' +
          '<div class="lay-note" id="layMsg"></div>' +
        "</div>" +
      "</div>";

    L.mount = mount;
    L.svg = document.getElementById("layCanvas");
    syncFormFromState();
    wire();
    L.built = true;
  }

  function syncFormFromState() {
    var r = L.room, p = L.params;
    set("layVenue", r.venue); set("layRoom", r.name); set("layW", r.width); set("layL", r.length);
    set("layUnit", r.unit); set("layCeil", r.ceilingHeight); set("layWall", r.wallClearance);
    set("layPub", L.published != null ? L.published : "");
    set("layObst", (r.obstructions || []).map(function (o) { return [o.x, o.y, o.w, o.l].join(","); }).join(" ; "));
    set("layType", p.layout); set("layTarget", p.target); set("layHigh", p.highTops || 0);
    chk("layStage", p.stage); chk("layScreen", p.screen); chk("layAv", p.av);
    set("layAisle", p.aisle); set("layRowGap", p.rowGap); set("layChairClear", p.chairClear); set("layTableGap", p.tableGap);
  }
  function readFormToState() {
    var r = L.room, p = L.params;
    r.venue = val("layVenue"); r.name = val("layRoom");
    r.width = num("layW", 45); r.length = num("layL", 50); r.unit = val("layUnit") || "ft";
    r.ceilingHeight = num("layCeil", 12); r.wallClearance = num("layWall", 1);
    L.published = val("layPub") !== "" ? num("layPub", null) : null;
    r.obstructions = parseObst(val("layObst"), r.unit);
    p.layout = val("layType"); p.target = num("layTarget", 40); p.highTops = num("layHigh", 0);
    p.stage = chkv("layStage"); p.screen = chkv("layScreen"); p.av = chkv("layAv");
    p.aisle = num("layAisle", 3.5); p.rowGap = num("layRowGap", 2.2);
    p.chairClear = num("layChairClear", 2.0); p.tableGap = num("layTableGap", 1.0);
  }
  function parseObst(s, unit) {
    if (!s) return [];
    return s.split(/[;\n]/).map(function (line) {
      var a = line.split(",").map(function (x) { return parseFloat(x.trim()); });
      if (a.length >= 4 && a.every(function (n) { return !isNaN(n); }))
        return { x: a[0], y: a[1], w: a[2], l: a[3], label: "Column", category: "obstruction" };
      return null;
    }).filter(Boolean);
  }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function set(id, v) { var e = $(id); if (e) e.value = (v == null ? "" : v); }
  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function num(id, d) { var e = $(id); var n = e ? parseFloat(e.value) : NaN; return isNaN(n) ? d : n; }
  function chk(id, v) { var e = $(id); if (e) e.checked = !!v; }
  function chkv(id) { var e = $(id); return e ? !!e.checked : false; }
  function pushHist() { L.hist.push(JSON.stringify(L.objects)); if (L.hist.length > 60) L.hist.shift(); L.redo = []; }

  /* ---------- generate + recalc ---------- */
  function regenerate() {
    readFormToState();
    var res = E.generate(L.params.layout, L.room, Object.assign({}, L.params));
    pushHist();
    L.objects = res.objects.map(cloneObj);
    L.sel = null;
    fitView();
    render(); recalc();
    msg("Generated " + (E.LAYOUT_META[L.params.layout] || {}).name + " — drag, rotate or delete pieces and the capacity updates live.");
  }
  function cloneObj(o) { return JSON.parse(JSON.stringify(o)); }

  function recalc() {
    var v = E.validate(L.objects, L.room, {});
    var est = L.params.layout === "RECEPTION" ? null : E.estimatedCapacity(L.params.layout, L.room);
    var fit = E.assessFit(L.params.layout, L.room, L.params.target, Object.assign({}, L.params));
    // after manual edits, "validated" = current feasible seat count
    var seats = L.objects.filter(function (o) { return o.category === "chair"; }).length;
    var validatedNow = v.feasible ? seats : countNonViolatingChairs(v);
    // highlight violations
    var badIds = {};
    v.violations.forEach(function (x) { x.ids.forEach(function (id) { badIds[id] = 1; }); });
    [].forEach.call(L.svg.querySelectorAll("[data-id]"), function (el) {
      el.classList.toggle("lay-bad", !!badIds[el.getAttribute("data-id")]);
    });

    var reception = L.params.layout === "RECEPTION";
    var standing = reception ? (E.validatedCapacity("RECEPTION", L.room, L.params).standingEstimate) : null;
    readout([
      stat("Published", L.published != null ? L.published : "—", "as advertised"),
      stat("Estimated", reception ? standing : est, reception ? "standing, by density" : "by area, approx"),
      stat("Validated", reception ? "—" : validatedNow, reception ? "n/a (standing)" : "seats passing checks"),
      stat("Requested", L.params.target, "attendees")
    ]);
    var fitEl = '<div class="lay-fit fit-' + fit.status + '">' + fit.status.replace(/_/g, " ") + " — " + esc(fit.reason) + "</div>";
    $("layReadout").insertAdjacentHTML("beforeend", fitEl);
    warn(v.feasible ? "" : (v.violations.length + " conflict(s): " + v.violations.slice(0, 4).map(function (x) { return x.msg; }).join("; ") + (v.violations.length > 4 ? "…" : "")));
  }
  function countNonViolatingChairs(v) {
    var bad = {}; v.violations.forEach(function (x) { x.ids.forEach(function (id) { bad[id] = 1; }); });
    return L.objects.filter(function (o) { return o.category === "chair" && !bad[o.id]; }).length;
  }

  function stat(k, v, sub) {
    return '<div class="lay-stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v == null ? "—" : v) + "</div><small>" + esc(sub) + "</small></div>";
  }
  function readout(parts) { $("layReadout").innerHTML = parts.join(""); }
  function warn(t) { var e = $("layWarn"); if (e) e.textContent = t || ""; }
  function msg(t) { var e = $("layMsg"); if (e) e.textContent = t || ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  /* ---------- SVG render ---------- */
  function fitView() {
    var r = E.normalizeRoom(L.room);
    var cw = L.svg.clientWidth || 700, ch = L.svg.clientHeight || 560;
    var pad = 24;
    var s = Math.min((cw - 2 * pad) / r.width, (ch - 2 * pad) / r.length);
    L.view.scale = s; L.view.ox = (cw - r.width * s) / 2; L.view.oy = (ch - r.length * s) / 2;
  }
  function render() {
    var r = E.normalizeRoom(L.room), vw = L.view;
    var parts = ['<g transform="translate(' + vw.ox + "," + vw.oy + ") scale(" + vw.scale + ')">'];
    // room
    parts.push('<rect class="lay-room" x="0" y="0" width="' + r.width + '" height="' + r.length + '"></rect>');
    // grid every 5 ft
    for (var gx = 5; gx < r.width; gx += 5) parts.push('<line class="lay-grid" x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + r.length + '"></line>');
    for (var gy = 5; gy < r.length; gy += 5) parts.push('<line class="lay-grid" x1="0" y1="' + gy + '" x2="' + r.width + '" y2="' + gy + '"></line>');
    // obstructions
    r.obstructions.forEach(function (o) { parts.push(rectSvg(o, "lay-obst")); });
    r.reservedZones.forEach(function (o) { parts.push(rectSvg(o, "lay-obst")); });
    r.doors.forEach(function (d) { parts.push('<line class="lay-door" x1="' + d.x + '" y1="' + d.y + '" x2="' + (d.x + d.w) + '" y2="' + d.y + '"></line>'); });
    // objects
    L.objects.forEach(function (o) {
      var cls = o.category === "chair" ? "lay-chair" : o.category === "equipment" ? "lay-equip" : "lay-tbl";
      if (L.sel === o.id) cls += " lay-sel";
      if (o.kind === "circle") parts.push('<circle data-id="' + o.id + '" class="' + cls + '" cx="' + o.x + '" cy="' + o.y + '" r="' + (o.d / 2) + '"></circle>');
      else parts.push(rectSvg(o, cls, o.id));
    });
    parts.push("</g>");
    // dimension labels (screen space)
    parts.push('<text class="lay-dim" x="' + (vw.ox + r.width * vw.scale / 2 - 20) + '" y="' + (vw.oy - 6) + '">' + fmtDim(r.width) + "</text>");
    parts.push('<text class="lay-dim" x="' + (vw.ox - 18) + '" y="' + (vw.oy + r.length * vw.scale / 2) + '" transform="rotate(-90 ' + (vw.ox - 18) + " " + (vw.oy + r.length * vw.scale / 2) + ')">' + fmtDim(r.length) + "</text>");
    L.svg.innerHTML = parts.join("");
  }
  function rectSvg(o, cls, id) {
    var idAttr = id ? ' data-id="' + id + '"' : "";
    var rot = o.r ? ' transform="rotate(' + o.r + " " + o.x + " " + o.y + ')"' : "";
    return '<rect' + idAttr + ' class="' + cls + '" x="' + (o.x - o.w / 2) + '" y="' + (o.y - o.l / 2) + '" width="' + o.w + '" height="' + o.l + '"' + rot + "></rect>";
  }
  function fmtDim(ft) {
    if (L.room.unit === "m") return E.round2(E.ft2m(ft)) + " m";
    return E.round2(ft) + " ft";
  }

  /* ---------- interaction ---------- */
  function screenToFeet(clientX, clientY) {
    var rect = L.svg.getBoundingClientRect();
    return { x: (clientX - rect.left - L.view.ox) / L.view.scale, y: (clientY - rect.top - L.view.oy) / L.view.scale };
  }
  function wire() {
    $("layGen").onclick = regenerate;
    $("laySave").onclick = doSave;
    $("layLoad").onclick = doLoad;
    $("layJson").onclick = exportJson;
    $("layPng").onclick = exportPng;
    $("layRot").onclick = function () { if (rotateSel(15)) { render(); recalc(); } };
    $("layDup").onclick = function () { if (dupSel()) { render(); recalc(); } };
    $("layDel").onclick = function () { if (delSel()) { render(); recalc(); } };
    $("layUndo").onclick = undo; $("layRedo").onclick = redo;
    L.mount.querySelectorAll(".lay-tools [data-z]").forEach(function (b) {
      b.onclick = function () { var z = b.getAttribute("data-z"); if (z === "fit") fitView(); else zoomAt(z === "in" ? 1.2 : 1 / 1.2, L.svg.clientWidth / 2, L.svg.clientHeight / 2); render(); };
    });
    // pointer drag/pan/select
    L.svg.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    L.svg.addEventListener("wheel", function (e) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.offsetX, e.offsetY); render(); }, { passive: false });
    // keyboard shortcuts while editor visible
    document.addEventListener("keydown", function (e) {
      if ($("layout") && $("layout").style.display === "none") return;
      if (/input|select|textarea/i.test((e.target.tagName || ""))) return;
      if (e.key === "r" || e.key === "R") { if (rotateSel(15)) { render(); recalc(); } }
      else if (e.key === "Delete" || e.key === "Backspace") { if (delSel()) { render(); recalc(); } }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); if (dupSel()) { render(); recalc(); } }
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); }
    });
  }
  function onDown(e) {
    var id = e.target.getAttribute && e.target.getAttribute("data-id");
    var pt = screenToFeet(e.clientX, e.clientY);
    if (id) {
      L.sel = id; var o = L.objects.find(function (x) { return x.id === id; });
      pushHist();
      L.drag = { id: id, dx: pt.x - o.x, dy: pt.y - o.y, moved: false };
      render();
    } else {
      L.sel = null;
      L.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: L.view.ox, oy: L.view.oy };
      render();
    }
  }
  function onMove(e) {
    if (!L.drag) return;
    if (L.drag.pan) { L.view.ox = L.drag.ox + (e.clientX - L.drag.sx); L.view.oy = L.drag.oy + (e.clientY - L.drag.sy); render(); return; }
    var pt = screenToFeet(e.clientX, e.clientY);
    var o = L.objects.find(function (x) { return x.id === L.drag.id; });
    if (!o) return;
    o.x = snap(pt.x - L.drag.dx); o.y = snap(pt.y - L.drag.dy);
    L.drag.moved = true;
    render();
  }
  function onUp() {
    if (L.drag && L.drag.moved) recalc();
    if (L.drag && !L.drag.moved && !L.drag.pan) { /* click select only */ }
    L.drag = null;
  }
  function snap(v) { var grid = 0.5; return Math.round(v / grid) * grid; }
  function zoomAt(factor, px, py) {
    var before = { x: (px - L.view.ox) / L.view.scale, y: (py - L.view.oy) / L.view.scale };
    L.view.scale *= factor;
    L.view.ox = px - before.x * L.view.scale; L.view.oy = py - before.y * L.view.scale;
  }
  function rotateSel(d) { var o = cur(); if (!o) return false; pushHist(); o.r = ((o.r || 0) + d) % 360; return true; }
  function dupSel() { var o = cur(); if (!o) return false; pushHist(); var c = cloneObj(o); c.id = "o_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); c.x = snap(o.x + 2); c.y = snap(o.y + 2); L.objects.push(c); L.sel = c.id; return true; }
  function delSel() { var o = cur(); if (!o) return false; pushHist(); L.objects = L.objects.filter(function (x) { return x.id !== L.sel; }); L.sel = null; return true; }
  function cur() { return L.sel ? L.objects.find(function (x) { return x.id === L.sel; }) : null; }
  function undo() { if (!L.hist.length) return; L.redo.push(JSON.stringify(L.objects)); L.objects = JSON.parse(L.hist.pop()); L.sel = null; render(); recalc(); }
  function redo() { if (!L.redo.length) return; L.hist.push(JSON.stringify(L.objects)); L.objects = JSON.parse(L.redo.pop()); L.sel = null; render(); recalc(); }

  /* ---------- serialize / persistence / export ---------- */
  function serialize() {
    readFormToState();
    return {
      version: 1, savedAt: new Date().toISOString(),
      room: cloneObj(L.room), params: cloneObj(L.params), published: L.published,
      objects: L.objects.map(cloneObj),      // deep clone: snapshot must be stable
      capacities: capacitySnapshot()
    };
  }
  function capacitySnapshot() {
    var v = E.validate(L.objects, L.room, {});
    var reception = L.params.layout === "RECEPTION";
    return {
      published: L.published,
      estimated: reception ? E.validatedCapacity("RECEPTION", L.room, L.params).standingEstimate : E.estimatedCapacity(L.params.layout, L.room),
      validated: reception ? null : (v.feasible ? v.seats : countNonViolatingChairs(v)),
      feasible: v.feasible, violations: v.violations.length, layout: L.params.layout
    };
  }
  function deserialize(d) {
    if (!d) return;
    L.room = d.room || L.room; L.params = d.params || L.params; L.published = d.published != null ? d.published : null;
    L.objects = (d.objects || []).map(cloneObj); L.sel = null;
    syncFormFromState(); fitView(); render(); recalc();
  }
  function doSave() {
    var payload = serialize();
    if (typeof LayoutUI.onSave === "function") {
      Promise.resolve(LayoutUI.onSave(payload)).then(function (r) {
        msg(r && r.ok ? "Saved to venue ✓" : "Save failed: " + ((r && r.error) || "unknown"));
      }).catch(function (e) { msg("Save failed: " + (e.message || e)); });
    } else { msg("Saving not wired in this context."); }
  }
  function doLoad() {
    if (typeof LayoutUI.onLoad === "function") {
      Promise.resolve(LayoutUI.onLoad()).then(function (d) { if (d) { deserialize(d); msg("Loaded saved layout ✓"); } else msg("No saved layout found."); })
        .catch(function (e) { msg("Load failed: " + (e.message || e)); });
    } else { msg("Loading not wired in this context."); }
  }
  function exportJson() {
    var blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" });
    download(blob, (L.room.name || "layout") + ".json");
  }
  function exportPng() {
    var svg = L.svg.cloneNode(true);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", L.svg.clientWidth); svg.setAttribute("height", L.svg.clientHeight);
    var data = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = L.svg.clientWidth * 2; c.height = L.svg.clientHeight * 2;
      var ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      c.toBlob(function (b) { download(b, (L.room.name || "layout") + ".png"); });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  }
  function download(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- public ---------- */
  var LayoutUI = {
    onSave: null, onLoad: null,
    render: function (mount) {
      if (!E) { mount.innerHTML = '<p style="color:#a52a22">Layout engine not loaded.</p>'; return; }
      if (!L.built) { buildUI(mount); regenerate(); }
      else { fitView(); render(); recalc(); }
    },
    _state: L, _engine: E, serialize: serialize, deserialize: deserialize, _regen: regenerate
  };
  root.LayoutUI = LayoutUI;
})(typeof window !== "undefined" ? window : globalThis);
