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
    sel: null, selected: [],
    view: { scale: 10, ox: 20, oy: 20 },
    hist: [], redo: [],
    drag: null,
    showEnv: false
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
      ".lay-marquee{fill:rgba(27,97,159,.10);stroke:#287fc2;stroke-dasharray:5 3;stroke-width:1.3;vector-effect:non-scaling-stroke;pointer-events:none}",
      "#layCanvas{width:100%;height:560px;background:#fcfaf4;border:1px solid var(--line,#e6ddca);border-radius:12px;touch-action:none;display:block}",
      ".lay-room{fill:#ffffff;stroke:#8a7a4a;stroke-width:2;vector-effect:non-scaling-stroke}",
      ".lay-grid{stroke:#eee3c9;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tbl{fill:#ffffff;stroke:#bfc5cd;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-chair{fill:#859bad;stroke:#52687d;stroke-width:1.15;vector-effect:non-scaling-stroke}",
      ".lay-equip{fill:#c9b8e0;stroke:#7a5fae;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-obst{fill:#d98b8b;stroke:#9c3f3f;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-door{fill:none;stroke:#2e7d5b;stroke-width:3;vector-effect:non-scaling-stroke}",
      ".lay-bad{fill:#e2574f !important;stroke:#a52a22 !important}",
      ".lay-sel{stroke:#b8860b !important;stroke-width:2.5 !important}",
      ".lay-dim{font-size:12px;fill:#6b7480}",
      ".lay-back{fill:#465c72;stroke:#33485e;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tbl-rim{fill:none;stroke:#e0e4ea;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-chair{fill:#859bad;stroke:#52687d;stroke-width:1.15;vector-effect:non-scaling-stroke}",
      ".lay-back{fill:#465c72;stroke:#33485e;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tbl{fill:#fffaf2;stroke:#bcaa8e;stroke-width:1.4;vector-effect:non-scaling-stroke}",
      ".lay-stage{fill:#c3ccd6;stroke:#5b6472;stroke-width:1.5;vector-effect:non-scaling-stroke}",
      ".lay-screen{fill:#2f6f8f;stroke:#1d4d66;stroke-width:1.4;vector-effect:non-scaling-stroke}",
      ".lay-eqlabel{fill:#223042;font-weight:800;pointer-events:none}",
      ".lay-dimline{stroke:#8a9199;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tnum{fill:#5b6472;font-weight:800}",
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
      ".lay-cond{font-size:12px;color:#8a6a20;margin-top:4px}",
      ".lay-note{font-size:11.5px;color:#6b7480;margin-top:8px;line-height:1.5}",
      ".lay-env{fill:none;stroke:#b8860b;stroke-dasharray:3 3;stroke-width:1;vector-effect:non-scaling-stroke;opacity:.65}",
      ".lay-locked{stroke:#14263f !important;stroke-dasharray:4 2}",
      ".lay-cat{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}",
      ".lay-cat button{font-size:11px;padding:4px 8px;border:1px solid var(--line,#e6ddca);border-radius:7px;background:#fff;cursor:pointer;color:#22303f}",
      ".lay-cat button:hover{background:var(--navy,#1e3a5f);color:#fff}",
      ".lay-catg{font-size:10px;font-weight:800;color:#8a9199;text-transform:uppercase;letter-spacing:.04em;margin:9px 0 1px}",
      ".lay-insp label{display:block;font-size:11px;font-weight:700;color:var(--navy,#1e3a5f);margin:7px 0 2px}",
      ".lay-act button{width:100%;margin-top:6px;font-size:12.5px;padding:8px;border:1px solid var(--line,#e6ddca);border-radius:8px;background:#fff;cursor:pointer;color:var(--navy,#1e3a5f);font-weight:700}",
      ".lay-act button:hover{background:#f3eee2}",
      ".lay-src{font-size:10px;padding:1px 6px;border-radius:999px;background:#eef0f3;color:#5b6472;font-weight:700}",
      ".lay-results{margin-top:8px;font-size:12px;color:#22303f;max-height:240px;overflow:auto;border-top:1px solid var(--line,#e6ddca);padding-top:6px}",
      ".lay-results table{width:100%;border-collapse:collapse;font-size:11.5px}",
      ".lay-results td,.lay-results th{padding:3px 5px;border-bottom:1px solid var(--line,#e6ddca);text-align:left}",
      ".lay-results .s-FIT{color:#1f6b4a;font-weight:800}.lay-results .s-CONDITIONAL{color:#8a6a20;font-weight:800}.lay-results .s-DOES_NOT_FIT{color:#a52a22;font-weight:800}.lay-results .s-UNKNOWN{color:#5b6472;font-weight:800}"
    ].join("\n");

    /* Premium planner UI — aesthetic-only overrides; geometry and behaviors unchanged. */
    s.textContent += [
      ".lay-wrap{grid-template-columns:minmax(285px,318px) minmax(0,1fr);gap:20px;align-items:start}",
      ".lay-wrap>div:first-child{min-width:0}",
      ".lay-panel{background:#fff;border:1px solid #e8eaf0;border-radius:18px;padding:20px;box-shadow:0 6px 26px rgba(16,35,63,.035)}",
      ".lay-panel h3{color:#9b793c;font-size:10px;letter-spacing:.16em;font-weight:850;margin-bottom:14px}",
      ".lay-f{font-size:11px;letter-spacing:.015em;color:#4e5b6f;margin-top:13px;margin-bottom:5px}",
      ".lay-panel input,.lay-panel select{border:1px solid #dfe4ec;background:#fafbfc;min-height:37px;border-radius:9px;color:#15253c;transition:border-color .18s,box-shadow .18s}",
      ".lay-panel input:focus,.lay-panel select:focus{outline:0;border-color:#bd9956;box-shadow:0 0 0 3px rgba(189,153,86,.14);background:#fff}",
      ".lay-btn{background:#142b46;border:1px solid #142b46;border-radius:11px;padding:12px 14px;font-weight:750;letter-spacing:.01em;box-shadow:0 3px 9px rgba(20,43,70,.1);transition:transform .16s,background .16s}",
      ".lay-btn:hover{background:#223e5e;transform:translateY(-1px)}",
      ".lay-btn.ghost{background:#fff;border-color:#dce2ea;color:#152e49;box-shadow:none}",
      ".lay-btn.ghost:hover{background:#f5f7fa}",
      ".lay-tools{gap:7px;margin-bottom:12px}",
      ".lay-tools button,.lay-act button{border:1px solid #e1e5eb;background:#fff;border-radius:10px;color:#34455b;min-height:32px;transition:background .15s,border-color .15s}",
      ".lay-tools button:hover,.lay-act button:hover{background:#f4f6f9;border-color:#b8c6d6}",
      "#layCanvas{background:#f5f7fa;border:1px solid #e3e8ef;border-radius:18px;box-shadow:inset 0 1px 3px rgba(15,30,50,.025);height:590px}",
      ".lay-room{fill:#fff;stroke:#b6a07b;stroke-width:2}",
      ".lay-grid{stroke:#edf0f4}",
      ".lay-tbl{fill:#f6eee2;stroke:#baa88e;stroke-width:1.15}",
      ".lay-chair{fill:#8fa4b7;stroke:#58738e;stroke-width:1}",
      ".lay-back{fill:#5b7188;stroke:#3e536a}",
      ".lay-tbl-rim{stroke:#d3bd9c}",
      ".lay-stage{fill:#bfccd7;stroke:#667e92}",
      ".lay-equip{fill:#c7bbd5;stroke:#86709c}",
      ".lay-sel{stroke:#bc8f42!important;stroke-width:2.5!important}",
      ".lay-stat{background:#fff;border:1px solid #e5eaf0;border-radius:14px;padding:12px 15px;box-shadow:0 3px 14px rgba(12,35,60,.025)}",
      ".lay-stat .k{font-size:10px;letter-spacing:.075em;color:#8994a3}",
      ".lay-stat .v{font-size:23px;letter-spacing:-.035em;font-weight:800;color:#152b46}",
      ".lay-fit{border-radius:10px}",
      ".lay-note{color:#748194;line-height:1.65}",
      ".lay-cat button{border:1px solid #dde4ed;border-radius:9px;padding:6px 9px;color:#2f435b;background:#fbfcfe}",
      ".lay-cat button:hover{background:#142b46;color:white}",
      ".lay-results th{color:#69798b;font-weight:750}",
      "@media(max-width:1020px){.lay-wrap{grid-template-columns:1fr}.lay-panel{padding:16px}#layCanvas{height:490px}}",
      "@media(prefers-reduced-motion:reduce){.lay-btn,.lay-tools button,.lay-panel input,.lay-panel select{transition:none}}"
    ].join("\\n");
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
            '<div aria-live="polite" style="margin-top:10px;padding:10px 12px;background:var(--card,#fffdf8);border:1px solid var(--line,#e6ddca);border-radius:9px">' +
              '<label class="lay-f" for="layArea" style="margin:0 0 4px">Total room area (sq ft)</label>' +
              '<input id="layArea" type="text" readonly aria-label="Calculated total room area in square feet" style="font-size:18px;font-weight:800;color:var(--navy,#1e3a5f);background:#f5f3ed" value="—">' +
              '<div class="lay-note" id="layAreaFormula" style="margin-top:4px">Width × Length</div>' +
            '</div>' +
            '<div class="lay-row"><div><label class="lay-f">Unit</label><select id="layUnit"><option value="ft">feet</option><option value="m">meters</option></select></div>' +
              '<div><label class="lay-f">Ceiling</label><input id="layCeil" type="number" step="0.1"></div></div>' +
            '<div class="lay-row"><div><label class="lay-f">Perimeter clearance</label><input id="layWall" type="number" step="0.1"></div>' +
              '<div><label class="lay-f">Published cap.</label><input id="layPub" type="number" step="1" placeholder="optional"></div></div>' +
            '<label class="lay-f">Columns / obstacles (x,y,w,l ; ";"-separated)</label><input id="layObst" placeholder="e.g. 22,25,2,2">' +
            '<label class="lay-f">Doors (x,y,w ; ";"-separated)</label><input id="layDoors" placeholder="e.g. 2,0,3">' +
            '<label class="lay-f">Unavailable zones (x,y,w,l ; ";"-separated)</label><input id="layZones" placeholder="e.g. 0,0,6,6">' +
            '<div class="lay-note" style="margin-top:6px">Tip: enter the <b>actual dimensions the hotel supplies</b>. Extracted/auto measurements are unverified until confirmed.</div>' +
          "</div>" +
          '<div class="lay-panel" style="margin-top:12px">' +
            "<h3>Event &amp; layout</h3>" +
            '<label class="lay-f">Layout</label><select id="layType">' + opts + "</select>" +
            '<div class="lay-row"><div><label class="lay-f">Attendees</label><input id="layTarget" type="number" step="1"></div>' +
              '<div><label class="lay-f">High-tops (reception)</label><input id="layHigh" type="number" step="1" value="0"></div></div>' +
            '<label class="lay-chk"><input type="checkbox" id="layStage"> Stage</label>' +
            '<label class="lay-chk"><input type="checkbox" id="layScreen"> Projection screen</label>' +
            '<label class="lay-chk"><input type="checkbox" id="layAv"> AV / control booth</label>' +
            '<div style="border-top:1px solid var(--line,#e6ddca);margin:12px 0 8px;padding-top:10px"><b>Furniture &amp; Presentation Setup</b></div>' +
            '<label class="lay-f">Chair type</label><select id="layChairType"><option value="CHAIR">Banquet upholstered (1.6 ft)</option><option value="CHAIR_FOLD">Folding (1.5 ft)</option><option value="CHAIR_EXEC">Executive / conference (2 ft)</option></select>' +
            '<label class="lay-f">Table type</label><select id="layTableType"><option value="AUTO">Layout default</option><option value="TBL_6FT">Banquet rectangular 6 ft</option><option value="CLASSROOM_TBL">Classroom narrow 6 ft</option><option value="RND_60">Round banquet 60 in</option><option value="RND_72">Round banquet 72 in</option></select>' +
            '<label class="lay-f">Backdrop / screen</label><select id="layBackdropType"><option value="AUTO">Layout default</option><option value="NONE">None</option><option value="SCREEN">Portable projection screen</option><option value="LED_WALL">LED wall</option><option value="DRAPE">Pipe &amp; drape backdrop</option></select>' +
            '<div class="lay-note" id="layFurnitureHint" style="margin-top:7px">Selections apply when generating. Larger furniture may reduce capacity.</div>' +
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
            '<button class="lay-btn ghost" id="layPdf">Export PDF report</button>' +
          "</div>" +
          '<div class="lay-panel lay-act" style="margin-top:12px">' +
            "<h3>Smart actions</h3>" +
            '<button id="layAutoFit">Auto-Fit (reflow to room)</button>' +
            '<button id="layMaxCap">Max capacity</button>' +
            '<button id="layCompare">Compare layouts</button>' +
            '<button id="layFindSize">Find required room size</button>' +
            '<div class="lay-results" id="layActOut"></div>' +
          "</div>" +
          '<div class="lay-panel" style="margin-top:12px">' +
            "<h3>Add from catalog</h3>" + catalogPanelHtml() +
          "</div>" +
          '<div class="lay-panel lay-insp" id="layInsp" style="margin-top:12px;display:none">' +
            '<h3>Selected object</h3>' +
            '<div id="layInspName" style="font-weight:800;color:var(--navy,#1e3a5f);font-size:13px"></div>' +
            '<div class="lay-row"><div><label>Width/Ø (ft)</label><input id="inspW" type="number" step="0.1"></div>' +
              '<div id="inspLwrap"><label>Depth (ft)</label><input id="inspL" type="number" step="0.1"></div></div>' +
            '<div class="lay-row"><div><label>Height (ft)</label><input id="inspH" type="number" step="0.1"></div>' +
              '<div><label>Rotation (°)</label><input id="inspR" type="number" step="5"></div></div>' +
            '<label>Dimension source</label><select id="inspSrc"></select>' +
            '<label class="lay-chk" style="margin-top:8px"><input type="checkbox" id="inspLock"> Lock (reflow won’t move it)</label>' +
            '<div class="lay-row" style="margin-top:4px"><button class="lay-btn ghost" id="inspDup" style="margin-top:0">Duplicate</button>' +
              '<button class="lay-btn ghost" id="inspDel" style="margin-top:0">Delete</button></div>' +
            '<button class="lay-btn" id="inspSeat" style="display:none">👁 View from this seat (3D)</button>' +
          "</div>" +
        "</div>" +
        '<div class="lay-stage">' +
          '<div class="lay-tools">' +
            '<button data-z="in">+ Zoom</button><button data-z="out">− Zoom</button><button data-z="fit">Fit</button>' +
            '<button id="layClearSelection">Clear selection</button><span id="laySelectionCount" style="font-size:12px;color:#475b73">0 selected</span>' +
            '<button id="layRot">Rotate 15°</button><button id="layDup">Duplicate</button><button id="layLock">Lock</button><button id="layDel">Delete</button>' +
            '<button id="layUndo">Undo</button><button id="layRedo">Redo</button>' +
            '<button id="layEnv">Envelopes: off</button>' +
            '<select id="layViewMode" title="2D view mode" style="font-weight:600"><option value="furnished">2D: Furnished</option><option value="technical">2D: Technical</option><option value="dimensioned">2D: Dimensioned</option></select>' +
            '<button id="lay3dOrbit">3D Orbit</button><button id="lay3dWalk">3D Walkthrough</button>' +
          "</div>" +
          '<svg id="layCanvas"></svg>' +
          '<div id="layReadout"></div>' +
          '<div class="lay-warn" id="layWarn"></div>' +
          '<div class="lay-cond" id="layCond"></div>' +
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
    updateRoomArea();
    set("layPub", L.published != null ? L.published : "");
    set("layObst", (r.obstructions || []).map(function (o) { return [o.x, o.y, o.w, o.l].join(","); }).join(" ; "));
    set("layDoors", (r.doors || []).map(function (o) { return [o.x, o.y, o.w].join(","); }).join(" ; "));
    set("layZones", (r.reservedZones || []).map(function (o) { return [o.x, o.y, o.w, o.l].join(","); }).join(" ; "));
    set("layType", p.layout); set("layTarget", p.target); set("layHigh", p.highTops || 0);
    chk("layStage", p.stage); chk("layScreen", p.screen); chk("layAv", p.av);
    set("layChairType",(p.furniture||{}).chairType||"CHAIR");
    set("layTableType",(p.furniture||{}).tableType||"AUTO");
    set("layBackdropType",(p.furniture||{}).backdropType||"AUTO");
    updateFurnitureCompatibility();
    set("layAisle", p.aisle); set("layRowGap", p.rowGap); set("layChairClear", p.chairClear); set("layTableGap", p.tableGap);
  }
  // Gross rectangular area, always shown in square feet regardless of input unit.
  // This is distinct from the usable area after circulation/obstacles.
  function updateRoomArea() {
    var w=parseFloat(val("layW")), l=parseFloat(val("layL"));
    var unit=val("layUnit")==="m"?"m":"ft";
    var display=$("layArea"), formula=$("layAreaFormula");
    if(!display||!formula)return;
    if(!Number.isFinite(w)||!Number.isFinite(l)||w<=0||l<=0){
      display.value="—";
      formula.textContent="Enter a positive width and length.";
      return;
    }
    var area=w*l*(unit==="m"?10.76391041671:1);
    display.value=area.toLocaleString("en-US",{maximumFractionDigits:2})+" ft²";
    formula.textContent=w+" "+unit+" × "+l+" "+unit+
      (unit==="m"?" = "+(w*l).toLocaleString("en-US",{maximumFractionDigits:2})+" m²":"");
  }
  function updateFurnitureCompatibility(){
    var type=val("layType"),table=$("layTableType"),hint=$("layFurnitureHint");
    if(!table||!hint)return;
    var round=(type==="BANQUET"||type==="CABARET");
    var noTable=(type==="THEATER"||type==="CHEVRON"||type==="SEMICIRCLE"||type==="RECEPTION");
    [].forEach.call(table.options,function(opt){
      opt.disabled=opt.value!=="AUTO" && (noTable ||
        (round ? opt.value.indexOf("RND_")!==0 : opt.value.indexOf("RND_")===0));
    });
    if(table.selectedOptions.length&&table.selectedOptions[0].disabled)table.value="AUTO";
    hint.textContent=noTable?"This layout does not place seated tables. Backdrop and chair selections still apply.":
      "Selections are applied before fit checks. Oversized furniture may trigger conflicts.";
  }
  function readFormToState() {
    var r = L.room, p = L.params;
    r.venue = val("layVenue"); r.name = val("layRoom");
    r.width = num("layW", 45); r.length = num("layL", 50); r.unit = val("layUnit") || "ft";
    r.ceilingHeight = num("layCeil", 12); r.wallClearance = num("layWall", 1);
    L.published = val("layPub") !== "" ? num("layPub", null) : null;
    r.obstructions = parseObst(val("layObst"), r.unit);
    r.doors = parseDoors(val("layDoors"));
    r.reservedZones = parseZones(val("layZones"));
    p.layout = val("layType"); p.target = num("layTarget", 40); p.highTops = num("layHigh", 0);
    p.stage = chkv("layStage"); p.screen = chkv("layScreen"); p.av = chkv("layAv");
    p.furniture={chairType:val("layChairType")||"CHAIR",tableType:val("layTableType")||"AUTO",
      backdropType:val("layBackdropType")||"AUTO"};
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
  function parseDoors(s) {
    if (!s) return [];
    return s.split(/[;\n]/).map(function (line) {
      var a = line.split(",").map(function (x) { return parseFloat(x.trim()); });
      if (a.length >= 3 && a.slice(0, 3).every(function (n) { return !isNaN(n); }))
        return { x: a[0], y: a[1], w: a[2], l: 0.5, label: "Door", category: "door" };
      return null;
    }).filter(Boolean);
  }
  function parseZones(s) {
    if (!s) return [];
    return s.split(/[;\n]/).map(function (line) {
      var a = line.split(",").map(function (x) { return parseFloat(x.trim()); });
      if (a.length >= 4 && a.every(function (n) { return !isNaN(n); }))
        return { x: a[0], y: a[1], w: a[2], l: a[3], label: "Unavailable", category: "reserved" };
      return null;
    }).filter(Boolean);
  }
  function catalogPanelHtml() {
    return (E.CATALOG || []).map(function (grp) {
      return '<div class="lay-catg">' + esc(grp.group) + "</div><div class=\"lay-cat\">" +
        grp.items.map(function (key) {
          var f = E.FURNITURE[key] || {}; return '<button data-add="' + key + '" title="' + esc(dimLabel(key)) + '">' + esc(f.sub || f.label || key) + "</button>";
        }).join("") + "</div>";
    }).join("");
  }
  function dimLabel(key) {
    var f = E.FURNITURE[key] || {};
    var d = f.kind === "circle" ? ("Ø " + f.d + " ft") : (f.w + "×" + f.l + " ft");
    return (f.label || key) + " — " + d + ", h " + (f.h || "?") + " ft" + (f.clear ? (", clearance " + f.clear + " ft") : "");
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
    L.sel = null; L.selected=[];
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
    var cl = v.clearance || [];
    var cond = $("layCond"); if (cond) cond.textContent = cl.length ? ("⚠ " + cl.length + " operational-clearance warning(s): " + cl.slice(0, 3).map(function (x) { return x.msg; }).join("; ") + (cl.length > 3 ? "…" : "")) : "";
    if (L.sel && L.selected.length<=1) showInspector();
  }
  /* ---------- inspector ---------- */
  function showInspector() {
    var o = cur(); var box = $("layInsp"); if (!box) return;
    if(L.selected.length>1){box.style.display="none";return;}
    if (!o) { box.style.display = "none"; return; }
    box.style.display = "";
    $("layInspName").textContent = (o.label || o.type) + (o.sub ? (" · " + o.sub) : "");
    var isCircle = o.kind === "circle";
    set("inspW", isCircle ? o.d : o.w);
    var lw = $("inspLwrap"); if (lw) lw.style.display = isCircle ? "none" : "";
    if (!isCircle) set("inspL", o.l);
    set("inspH", o.h != null ? o.h : "");
    set("inspR", o.r || 0);
    var isrc = $("inspSrc"); if (isrc) isrc.value = o.src || "STANDARD";
    var ilk = $("inspLock"); if (ilk) ilk.checked = !!o.locked;
    var isSeat = o.category === "chair";
    var sb = $("inspSeat"); if (sb) sb.style.display = isSeat ? "" : "none";
  }
  function hideInspector() { var b = $("layInsp"); if (b) b.style.display = "none"; }
  function seatView3D() {
    var o = cur(); if (!o || o.category !== "chair") return;
    readFormToState();
    updateChairFacing();
    var idx = 0, i = 0;
    for (var k = 0; k < L.objects.length; k++) { if (L.objects[k].category === "chair") { if (L.objects[k].id === o.id) { idx = i; break; } i++; } }
    var go = function () { if (root.Layout3D) root.Layout3D.open("seat", L.objects, L.room, L.params, { seatIndex: idx }); };
    if (root.Layout3D) go(); else { ensure3D(go); msg("Opening 3D seat view…"); }
  }
  function applyInspector() {
    var o = cur(); if (!o) return;
    if (o.kind === "circle") { var d = num("inspW", o.d); if (d > 0) o.d = d; }
    else { var w = num("inspW", o.w), l = num("inspL", o.l); if (w > 0) o.w = w; if (l > 0) o.l = l; }
    var h = num("inspH", o.h); if (h > 0) o.h = h;
    var nextR = num("inspR", o.r) % 360;
    if (o.category === "chair" && nextR !== o.r) { o.manualFacing = true; o.visualRotation = nextR; }
    o.r = nextR;
    var isrc = $("inspSrc"); if (isrc) o.src = isrc.value;
    render(); recalc();
  }
  function toggleLockSel() { var o = cur(); if (!o) return false; pushHist(); o.locked = !o.locked; return true; }
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
  // Visual facing only: the occupancy footprints remain in their original
  // engineering orientation, so changing chair facing cannot alter fit scores.
  // Chair front is local -Y in the 2D glyph and local -Z in the 3D model.
  // Assign each chair to the nearest table EDGE, then face perpendicular to
  // that edge. This avoids diagonal corner chairs at long rectangular tables.
  // Geometry and collision rotation (o.r) are deliberately unchanged.
  function updateChairFacing() {
    var presentationOnly={THEATER:1,CHEVRON:1,SEMICIRCLE:1};
    var tables=L.objects.filter(function(o){return o.category==="table";});
    L.objects.forEach(function(chair){
      if(chair.category!=="chair" || chair.manualFacing)return;
      if(presentationOnly[L.params.layout] || !tables.length){chair.visualRotation=null;return;}
      var chosen=null,best=Infinity,normal=null;
      tables.forEach(function(t){
        var dx=chair.x-t.x,dy=chair.y-t.y,angle=(t.r||0)*Math.PI/180;
        var co=Math.cos(angle),si=Math.sin(angle);
        var lx=dx*co+dy*si,ly=-dx*si+dy*co;
        var dist,nx,ny;
        if(t.kind==="circle"){
          var radius=(t.d||0)/2;
          dist=Math.abs(Math.hypot(dx,dy)-radius);
          nx=-dx;ny=-dy;
        }else{
          var hw=(t.w||0)/2,hl=(t.l||0)/2;
          // Closest perimeter point for table association.
          dist=Math.hypot(Math.max(Math.abs(lx)-hw,0),Math.max(Math.abs(ly)-hl,0));
          // Prefer the LONG edge for rectangular banquet / classroom tables.
          // End seats in a row must face the same way as middle seats, even
          // when their centers are close to a table's short-end corners.
          // Square tables retain the nearest-face behavior.
          var tx=0,ty=0;
          if(hw>hl+0.15){
            ty=ly>=0?-1:1; // local +/-Y is normal to the long edge
          }else if(hl>hw+0.15){
            tx=lx>=0?-1:1; // local +/-X is normal to the long edge
          }else{
            var sideX=Math.abs(Math.abs(lx)-hw);
            var sideY=Math.abs(Math.abs(ly)-hl);
            if(sideX<=sideY){tx=lx>=0?-1:1;}else{ty=ly>=0?-1:1;}
          }
          nx=tx*co-ty*si;ny=tx*si+ty*co;
        }
        if(chair.tableId!=null && String(chair.tableId)===String(t.id))dist-=100000;
        if(dist<best){best=dist;chosen=t;normal={x:nx,y:ny};}
      });
      if(!chosen||!normal)return;
      if(Math.hypot(normal.x,normal.y)<0.00001)return;
      chair.visualRotation=Math.atan2(normal.x,-normal.y)*180/Math.PI;
    });
  }
  function chairRotation(o) {
    return o.visualRotation == null ? (o.r||0) : o.visualRotation;
  }

  function render() {
    updateChairFacing();
    var r = E.normalizeRoom(L.room), vw = L.view;
    var mode = L.viewMode || "furnished";
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
    // operational envelopes (clearance) overlay
    if (L.showEnv) {
      L.objects.forEach(function (o) {
        if (!o.clear) return;
        var ew = (o.kind === "circle" ? o.d : o.w) + 2 * o.clear;
        var el = (o.kind === "circle" ? o.d : o.l) + 2 * o.clear;
        var rot = o.r ? ' transform="rotate(' + o.r + " " + o.x + " " + o.y + ')"' : "";
        parts.push('<rect class="lay-env" x="' + (o.x - ew / 2) + '" y="' + (o.y - el / 2) + '" width="' + ew + '" height="' + el + '"' + rot + "></rect>");
      });
    }
    // objects — technical (clean primitives) vs furnished (recognizable symbols)
    var tnum = 0;
    L.objects.forEach(function (o) {
      if (mode === "technical") { parts.push(techSymbol(o)); return; }
      var n = (o.category === "table") ? (++tnum) : 0;   // number tables like a pro floor plan
      parts.push(furnSymbol(o, n));
    });
    if(L.drag && L.drag.box){
      var q=L.drag.box,xx=Math.min(q.x0,q.x1),yy=Math.min(q.y0,q.y1);
      parts.push('<rect class="lay-marquee" x="'+xx+'" y="'+yy+'" width="'+Math.abs(q.x1-q.x0)+'" height="'+Math.abs(q.y1-q.y0)+'"></rect>');
    }
    parts.push("</g>");
    // dimension labels (screen space)
    parts.push('<text class="lay-dim" x="' + (vw.ox + r.width * vw.scale / 2 - 20) + '" y="' + (vw.oy - 6) + '">' + fmtDim(r.width) + "</text>");
    parts.push('<text class="lay-dim" x="' + (vw.ox - 18) + '" y="' + (vw.oy + r.length * vw.scale / 2) + '" transform="rotate(-90 ' + (vw.ox - 18) + " " + (vw.oy + r.length * vw.scale / 2) + ')">' + fmtDim(r.length) + "</text>");
    if (mode === "dimensioned") parts.push(dimLines(r, vw));
    L.svg.innerHTML = parts.join("");
    var count=$("laySelectionCount");if(count)count.textContent=L.selected.length+" selected";
  }
  function stateCls(o, base) { var c = base; if (L.selected.indexOf(o.id)!==-1) c += " lay-sel"; if (o.locked) c += " lay-locked"; return c; }
  // Technical mode: clean primitives (fast, blueprint-style) — the original look.
  function techSymbol(o) {
    var cls = stateCls(o, o.category === "chair" ? "lay-chair" : o.category === "equipment" ? "lay-equip" : "lay-tbl");
    if (o.kind === "circle") return '<circle data-id="' + o.id + '" class="' + cls + '" cx="' + o.x + '" cy="' + o.y + '" r="' + (o.d / 2) + '"></circle>';
    return rectSvg(o, cls, o.id);
  }
  // Furnished mode: recognizable furniture silhouettes (seat+back, linen rounds, stage, screen).
  function furnSymbol(o, tnum) {
    if (o.category === "chair") return chairSym(o);
    if (o.category === "table") return tableSym(o, tnum);
    return equipSym(o);
  }
  // A rounded chair glyph: cushion + curved backrest on the far edge (Prismm-style).
  // Premium top-down chair glyph: rounded back shell, contrasting cushion,
  // visible frame and inset seam, all inside the real object footprint.
  function chairSym(o) {
    var w=o.w||1.6,l=o.l||1.6,id=o.id;
    var facing=chairRotation(o);
    var rot=facing?' transform="rotate('+facing+' '+o.x+' '+o.y+')"':"";
    var x=o.x-w/2,y=o.y-l/2;
    var shell='<rect data-id="'+id+'" class="'+stateCls(o,"lay-back")+'" x="'+(x+w*.04)+'" y="'+(y+l*.06)+'" width="'+(w*.92)+'" height="'+(l*.90)+'" rx="'+(w*.24)+'"></rect>';
    var seat='<rect data-id="'+id+'" class="'+stateCls(o,"lay-chair")+'" x="'+(x+w*.13)+'" y="'+(y+l*.10)+'" width="'+(w*.74)+'" height="'+(l*.65)+'" rx="'+(w*.19)+'"></rect>';
    var seam='<rect pointer-events="none" x="'+(x+w*.19)+'" y="'+(y+l*.17)+'" width="'+(w*.62)+'" height="'+(l*.51)+'" rx="'+(w*.13)+'" fill="none" stroke="#e7ecf1" stroke-width="0.025" opacity=".88"></rect>';
    var back='<path data-id="'+id+'" d="M '+(x+w*.14)+' '+(y+l*.82)+' Q '+o.x+' '+(y+l*1.03)+' '+(x+w*.86)+' '+(y+l*.82)+'" fill="none" stroke="#35475b" stroke-width="'+Math.max(.045,l*.065)+'" stroke-linecap="round"></path>';
    if(o.type==="CHAIR_FOLD"){
      var xx=o.x-w*.33,yy=o.y-l*.30;
      return '<g'+rot+'><rect data-id="'+id+'" class="'+stateCls(o,"lay-chair")+
        '" x="'+xx+'" y="'+yy+'" width="'+(w*.66)+'" height="'+(l*.62)+
        '" rx="0.07" fill="#84949e" stroke="#445666" stroke-width=".04"></rect>'+
        '<path data-id="'+id+'" d="M '+xx+' '+(o.y+l*.38)+' H '+(xx+w*.66)+
        '" fill="none" stroke="#445666" stroke-width=".10"/></g>';
    }
    if(o.type==="CHAIR_EXEC"){
      return '<g'+rot+'>'+shell+seat+seam+back+
        '<path pointer-events="none" d="M '+(x-w*.04)+' '+(y+l*.28)+' v '+(l*.44)+
        ' M '+(x+w*1.04)+' '+(y+l*.28)+' v '+(l*.44)+
        '" stroke="#273b4c" stroke-width=".10" stroke-linecap="round"/></g>';
    }
    return '<g'+rot+'>'+shell+seat+seam+back+'</g>';
  }
  function tableSym(o, tnum) {
    var id = o.id;
    var num = ""; // Clean tabletop: no numbers or faux centerpieces in 2D.
    if (o.kind === "circle") {
      var rr = (o.d || 4) / 2;
      return '<g data-id="' + id + '"><circle data-id="' + id + '" class="' + stateCls(o, "lay-tbl") + '" cx="' + o.x + '" cy="' + o.y + '" r="' + rr + '"></circle>' +
             num + "</g>";
    }
    var rot = o.r ? ' transform="rotate(' + o.r + ' ' + o.x + ' ' + o.y + ')"' : "";
    return '<g data-id="' + id + '">' + "<g" + rot + '><rect data-id="' + id + '" class="' + stateCls(o, "lay-tbl") + '" x="' + (o.x - o.w / 2) + '" y="' + (o.y - o.l / 2) + '" width="' + o.w + '" height="' + o.l + '" rx="0.25"></rect></g>' + num + "</g>";
  }
  function tnumFs(o) { var s = o.kind === "circle" ? (o.d || 4) : Math.min(o.w || 4, o.l || 2.5); return Math.max(0.85, Math.min(s * 0.26, 1.4)); }
  function equipSym(o) {
    var t = o.type || "", id = o.id, rot = o.r ? ' transform="rotate(' + o.r + ' ' + o.x + ' ' + o.y + ')"' : "";
    var x = o.x - o.w / 2, y = o.y - o.l / 2;
    if (t === "STAGE" || t === "RISER" || t === "STAGE_STAIRS") {
      var fs = Math.max(1, Math.min(o.w, o.l) * 0.45);
      return '<g' + rot + '><rect data-id="' + id + '" class="' + stateCls(o, "lay-stage") + '" x="' + x + '" y="' + y + '" width="' + o.w + '" height="' + o.l + '" rx="0.3"></rect>' +
             '<text class="lay-eqlabel" x="' + o.x + '" y="' + (o.y + fs * 0.35) + '" font-size="' + fs + '" text-anchor="middle">' + esc(o.label || "STAGE") + "</text></g>";
    }
    if (t === "SCREEN" || t === "LED_WALL" || t === "TV_MONITOR" || t === "DRAPE" || t === "PARTITION") {
      var hl = Math.max(o.l, 0.6);
      return '<g' + rot + '><rect data-id="' + id + '" class="' + stateCls(o, "lay-screen") + '" x="' + x + '" y="' + (o.y - hl / 2) + '" width="' + o.w + '" height="' + hl + '" rx="0.2"></rect></g>';
    }
    if(t==="AV_BOOTH"){
      return '<g'+rot+'><rect data-id="'+id+'" class="'+stateCls(o,"lay-equip")+
        '" x="'+x+'" y="'+y+'" width="'+o.w+'" height="'+o.l+'" rx="0.3"></rect></g>';
    }
    var out = '<g' + rot + '><rect data-id="' + id + '" class="' + stateCls(o, "lay-equip") + '" x="' + x + '" y="' + y + '" width="' + o.w + '" height="' + o.l + '" rx="0.3"></rect>';
    if (o.w >= 4 && o.l >= 1.6) { var fs2 = Math.max(0.9, Math.min(o.w, o.l) * 0.4); out += '<text class="lay-eqlabel" x="' + o.x + '" y="' + (o.y + fs2 * 0.35) + '" font-size="' + fs2 + '" text-anchor="middle">' + esc(o.label || "") + "</text>"; }
    return out + "</g>";
  }
  function dimLines(r, vw) {
    var x0 = vw.ox, y0 = vw.oy, x1 = vw.ox + r.width * vw.scale, y1 = vw.oy + r.length * vw.scale, o = 12, s = "";
    s += '<line class="lay-dimline" x1="' + x0 + '" y1="' + (y0 - o) + '" x2="' + x1 + '" y2="' + (y0 - o) + '"></line>';
    s += '<line class="lay-dimline" x1="' + x0 + '" y1="' + (y0 - o - 4) + '" x2="' + x0 + '" y2="' + (y0 - o + 4) + '"></line>';
    s += '<line class="lay-dimline" x1="' + x1 + '" y1="' + (y0 - o - 4) + '" x2="' + x1 + '" y2="' + (y0 - o + 4) + '"></line>';
    s += '<line class="lay-dimline" x1="' + (x0 - o) + '" y1="' + y0 + '" x2="' + (x0 - o) + '" y2="' + y1 + '"></line>';
    s += '<line class="lay-dimline" x1="' + (x0 - o - 4) + '" y1="' + y0 + '" x2="' + (x0 - o + 4) + '" y2="' + y0 + '"></line>';
    s += '<line class="lay-dimline" x1="' + (x0 - o - 4) + '" y1="' + y1 + '" x2="' + (x0 - o + 4) + '" y2="' + y1 + '"></line>';
    return s;
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
    ["layW","layL"].forEach(function(id){$(id).addEventListener("input",updateRoomArea);});
    $("layType").addEventListener("change",updateFurnitureCompatibility);
    $("layUnit").addEventListener("change",updateRoomArea);
    $("layGen").onclick = regenerate;
    $("laySave").onclick = doSave;
    $("layLoad").onclick = doLoad;
    $("layJson").onclick = exportJson;
    $("layPng").onclick = exportPng;
    $("layClearSelection").onclick=function(){L.selected=[];L.sel=null;hideInspector();render();};
    $("layRot").onclick = function () { if (rotateSel(15)) { render(); recalc(); } };
    $("layDup").onclick = function () { if (dupSel()) { render(); recalc(); } };
    $("layDel").onclick = function () { if (delSel()) { render(); recalc(); } };
    $("layUndo").onclick = undo; $("layRedo").onclick = redo;
    $("layLock").onclick = function () { if (toggleLockSel()) { render(); recalc(); } };
    $("layEnv").onclick = function () { L.showEnv = !L.showEnv; $("layEnv").textContent = "Envelopes: " + (L.showEnv ? "on" : "off"); render(); };
    var vm = $("layViewMode"); if (vm) { vm.value = L.viewMode || "furnished"; vm.onchange = function () { L.viewMode = vm.value; render(); }; }
    $("layPdf").onclick = exportPdf;
    $("layAutoFit").onclick = autoFit;
    $("layMaxCap").onclick = doMaxCap;
    $("layCompare").onclick = doCompare;
    $("layFindSize").onclick = doFindSize;
    var o3 = $("lay3dOrbit"); if (o3) o3.onclick = function () { open3D("orbit"); };
    var w3 = $("lay3dWalk"); if (w3) w3.onclick = function () { open3D("walk"); };
    // catalog add (delegated)
    L.mount.querySelectorAll("[data-add]").forEach(function (b) {
      b.onclick = function () { addFromCatalog(b.getAttribute("data-add")); };
    });
    // inspector
    ["inspW", "inspL", "inspH", "inspR"].forEach(function (id) { var e = $(id); if (e) e.oninput = applyInspector; });
    var isrc = $("inspSrc"); if (isrc) { isrc.innerHTML = (E.DIM_SOURCES || []).map(function (s) { return '<option>' + s + '</option>'; }).join(""); isrc.onchange = applyInspector; }
    var ilk = $("inspLock"); if (ilk) ilk.onchange = function () { var o = cur(); if (o) { pushHist(); o.locked = ilk.checked; render(); recalc(); } };
    var idup = $("inspDup"); if (idup) idup.onclick = function () { if (dupSel()) { render(); recalc(); showInspector(); } };
    var idel = $("inspDel"); if (idel) idel.onclick = function () { if (delSel()) { render(); recalc(); hideInspector(); } };
    var isb = $("inspSeat"); if (isb) isb.onclick = seatView3D;
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
      if (e.key === "Escape") { L.selected=[];L.sel=null;hideInspector();render(); }
      else if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="a") { e.preventDefault(); selectIds(L.objects.map(function(o){return o.id;}),false);render(); }
      else if (e.key === "r" || e.key === "R") { if (rotateSel(15)) { render(); recalc(); } }
      else if (e.key === "Delete" || e.key === "Backspace") { if (delSel()) { render(); recalc(); } }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); if (dupSel()) { render(); recalc(); } }
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); }
    });
  }
  function selectIds(ids, additive){
    var next=additive?L.selected.slice():[];
    ids.forEach(function(id){var i=next.indexOf(id);if(i<0)next.push(id);else if(additive)next.splice(i,1);});
    L.selected=next;
    L.sel=next.length===1?next[0]:null;
    if(L.sel)showInspector();else hideInspector();
  }
  // Shift+click toggles objects; Shift+drag on blank canvas draws a marquee.
  // Drag a member of a multi-selection to move the group with relative offsets.
  function onDown(e) {
    if(e.button!=null&&e.button!==0)return;
    var hit=e.target.closest && e.target.closest("[data-id]");
    var id=hit && hit.getAttribute("data-id");
    var pt=screenToFeet(e.clientX,e.clientY);
    if(id){
      var obj=L.objects.find(function(o){return o.id===id;});
      if(!obj)return;
      if(e.shiftKey||e.metaKey||e.ctrlKey){
        selectIds([id],true);L.drag=null;render();return;
      }
      if(L.selected.indexOf(id)<0)selectIds([id],false);
      var items=L.objects.filter(function(o){return L.selected.indexOf(o.id)!==-1&&!o.locked;});
      if(obj.locked||!items.length){L.drag=null;render();return;}
      L.drag={group:true,origin:pt,items:items.map(function(o){return{id:o.id,x:o.x,y:o.y};}),moved:false,history:false};
      render();
    }else if(e.shiftKey){
      L.drag={box:{x0:pt.x,y0:pt.y,x1:pt.x,y1:pt.y},additive:e.ctrlKey||e.metaKey};
      render();
    }else{
      L.selected=[];L.sel=null;hideInspector();
      L.drag={pan:true,sx:e.clientX,sy:e.clientY,ox:L.view.ox,oy:L.view.oy};
      render();
    }
  }
  function onMove(e) {
    if(!L.drag)return;
    if(L.drag.pan){L.view.ox=L.drag.ox+(e.clientX-L.drag.sx);L.view.oy=L.drag.oy+(e.clientY-L.drag.sy);render();return;}
    var pt=screenToFeet(e.clientX,e.clientY);
    if(L.drag.box){L.drag.box.x1=pt.x;L.drag.box.y1=pt.y;render();return;}
    if(!L.drag.group)return;
    var d=L.drag,dx=snap(pt.x-d.origin.x),dy=snap(pt.y-d.origin.y);
    if(!dx&&!dy&&!d.moved)return;
    if(!d.history){pushHist();d.history=true;}
    d.items.forEach(function(item){
      var o=L.objects.find(function(x){return x.id===item.id;});
      if(o){o.x=item.x+dx;o.y=item.y+dy;}
    });
    d.moved=true;render();
  }
  function onUp() {
    if(!L.drag)return;
    if(L.drag.box){
      var q=L.drag.box,minX=Math.min(q.x0,q.x1),maxX=Math.max(q.x0,q.x1);
      var minY=Math.min(q.y0,q.y1),maxY=Math.max(q.y0,q.y1);
      var ids=L.objects.filter(function(o){
        var w=o.kind==="circle"?o.d:o.w,l=o.kind==="circle"?o.d:o.l;
        return o.x+w/2>=minX&&o.x-w/2<=maxX&&o.y+l/2>=minY&&o.y-l/2<=maxY;
      }).map(function(o){return o.id;});
      selectIds(ids,L.drag.additive);
      msg(ids.length+" objects intersect the selection. Drag a selected piece to move the group.");
    }else if(L.drag.group && L.drag.moved)recalc();
    L.drag=null;render();
  }
  function snap(v) { var grid = 0.5; return Math.round(v / grid) * grid; }
  function zoomAt(factor, px, py) {
    var before = { x: (px - L.view.ox) / L.view.scale, y: (py - L.view.oy) / L.view.scale };
    L.view.scale *= factor;
    L.view.ox = px - before.x * L.view.scale; L.view.oy = py - before.y * L.view.scale;
  }
  // Rotate the full selection around the center of its bounding box. A single
  // item rotates in place. Both geometry and chair visual facing stay in sync.
  function rotateSel(degrees) {
    var items=L.objects.filter(function(o){return L.selected.indexOf(o.id)>=0 && !o.locked;});
    if(!items.length)return false;
    pushHist();
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    items.forEach(function(o){
      var hw=(o.kind==="circle"?o.d:o.w)/2,hl=(o.kind==="circle"?o.d:o.l)/2;
      minX=Math.min(minX,o.x-hw);maxX=Math.max(maxX,o.x+hw);
      minY=Math.min(minY,o.y-hl);maxY=Math.max(maxY,o.y+hl);
    });
    var cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    var rad=degrees*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
    items.forEach(function(o){
      if(items.length>1){
        var x=o.x-cx,y=o.y-cy;
        o.x=Math.round((cx+x*cs-y*sn)*10000)/10000;
        o.y=Math.round((cy+x*sn+y*cs)*10000)/10000;
      }
      var base=o.category==="chair"?chairRotation(o):(o.r||0);
      o.r=((base+degrees)%360+360)%360;
      if(o.category==="chair"){o.manualFacing=true;o.visualRotation=o.r;}
    });
    msg("Rotated "+items.length+" object(s) by "+degrees+"°. Check clearance warnings before saving.");
    return true;
  }
  // Duplicate an entire selection as a single transaction. All relative
  // positions, rotations and styles are retained in the copied group.
  function dupSel() {
    var items=L.objects.filter(function(o){return L.selected.indexOf(o.id)>=0;});
    if(!items.length)return false;
    pushHist();
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    items.forEach(function(o){
      var hw=(o.kind==="circle"?o.d:o.w)/2,hl=(o.kind==="circle"?o.d:o.l)/2;
      minX=Math.min(minX,o.x-hw);maxX=Math.max(maxX,o.x+hw);
      minY=Math.min(minY,o.y-hl);maxY=Math.max(maxY,o.y+hl);
    });
    var rm=E.normalizeRoom(L.room),width=maxX-minX,height=maxY-minY;
    // Prefer copying to the right without overlapping the original group.
    var dx=width+2,dy=0;
    if(maxX+dx>rm.width-rm.wallClearance){dx=0;dy=height+2;}
    if(maxY+dy>rm.length-rm.wallClearance && dx===0){dx=2;dy=2;}
    var ids=[];
    items.forEach(function(o){
      var copy=cloneObj(o);
      copy.id="o_"+Date.now().toString(36)+"_"+Math.floor(Math.random()*1e9).toString(36);
      copy.locked=false;copy.x=o.x+dx;copy.y=o.y+dy;
      L.objects.push(copy);ids.push(copy.id);
    });
    L.selected=ids;L.sel=ids.length===1?ids[0]:null;
    if(L.sel)showInspector();else hideInspector();
    msg("Duplicated "+ids.length+" object(s). Copies selected—drag the group to reposition.");
    return true;
  }
  function delSel() { var o = cur(); if (!o) return false; pushHist(); L.objects = L.objects.filter(function (x) { return x.id !== L.sel; }); L.sel = null;L.selected=[]; return true; }
  function cur() { return L.sel ? L.objects.find(function (x) { return x.id === L.sel; }) : null; }
  function undo() { if (!L.hist.length) return; L.redo.push(JSON.stringify(L.objects)); L.objects = JSON.parse(L.hist.pop()); L.sel = null;L.selected=[]; render(); recalc(); }
  function redo() { if (!L.redo.length) return; L.hist.push(JSON.stringify(L.objects)); L.objects = JSON.parse(L.redo.pop()); L.sel = null;L.selected=[]; render(); recalc(); }

  /* ---------- catalog add + smart actions ---------- */
  function addFromCatalog(key) {
    var r = E.normalizeRoom(L.room);
    var o = E.makeObj(key, E.round2(r.width / 2), E.round2(r.length / 2), 0);
    pushHist(); L.objects.push(o); L.sel = o.id;L.selected=[o.id]; render(); recalc(); showInspector();
    msg("Added " + (o.label || key) + ". Drag to position; edit size/height/source in the inspector.");
  }
  function actOut(html) { var e = $("layActOut"); if (e) e.innerHTML = html; }
  function autoFit() {
    readFormToState();
    var res = E.reflow(L.params.layout, L.room, Object.assign({}, L.params), L.objects);
    pushHist(); L.objects = res.objects.map(cloneObj); L.sel = null; hideInspector(); fitView(); render(); recalc();
    var rf = res.reflow;
    actOut(rf.fits
      ? ("<b>Auto-Fit ✓</b> — " + esc((E.LAYOUT_META[L.params.layout] || {}).name || L.params.layout) + " reflowed to " + L.room.width + "×" + L.room.length + " ft. Seats " + res.seats + (rf.target ? (" / requested " + rf.target) : "") + (rf.lockedKept ? (" · kept " + rf.lockedKept + " locked") : "") + ".")
      : ("<b>Auto-Fit — does not fit.</b> " + esc(rf.reason || "")));
  }
  function doMaxCap() {
    readFormToState();
    var mc = E.maxCapacity(L.params.layout, L.room, L.params);
    actOut("<b>Max capacity:</b> " + mc.validated + " seats found for " + esc((E.LAYOUT_META[L.params.layout] || {}).name) + " in " + L.room.width + "×" + L.room.length + " ft.<br><span class='lay-note'>" + esc(mc.note) + "</span>");
  }
  function doCompare() {
    readFormToState();
    var rows = E.compareLayouts(L.room, L.params.target, L.params);
    var html = "<table><tr><th>Layout</th><th>Fit</th><th>Seats</th></tr>" + rows.map(function (r) {
      return "<tr><td>" + esc(r.name) + "</td><td class='s-" + r.status + "'>" + r.status.replace(/_/g, " ") + "</td><td>" + (r.validated != null ? r.validated : (r.estimated != null ? ("~" + r.estimated) : "—")) + "</td></tr>";
    }).join("") + "</table>";
    actOut("<b>Compare layouts</b> (" + L.room.width + "×" + L.room.length + " ft, " + L.params.target + " attendees):" + html);
  }
  function doFindSize() {
    readFormToState();
    var fs = E.findRoomSize(L.params.target, L.params.layout, L.params);
    var html = fs.candidates.length ? ("<table><tr><th>Room (ft)</th><th>Area</th><th>Seats</th></tr>" + fs.candidates.map(function (c) { return "<tr><td>" + c.width + "×" + c.length + "</td><td>" + c.area + " ft²</td><td>" + c.validated + "</td></tr>"; }).join("") + "</table>") : "";
    actOut("<b>Required room size</b> for " + fs.target + " in " + esc((E.LAYOUT_META[L.params.layout] || {}).name) + ":" + html + "<span class='lay-note'>" + esc(fs.note) + "</span>");
  }
  // A frozen report snapshot from the same engine used by the existing 2D PDF.
  // Manual edits are included; the image and its report represent one layout.
  function reportSnapshot3D(){
    var v=E.validate(L.objects,L.room,{});
    var reception=L.params.layout==="RECEPTION";
    var est=reception?E.validatedCapacity("RECEPTION",L.room,L.params).standingEstimate:E.estimatedCapacity(L.params.layout,L.room);
    var fit=E.assessFit(L.params.layout,L.room,L.params.target,L.params);
    var counts={};
    L.objects.forEach(function(o){var k=o.label||o.type;counts[k]=(counts[k]||0)+1;});
    var seats=L.objects.filter(function(o){return o.category==="chair";}).length;
    var countGood=(typeof countNonViolatingChairs==="function")?countNonViolatingChairs(v):seats;
    return {
      venue:L.room.venue||"Venue",room:L.room.name||"Room",
      layout:(E.LAYOUT_META[L.params.layout]||{}).name||L.params.layout,
      dimensions:{width:L.room.width,length:L.room.length,ceiling:L.room.ceilingHeight||null,area:L.room.width*L.room.length},
      capacities:{published:L.published,estimated:est,validated:reception?null:(v.feasible?seats:countGood),requested:L.params.target,fit:fit.status,fitReason:fit.reason},
      counts:Object.keys(counts).sort().map(function(k){return {name:k,qty:counts[k]};}),
      checks:{feasible:v.feasible,violations:(v.violations||[]).map(function(x){return x.msg||"Collision or fit conflict";}),
      clearance:(v.clearance||[]).map(function(x){return x.msg||"Operational-clearance warning";})},
      assumptions:"Planning tool only. Nominal dimensions unless HOTEL-CONFIRMED or MANUFACTURER-VERIFIED. This is not an official fire, occupancy, or accessibility approval.",
      planSvg:exportableSvgString(),
      generatedAt:new Date().toLocaleString()
    };
  }
  function open3D(mode) {
    readFormToState();
    updateChairFacing();
    if (root.Layout3D && typeof root.Layout3D.open === "function") {
      root.Layout3D.open(mode, L.objects, L.room, L.params, { report: reportSnapshot3D(), floorPlanSvg: exportableSvgString(), onSeat: function (info) {} });
    } else {
      msg("Loading 3D… if it doesn’t open, this device may not support WebGL — the 2D planner remains fully usable.");
      ensure3D(function () { if (root.Layout3D) root.Layout3D.open(mode, L.objects, L.room, L.params, { report: reportSnapshot3D(), floorPlanSvg: exportableSvgString() }); });
    }
  }
  function ensure3D(cb) {
    if (root.Layout3D) { cb && cb(); return; }
    if (document.getElementById("lay-3d-js")) { setTimeout(function () { cb && cb(); }, 400); return; }
    var s = document.createElement("script"); s.id = "lay-3d-js"; s.src = "layout-3d.js";
    s.onload = function () { cb && cb(); }; document.head.appendChild(s);
  }
  // CSS de las figuras del plano — se EMBEBE dentro del SVG al exportar.
  // Sin esto, el SVG exportado pierde las clases de la hoja de estilos de la
  // página y cada figura cae al relleno por defecto (negro) → plano todo negro.
  function svgShapeCss() {
    return [
      ".lay-room{fill:#ffffff;stroke:#8a7a4a;stroke-width:2;vector-effect:non-scaling-stroke}",
      ".lay-grid{stroke:#eee3c9;stroke-width:1;fill:none;vector-effect:non-scaling-stroke}",
      ".lay-tbl{fill:#ffffff;stroke:#bfc5cd;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-chair{fill:#9fb3d1;stroke:#6f87ad;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-equip{fill:#c9b8e0;stroke:#7a5fae;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-obst{fill:#d98b8b;stroke:#9c3f3f;stroke-width:1.2;vector-effect:non-scaling-stroke}",
      ".lay-door{fill:none;stroke:#2e7d5b;stroke-width:3;vector-effect:non-scaling-stroke}",
      ".lay-bad{fill:#e2574f;stroke:#a52a22}",
      ".lay-sel{stroke:#b8860b;stroke-width:2.5}",
      ".lay-dim{font-size:12px;fill:#6b7480}",
      ".lay-back{fill:#6f87ad;stroke:#51688c;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tbl-rim{fill:none;stroke:#e0e4ea;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-stage{fill:#c3ccd6;stroke:#5b6472;stroke-width:1.5;vector-effect:non-scaling-stroke}",
      ".lay-screen{fill:#2f6f8f;stroke:#1d4d66;stroke-width:1.4;vector-effect:non-scaling-stroke}",
      ".lay-eqlabel{fill:#223042;font-weight:800}",
      ".lay-dimline{stroke:#8a9199;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".lay-tnum{fill:#5b6472;font-weight:800}",
      ".lay-env{fill:none;stroke:#b8860b;stroke-dasharray:3 3;stroke-width:1;vector-effect:non-scaling-stroke;opacity:.65}",
      ".lay-locked{stroke:#14263f;stroke-dasharray:4 2}"
    ].join("");
  }
  // Clona el SVG del plano y le incrusta <style> + xmlns + tamaño, listo para rasterizar.
  function exportableSvgString() {
    var svg = L.svg.cloneNode(true);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", L.svg.clientWidth);
    svg.setAttribute("height", L.svg.clientHeight);
    var st = document.createElementNS("http://www.w3.org/2000/svg", "style");
    st.textContent = svgShapeCss();
    svg.insertBefore(st, svg.firstChild);
    return new XMLSerializer().serializeToString(svg);
  }
  function exportPdf() {
    readFormToState();
    var v = E.validate(L.objects, L.room, {});
    var counts = {}; L.objects.forEach(function (o) { var k = o.label || o.type; counts[k] = (counts[k] || 0) + 1; });
    var fit = E.assessFit(L.params.layout, L.room, L.params.target, L.params);
    var data = exportableSvgString();
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = L.svg.clientWidth * 2; c.height = L.svg.clientHeight * 2;
      var ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
      var png = c.toDataURL("image/png");
      var rowsC = Object.keys(counts).sort().map(function (k) { return "<tr><td>" + esc(k) + "</td><td>" + counts[k] + "</td></tr>"; }).join("");
      var cl = v.clearance || [];
      var est = L.params.layout === "RECEPTION" ? E.validatedCapacity("RECEPTION", L.room, L.params).standingEstimate : E.estimatedCapacity(L.params.layout, L.room);
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>Room plan — ' + esc(L.room.name || "") + '</title>' +
        '<style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#22303f;margin:24px}h1{color:#1e3a5f;font-size:20px;margin:0}h2{color:#b8860b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 4px}table{border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #e6ddca;padding:4px 12px;text-align:left}img{max-width:100%;border:1px solid #e6ddca;border-radius:8px;margin-top:4px}.muted{color:#6b7480;font-size:12px}</style></head><body>' +
        '<h1>' + esc(L.room.venue || "Venue") + " — " + esc(L.room.name || "Room") + "</h1>" +
        '<div class="muted">' + esc((E.LAYOUT_META[L.params.layout] || {}).name || L.params.layout) + " · " + L.room.width + "×" + L.room.length + " ft, ceiling " + (L.room.ceilingHeight || "?") + " ft · " + new Date().toLocaleString() + "</div>" +
        "<h2>Capacity</h2><table><tr><td>Published</td><td>" + (L.published != null ? L.published : "—") + "</td></tr><tr><td>Estimated</td><td>" + est + "</td></tr><tr><td>Validated</td><td>" + (fit.validated != null ? fit.validated : "—") + "</td></tr><tr><td>Requested</td><td>" + L.params.target + "</td></tr><tr><td>Fit</td><td>" + fit.status.replace(/_/g, " ") + "</td></tr></table>" +
        '<h2>Floor plan (to scale)</h2><img src="' + png + '">' +
        "<h2>Furniture &amp; equipment</h2><table><tr><th>Item</th><th>Qty</th></tr>" + rowsC + "</table>" +
        "<h2>Checks &amp; assumptions</h2><p>" + (v.feasible ? '<span style="color:#1f6b4a">No hard conflicts.</span>' : '<span style="color:#a52a22">' + v.violations.length + " conflict(s).</span>") + " " + (cl.length ? (cl.length + " operational-clearance warning(s).") : "") + "</p>" +
        '<p class="muted">Planning tool only. Dimensions are nominal unless marked HOTEL-CONFIRMED / MANUFACTURER-VERIFIED. Not an official fire, occupancy, or accessibility approval; subject to qualified review.</p>' +
        '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},350);}</scr' + 'ipt></body></html>';
      var w = window.open("", "_blank"); if (!w) { msg("Allow pop-ups to export the PDF report (print dialog → Save as PDF)."); return; }
      w.document.open(); w.document.write(html); w.document.close();
      msg("PDF report opened in a new tab — use your browser’s print dialog → Save as PDF.");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  }

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
    var data = exportableSvgString();
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
