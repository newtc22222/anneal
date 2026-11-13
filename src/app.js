(function () {
"use strict";
const $ = (s, el) => (el || document).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rich = s => esc(s).replace(/`([^`]+)`/g, '<code class="i">$1</code>').replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const pad = n => String(n).padStart(2, "0");
const BY = {}; LESSONS.forEach(l => { BY[l.slug] = l; l.next = []; });
LESSONS.forEach(l => l.needs.forEach(n => { if (BY[n]) BY[n].next.push(l.slug); }));
const TR = {}; TRACKS.forEach(t => { TR[t.id] = t; });
const TOTAL_MIN = LESSONS.reduce((a, l) => a + l.minutes, 0);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- syntax highlighting
const CLS = [null, "c", "s", "s", "l", "c", "n", "m", "k", "y"];
function hl(code, lang) {
  if (lang === "plain") return esc(code).replace(/(#[^\n]*|←[^\n]*)/g, '<span class="c">$1</span>');
  const rx = /(\/\/[^\n]*)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])')|('[a-z_]\w*)|(#!?\[[^\]\n]*\])|(\b\d[\d_]*(?:\.\d+)?(?:u8|u16|u32|u64|i32|i64|usize|f64)?\b)|(\b[a-z_]\w*!)|(\b(?:as|async|await|const|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|return|safe|self|Self|static|struct|trait|true|type|unsafe|use|where|while)\b)|(\b[A-Z][A-Za-z0-9_]*\b)/g;
  let out = "", last = 0, m;
  while ((m = rx.exec(code))) {
    out += esc(code.slice(last, m.index));
    let k = 1; while (!m[k]) k++;
    out += '<span class="' + CLS[k] + '">' + esc(m[0]) + "</span>";
    last = rx.lastIndex;
  }
  return out + esc(code.slice(last));
}

// ---------- progress: this browser, plus your claude.ai account when available
const KEY = "anneal.v1";
let P = { answers: {}, done: [], last: null, updatedAt: 0 };
let local = true;
try { const raw = localStorage.getItem(KEY); if (raw) P = Object.assign(P, JSON.parse(raw)); } catch (e) { local = false; }
let remote = null, pushT = null;
function save() {
  P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { local = false; }
  if (remote) { clearTimeout(pushT); pushT = setTimeout(() => remote.set(JSON.parse(JSON.stringify(P))).catch(() => { remote = null; }), 700); }
}
async function connect() {
  try {
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [user, db] = await Promise.all([window.claude.use("user").catch(() => null), window.claude.use("db").catch(() => null)]);
    if (!user || !db) return;
    const id = await user.id(); if (!id) return;
    const ref = db.doc("data/users/" + id + "/anneal");
    const snap = await ref.get();
    const r = snap.exists ? snap.data() : null;
    remote = ref;
    if (r && (r.updatedAt || 0) > (P.updatedAt || 0)) {
      P = { answers: r.answers || {}, done: Array.isArray(r.done) ? r.done.filter(s => BY[s]) : [], last: r.last || null, updatedAt: r.updatedAt };
      try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { }
      render(true);
    } else if ((P.updatedAt || 0) > ((r && r.updatedAt) || 0)) save();
  } catch (e) { remote = null; }
}
const isDone = s => P.done.includes(s);
const reached = s => OUTSIDE[s] ? true : isDone(s); // outside courses count as already learned
const isReady = l => l.needs.every(reached);
const doneCount = () => LESSONS.filter(l => isDone(l.slug)).length;
const qid = (l, i) => l.slug + ":" + i;
function kindCounts() {
  const c = { what: [0, 0], why: [0, 0] };
  LESSONS.forEach(l => l.quiz.forEach((q, i) => { c[q.kind][1]++; if (P.answers[qid(l, i)] === q.answer) c[q.kind][0]++; }));
  return c;
}
function resume() {
  if (P.last && BY[P.last] && !isDone(P.last)) return BY[P.last];
  return LESSONS.find(l => !isDone(l.slug) && isReady(l)) || LESSONS.find(l => !isDone(l.slug)) || null;
}
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
const nodeTitle = s => OUTSIDE[s] ? OUTSIDE[s].title : BY[s].title;

// ---------- the topic map
const MAP_W = 1200, MAP_H = 800;
const POS = {
  patina: [70, 250], temper: [70, 500],
  threads: [210, 130], "send-sync": [350, 130], locks: [490, 90], channels: [490, 190], atomics: [635, 62], contention: [780, 135],
  futures: [210, 370], tasks: [350, 370], blocking: [490, 295], cancellation: [490, 430], backpressure: [640, 320], shutdown: [790, 410],
  layout: [210, 620], allocation: [350, 565], dispatch: [350, 670], locality: [500, 600], measuring: [650, 620],
  unsafe: [850, 725], ffi: [990, 725],
  "under-load": [1110, 470]
};
const LABEL = {
  threads: "Threads", "send-sync": "Send & Sync", locks: "Arc · Mutex", channels: "Channels", atomics: "Atomics", contention: "Contention",
  futures: "Futures", tasks: "Tasks", blocking: "Blocking", cancellation: "Cancellation", backpressure: "Backpressure", shutdown: "Shutdown",
  layout: "Layout", allocation: "Allocation", dispatch: "Generics · dyn", locality: "Locality", measuring: "Measuring",
  unsafe: "unsafe", ffi: "Calling C", "under-load": "Under load"
};
const ROUTE = { "layout>unsafe": [[210, 636], [210, 770], [560, 770], [834, 725]], "temper>under-load": [[122, 500], [650, 500], [1110, 505], [1110, 486]] };
const R_NODE = 16, OUT_W = 104, OUT_H = 46;
function edgePath(a, b) {
  const key = a + ">" + b;
  if (ROUTE[key]) { const p = ROUTE[key]; return "M" + p[0] + " C" + p[1] + " " + p[2] + " " + p[3]; }
  const [sx, sy] = POS[a], [tx, ty] = POS[b];
  const out = !!OUTSIDE[a];
  const x1 = out ? sx + OUT_W / 2 : sx + R_NODE, x2 = tx - R_NODE;
  if (tx - sx < 60) { // stacked: go down
    const y1 = sy + R_NODE + 26, y2 = ty - R_NODE, my = (y1 + y2) / 2; // start below the label
    return "M" + sx + "," + y1 + " C" + sx + "," + my + " " + tx + "," + my + " " + tx + "," + y2;
  }
  const mx = (x1 + x2) / 2;
  return "M" + x1 + "," + sy + " C" + mx + "," + sy + " " + mx + "," + ty + " " + x2 + "," + ty;
}
function edges() {
  const list = [];
  LESSONS.forEach(l => l.needs.forEach(n => list.push({ a: n, b: l.slug, cross: !!OUTSIDE[n] || (BY[n] && BY[n].track !== l.track) })));
  return list;
}
function regionRects() {
  return TRACKS.map(t => {
    const ps = LESSONS.filter(l => l.track === t.id).map(l => POS[l.slug]);
    let x0 = Math.min(...ps.map(p => p[0])) - 40, x1 = Math.max(...ps.map(p => p[0])) + 40;
    const y0 = Math.min(...ps.map(p => p[1])) - 40, y1 = Math.max(...ps.map(p => p[1])) + 44;
    if (x1 - x0 < 140) { const c = (x0 + x1) / 2; x0 = c - 70; x1 = c + 70; }
    return { t, x0, y0, x1, y1 };
  });
}
let mapSel = null, mapIntroDone = false;
function viewMap() {
  const r = resume();
  const E = edges();
  const regions = regionRects().map(g => '<g class="m-region"><rect x="' + g.x0 + '" y="' + g.y0 + '" width="' + (g.x1 - g.x0) + '" height="' + (g.y1 - g.y0) + '" rx="18"/><text x="' + (g.x0 + 14) + '" y="' + (g.y0 + 22) + '">' + esc(g.t.short) + "</text></g>").join("");
  const order = s => OUTSIDE[s] ? 0 : BY[s].number;
  const paths = E.map((e, i) => {
    const warm = reached(e.a);
    return '<path id="me-' + i + '" data-a="' + e.a + '" data-b="' + e.b + '" class="m-edge' + (warm ? " warm" : "") + (e.cross ? " cross" : "") + '" style="--d:' + (0.15 + order(e.b) * 0.06).toFixed(2) + 's" d="' + edgePath(e.a, e.b) + '"/>';
  }).join("");
  const dots = REDUCED ? "" : E.map((e, i) => (reached(e.a) && !isDone(e.b)) ? '<circle class="m-dot" r="3.4"><animateMotion dur="' + (2.2 + (i % 3) * 0.35) + 's" begin="' + ((i * 0.37) % 2).toFixed(2) + 's" repeatCount="indefinite" rotate="auto"><mpath href="#me-' + i + '"/></animateMotion></circle>' : "").join("");
  const outs = Object.keys(OUTSIDE).map(k => {
    const [x, y] = POS[k], o = OUTSIDE[k];
    return '<a class="m-out" data-node="' + k + '" href="' + o.href + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(o.title + ": " + o.summary) + ' (opens the course)" style="--d:0s"><g transform="translate(' + x + "," + y + ')"><g class="pop"><rect x="' + (-OUT_W / 2) + '" y="' + (-OUT_H / 2) + '" width="' + OUT_W + '" height="' + OUT_H + '" rx="10"/><text y="-6">' + esc(o.title) + '</text><text class="s" y="13">' + (k === "patina" ? "the language" : "web services") + "</text></g></g></a>";
  }).join("");
  const nodes = LESSONS.map(l => {
    const [x, y] = POS[l.slug];
    const cls = ["m-node", isDone(l.slug) ? "done" : isReady(l) ? "ready" : "", r && r.slug === l.slug ? "next" : ""].join(" ");
    const state = isDone(l.slug) ? "done" : isReady(l) ? "ready to learn" : "needs earlier lessons";
    return '<a class="' + cls + '" data-node="' + l.slug + '" href="#l-' + l.slug + '" aria-label="Lesson ' + l.number + ": " + esc(l.title) + ", " + state + '" style="--d:' + (0.1 + l.number * 0.06).toFixed(2) + 's"><g transform="translate(' + x + "," + y + ')"><g class="pop"><circle class="ring" r="' + R_NODE + '"/><circle class="c" r="' + R_NODE + '"/><text class="n">' + pad(l.number) + '</text><text class="l" y="' + (R_NODE + 17) + '">' + esc(LABEL[l.slug]) + "</text></g></g></a>";
  }).join("");
  const intro = !mapIntroDone && !REDUCED;
  return '<div class="mapbox"><aside class="infocard" id="infocard" aria-live="polite"></aside><div class="mapscroll" id="mapscroll"><svg id="map" class="' + (intro ? "intro" : "") + '" viewBox="0 0 ' + MAP_W + " " + MAP_H + '" role="group" aria-label="Topic map: lessons and how they connect. Patina and Temper feed in from the left.">' +
    "<g>" + regions + "</g><g>" + paths + "</g><g>" + dots + '</g><g class="m-nodes">' + outs + nodes + "</g></svg></div>" +
    '<p class="maphint">Drag sideways to see the whole map. Tap a lesson to open it.</p></div>';
}
function infoCard(slug) {
  if (!slug) return "";
  if (OUTSIDE[slug]) {
    const o = OUTSIDE[slug];
    return '<span class="k">Earlier course</span><h3>' + esc(o.title) + "</h3><p>" + esc(o.summary) + '</p><div class="rel"><span><b>Leads into:</b> ' + LESSONS.filter(l => l.needs.includes(slug)).map(l => '<a href="#l-' + l.slug + '">' + esc(l.title) + "</a>").join(", ") + '</span></div><a class="btn quiet sm" href="' + o.href + '" target="_blank" rel="noopener noreferrer">Open ' + esc(o.title) + " ↗</a>";
  }
  const l = BY[slug];
  const st = isDone(slug) ? "Done" : isReady(l) ? "Ready: everything it builds on is done" : "Builds on lessons you have not done yet. You can still open it.";
  return '<span class="k">' + pad(l.number) + " · " + esc(TR[l.track].title) + " · " + l.minutes + " min</span><h3>" + esc(l.title) + "</h3><p>" + rich(l.summary) + "</p>" +
    '<div class="rel"><span><b>Builds on:</b> ' + l.needs.map(n => OUTSIDE[n] ? esc(OUTSIDE[n].title) : '<a href="#l-' + n + '">' + esc(BY[n].title) + "</a>").join(", ") + "</span>" +
    (l.next.length ? "<span><b>Leads to:</b> " + l.next.map(n => '<a href="#l-' + n + '">' + esc(BY[n].title) + "</a>").join(", ") + "</span>" : "") + "</div>" +
    '<span class="st muted">' + st + '</span><a class="btn sm" href="#l-' + l.slug + '">Open lesson →</a>';
}
function selectNode(slug) {
  const svg = $("#map"); if (!svg) return;
  mapSel = slug;
  const card = $("#infocard"); if (card) card.innerHTML = infoCard(slug);
  svg.querySelectorAll(".sel,.hl").forEach(e => e.classList.remove("sel", "hl"));
  if (!slug) { svg.classList.remove("dim"); return; }
  svg.classList.add("dim");
  const keep = new Set([slug]);
  svg.querySelectorAll(".m-edge").forEach(p => { if (p.dataset.a === slug || p.dataset.b === slug) { p.classList.add("hl"); keep.add(p.dataset.a); keep.add(p.dataset.b); } });
  svg.querySelectorAll("[data-node]").forEach(n => { if (keep.has(n.dataset.node)) n.classList.add("hl"); if (n.dataset.node === slug) n.classList.add("sel"); });
}
function afterMap() {
  const svg = $("#map"); if (!svg) return;
  svg.querySelectorAll(".m-edge").forEach(p => { try { p.style.setProperty("--len", Math.ceil(p.getTotalLength())); } catch (e) { p.style.setProperty("--len", 1200); } });
  if (svg.classList.contains("intro")) { mapIntroDone = true; setTimeout(() => svg.classList.remove("intro"), 2600); }
  const def = resume();
  const card = $("#infocard"); if (card) card.innerHTML = infoCard(mapSel || (def && def.slug));
  const sc = $("#mapscroll");
  if (sc && sc.scrollWidth > sc.clientWidth && def) { const ratio = POS[def.slug][0] / MAP_W; sc.scrollLeft = Math.max(0, ratio * sc.scrollWidth - sc.clientWidth / 2); }
  svg.addEventListener("mouseover", e => { const n = e.target.closest("[data-node]"); if (n) selectNode(n.dataset.node); });
  svg.addEventListener("focusin", e => { const n = e.target.closest("[data-node]"); if (n) selectNode(n.dataset.node); });
  svg.addEventListener("mouseleave", () => { svg.classList.remove("dim"); svg.querySelectorAll(".hl").forEach(e => e.classList.remove("hl")); });
  svg.addEventListener("click", e => {
    const n = e.target.closest(".m-node"); if (!n || REDUCED || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); selectNode(n.dataset.node); svg.classList.add("launch");
    setTimeout(() => { location.hash = "l-" + n.dataset.node; }, 300);
  });
}

// ---------- "where this sits" strip on each lesson
let narrow = window.innerWidth < 640;
function miniMapNarrow(l) {
  const W = 360, BW = 318, BX = 30, BH = 34, items = []; let y = 10;
  const cap = t => { items.push('<text class="mm-cap" x="' + BX + '" y="' + (y + 12) + '">' + t + "</text>"); y += 22; };
  const box = (slug, kind) => {
    const out = !!OUTSIDE[slug], b = BY[slug], label = out ? OUTSIDE[slug].title : b.title;
    const cls = "mm-node " + (kind === "cur" ? "cur" : out ? "out" : isDone(slug) ? "done" : "");
    items.push('<a class="' + cls + '" href="' + (out ? OUTSIDE[slug].href : "#l-" + slug) + '"' + (out ? ' target="_blank" rel="noopener noreferrer"' : "") + ' aria-label="' + esc((out ? "Course " : "Lesson " + b.number + ": ") + label) + '"><g transform="translate(' + BX + "," + y + ')"><rect width="' + BW + '" height="' + BH + '" rx="9"/>' +
      (out ? '<text x="12" y="' + BH / 2 + '">' + esc(label) + " ↗</text>" : '<text class="n" x="12" y="' + BH / 2 + '">' + pad(b.number) + '</text><text x="40" y="' + BH / 2 + '">' + esc(label.length > 34 ? label.slice(0, 33) + "…" : label) + "</text>") + "</g></a>");
    const cy = y + BH / 2; y += BH + 8; return cy;
  };
  cap("Builds on"); const ys = l.needs.map(s => box(s));
  y += 6; cap("This lesson"); const cy = box(l.slug, "cur");
  let ye = [];
  if (l.next.length) { y += 6; cap("Leads to"); ye = l.next.map(s => box(s)); }
  const warmIn = l.needs.some(reached), warmOut = isDone(l.slug);
  let rail = '<path id="mmr-in" class="mm-edge' + (warmIn ? " warm" : "") + '" d="M14,' + ys[0] + " L14," + cy + '"/>' + ys.concat([cy]).map(v => '<path class="mm-edge' + (warmIn ? " warm" : "") + '" d="M14,' + v + " L" + BX + "," + v + '"/>').join("");
  if (ye.length) rail += '<path id="mmr-out" class="mm-edge' + (warmOut ? " warm" : "") + '" d="M14,' + cy + " L14," + ye[ye.length - 1] + '"/>' + ye.map(v => '<path class="mm-edge' + (warmOut ? " warm" : "") + '" d="M14,' + v + " L" + BX + "," + v + '"/>').join("");
  const dots = REDUCED ? "" : (warmIn ? '<circle class="m-dot" r="3.2"><animateMotion dur="1.6s" repeatCount="indefinite"><mpath href="#mmr-in"/></animateMotion></circle>' : "") + (warmOut && ye.length ? '<circle class="m-dot" r="3.2"><animateMotion dur="1.6s" repeatCount="indefinite"><mpath href="#mmr-out"/></animateMotion></circle>' : "");
  return '<div class="sits"><div class="sits-h"><span class="label">Where this sits</span><a class="link" href="#map">Full map</a></div><svg viewBox="0 0 ' + W + " " + (y + 4) + '" role="group" aria-label="Lessons this one builds on and leads to">' + rail + dots + items.join("") + "</svg></div>";
}
function miniMap(l) {
  if (narrow) return miniMapNarrow(l);
  const L = l.needs, Rn = l.next;
  const rows = Math.max(L.length, Rn.length, 1), RH = 52, top = 36, H = top + rows * RH + 8, W = 760, BW = 210, BH = 36;
  const colX = [10, 275, 540];
  const y = (i, n) => top + (rows * RH) / 2 + (i - (n - 1) / 2) * RH;
  const cy = top + (rows * RH) / 2;
  const box = (slug, x, yy, kind) => {
    const out = !!OUTSIDE[slug], b = BY[slug];
    const cls = "mm-node " + (kind === "cur" ? "cur" : out ? "out" : isDone(slug) ? "done" : "");
    const href = out ? OUTSIDE[slug].href : "#l-" + slug;
    const label = out ? OUTSIDE[slug].title : b.title;
    const short = label.length > 22 ? label.slice(0, 21).trimEnd() + "…" : label;
    return '<a class="' + cls + '" href="' + href + '"' + (out ? ' target="_blank" rel="noopener noreferrer"' : "") + ' aria-label="' + esc((out ? "Course " : "Lesson " + b.number + ": ") + label) + '"><g transform="translate(' + x + "," + (yy - BH / 2) + ')"><rect width="' + BW + '" height="' + BH + '" rx="9"/>' +
      (out ? '<text x="12" y="' + BH / 2 + '">' + esc(short) + " ↗</text>" : '<text class="n" x="12" y="' + BH / 2 + '">' + pad(b.number) + '</text><text x="40" y="' + BH / 2 + '">' + esc(short) + "</text>") + "</g></a>";
  };
  let paths = "", dots = "", nodes = "";
  L.forEach((s, i) => {
    const yy = y(i, L.length), d = "M" + (colX[0] + BW) + "," + yy + " C" + (colX[0] + BW + 30) + "," + yy + " " + (colX[1] - 30) + "," + cy + " " + colX[1] + "," + cy;
    const warm = reached(s);
    paths += '<path id="mm-in-' + i + '" class="mm-edge' + (warm ? " warm" : "") + '" d="' + d + '"/>';
    if (warm && !REDUCED) dots += '<circle class="m-dot" r="3.2"><animateMotion dur="1.8s" begin="' + (i * 0.4) + 's" repeatCount="indefinite"><mpath href="#mm-in-' + i + '"/></animateMotion></circle>';
    nodes += box(s, colX[0], yy);
  });
  Rn.forEach((s, i) => {
    const yy = y(i, Rn.length), d = "M" + (colX[1] + BW) + "," + cy + " C" + (colX[1] + BW + 30) + "," + cy + " " + (colX[2] - 30) + "," + yy + " " + colX[2] + "," + yy;
    const warm = isDone(l.slug);
    paths += '<path id="mm-out-' + i + '" class="mm-edge' + (warm ? " warm" : "") + '" d="' + d + '"/>';
    if (warm && !isDone(s) && !REDUCED) dots += '<circle class="m-dot" r="3.2"><animateMotion dur="1.8s" begin="' + (i * 0.4) + 's" repeatCount="indefinite"><mpath href="#mm-out-' + i + '"/></animateMotion></circle>';
    nodes += box(s, colX[2], yy);
  });
  nodes += box(l.slug, colX[1], cy, "cur");
  const caps = '<text class="mm-cap" x="' + colX[0] + '" y="18">Builds on</text><text class="mm-cap" x="' + colX[1] + '" y="18">This lesson</text>' + (Rn.length ? '<text class="mm-cap" x="' + colX[2] + '" y="18">Leads to</text>' : '<text class="mm-cap" x="' + colX[2] + '" y="18">The end of the path</text>');
  return '<div class="sits"><div class="sits-h"><span class="label">Where this sits</span><a class="link" href="#map">Full map</a></div><svg viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="Lessons this one builds on and leads to">' + caps + paths + dots + nodes + "</svg></div>";
}

// ---------- animated figures: each frame is the complete state, so stepping back and forth is exact
const FIG = {};
FIG.mutex = {
  title: "One holder at a time",
  svg: '<svg viewBox="0 0 640 250"><rect class="fg-box fg-flash" data-k="room" x="350" y="40" width="250" height="170" rx="14"/><text class="fg-tm" x="364" y="62">Mutex&lt;Vec&lt;Note&gt;&gt;</text>' +
    '<rect class="fg-soft" x="440" y="120" width="140" height="70" rx="10"/><text class="fg-tb" data-k="data" x="452" y="160">notes: 3</text>' +
    '<rect class="fg-soft" x="340" y="100" width="20" height="60" rx="4"/><text class="fg-tm" data-k="lock" x="364" y="90">unlocked</text>' +
    '<text class="fg-tm" x="40" y="230">guards dropped:</text>' +
    ["T1", "T2", "T3"].map(t => '<g class="fg-mv fg-tok" data-k="' + t + '"><circle r="20"/><text>' + t + "</text></g>").join("") + "</svg>",
  frames: (() => {
    const Q = [[290, 130], [235, 130], [180, 130]], IN = [400, 150], D = i => [160 + i * 48, 225];
    const f = (pos, lock, data, hot, cap, room) => ({ cap, set: { T1: { xy: pos[0], c: { hot: hot === 0, wait: hot !== 0 && pos[0] !== D(0) } }, T2: { xy: pos[1], c: { hot: hot === 1, wait: hot !== 1 && pos[1] !== D(1) } }, T3: { xy: pos[2], c: { hot: hot === 2, wait: hot !== 2 && pos[2] !== D(2) } }, lock: { t: lock }, data: { t: data }, room: { c: { on: !!room } } } });
    return [
      f([Q[0], Q[1], Q[2]], "unlocked", "notes: 3", -1, "Three threads call `lock()` at the same moment."),
      f([IN, Q[1], Q[2]], "held by T1", "notes: 3", 0, "T1 gets the guard. T2 and T3 are blocked: the OS parks them until the lock is free."),
      f([IN, Q[1], Q[2]], "held by T1", "notes: 4", 0, "Through its guard, T1 has `&mut Vec`. Nobody else can see the list while it changes.", true),
      f([D(0), IN, Q[0]], "held by T2", "notes: 4", 1, "T1's guard is dropped at the end of its scope. The lock passes to T2."),
      f([D(0), IN, Q[0]], "held by T2", "notes: 5", 1, "T2 pushes its note.", true),
      f([D(0), D(1), IN], "held by T3", "notes: 6", 2, "Then T3. Each update happened alone, in some order.", true),
      f([D(0), D(1), D(2)], "unlocked", "notes: 6", -1, "All three guards dropped. There was no way to reach the Vec without the lock.")
    ];
  })()
};
FIG.owner = {
  title: "One owner, many senders",
  svg: '<svg viewBox="0 0 640 250"><text class="fg-tm" x="30" y="28">workers</text><text class="fg-tm" x="230" y="28">channel</text><text class="fg-tm" x="500" y="28">owner thread</text>' +
    [60, 125, 190].map((y, i) => '<rect class="fg-soft" x="20" y="' + (y - 20) + '" width="70" height="40" rx="8"/><text class="fg-tm" x="34" y="' + (y + 4) + '">W' + (i + 1) + "</text>").join("") +
    '<rect class="fg-soft" x="200" y="105" width="250" height="40" rx="20"/><circle class="fg-box fg-flash" data-k="own" cx="540" cy="125" r="48"/><text class="fg-tm" x="540" y="112" text-anchor="middle">total</text><text class="fg-tb" data-k="total" x="540" y="138" text-anchor="middle">0</text>' +
    ["m1", "m2", "m3"].map((k, i) => '<g class="fg-mv fg-tok" data-k="' + k + '"><rect x="-34" y="-14" width="68" height="28" rx="6"/><text>Add(' + (i + 1) * 10 + ")</text></g>").join("") +
    '<text class="fg-tm" x="30" y="235">main:</text><g class="fg-mv fg-tok hot" data-k="reply"><rect x="-22" y="-14" width="44" height="28" rx="6"/><text>60</text></g></svg>',
  frames: (() => {
    const W = [[130, 60], [130, 125], [130, 190]], C = [[250, 125], [325, 125], [400, 125]], O = [540, 125];
    const f = (m, total, cap, reply, flash) => ({ cap, set: { m1: { xy: m[0], o: m[0] === O ? 0 : 1 }, m2: { xy: m[1], o: m[1] === O ? 0 : 1 }, m3: { xy: m[2], o: m[2] === O ? 0 : 1 }, total: { t: total }, own: { c: { on: !!flash } }, reply: { xy: reply || O, o: reply ? 1 : 0 } } });
    return [
      f([W[0], W[1], W[2]], "0", "Three workers each own one message."),
      f([C[2], C[1], C[0]], "0", "`send()` moves each message into the channel. The workers no longer have them."),
      f([O, C[1], C[0]], "10", "The owner receives one message at a time and updates its own total. No lock: nobody else can reach it.", null, true),
      f([O, O, C[0]], "30", "Next message, same owner.", null, true),
      f([O, O, O], "60", "All three applied, in arrival order.", null, true),
      f([O, O, O], "60", "A `Get` request carries its own reply channel. The answer travels back the same way.", [110, 230])
    ];
  })()
};
FIG.poll = {
  title: "poll, Pending, wake, poll, Ready",
  svg: '<svg viewBox="0 0 640 250"><rect class="fg-box" x="20" y="50" width="170" height="150" rx="12"/><text class="fg-tm" x="34" y="74">executor</text>' +
    '<rect class="fg-box fg-flash" data-k="fut" x="240" y="70" width="170" height="110" rx="12"/><text class="fg-tm" x="254" y="94">your future</text><text class="fg-tb" data-k="state" x="254" y="132">state: start</text>' +
    '<rect class="fg-box fg-flash" data-k="timer" x="470" y="70" width="150" height="110" rx="12"/><text class="fg-tm" x="484" y="94">timer / socket</text>' +
    '<path class="fg-arrow" data-k="a1" d="M190,105 L240,105"/><text class="fg-tm" x="196" y="98">poll</text><path class="fg-arrow" data-k="a2" d="M240,150 L190,150"/><text class="fg-tm" x="194" y="168" data-k="ret">  </text>' +
    '<g class="fg-mv fg-tok" data-k="o1"><rect x="-26" y="-12" width="52" height="24" rx="6"/><text>task</text></g><g class="fg-mv fg-tok" data-k="o2"><rect x="-26" y="-12" width="52" height="24" rx="6"/><text>task</text></g>' +
    '<g class="fg-mv fg-tok hot" data-k="waker"><rect x="-30" y="-12" width="60" height="24" rx="12"/><text>waker</text></g></svg>',
  frames: (() => {
    const EX = [105, 125], TM = [545, 140], FU = [325, 155];
    const f = (o) => ({ cap: o.cap, set: { a1: { c: { on: !!o.poll } }, a2: { c: { on: !!o.ret } }, ret: { t: o.ret || " " }, state: { t: o.state }, waker: { xy: o.w }, fut: { c: { on: !!o.fl } }, timer: { c: { on: !!o.tf } }, o1: { xy: o.busy ? [70, 170] : [70, 230], o: o.busy ? 1 : 0, c: { hot: !!o.busy } }, o2: { xy: o.busy ? [140, 170] : [140, 230], o: o.busy ? 1 : 0 } } });
    return [
      f({ cap: "The executor calls `poll()` on the future.", poll: 1, state: "state: start", w: EX, fl: 1 }),
      f({ cap: "It is not ready. Before returning `Pending`, it hands its waker to the timer it waits on.", ret: "Pending", state: "parked at .await", w: TM, tf: 1 }),
      f({ cap: "The executor moves on to other tasks. A parked future uses no thread at all.", state: "parked at .await", w: TM, busy: 1 }),
      f({ cap: "The timer fires and calls `wake()`. The task goes back in the executor's ready queue.", state: "parked at .await", w: EX, tf: 1 }),
      f({ cap: "`poll()` again. The state machine resumes after the `.await` and returns `Ready(value)`.", poll: 1, ret: "Ready", state: "Ready(value)", w: EX, fl: 1 })
    ];
  })()
};
FIG.blocking = {
  title: "One blocking call, everyone waits",
  svg: '<svg viewBox="0 0 640 250"><text class="fg-tm" x="20" y="74">worker</text><text class="fg-tm" x="20" y="174">blocking pool</text>' +
    '<path class="fg-line" d="M120,90 L620,90"/><path class="fg-line" d="M120,190 L620,190"/>' +
    '<g class="fg-mv" data-k="bar"><rect class="fg-bar" x="0" y="-14" width="240" height="28" rx="6"/><text class="fg-tm" x="10" y="5" style="fill:var(--card)">thread::sleep(200 ms)</text></g>' +
    [0, 1, 2, 3, 4, 5].map(i => '<g class="fg-mv fg-tok" data-k="k' + i + '"><circle r="12"/><text>t</text></g>').join("") +
    '<text class="fg-tm" data-k="note" x="120" y="236"> </text></svg>',
  frames: (() => {
    const xs = [150, 230, 310, 390, 470, 550];
    const ticks = (late) => { const o = {}; xs.forEach((x, i) => { const isLate = late && i >= 1 && i <= 3; o["k" + i] = { xy: [isLate ? 420 + i * 12 : x, 90], c: { hot: !isLate, wait: isLate } }; }); return o; };
    const f = (cap, late, bar, note) => ({ cap, set: Object.assign(ticks(late), { bar: { xy: bar ? bar.xy : [160, 90], o: bar ? 1 : 0 }, note: { t: note || " " } }) });
    return [
      f("A ticker task wants to run every 50 ms on the worker thread. Each `.await` gives the thread back.", false, null, "every tick on time"),
      f("Another task calls `std::thread::sleep`. It never reaches an `.await`, so the thread is stuck.", false, { xy: [170, 90] }, " "),
      f("The ticks that should have run meanwhile all wait, then rush through late. In the example: a 211 ms gap.", true, { xy: [170, 90] }, "worst gap: 211 ms"),
      f("With `spawn_blocking`, the sleep runs on the blocking pool instead.", false, { xy: [170, 190] }, " "),
      f("The worker stays free, and every tick runs on time. Worst gap: 51 ms.", false, { xy: [170, 190] }, "worst gap: 51 ms")
    ];
  })()
};
FIG.channel = {
  title: "A bounded channel, capacity 2",
  svg: '<svg viewBox="0 0 640 250"><text class="fg-tm" x="30" y="40">producer</text><text class="fg-tm" x="250" y="40">channel (2 slots)</text><text class="fg-tm" x="470" y="40">consumer</text>' +
    '<rect class="fg-box" x="20" y="60" width="120" height="150" rx="12"/><rect class="fg-soft" x="240" y="100" width="160" height="60" rx="30"/><rect class="fg-box" x="460" y="60" width="150" height="150" rx="12"/>' +
    '<circle class="fg-cell" cx="285" cy="130" r="22"/><circle class="fg-cell" cx="355" cy="130" r="22"/>' +
    '<text class="fg-tm" data-k="ps" x="30" y="232"> </text><text class="fg-tm" data-k="clock" x="470" y="232">0 ms</text>' +
    [1, 2, 3, 4, 5].map(i => '<g class="fg-mv fg-tok" data-k="j' + i + '"><circle r="18"/><text>' + i + "</text></g>").join("") + "</svg>",
  frames: (() => {
    const P = i => [55 + ((i - 1) % 2) * 50, 90 + Math.floor((i - 1) / 2) * 44], S = [[285, 130], [355, 130]], C = [535, 120], W = [175, 130], DONE = i => [497 + ((i - 1) % 3) * 40, 166 + Math.floor((i - 1) / 3) * 30];
    const f = (cap, pos, clock, ps, waitJ) => { const set = { clock: { t: clock }, ps: { t: ps || " " } }; for (let i = 1; i <= 5; i++) { const p = pos[i]; set["j" + i] = { xy: p[0], o: p[1] === "x" ? 0.35 : 1, c: { hot: p[1] === "c", wait: waitJ === i } }; } return { cap, set }; };
    return [
      f("Five jobs. The channel holds two. The consumer takes 100 ms per job.", { 1: [P(1)], 2: [P(2)], 3: [P(3)], 4: [P(4)], 5: [P(5)] }, "0 ms"),
      f("Job 1 goes straight to the consumer, so jobs 2 and 3 both fit in the slots.", { 1: [C, "c"], 2: [S[1]], 3: [S[0]], 4: [P(4)], 5: [P(5)] }, "0 ms"),
      f("Job 4: the channel is full, so `send().await` waits. Nothing piles up.", { 1: [C, "c"], 2: [S[1]], 3: [S[0]], 4: [W], 5: [P(5)] }, "0 ms", "send().await is waiting", 4),
      f("100 ms: job 1 is done, the consumer takes job 2, a slot frees, and job 4 goes in.", { 1: [DONE(1), "x"], 2: [C, "c"], 3: [S[1]], 4: [S[0]], 5: [W] }, "100 ms", "send().await is waiting", 5),
      f("200 ms: the same again for job 5. The producer runs at the consumer's pace.", { 1: [DONE(1), "x"], 2: [DONE(2), "x"], 3: [C, "c"], 4: [S[1]], 5: [S[0]] }, "200 ms"),
      f("500 ms: all done. Memory stayed bounded the whole time.", { 1: [DONE(1), "x"], 2: [DONE(2), "x"], 3: [DONE(3), "x"], 4: [DONE(4), "x"], 5: [DONE(5), "x"] }, "500 ms")
    ];
  })()
};
FIG.locality = {
  title: "Side by side, or scattered",
  svg: (() => {
    let s = '<svg viewBox="0 0 640 250"><text class="fg-tm" x="20" y="36">Vec&lt;Point&gt;: points side by side</text>';
    for (let i = 0; i < 16; i++) s += '<rect class="fg-cell pt" data-k="a' + i + '" x="' + (20 + i * 36 + Math.floor(i / 4) * 8) + '" y="48" width="32" height="32" rx="4"/>';
    for (let g = 0; g < 4; g++) s += '<text class="fg-tm" x="' + (20 + g * 152) + '" y="98">line ' + (g + 1) + "</text>";
    s += '<text class="fg-tm" x="20" y="140">Vec&lt;Box&lt;Point&gt;&gt;: each point somewhere else</text>';
    for (let i = 0; i < 32; i++) s += '<rect class="fg-cell" data-k="b' + i + '" x="' + (20 + (i % 16) * 36 + Math.floor((i % 16) / 4) * 8) + '" y="' + (150 + Math.floor(i / 16) * 38) + '" width="32" height="32" rx="4"/>';
    return s + '<text class="fg-tb" data-k="ca" x="420" y="36">lines fetched: 0</text><text class="fg-tb" data-k="cb" x="420" y="140">lines fetched: 0</text></svg>';
  })(),
  frames: (() => {
    const scat = [21, 6, 28, 13, 2, 25, 10, 31]; // where each boxed point lives
    const frames = [];
    for (let k = 0; k <= 8; k++) {
      const set = {};
      const linesA = k === 0 ? 0 : Math.floor((k - 1) / 4) + 1;
      for (let i = 0; i < 16; i++) set["a" + i] = { c: { cur: i === k - 1, fetched: k > 0 && Math.floor(i / 4) < linesA } };
      const fetchedB = new Set(scat.slice(0, k).map(c => Math.floor(c / 4)));
      for (let i = 0; i < 32; i++) set["b" + i] = { c: { pt: scat.includes(i), cur: i === scat[k - 1], fetched: fetchedB.has(Math.floor(i / 4)) } };
      set.ca = { t: "lines fetched: " + linesA }; set.cb = { t: "lines fetched: " + fetchedB.size };
      const cap = k === 0 ? "Summing 8 points. The CPU reads memory a cache line at a time (here, 4 cells per line)."
        : k <= 4 ? "Side by side: one line brings in four points. Boxed: every point is in a different line."
        : k < 8 ? "The next line of the flat Vec is fetched once; the boxed points keep landing in new places."
        : "8 points: 2 lines fetched for the Vec, 8 for the boxes. In the example that was about 3× slower.";
      frames.push({ cap, set });
    }
    return frames;
  })(),
  ms: 1100
};

const figState = {};
let figObserver = null;
function figHtml(id, key) {
  const F = FIG[id];
  return '<figure class="fig" data-fig="' + id + '" data-key="' + key + '"><div class="fig-h"><span class="label">' + esc(F.title) + '</span><div class="fig-ctl">' +
    '<button data-act="fig-prev" aria-label="Previous step">←</button><span class="ct" aria-hidden="true"></span><button data-act="fig-next" aria-label="Next step">→</button>' +
    '<button data-act="fig-play" aria-label="Pause animation">❚❚</button></div></div>' + F.svg +
    '<div class="dots" aria-hidden="true">' + F.frames.map(() => "<i></i>").join("") + "</div><figcaption></figcaption></figure>";
}
function figApply(el, instant) {
  const id = el.dataset.fig, F = FIG[id], st = figState[el.dataset.key];
  const fr = F.frames[st.i];
  if (instant) el.classList.add("snap");
  Object.entries(fr.set).forEach(([k, v]) => {
    const node = el.querySelector('[data-k="' + k + '"]'); if (!node) return;
    if (v.xy) node.style.transform = "translate(" + v.xy[0] + "px," + v.xy[1] + "px)";
    if (v.o !== undefined) node.style.opacity = v.o;
    if (v.t !== undefined) node.textContent = v.t;
    if (v.c) Object.entries(v.c).forEach(([c, on]) => node.classList.toggle(c, !!on));
  });
  if (instant) { void el.offsetWidth; el.classList.remove("snap"); }
  el.querySelector("figcaption").innerHTML = rich(fr.cap);
  el.querySelector(".ct").textContent = (st.i + 1) + " / " + F.frames.length;
  el.querySelectorAll(".dots i").forEach((d, j) => d.classList.toggle("on", j <= st.i));
  const play = el.querySelector('[data-act="fig-play"]');
  play.textContent = st.playing ? "❚❚" : "▶"; play.setAttribute("aria-label", st.playing ? "Pause animation" : "Play animation");
  el.querySelector("figcaption").setAttribute("aria-live", st.playing ? "off" : "polite");
}
function figTick(el) {
  const st = figState[el.dataset.key]; clearTimeout(st.t);
  if (!st.playing || !st.visible) return;
  const F = FIG[el.dataset.fig], last = st.i === F.frames.length - 1;
  st.t = setTimeout(() => { st.i = last ? 0 : st.i + 1; figApply(el, last); figTick(el); }, (F.ms || 1900) * (last ? 1.8 : 1) + (st.i === 0 ? 400 : 0));
}
function setupFigures() {
  if (figObserver) figObserver.disconnect();
  figObserver = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
    const st = figState[e.target.dataset.key]; if (!st) return;
    st.visible = e.isIntersecting; figTick(e.target);
  }), { threshold: 0.5 }) : null;
  document.querySelectorAll(".fig").forEach(el => {
    const key = el.dataset.key;
    if (!figState[key]) figState[key] = { i: 0, playing: !REDUCED, visible: !figObserver };
    figApply(el, true);
    if (figObserver) figObserver.observe(el); else figTick(el);
  });
}

// ---------- routing
function route() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("l-") && BY[h.slice(2)]) return { v: "lesson", slug: h.slice(2) };
  if (["glossary", "sheet", "errors"].includes(h)) return { v: h };
  return { v: "map" };
}
let R = route(), armed = false;

// ---------- views
function header() {
  const cur = R.v === "lesson" ? "map" : R.v;
  const links = [["map", "Map"], ["glossary", "Glossary"], ["sheet", "Sheet"], ["errors", "Errors"]];
  return '<a class="skip" href="#content" data-skip>Skip to content</a><header class="top"><div class="rule"></div><div class="bar"><div class="wrap"><div class="row">' +
    '<a class="brand" href="#map" aria-label="Anneal: the map"><svg viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="var(--steel)"/><stop offset="1" stop-color="var(--amber)"/></linearGradient></defs><rect x="3" y="9" width="22" height="10" rx="3" fill="url(#bg)"/><path d="M6 6 C9 3, 12 9, 15 6 S21 3, 22 6" fill="none" stroke="var(--ember)" stroke-width="1.6" stroke-linecap="round"/><path d="M6 23 h16" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"/></svg><span>Anneal</span></a>' +
    '<nav class="main" aria-label="Course">' + links.map(([k, t]) => '<a href="#' + k + '"' + (cur === k ? ' aria-current="page"' : "") + ">" + t + "</a>").join("") + "</nav>" +
    '<a class="count" href="#map" aria-label="' + doneCount() + " of " + LESSONS.length + ' lessons complete">' + doneCount() + "/" + LESSONS.length + "</a></div></div></div></header>";
}
function footer() {
  return '<footer><div class="wrap"><p>Anneal is the third course, after Patina and Temper. Every example was compiled and run with Rust 1.97 (Tokio 1.54, Axum 0.8), and every output and timing shown is a real run on a 2-core machine. This page does not run code.</p><p id="savenote">' +
    (remote ? "Progress is saved to your claude.ai account and this browser." : local ? "Progress stays in this browser." : "Progress can't be saved in this view; it lasts until you close the page.") + "</p></div></footer>";
}
function viewHome() {
  const n = doneCount(), all = n === LESSONS.length, r = resume(), kc = kindCounts();
  const started = n > 0 || Object.keys(P.answers).length > 0;
  return '<main id="content"><div class="wrap"><section class="hero">' +
    '<p class="eyebrow">Course three · ' + LESSONS.length + " lessons · about " + Math.round(TOTAL_MIN / 60 * 2) / 2 + " hours</p>" +
    "<h1>" + (all ? "You have seen what happens under the code." : "What happens under the code.") + "</h1>" +
    '<p class="lede">' + (all ? "Threads, tasks, memory, and a real service measured and fixed. The sheet and the errors page are worth keeping open." :
      "Patina taught the language. Temper built a web service. Anneal opens the hood: threads and locks, what a future really is, where memory goes, and how to measure. It ends by putting Temper's notes service under load and making it faster.") + "</p>" +
    '<div class="family" aria-label="The course series"><a href="' + OUTSIDE.patina.href + '" target="_blank" rel="noopener noreferrer">Patina ↗</a><span class="arr">→</span><a href="' + OUTSIDE.temper.href + '" target="_blank" rel="noopener noreferrer">Temper ↗</a><span class="arr">→</span><b>Anneal</b></div>' +
    '<div class="start-row">' + (r ? '<a class="btn" href="#l-' + r.slug + '">' + (n === 0 ? "Start with lesson 1" : "Continue · " + esc(r.title)) + " →</a>" : '<a class="btn" href="#sheet">Open the sheet →</a>') +
    '<span class="mono muted" style="font-size:14px">' + n + " of " + LESSONS.length + " complete</span></div>" +
    '<div class="progress" role="progressbar" aria-label="Lessons completed" aria-valuemin="0" aria-valuemax="' + LESSONS.length + '" aria-valuenow="' + n + '"><i style="width:' + (100 * n / LESSONS.length) + '%"></i></div>' +
    '<p class="qcount">Questions right: <b>' + kc.what[0] + "/" + kc.what[1] + "</b> on what an idea is · <b>" + kc.why[0] + "/" + kc.why[1] + "</b> on why it exists</p></section>" +
    '<section class="mapsec" aria-labelledby="map-h"><div class="mapsec-head"><h2 id="map-h">The map</h2><div class="legend"><span><i></i>not yet</span><span><i class="n"></i>ready</span><span><i class="d"></i>done</span><span>Heat flows from what you know to what it unlocks.</span></div></div>' +
    '<div class="mapgrid">' + viewMap() + "</div></section>" +
    '<section class="path" aria-labelledby="path-h"><h2 id="path-h">The lessons, in order</h2>' +
    TRACKS.map(t => '<div class="track"><h3>' + esc(t.title) + " <span>· " + esc(t.summary) + '</span></h3><ul class="lessons">' + LESSONS.filter(l => l.track === t.id).map(l =>
      '<li class="' + (isDone(l.slug) ? "done" : "") + '"><a href="#l-' + l.slug + '"><span class="num">' + pad(l.number) + '</span><span class="body"><span class="t">' + esc(l.title) + '</span><span class="s">' + rich(l.summary) + '</span></span><span class="min">' + l.minutes + ' min</span><span class="tick" aria-label="' + (isDone(l.slug) ? "Done" : "Not done") + '">✓</span></a></li>').join("") + "</ul></div>").join("") + "</section>" +
    (started ? '<div class="reset">' + (armed ? "<span>This clears every answer on this device" + (remote ? " and in your account" : "") + '.</span><button class="btn sm" data-act="reset-yes">Clear progress</button><button class="btn sm quiet" data-act="reset-no">Keep it</button>' : '<button class="btn sm quiet" data-act="reset">Reset progress</button>') + "</div>" : "") +
    "</div></main>";
}
function codeBlock(b, idx) {
  const std = (b.lang || "rust") === "rust" && /fn main/.test(b.code) && !/tokio|axum|serde/.test(b.code);
  const pg = std ? "https://play.rust-lang.org/?version=stable&mode=release&edition=2024&code=" + encodeURIComponent(b.code) : null;
  return '<div class="code"><div class="cap"><span>' + esc(b.file || (b.lang === "plain" ? "" : "src/main.rs")) + '</span><span class="acts"><button data-act="copy" data-i="' + idx + '">Copy</button>' + (pg ? '<a href="' + esc(pg) + '" target="_blank" rel="noopener noreferrer">Open in Playground ↗</a>' : "") + "</span></div>" +
    "<pre><code>" + hl(b.code, b.lang) + "</code></pre>" + (b.out ? '<div class="out"><div class="lbl">Output</div><pre>' + esc(b.out) + "</pre></div>" : "") + "</div>" +
    (b.caption ? '<p class="figcap">' + rich(b.caption) + "</p>" : "");
}
const pickState = {};
function pick(b, idx) {
  const key = R.slug + ":" + idx, p = pickState[key];
  const opt = id => {
    const sel = p === id, cls = sel ? (id === b.answer ? "right" : "wrong") : "";
    return '<label class="' + cls + '"><span class="h"><input type="radio" name="pk-' + idx + '" data-act="pick" data-i="' + idx + '" value="' + id + '"' + (sel ? " checked" : "") + "> " + id.toUpperCase() + "</span><pre><code>" + hl(b[id]) + "</code></pre></label>";
  };
  const wrongId = b.answer === "a" ? "B" : "A";
  return '<fieldset class="pick"><legend>' + rich(b.prompt) + '</legend><div class="opts">' + opt("a") + opt("b") + "</div>" +
    '<div class="res" aria-live="polite">' + (p ? "<b>" + (p === b.answer ? "Yes, this one compiles." : "This one does not compile.") + "</b> Version " + (b.answer === "a" ? "B" : "A") + " fails with:" + '<div class="err">' + esc(b.error) + '</div><p style="margin-top:8px">' + rich(b.why) + "</p>" : '<span class="muted">Pick the version the compiler accepts.</span>') + "</div></fieldset>";
}
function block(b, idx) {
  switch (b.type) {
    case "p": return "<p>" + rich(b.text) + "</p>";
    case "h": return "<h2>" + rich(b.text) + "</h2>";
    case "ul": return "<ul>" + b.items.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul>";
    case "callout": return '<div class="callout' + (b.tone === "warn" ? " warn" : "") + '"><div class="ct">' + rich(b.title) + "</div>" + rich(b.text) + "</div>";
    case "code": return codeBlock(b, idx);
    case "pick": return pick(b, idx);
    case "figure": return figHtml(b.id, R.slug + ":" + idx);
    case "links": return '<ul class="links">' + b.items.map(x => '<li><a href="' + esc(x.href) + '" target="_blank" rel="noopener noreferrer">' + esc(x.label) + " ↗</a> <span>— " + rich(x.note) + "</span></li>").join("") + "</ul>";
  }
  return "";
}
function order(key, n) {
  let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}
function quiz(l) {
  const right = l.quiz.filter((q, i) => P.answers[qid(l, i)] === q.answer).length, total = l.quiz.length;
  return '<section class="check" aria-labelledby="check-h"><h2 id="check-h">Check</h2><p class="st">' + (right === total ? "All " + total + " landed. This lesson is marked done, and its node on the map is warm." : right + " of " + total + " correct. Two questions ask what the idea is; one asks why it exists. A wrong answer can be changed.") + "</p>" +
    '<ol class="qs">' + l.quiz.map((q, i) => {
      const a = P.answers[qid(l, i)], ok = a === q.answer;
      return '<li><div class="qmeta"><span>' + (i + 1) + " / " + total + '</span><span class="tag ' + q.kind + '">' + (q.kind === "why" ? "Why it exists" : "What it is") + '</span></div><p class="qp">' + rich(q.prompt) + '</p><ul class="choices">' +
        order(qid(l, i), q.choices.length).map((j, pos) => {
          const sel = a === j;
          return '<li><button data-act="answer" data-q="' + i + '" data-c="' + j + '"' + (ok ? " disabled" : "") + ' class="' + (sel ? (j === q.answer ? "sel-right" : "sel-wrong") : "") + '"' + (sel ? ' aria-pressed="true"' : "") + '><span class="L">' + "ABCD"[pos] + "</span><span>" + rich(q.choices[j]) + "</span></button></li>";
        }).join("") + "</ul>" + (a !== undefined ? '<p class="fb" aria-live="polite"><b>' + (ok ? "Yes." : "Not quite.") + "</b> " + rich(q.why) + "</p>" : "") + "</li>";
    }).join("") + "</ol>" + (right === total ? '<div class="done-note">Done. ' + (l.next.length ? "This unlocks: " + l.next.map(n => '<a class="link" href="#l-' + n + '">' + esc(BY[n].title) + "</a>").join(", ") + "." : "That was the last lesson.") + "</div>" : "") + "</section>";
}
function viewLesson() {
  const l = BY[R.slug], t = TR[l.track];
  const prev = LESSONS[l.number - 2], next = LESSONS[l.number];
  return '<main id="content"><div class="wrap narrow"><div class="lesson-head"><p class="eyebrow">' + pad(l.number) + " · " + esc(t.title) + " · " + l.minutes + " min</p><h1>" + esc(l.title) + '</h1><p class="lede">' + rich(l.summary) + "</p></div>" +
    miniMap(l) + '<div class="lesson-body">' + l.blocks.map(block).join("") + "</div>" +
    '<section class="why" aria-labelledby="why-h"><h2 id="why-h">Why it exists</h2><p class="sub">The part worth being able to say in your own words.</p><dl><dt>Without it</dt><dd>' + rich(l.why.without) + "</dd><dt>Rust's answer</dt><dd>" + rich(l.why.answer) + "</dd><dt>The cost</dt><dd>" + rich(l.why.cost) + "</dd></dl></section>" +
    quiz(l) +
    '<nav class="pager" aria-label="Lessons">' + (prev ? '<a href="#l-' + prev.slug + '"><span class="d">← ' + pad(prev.number) + '</span><span class="t">' + esc(prev.title) + "</span></a>" : '<a href="#map"><span class="d">← Map</span><span class="t">All lessons</span></a>') +
    (next ? '<a class="nx" href="#l-' + next.slug + '"><span class="d">' + pad(next.number) + ' →</span><span class="t">' + esc(next.title) + "</span></a>" : '<a class="nx" href="#map"><span class="d">Finished →</span><span class="t">Back to the map</span></a>') + "</nav></div></main>";
}
let gq = "";
const termsHtml = list => list.length ? list.map(t => '<div class="term"><h2>' + esc(t.name) + "</h2><div><p>" + rich(t.body) + '</p><a class="link" href="#l-' + t.lesson + '">Lesson ' + pad(BY[t.lesson].number) + " · " + esc(BY[t.lesson].title) + "</a></div></div>").join("") : '<p class="muted" style="padding:16px 0">No term matches that.</p>';
const glossFilter = () => { const q = gq.trim().toLowerCase(); return GLOSSARY.filter(t => !q || (t.name + " " + t.body).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)); };
function viewGlossary() {
  return '<main id="content" class="ref"><div class="wrap narrow"><p class="eyebrow">' + GLOSSARY.length + ' terms</p><h1>Glossary</h1><p class="lede">Each word in a sentence or two, with the lesson that teaches it.</p>' +
    '<input class="filter" id="gq" type="search" placeholder="Filter terms" aria-label="Filter terms" value="' + esc(gq) + '"><div class="terms" id="terms">' + termsHtml(glossFilter()) + "</div></div></main>";
}
function viewSheet() {
  return '<main id="content" class="ref"><div class="wrap"><p class="eyebrow">Keep this open</p><h1>The pocket sheet</h1><p class="lede">The whole course, one line per idea.</p><div class="sheet">' +
    SHEET.map(s => "<section><h2>" + esc(s.title) + "</h2><table>" + s.rows.map(r => "<tr><td>" + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td></tr>").join("") + "</table></section>").join("") + "</div></div></main>";
}
function viewErrors() {
  return '<main id="content" class="ref"><div class="wrap narrow"><p class="eyebrow">' + ERRORS.length + ' errors</p><h1>What the compiler is saying</h1><p class="lede">The concurrency errors you will meet first. Each broken snippet was checked to fail with exactly this message, and each fix to compile.</p><div class="errs">' +
    ERRORS.map(e => '<article class="errcard"><div class="code-id">' + esc(e.code) + "</div><h2>" + esc(e.title) + '</h2><div class="err">' + esc(e.message) + "</div><p>" + rich(e.meaning) + "</p><p><b>Fix.</b> " + rich(e.fix) + "</p>" +
      '<div class="bf"><div class="code"><div class="cap"><span>fails</span></div><pre><code>' + hl(e.broken) + '</code></pre></div><div class="code"><div class="cap"><span>compiles</span></div><pre><code>' + hl(e.fixed) + "</code></pre></div></div>" +
      '<p style="font-size:14px"><a class="link" href="#l-' + e.lesson + '">Lesson ' + pad(BY[e.lesson].number) + " · " + esc(BY[e.lesson].title) + "</a></p></article>").join("") + "</div></div></main>";
}

function render(keepScroll) {
  const y = window.scrollY;
  Object.values(figState).forEach(s => clearTimeout(s.t));
  let body;
  if (R.v === "lesson") body = viewLesson();
  else if (R.v === "glossary") body = viewGlossary();
  else if (R.v === "sheet") body = viewSheet();
  else if (R.v === "errors") body = viewErrors();
  else body = viewHome();
  $("#app").innerHTML = header() + body + footer();
  if (R.v === "map") afterMap();
  setupFigures();
  const titles = { lesson: R.slug && pad(BY[R.slug].number) + ". " + BY[R.slug].title, glossary: "Glossary", sheet: "Pocket sheet", errors: "Compiler errors" };
  document.title = (titles[R.v] ? titles[R.v] + " · " : "") + "Anneal";
  if (keepScroll) window.scrollTo(0, y);
}

window.addEventListener("hashchange", () => {
  if (location.hash === "#content") return;
  const prev = R; R = route(); armed = false;
  if (R.v === "lesson") { P.last = R.slug; save(); }
  if (prev.v === R.v && prev.slug === R.slug) return;
  render(); window.scrollTo(0, 0);
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-skip]")) { e.preventDefault(); const m = $("#content"); if (m) { m.setAttribute("tabindex", "-1"); m.focus(); } return; }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "answer") {
    const l = BY[R.slug], i = +a.dataset.q, c = +a.dataset.c;
    P.answers[qid(l, i)] = c;
    if (l.quiz.every((q, k) => P.answers[qid(l, k)] === q.answer) && !isDone(l.slug)) { P.done.push(l.slug); toast("Lesson " + pad(l.number) + " done"); }
    save(); render(true);
  } else if (act === "copy") {
    const pre = a.closest(".code").querySelector("pre"), b = BY[R.slug].blocks[+a.dataset.i];
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected. Press Ctrl+C or ⌘C to copy."); };
    try { navigator.clipboard.writeText(b.code).then(() => toast("Copied"), fallback); } catch (err) { fallback(); }
  } else if (act.startsWith("fig-")) {
    const el = a.closest(".fig"), st = figState[el.dataset.key], n = FIG[el.dataset.fig].frames.length;
    if (act === "fig-play") { st.playing = !st.playing; if (st.playing && st.i === n - 1) st.i = 0; }
    else { st.playing = false; st.i = (st.i + (act === "fig-next" ? 1 : -1) + n) % n; }
    figApply(el, false); figTick(el);
  } else if (act === "reset") { armed = true; render(true); }
  else if (act === "reset-no") { armed = false; render(true); }
  else if (act === "reset-yes") { P = { answers: {}, done: [], last: null, updatedAt: 0 }; armed = false; save(); render(true); toast("Progress cleared"); }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.act === "pick") { pickState[R.slug + ":" + t.dataset.i] = t.value; render(true); const el = document.querySelector('input[name="pk-' + t.dataset.i + '"][value="' + t.value + '"]'); if (el) el.focus({ preventScroll: true }); }
});
document.addEventListener("input", e => { if (e.target.id === "gq") { gq = e.target.value; $("#terms").innerHTML = termsHtml(glossFilter()); } });
window.addEventListener("resize", () => { const n = window.innerWidth < 640; if (n !== narrow) { narrow = n; if (R.v === "lesson") render(true); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) Object.values(figState).forEach(s => clearTimeout(s.t)); else document.querySelectorAll(".fig").forEach(figTick); });

if (R.v === "lesson") { P.last = R.slug; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { } }
render();
connect().then(() => { const n = $("#savenote"); if (remote && n) n.textContent = "Progress is saved to your claude.ai account and this browser."; });
})();
