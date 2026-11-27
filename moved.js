// Shift-Log add-on: how much of each product you moved, per week or per month.
// Load AFTER all the other scripts: <script src="moved.js"></script> just before </body>.
// To go back, delete that one line.
// It counts what came OFF the truck between one status log entry and the next
// (so part pallets and lintels are counted by the piece). Shown under Results & history.
(function () {
  const $ = (id) => document.getElementById(id);
  const anchor = $("historyList");
  if (!anchor) return;
  let mode = "week"; // "week" or "month"
  let back = 0; // how many periods back from the current one

  const box = document.createElement("div");
  box.id = "movedBox";
  anchor.before(box);

  function parseD(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function range() {
    const now = new Date();
    let a, b;
    if (mode === "week") {
      a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      a.setDate(a.getDate() - ((a.getDay() + 6) % 7) - 7 * back); // Monday
      b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7);
    } else {
      a = new Date(now.getFullYear(), now.getMonth() - back, 1);
      b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    }
    return { a: a, b: b };
  }
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function label(r) {
    if (mode === "month") return MONL[r.a.getMonth()] + " " + r.a.getFullYear();
    const z = new Date(r.b.getFullYear(), r.b.getMonth(), r.b.getDate() - 1);
    return r.a.getDate() + " " + MON[r.a.getMonth()] + " to " + z.getDate() + " " + MON[z.getMonth()];
  }

  // what is on the truck at one status entry: { product: {pcs, kg per piece} }, or null if unknown
  function cargoMap(e) {
    if (Array.isArray(e.cargo)) {
      const m = {};
      let std = {};
      try {
        (JSON.parse(localStorage.getItem("gbt10_products") || "[]") || []).forEach((p) => (std[p.n] = p.pp));
      } catch (x) {}
      e.cargo.forEach((l) => {
        const pcs = l.u ? l.q : l.p * l.pp;
        if (!m[l.n]) m[l.n] = { pcs: 0, kg: l.kg, u: !!l.u, pp: std[l.n] > 0 ? std[l.n] : l.pp };
        m[l.n].pcs += pcs;
      });
      return m;
    }
    const pal = (e.truckP || 0) + (e.trailer ? e.trailerP || 0 : 0);
    return pal > 0 ? null : {};
  }

  function compute(r) {
    const out = {};
    let prev = null;
    events.forEach((e) => {
      const cur = cargoMap(e);
      const d = parseD(e.date);
      if (prev && cur && d && d >= r.a && d < r.b) {
        Object.keys(prev).forEach((n) => {
          const was = prev[n].pcs,
            now = cur[n] ? cur[n].pcs : 0;
          if (now < was) {
            if (!out[n]) out[n] = { pcs: 0, kg: prev[n].kg, u: prev[n].u, pp: prev[n].pp };
            out[n].pcs += was - now;
          }
        });
      }
      prev = cur;
    });
    return out;
  }

  function render() {
    const r = range();
    const data = compute(r);
    const names = Object.keys(data).sort(
      (x, y) => data[y].pcs * data[y].kg - data[x].pcs * data[x].kg
    );
    let tkg = 0,
      tpal = 0;
    const pal = (d) => (d.u || !(d.pp > 0) ? null : d.pcs / d.pp);
    const num = (x) => String(Math.round(x * 10) / 10);
    names.forEach((n) => {
      tkg += data[n].pcs * data[n].kg;
      const p = pal(data[n]);
      if (p !== null) tpal += p;
    });
    const on = "background:var(--accent-color);color:var(--btn-text);border-color:var(--accent-color);";
    let h =
      '<div class="log-entry" style="border-left-color:var(--success-color)"><strong>Products moved</strong>' +
      '<div style="margin-top:8px">' +
      '<button class="small-btn" style="' + (mode === "week" ? on : "") + '" onclick="mvMode(\'week\')">Week</button>' +
      '<button class="small-btn" style="' + (mode === "month" ? on : "") + '" onclick="mvMode(\'month\')">Month</button></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
      '<button class="small-btn" style="margin:0" onclick="mvNav(1)">‹</button>' +
      '<span style="flex:1;text-align:center;font-weight:bold">' + label(r) + "</span>" +
      '<button class="small-btn" style="margin:0" onclick="mvNav(-1)"' + (back === 0 ? " disabled" : "") + ">›</button></div>";
    if (!names.length) {
      h += '<div class="note">Nothing offloaded in this period.</div>';
    } else {
      names.forEach((n) => {
        const d = data[n];
        h +=
          '<div class="est-row"><span>' + esc(n) + "</span><span>" +
          (pal(d) !== null ? num(pal(d)) + (num(pal(d)) === "1" ? " pallet · " : " pallets · ") : "") +
          f(d.pcs, 0) + " pcs · " + f((d.pcs * d.kg) / 1000, 2) + " t</span></div>";
      });
      h +=
        '<div class="now" style="margin-top:8px">Total: ' + (tpal > 0 ? num(tpal) + " pallets · " : "") + f(tkg / 1000, 2) + " t offloaded</div>";
    }
    h +=
      '<div class="note">Counted when the cargo comes off the truck. Pallets = pieces divided by the usual pieces per pallet, so a part pallet counts as a fraction. Lintels are counted by the piece. Entries without a cargo list or a date are skipped.</div></div>';
    box.innerHTML = h;
  }

  window.mvMode = function (m) {
    mode = m;
    back = 0;
    render();
  };
  window.mvNav = function (d) {
    back = Math.max(0, back + d);
    render();
  };

  const oHist = window.renderHistory;
  window.renderHistory = function () {
    oHist();
    render();
  };
  render();
})();
