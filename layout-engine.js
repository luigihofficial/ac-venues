/* ============================================================================
 * AC VENUES — MEETING ROOM LAYOUT & CAPACITY ENGINE  (pure logic, no DOM)
 * Vanilla JS. Works in the browser (window.LayoutEngine) and in Node (exports).
 * Internal unit = FEET. All geometry uses real-world coordinates, never pixels.
 * Core principle: published capacity != proof a layout fits. We distinguish
 * published / estimated / VALIDATED capacity and never claim a guaranteed max.
 * ==========================================================================*/
(function (root) {
  "use strict";

  /* ---------- tolerances & conversion ---------- */
  var EPS = 1e-6;                 // numerical tolerance (feet)
  var M_PER_FT = 0.3048;
  function ft2m(v) { return v * M_PER_FT; }
  function m2ft(v) { return v / M_PER_FT; }
  function toFeet(v, unit) { return unit === "m" ? m2ft(v) : v; }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* ---------- geometry primitives ---------- */
  function deg2rad(d) { return (d * Math.PI) / 180; }

  // Corners of an axis object: center (x,y), size w (local X) by l (local Y),
  // rotation r degrees (CCW). Returns 4 points in order.
  function rectCorners(o) {
    var hw = o.w / 2, hl = o.l / 2, a = deg2rad(o.r || 0);
    var c = Math.cos(a), s = Math.sin(a);
    var pts = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    return pts.map(function (p) {
      return { x: o.x + p[0] * c - p[1] * s, y: o.y + p[0] * s + p[1] * c };
    });
  }

  // Separating Axis Theorem for two convex polygons (arrays of {x,y}).
  function polyAxes(poly) {
    var axes = [];
    for (var i = 0; i < poly.length; i++) {
      var p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      var nx = -(p2.y - p1.y), ny = p2.x - p1.x;
      var len = Math.hypot(nx, ny) || 1;
      axes.push({ x: nx / len, y: ny / len });
    }
    return axes;
  }
  function projectPoly(poly, ax) {
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < poly.length; i++) {
      var d = poly[i].x * ax.x + poly[i].y * ax.y;
      if (d < min) min = d; if (d > max) max = d;
    }
    return { min: min, max: max };
  }
  function polysIntersect(a, b) {
    // Touching edges (zero gap) count as SEPARATED — chairs legitimately abut
    // tables, and run segments abut end-to-end. Only a real overlap (> TOUCH) is a hit.
    var TOUCH = 0.02; // ~1/4 inch slack, in feet
    var axes = polyAxes(a).concat(polyAxes(b));
    for (var i = 0; i < axes.length; i++) {
      var pa = projectPoly(a, axes[i]), pb = projectPoly(b, axes[i]);
      if (pa.max <= pb.min + TOUCH || pb.max <= pa.min + TOUCH) return false; // gap/touch
    }
    return true;
  }

  function circleRectIntersect(cx, cy, rad, rectObj) {
    // transform circle center into rect's local frame
    var a = -deg2rad(rectObj.r || 0);
    var dx = cx - rectObj.x, dy = cy - rectObj.y;
    var lx = dx * Math.cos(a) - dy * Math.sin(a);
    var ly = dx * Math.sin(a) + dy * Math.cos(a);
    var hw = rectObj.w / 2, hl = rectObj.l / 2;
    var nx = Math.max(-hw, Math.min(lx, hw));
    var ny = Math.max(-hl, Math.min(ly, hl));
    return (lx - nx) * (lx - nx) + (ly - ny) * (ly - ny) < rad * rad - EPS;
  }
  function circlesIntersect(a, b) {
    var rr = a.d / 2 + b.d / 2;
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < rr * rr - EPS;
  }

  function pointInPolygon(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      var hit = (yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + EPS) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }
  function polygonArea(poly) {
    var a = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
    }
    return Math.abs(a / 2);
  }

  /* generic pair test for any two placed objects (rect or circle) */
  function objCorners(o) {
    if (o.kind === "circle") return null;
    return rectCorners(o);
  }
  function objectsOverlap(a, b) {
    if (a.kind === "circle" && b.kind === "circle") return circlesIntersect(a, b);
    if (a.kind === "circle") return circleRectIntersect(a.x, a.y, a.d / 2, b);
    if (b.kind === "circle") return circleRectIntersect(b.x, b.y, b.d / 2, a);
    return polysIntersect(objCorners(a), objCorners(b));
  }

  /* ---------- furniture library (feet) ---------- */
  // Nominal footprints. Chair footprint = SEATED occupant zone (seat + body),
  // deliberately larger than a bare chair so packing stays honest.
  var FURNITURE = {
    TBL_4FT: { category: "table", kind: "rect", w: 4.0, l: 2.5, label: "4 ft table" },
    TBL_6FT: { category: "table", kind: "rect", w: 6.0, l: 2.5, label: "6 ft table" },
    TBL_8FT: { category: "table", kind: "rect", w: 8.0, l: 2.5, label: "8 ft table" },
    RND_48:  { category: "table", kind: "circle", d: 4.0, seats: 6,  label: "48\" round" },
    RND_60:  { category: "table", kind: "circle", d: 5.0, seats: 8,  label: "60\" round" },
    RND_72:  { category: "table", kind: "circle", d: 6.0, seats: 10, label: "72\" round" },
    HIGHTOP: { category: "table", kind: "circle", d: 2.5, label: "High-top" },
    CHAIR:   { category: "chair", kind: "rect", w: 1.6, l: 1.6, label: "Chair" },
    STAGE:   { category: "equipment", kind: "rect", w: 12.0, l: 8.0, label: "Stage" },
    PODIUM:  { category: "equipment", kind: "rect", w: 2.5, l: 2.0, label: "Podium" },
    SCREEN:  { category: "equipment", kind: "rect", w: 8.0, l: 1.0, label: "Screen" },
    AV_BOOTH:{ category: "equipment", kind: "rect", w: 6.0, l: 4.0, label: "AV / control" },
    REG_TABLE:{category: "equipment", kind: "rect", w: 6.0, l: 2.5, label: "Registration" }
  };
  function makeObj(type, x, y, r, over) {
    var base = FURNITURE[type] || { category: "misc", kind: "rect", w: 2, l: 2 };
    var o = { id: uid(), type: type, category: base.category, kind: base.kind,
      x: x, y: y, r: r || 0, label: base.label };
    if (base.kind === "circle") { o.d = base.d; o.seats = base.seats; }
    else { o.w = base.w; o.l = base.l; }
    if (over) for (var k in over) o[k] = over[k];
    return o;
  }
  var _n = 0;
  function uid() { return "o" + (++_n) + "_" + Math.floor(Math.random() * 1e6).toString(36); }

  /* ---------- room model & usable-space helpers ---------- */
  // Normalize a room into feet with a usable inner boundary (wall clearance).
  function normalizeRoom(room) {
    var unit = room.unit || "ft";
    var W = toFeet(room.width, unit), L = toFeet(room.length, unit);
    var wall = room.wallClearance != null ? toFeet(room.wallClearance, unit) : 1.0; // perimeter gangway
    var r = {
      unit: "ft", width: W, length: L, wallClearance: wall,
      ceilingHeight: room.ceilingHeight != null ? toFeet(room.ceilingHeight, unit) : null,
      boundary: room.boundaryPolygon && room.boundaryPolygon.length >= 3
        ? room.boundaryPolygon.map(function (p) { return { x: toFeet(p.x, unit), y: toFeet(p.y, unit) }; })
        : [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: L }, { x: 0, y: L }],
      obstructions: (room.obstructions || []).map(function (o) { return normZone(o, unit); }),
      doors: (room.doors || []).map(function (d) { return normZone(d, unit); }),
      reservedZones: (room.reservedZones || []).map(function (z) { return normZone(z, unit); })
    };
    return r;
  }
  function normZone(o, unit) {
    return { id: o.id || uid(), kind: "rect", category: o.category || "obstruction",
      x: toFeet(o.x, unit), y: toFeet(o.y, unit),
      w: toFeet(o.w, unit), l: toFeet(o.l, unit), r: o.r || 0, label: o.label || "" };
  }
  function grossArea(room) {
    var r = room.width != null && room.boundary ? room : normalizeRoom(room);
    return polygonArea(r.boundary);
  }
  // usable area = gross - obstructions - reserved (clamped >= 0). Honest NOTE:
  // this is an upper bound on placeable area, NOT a guarantee of packability.
  function usableArea(room) {
    var r = normalizeRoom(room);
    var used = 0;
    r.obstructions.concat(r.reservedZones).forEach(function (z) {
      used += z.w * z.l;
    });
    // approximate wall gangway loss
    var g = r.wallClearance;
    var inner = Math.max(0, r.width - 2 * g) * Math.max(0, r.length - 2 * g);
    return Math.max(0, Math.min(polygonArea(r.boundary), inner) - used);
  }

  // Is a placed object fully inside the usable boundary (walls + clearance)?
  function insideUsable(o, room) {
    var g = room.wallClearance;
    // shrink rectangular boundary by clearance when boundary is the default rect
    var isRect = room.boundary.length === 4;
    if (isRect) {
      var minx = g, miny = g, maxx = room.width - g, maxy = room.length - g;
      if (o.kind === "circle") {
        return o.x - o.d / 2 >= minx - EPS && o.x + o.d / 2 <= maxx + EPS &&
               o.y - o.d / 2 >= miny - EPS && o.y + o.d / 2 <= maxy + EPS;
      }
      var cs = rectCorners(o);
      return cs.every(function (p) {
        return p.x >= minx - EPS && p.x <= maxx + EPS && p.y >= miny - EPS && p.y <= maxy + EPS;
      });
    }
    // polygon room: require all corners inside (clearance approximated by sampling)
    if (o.kind === "circle") {
      var samples = 8, ok = true;
      for (var i = 0; i < samples; i++) {
        var a = (i / samples) * 2 * Math.PI;
        var pt = { x: o.x + Math.cos(a) * (o.d / 2), y: o.y + Math.sin(a) * (o.d / 2) };
        if (!pointInPolygon(pt, room.boundary)) ok = false;
      }
      return ok && pointInPolygon({ x: o.x, y: o.y }, room.boundary);
    }
    return rectCorners(o).every(function (p) { return pointInPolygon(p, room.boundary); });
  }

  /* ---------- spatial validation ---------- */
  // Returns { feasible, violations:[{type,ids,msg}], seats }
  function validate(objects, roomRaw, opts) {
    opts = opts || {};
    var room = normalizeRoom(roomRaw);
    var violations = [];
    var seatable = objects.filter(function (o) { return o.category !== "reserved-ok"; });

    // 1 & 2: boundary + obstruction + reserved-zone + door-access
    var blockers = room.obstructions.concat(room.reservedZones);
    var doorAccess = room.doors.map(function (d) {
      // clear access rectangle in front of door (depth ~3.5 ft, along +y by default)
      var depth = 3.5;
      return { id: "door_" + d.id, kind: "rect", x: d.x, y: d.y + (d.l / 2 + depth / 2) * 0, w: d.w + 2, l: d.l + depth, r: d.r || 0 };
    });

    objects.forEach(function (o) {
      if (o.category === "equipment" && o.isReserved) return; // reserved footprints handled as blockers
      if (!insideUsable(o, room)) {
        violations.push({ type: "boundary", ids: [o.id], msg: (o.label || o.type) + " crosses a wall or the perimeter clearance" });
      }
      blockers.forEach(function (z) {
        if (objectsOverlap(o, z)) {
          violations.push({ type: z.category === "obstruction" ? "obstruction" : "reserved",
            ids: [o.id, z.id], msg: (o.label || o.type) + " overlaps " + (z.label || z.category) });
        }
      });
      doorAccess.forEach(function (da) {
        if (o.category !== "equipment" && objectsOverlap(o, da)) {
          violations.push({ type: "door", ids: [o.id, da.id], msg: (o.label || o.type) + " blocks a door/exit access path" });
        }
      });
    });

    // 3: object-object overlaps (skip chair-to-its-own-table and same-group where tagged)
    for (var i = 0; i < objects.length; i++) {
      for (var j = i + 1; j < objects.length; j++) {
        var a = objects[i], b = objects[j];
        if (a.category === "equipment" || b.category === "equipment") {
          // allow a chair to sit near equipment only if not overlapping; still check overlap
        }
        if (sameFixedPair(a, b)) continue;
        if (objectsOverlap(a, b)) {
          violations.push({ type: "collision", ids: [a.id, b.id],
            msg: (a.label || a.type) + " overlaps " + (b.label || b.type) });
        }
      }
    }

    var seats = objects.filter(function (o) { return o.category === "chair"; }).length;
    // rounds with implicit seats (reception/cabaret counts explicit chairs only)
    return {
      feasible: violations.length === 0,
      violations: dedupeViolations(violations),
      seats: seats,
      room: room
    };
  }
  function sameFixedPair() { return false; } // chairs are placed with gaps; no exemptions needed
  function dedupeViolations(vs) {
    var seen = {}, out = [];
    vs.forEach(function (v) {
      var k = v.type + "|" + v.ids.slice().sort().join(",");
      if (!seen[k]) { seen[k] = 1; out.push(v); }
    });
    return out;
  }

  /* ============================================================================
   * LAYOUT GENERATORS — 12 parametric presets.
   * Each: generate(room, params) -> { objects, seats, meta }
   * Presenter faces +y (front of room = small y). Seating faces the front.
   * ==========================================================================*/
  function defaults(room, p) {
    p = p || {};
    var r = normalizeRoom(room);
    return {
      room: r,
      aisle: p.aisle != null ? p.aisle : 3.5,          // circulation aisle width
      rowGap: p.rowGap != null ? p.rowGap : 2.2,        // back-to-back clearance between rows
      chairGap: p.chairGap != null ? p.chairGap : 0.2,  // side gap between chairs
      tableGap: p.tableGap != null ? p.tableGap : 1.0,  // between table groups
      chairClear: p.chairClear != null ? p.chairClear : 2.0, // occupied-chair depth from table edge
      front: p.front != null ? p.front : presentationDepth(r, p), // y reserved at front
      target: p.target || null,
      params: p
    };
  }
  function presentationDepth(r, p) {
    // front reserved band for stage/screen/podium/AV (AV booth lives here so it
    // never fights the seating field).
    var d = 0;
    if (p.stage) d = Math.max(d, 8.5);
    if (p.av) d = Math.max(d, 4.5);     // AV/control booth depth
    if (p.screen) d = Math.max(d, 2.5);
    if (!p.stage && !p.screen && !p.av) d = 2.0; // minimal presenter standing zone
    return d;
  }
  function frontEquipment(cfg) {
    var r = cfg.room, objs = [], cx = r.width / 2, p = cfg.params, g = r.wallClearance;
    if (p.stage) objs.push(makeObj("STAGE", cx, g + 4, 0, { isReserved: true }));
    if (p.screen) objs.push(makeObj("SCREEN", cx, g + 0.6, 0, { isReserved: true }));
    else if (!p.stage) objs.push(makeObj("PODIUM", cx, g + 1.2, 0, { isReserved: true }));
    // AV/control booth placed in the front band at the right, clear of seating.
    if (p.av) objs.push(makeObj("AV_BOOTH", r.width - g - 3, g + 2.2, 0, { isReserved: true, category: "equipment" }));
    return objs;
  }
  function chairRow(xStart, y, n, gap, chairW) {
    var out = [], step = chairW + gap;
    for (var i = 0; i < n; i++) out.push(makeObj("CHAIR", xStart + chairW / 2 + i * step, y, 0));
    return out;
  }
  // Place a run of tables with chairs on the OUTSIDE (delegates face the hollow).
  // orient 'V': tables tiled along y at x=fixed, chairs on side chairDir (±1 in x).
  // orient 'H': tables tiled along x at y=fixed, chairs on side chairDir (±1 in y).
  // Returns number of seats placed.
  function placeRun(objs, orient, fixed, from, to, cfg, chairDir) {
    var T = FURNITURE.TBL_6FT, seg = T.w, tD = T.l, gap = cfg.tableGap;
    var chairW = FURNITURE.CHAIR.w, chairClear = cfg.chairClear, chairGap = cfg.chairGap;
    var step = seg + gap, seats = 0;
    if (orient === "V") {
      for (var y = from; y + seg <= to + EPS; y += step) {
        var tcY = y + seg / 2;
        objs.push(makeObj("TBL_6FT", fixed, tcY, 90));                 // length along y
        var outerFace = fixed + chairDir * (tD / 2);
        var chX = outerFace + chairDir * (chairClear / 2);
        var nSeat = Math.max(1, Math.floor(seg / (chairW + chairGap)));
        var sstep = seg / nSeat;
        for (var s = 0; s < nSeat; s++) {
          objs.push(makeObj("CHAIR", chX, y + (s + 0.5) * sstep, 0,
            { w: chairClear, l: chairW, face: chairDir > 0 ? "E" : "W" }));
          seats++;
        }
      }
    } else {
      for (var x = from; x + seg <= to + EPS; x += step) {
        var tcX = x + seg / 2;
        objs.push(makeObj("TBL_6FT", tcX, fixed, 0));
        var outerFaceH = fixed + chairDir * (tD / 2);
        var chY = outerFaceH + chairDir * (chairClear / 2);
        var nSeatH = Math.max(1, Math.floor(seg / (chairW + chairGap)));
        var sstepH = seg / nSeatH;
        for (var s2 = 0; s2 < nSeatH; s2++) {
          objs.push(makeObj("CHAIR", x + (s2 + 0.5) * sstepH, chY, 0,
            { w: chairW, l: chairClear, face: chairDir > 0 ? "S" : "N" }));
          seats++;
        }
      }
    }
    return seats;
  }

  // THEATER: forward-facing chairs, no tables, center aisle
  function genTheater(room, params) {
    var cfg = defaults(room, params), r = cfg.room;
    var objs = frontEquipment(cfg);
    var chairW = FURNITURE.CHAIR.w, chairL = FURNITURE.CHAIR.l;
    var g = r.wallClearance;
    var usableW = r.width - 2 * g;
    var aisle = cfg.aisle;
    var blockW = (usableW - aisle) / 2;                 // two blocks + center aisle
    var perBlock = Math.max(1, Math.floor((blockW + cfg.chairGap) / (chairW + cfg.chairGap)));
    var rowStepY = chairL + cfg.rowGap;
    var y0 = g + cfg.front + chairL / 2;
    var yMax = r.length - g;
    var seats = 0;
    for (var y = y0; y + chairL / 2 <= yMax + EPS; y += rowStepY) {
      objs = objs.concat(chairRow(g, y, perBlock, cfg.chairGap, chairW));
      objs = objs.concat(chairRow(g + blockW + aisle, y, perBlock, cfg.chairGap, chairW));
      seats += perBlock * 2;
    }
    return finalize(objs, room, cfg, { layout: "THEATER" });
  }

  // CLASSROOM: rows of tables with chairs on the audience side
  function genClassroom(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var T = FURNITURE.TBL_6FT;                           // seminar tables
    var aisle = cfg.aisle;
    var usableW = r.width - 2 * g;
    var blockW = (usableW - aisle) / 2;
    var tablesPerBlock = Math.max(1, Math.floor((blockW + cfg.tableGap) / (T.w + cfg.tableGap)));
    var seatsPerTable = 3;
    var chairW = FURNITURE.CHAIR.w;
    var rowStepY = T.l + cfg.chairClear + FURNITURE.CHAIR.l + cfg.rowGap;
    var y0 = g + cfg.front + T.l / 2;
    var yMax = r.length - g;
    var seats = 0;
    function placeBlock(x0, y) {
      var o = [], step = T.w + cfg.tableGap;
      for (var t = 0; t < tablesPerBlock; t++) {
        var tx = x0 + T.w / 2 + t * step;
        o.push(makeObj("TBL_6FT", tx, y, 0));
        // chairs behind table (audience side = +y)
        var cy = y + T.l / 2 + cfg.chairClear - FURNITURE.CHAIR.l / 2;
        var innerW = T.w - 0.4, cstep = innerW / seatsPerTable;
        for (var s = 0; s < seatsPerTable; s++) {
          o.push(makeObj("CHAIR", tx - innerW / 2 + cstep * (s + 0.5), cy, 0));
          seats++;
        }
      }
      return o;
    }
    for (var y = y0; y + T.l / 2 + cfg.chairClear + FURNITURE.CHAIR.l <= yMax + EPS; y += rowStepY) {
      objs = objs.concat(placeBlock(g, y));
      objs = objs.concat(placeBlock(g + blockW + aisle, y));
    }
    return finalize(objs, room, cfg, { layout: "CLASSROOM" });
  }

  // Shared U-shape builder (U_SHAPE=1 ring, DOUBLE_U=2, TRIPLE_U=3 nested rings).
  // Tables form 3 sides (left, right, back); chairs on the OUTSIDE facing the
  // open hollow/front. Nested rings are inset by (table depth + chair zone + aisle).
  function buildU(room, params, count) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var tD = FURNITURE.TBL_6FT.l, CD = cfg.chairClear;  // table depth, chair-zone depth (outside)
    var aisle = (params && params.uGap != null) ? params.uGap : cfg.aisle;
    var inset = tD + CD + aisle;                         // ring-to-ring inward step
    var minSide = 2 * (tD + CD) + 4;                     // need two arms + a hollow
    var seats = 0, rings = 0;
    for (var k = 0; k < count; k++) {
      var off = k * inset;
      var leftWall = g + off, rightWall = r.width - g - off;
      var topFront = g + cfg.front + off, backWall = r.length - g - off;
      if (rightWall - leftWall < minSide || backWall - topFront < (tD + CD) + 4) break;
      rings++;
      var lx = leftWall + CD + tD / 2;        // left arm table center x
      var rx = rightWall - CD - tD / 2;       // right arm table center x
      var by = backWall - CD - tD / 2;        // back run table center y
      // left arm (chairs to the LEFT, -x)
      seats += placeRun(objs, "V", lx, topFront, by - tD / 2, cfg, -1);
      // right arm (chairs to the RIGHT, +x)
      seats += placeRun(objs, "V", rx, topFront, by - tD / 2, cfg, +1);
      // back run (chairs DOWN/behind, +y), spanning between the two arms
      seats += placeRun(objs, "H", by, lx + tD / 2, rx - tD / 2, cfg, +1);
    }
    return finalize(objs, room, cfg, { layout: count >= 3 ? "TRIPLE_U" : (count === 2 ? "DOUBLE_U" : "U_SHAPE"), rings: rings });
  }
  function genUShape(room, params) { return buildU(room, params, 1); }
  function genDoubleU(room, params) { return buildU(room, params, 2); }
  function genTripleU(room, params) { return buildU(room, params, 3); }

  // BOARDROOM: single central rectangular table, chairs around
  function genBoardroom(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = [];
    var chairClear = cfg.chairClear, chairW = FURNITURE.CHAIR.w, chairL = FURNITURE.CHAIR.l;
    var margin = chairClear + chairL + 1.0;
    var tW = Math.max(6, r.width - 2 * g - 2 * margin);
    var tL = Math.max(4, r.length - 2 * g - 2 * margin);
    var cx = r.width / 2, cy = r.length / 2;
    objs.push(makeObj("TBL_8FT", cx, cy, 0, { w: tW, l: tL }));
    var seats = 0;
    var nx = Math.max(1, Math.floor(tW / (chairW + cfg.chairGap)));
    for (var i = 0; i < nx; i++) {
      var x = cx - tW / 2 + (i + 0.5) * (tW / nx);
      objs.push(makeObj("CHAIR", x, cy - tL / 2 - chairClear + chairL / 2, 180));
      objs.push(makeObj("CHAIR", x, cy + tL / 2 + chairClear - chairL / 2, 0));
      seats += 2;
    }
    var ny = Math.max(1, Math.floor(tL / (chairW + cfg.chairGap)));
    for (var j = 0; j < ny; j++) {
      var y = cy - tL / 2 + (j + 0.5) * (tL / ny);
      objs.push(makeObj("CHAIR", cx - tW / 2 - chairClear + chairL / 2, y, 90));
      objs.push(makeObj("CHAIR", cx + tW / 2 + chairClear - chairL / 2, y, -90));
      seats += 2;
    }
    return finalize(objs, room, cfg, { layout: "BOARDROOM" });
  }

  // HOLLOW_SQUARE: four sides of tables, open center, chairs outside facing in
  function genHollowSquare(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = [];
    var tD = FURNITURE.TBL_6FT.l, CD = cfg.chairClear;
    var leftWall = g, rightWall = r.width - g, topWall = g, bottomWall = r.length - g;
    var lx = leftWall + CD + tD / 2, rx = rightWall - CD - tD / 2;
    var ty = topWall + CD + tD / 2, by = bottomWall - CD - tD / 2;
    var seats = 0;
    // top run (chairs up, -y) and bottom run (chairs down, +y)
    seats += placeRun(objs, "H", ty, lx + tD / 2, rx - tD / 2, cfg, -1);
    seats += placeRun(objs, "H", by, lx + tD / 2, rx - tD / 2, cfg, +1);
    // left arm (chairs left, -x) and right arm (chairs right, +x), between the runs
    seats += placeRun(objs, "V", lx, ty + tD / 2, by - tD / 2, cfg, -1);
    seats += placeRun(objs, "V", rx, ty + tD / 2, by - tD / 2, cfg, +1);
    return finalize(objs, room, cfg, { layout: "HOLLOW_SQUARE" });
  }

  // BANQUET: round tables in a grid, full seating
  function genBanquet(room, params) { return rounds(room, params, "BANQUET", false); }
  // CABARET: round tables, seats only on the back ~2/3 (facing front)
  function genCabaret(room, params) { return rounds(room, params, "CABARET", true); }
  function rounds(room, params, name, cabaret) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var TT = params && params.round ? FURNITURE[params.round] : FURNITURE.RND_60;
    var d = TT.d, seatsFull = TT.seats || 8;
    var chairClear = cfg.chairClear;
    var cell = d + 2 * chairClear + cfg.tableGap;       // table + seated ring + gap
    var usableW = r.width - 2 * g, usableL = r.length - g - (g + cfg.front);
    var cols = Math.max(1, Math.floor(usableW / cell));
    var rowsN = Math.max(1, Math.floor(usableL / cell));
    var seats = 0;
    for (var ri = 0; ri < rowsN; ri++) {
      for (var ci = 0; ci < cols; ci++) {
        var cx = g + (ci + 0.5) * (usableW / cols);
        var cy = g + cfg.front + (ri + 0.5) * (usableL / rowsN);
        objs.push(makeObj(params && params.round ? params.round : "RND_60", cx, cy, 0));
        var nSeat = cabaret ? Math.round(seatsFull * 0.66) : seatsFull;
        var startA = cabaret ? Math.PI * 0.2 : 0;       // leave the front arc open for cabaret
        var sweep = cabaret ? Math.PI * 1.6 : Math.PI * 2;
        for (var s = 0; s < nSeat; s++) {
          var a = startA + (sweep * s) / nSeat + (cabaret ? 0 : 0);
          var rad = d / 2 + chairClear - FURNITURE.CHAIR.l / 2;
          objs.push(makeObj("CHAIR", cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, (a * 180 / Math.PI) + 90));
          seats++;
        }
      }
    }
    return finalize(objs, room, cfg, { layout: name });
  }

  // CHEVRON: angled rows facing the front, center aisle
  function genChevron(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var chairW = FURNITURE.CHAIR.w, chairL = FURNITURE.CHAIR.l;
    var aisle = cfg.aisle, angle = 15;
    var usableW = r.width - 2 * g, blockW = (usableW - aisle) / 2;
    var perBlock = Math.max(1, Math.floor((blockW + cfg.chairGap) / (chairW + cfg.chairGap)));
    var rowStepY = chairL + cfg.rowGap, y0 = g + cfg.front + chairL, yMax = r.length - g;
    var seats = 0;
    for (var y = y0; y + chairL <= yMax; y += rowStepY) {
      for (var i = 0; i < perBlock; i++) {
        objs.push(makeObj("CHAIR", g + chairW / 2 + i * (chairW + cfg.chairGap), y, angle));
        objs.push(makeObj("CHAIR", g + blockW + aisle + chairW / 2 + i * (chairW + cfg.chairGap), y, -angle));
        seats += 2;
      }
    }
    return finalize(objs, room, cfg, { layout: "CHEVRON" });
  }

  // PODS: independent clustered tables (groups), chairs around each pod
  function genPods(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var podW = 6, podL = 5, perPod = 6, chairClear = cfg.chairClear;
    var cell = Math.max(podW, podL) + 2 * chairClear + cfg.aisle;
    var usableW = r.width - 2 * g, usableL = r.length - g - (g + cfg.front);
    var cols = Math.max(1, Math.floor(usableW / cell)), rowsN = Math.max(1, Math.floor(usableL / cell));
    var seats = 0;
    for (var ri = 0; ri < rowsN; ri++) for (var ci = 0; ci < cols; ci++) {
      var cx = g + (ci + 0.5) * (usableW / cols), cy = g + cfg.front + (ri + 0.5) * (usableL / rowsN);
      objs.push(makeObj("TBL_6FT", cx, cy, 0, { w: podW, l: podL }));
      var ring = [[0, -1], [0, 1], [-1, 0], [1, 0], [-0.7, -0.7], [0.7, 0.7]];
      for (var s = 0; s < perPod; s++) {
        var dx = ring[s][0], dy = ring[s][1];
        objs.push(makeObj("CHAIR", cx + dx * (podW / 2 + chairClear), cy + dy * (podL / 2 + chairClear), 0));
        seats++;
      }
    }
    return finalize(objs, room, cfg, { layout: "PODS" });
  }

  // SEMICIRCLE / Horseshoe: curved forward-facing chair arcs
  function genSemicircle(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = frontEquipment(cfg);
    var chairW = FURNITURE.CHAIR.w, chairL = FURNITURE.CHAIR.l;
    var cx = r.width / 2, focusY = g + cfg.front;
    var rMin = Math.max(4, cfg.front + 3), rMax = Math.min(r.width / 2 - g, r.length - g - focusY);
    var seats = 0;
    for (var rad = rMin; rad <= rMax; rad += chairL + cfg.rowGap) {
      var arcLen = Math.PI * rad, n = Math.max(1, Math.floor(arcLen / (chairW + cfg.chairGap)));
      for (var s = 0; s < n; s++) {
        var a = Math.PI * (s + 0.5) / n; // 0..PI across the front
        var x = cx - Math.cos(a) * rad, y = focusY + Math.sin(a) * rad;
        if (x < g || x > r.width - g || y > r.length - g) continue;
        objs.push(makeObj("CHAIR", x, y, (a * 180 / Math.PI) - 90));
        seats++;
      }
    }
    return finalize(objs, room, cfg, { layout: "SEMICIRCLE" });
  }

  // RECEPTION: mostly standing; optional high-tops. Capacity = standing density.
  function genReception(room, params) {
    var cfg = defaults(room, params), r = cfg.room, g = r.wallClearance;
    var objs = [];
    var nHigh = (params && params.highTops != null) ? params.highTops : 0;
    // scatter high-tops on a loose grid
    if (nHigh > 0) {
      var cols = Math.ceil(Math.sqrt(nHigh)), placed = 0;
      var uw = r.width - 2 * g, ul = r.length - 2 * g;
      for (var ri = 0; ri < cols && placed < nHigh; ri++)
        for (var ci = 0; ci < cols && placed < nHigh; ci++) {
          objs.push(makeObj("HIGHTOP", g + (ci + 0.5) * (uw / cols), g + (ri + 0.5) * (ul / cols), 0));
          placed++;
        }
    }
    // standing capacity (planning density ~ 7-9 sq ft/person; use 8). This is an
    // ESTIMATE by density, not a packed-seat VALIDATED count — flagged in meta.
    var standArea = usableArea(room);
    var standing = Math.floor(standArea / 8);
    var res = finalize(objs, room, cfg, { layout: "RECEPTION", standingEstimate: standing });
    res.seats = 0;
    res.standingEstimate = standing;
    return res;
  }

  /* registry */
  var REGISTRY = {
    THEATER: genTheater, CLASSROOM: genClassroom, U_SHAPE: genUShape, DOUBLE_U: genDoubleU,
    TRIPLE_U: genTripleU, BOARDROOM: genBoardroom, HOLLOW_SQUARE: genHollowSquare,
    BANQUET: genBanquet, CABARET: genCabaret, CHEVRON: genChevron, PODS: genPods,
    SEMICIRCLE: genSemicircle, RECEPTION: genReception
  };
  var LAYOUT_META = {
    THEATER: { name: "Theater", tables: false },
    CLASSROOM: { name: "Classroom", tables: true },
    U_SHAPE: { name: "U-Shape", tables: true },
    DOUBLE_U: { name: "Double U-Shape", tables: true, priority: true },
    TRIPLE_U: { name: "Triple U-Shape", tables: true },
    BOARDROOM: { name: "Boardroom", tables: true },
    HOLLOW_SQUARE: { name: "Hollow Square", tables: true },
    BANQUET: { name: "Banquet Rounds", tables: true },
    CABARET: { name: "Cabaret", tables: true },
    CHEVRON: { name: "Chevron", tables: false },
    PODS: { name: "Pods / Clusters", tables: true },
    SEMICIRCLE: { name: "Semicircle / Horseshoe", tables: false },
    RECEPTION: { name: "Reception / Cocktail", tables: false }
  };

  function finalize(objects, room, cfg, meta) {
    // Honest trim: drop seatable objects (tables/chairs) that fall outside the
    // usable boundary, overlap a structural obstruction, a reserved zone, or a
    // reserved equipment footprint (stage/screen/AV/podium), or block a door.
    // Object-to-object seating collisions are NOT trimmed — they must surface as
    // violations so a generator bug is caught rather than silently hidden.
    var r = normalizeRoom(room);
    var blockers = r.obstructions.concat(r.reservedZones);
    var equip = objects.filter(function (o) { return o.isReserved || o.category === "equipment"; });
    var doorAccess = r.doors.map(function (d) {
      return { id: "door_" + d.id, kind: "rect", x: d.x, y: d.y, w: d.w + 2, l: d.l + 7, r: d.r || 0 };
    });
    var kept = objects.filter(function (o) {
      if (o.isReserved || o.category === "equipment") return true; // keep equipment
      if (!insideUsable(o, r)) return false;
      for (var i = 0; i < blockers.length; i++) if (objectsOverlap(o, blockers[i])) return false;
      for (var j = 0; j < equip.length; j++) if (objectsOverlap(o, equip[j])) return false;
      for (var k = 0; k < doorAccess.length; k++) if (objectsOverlap(o, doorAccess[k])) return false;
      return true;
    });
    var v = validate(kept, room, {});
    return { objects: kept, seats: kept.filter(function (o) { return o.category === "chair"; }).length,
      meta: meta || {}, validation: v };
  }

  function generate(layoutId, room, params) {
    var fn = REGISTRY[layoutId];
    if (!fn) return { objects: [], seats: 0, meta: { layout: layoutId, error: "unknown layout" }, validation: { feasible: false, violations: [], seats: 0 } };
    return fn(room, params || {});
  }

  /* ============================================================================
   * CAPACITY ENGINE — published / estimated / VALIDATED + fit assessment
   * ==========================================================================*/
  // Highest validated capacity FOUND for a layout in a room (heuristic, not proven max).
  function validatedCapacity(layoutId, room, params) {
    var res = generate(layoutId, room, params);
    // remove colliding/out-of-bounds chairs would be a refinement; for now a layout
    // is accepted only if feasible. If infeasible, we report 0 validated + reasons.
    if (res.meta && res.meta.standingEstimate != null && layoutId === "RECEPTION") {
      return { validated: null, standingEstimate: res.meta.standingEstimate, feasible: res.validation.feasible, violations: res.validation.violations, objects: res.objects };
    }
    return {
      validated: res.validation.feasible ? res.seats : 0,
      seatsPlaced: res.seats,
      feasible: res.validation.feasible,
      violations: res.validation.violations,
      objects: res.objects
    };
  }
  // Rough planning estimate from area (NO geometry guarantee). sqftPerSeat by layout.
  var SQFT_PER_SEAT = {
    THEATER: 8, CHEVRON: 9, SEMICIRCLE: 10, CLASSROOM: 18, U_SHAPE: 24, DOUBLE_U: 22,
    TRIPLE_U: 21, HOLLOW_SQUARE: 23, BOARDROOM: 25, BANQUET: 12, CABARET: 15, PODS: 18, RECEPTION: 8
  };
  function estimatedCapacity(layoutId, room) {
    var a = usableArea(room);
    var per = SQFT_PER_SEAT[layoutId] || 15;
    return Math.max(0, Math.floor(a / per));
  }

  // Fit assessment for a requested attendee count.
  // Returns status FIT / CONDITIONAL / DOES_NOT_FIT / UNKNOWN + detail.
  function assessFit(layoutId, room, requested, params) {
    var hasDims = room && room.width > 0 && room.length > 0;
    if (!hasDims) {
      var est = room && room.area ? Math.floor(room.area / (SQFT_PER_SEAT[layoutId] || 15)) : null;
      return { status: "UNKNOWN", validated: null, estimated: est,
        reason: "No room dimensions — cannot validate geometry. Provide width and length." };
    }
    var vc = validatedCapacity(layoutId, room, params);
    if (layoutId === "RECEPTION") {
      var se = vc.standingEstimate;
      if (!vc.feasible) return { status: "DOES_NOT_FIT", validated: null, estimated: se, reason: violationSummary(vc.violations) };
      return { status: se >= requested ? "FIT" : "DOES_NOT_FIT", validated: null, estimated: se,
        reason: se >= requested ? "Standing capacity estimate meets the request." : "Standing estimate (" + se + ") below requested " + requested + "." };
    }
    if (!vc.feasible) {
      return { status: "DOES_NOT_FIT", validated: 0, seatsPlaced: vc.seatsPlaced,
        reason: violationSummary(vc.violations), violations: vc.violations };
    }
    if (vc.validated >= requested) {
      return { status: "FIT", validated: vc.validated, reason: "A valid configuration seats " + vc.validated + " (>= " + requested + ")." };
    }
    return { status: "DOES_NOT_FIT", validated: vc.validated,
      reason: "Highest validated capacity found is " + vc.validated + ", below requested " + requested + "." };
  }
  function violationSummary(vs) {
    if (!vs || !vs.length) return "No valid placement found.";
    var byType = {};
    vs.forEach(function (v) { byType[v.type] = (byType[v.type] || 0) + 1; });
    return Object.keys(byType).map(function (t) { return byType[t] + " " + t; }).join(", ") + " conflict(s).";
  }

  /* ---------- FIT SCORE (0..100), hard constraints override ---------- */
  var FIT_WEIGHTS = { capacity: 0.30, circulation: 0.25, geometry: 0.20, av: 0.15, ops: 0.10 };
  function fitScore(parts, hardFail) {
    // parts: {capacity,circulation,geometry,av,ops} each 0..1. hardFail => cap at label DOES_NOT_FIT
    var w = FIT_WEIGHTS, score = 0;
    score += (parts.capacity || 0) * w.capacity;
    score += (parts.circulation || 0) * w.circulation;
    score += (parts.geometry || 0) * w.geometry;
    score += (parts.av || 0) * w.av;
    score += (parts.ops || 0) * w.ops;
    return { score: Math.round(score * 100), hardFail: !!hardFail, weights: w };
  }

  /* ---------- public API ---------- */
  var API = {
    // constants / libs
    FURNITURE: FURNITURE, REGISTRY: REGISTRY, LAYOUT_META: LAYOUT_META, FIT_WEIGHTS: FIT_WEIGHTS,
    SQFT_PER_SEAT: SQFT_PER_SEAT,
    // units
    ft2m: ft2m, m2ft: m2ft, toFeet: toFeet, round2: round2,
    // geometry
    rectCorners: rectCorners, polysIntersect: polysIntersect, objectsOverlap: objectsOverlap,
    pointInPolygon: pointInPolygon, polygonArea: polygonArea,
    // room
    normalizeRoom: normalizeRoom, grossArea: grossArea, usableArea: usableArea, insideUsable: insideUsable,
    makeObj: makeObj,
    // validation + generate
    validate: validate, generate: generate,
    // capacity
    validatedCapacity: validatedCapacity, estimatedCapacity: estimatedCapacity,
    assessFit: assessFit, fitScore: fitScore
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.LayoutEngine = API;
})(typeof window !== "undefined" ? window : globalThis);
