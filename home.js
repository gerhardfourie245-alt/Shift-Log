// Shift-Log add-on: "What are you doing?" start screen.
// Load AFTER products.js: <script src="home.js"></script> just before </body>.
// To go back to the old layout, delete that one line.
(function () {
  const C = [].slice.call(document.querySelectorAll(".card"));
  const veh = C[0],
    load = C[1],
    read = C[2],
    hist = C[3];
  const hdr = document.querySelector(".header-row");
  const $ = (id) => document.getElementById(id);
  let cur = "home"; // which screen is open

  const st = document.createElement("style");
  st.textContent =
    ".hbtn{display:block;width:100%;padding:22px 12px;margin-top:12px;font-size:20px;font-weight:bold;border-radius:10px;border:none;cursor:pointer;background:var(--accent-color);color:var(--btn-text)}" +
    ".hbtn.alt{background:var(--input-bg);color:var(--text-color);border:2px solid var(--input-border);font-size:16px;padding:14px 8px}" +
    ".hrow{display:flex;gap:8px}.hrow .hbtn{margin-top:12px}";
  document.head.appendChild(st);

  const home = document.createElement("div");
  home.innerHTML =
    '<div class="card"><h3>What are you doing?</h3><div class="now" id="homeNow"></div><div class="info-msg" id="homeMsg"></div>' +
    '<button class="hbtn" onclick="shiftGo(\'fill\')">⛽ Filling up</button>' +
    '<button class="hbtn" onclick="shiftGo(\'load\')">📦 Loading</button>' +
    '<button class="hbtn" onclick="shiftGo(\'off\')">⬇️ Offloading</button>' +
    '<button class="hbtn" onclick="shiftGo(\'trl\')">🔗 Trailer on / off</button>' +
    '<div class="hrow"><button class="hbtn alt" onclick="shiftGo(\'hist\')">Results &amp; history</button>' +
    '<button class="hbtn alt" onclick="shiftGo(\'set\')">Settings</button></div></div>';
  hdr.after(home);

  const back = document.createElement("button");
  back.className = "small-btn";
  back.style.cssText =
    "display:none;margin-bottom:12px;font-size:16px;padding:12px 16px";
  back.textContent = "← Back";
  back.onclick = function () {
    shiftGo("home");
  };
  home.after(back);

  // pallets: tuck the number boxes away, cargo fills them in automatically
  const tog = load.querySelector(".toggle-row");
  const palWrap = document.createElement("details");
  const palSum = document.createElement("summary");
  palWrap.appendChild(palSum);
  const mv = [];
  let n = tog.nextElementSibling;
  while (n && n.id !== "trailerBlock") {
    mv.push(n);
    n = n.nextElementSibling;
  }
  if (n) mv.push(n);
  tog.after(palWrap);
  mv.forEach((x) => palWrap.appendChild(x));

  const hint = document.createElement("div");
  hint.className = "note";
  $("nowStatus").after(hint);
  const allOff = document.createElement("button");
  allOff.className = "hbtn";
  allOff.textContent = "Everything is off";
  allOff.onclick = function () {
    $("truckP").value = 0;
    $("trailerP").value = 0;
    if (window.cgClear) cgClear();
    hint.innerText =
      "All pallets set to 0. Now enter the odometer and tap Log.";
    $("evOdo").focus();
  };
  hint.after(allOff);

  const evDet = $("evList").parentNode;
  hist.children[0].after(evDet);
  evDet.querySelector("summary").textContent =
    "Status log (loads, offloads, trailer)";
  const cargoBox = $("cgProd") ? $("cgProd").parentNode : null;
  const loadTitle = load.querySelector("h3");

  const M = {
    load: {
      t: "Loading",
      h: "Pick the product and pallets, tap Add to load. Then enter the odometer and tap Log.",
      cargo: 1,
      tog: 1,
      pal: 1,
      ps: "Pallets are filled in from the cargo. Tap to adjust.",
    },
    off: {
      t: "Offloading",
      h: "Tap Everything is off, or open the pallets below and tap how many came off. Then enter the odometer and tap Log.",
      cargo: 0,
      tog: 0,
      pal: 1,
      all: 1,
      ps: "Only some came off? Tap here.",
    },
    trl: {
      t: "Trailer on / off",
      h: "Choose trailer on or off, enter the odometer and tap Log.",
      cargo: 0,
      tog: 1,
      pal: 0,
    },
  };

  window.shiftGo = function (m, msg) {
    cur = m;
    [veh, load, read, hist].forEach((c) => (c.style.display = "none"));
    home.style.display = m === "home" ? "block" : "none";
    back.style.display = m === "home" ? "none" : "block";
    $("homeMsg").innerText = msg || "";
    if (m === "home") updNow();
    else if (m === "fill") read.style.display = "block";
    else if (m === "hist") hist.style.display = "block";
    else if (m === "set") veh.style.display = "block";
    else {
      const c = M[m];
      load.style.display = "block";
      loadTitle.innerText = c.t;
      hint.innerText = c.h;
      tog.style.display = c.tog ? "flex" : "none";
      palWrap.style.display = c.pal ? "block" : "none";
      palWrap.open = false;
      palSum.textContent = c.ps || "";
      allOff.style.display = c.all ? "block" : "none";
      if (cargoBox) cargoBox.style.display = c.cargo ? "block" : "none";
      $("evError").innerText = "";
    }
    window.scrollTo(0, 0);
  };
  function updNow() {
    $("homeNow").innerText = $("nowStatus").innerText;
  }

  // keep pallets in step with the cargo lines
  function sync() {
    if (typeof cgPallets !== "function" || typeof caps !== "function") return;
    const k = cgPallets(),
      c = caps();
    const t = Math.min(k, c.truck),
      r = selTrailer ? Math.min(k - t, c.trailer) : 0;
    $("truckP").value = t;
    $("trailerP").value = r;
    if (typeof cgRender === "function") cgRender();
  }
  ["cgAdd", "cgDel", "cgClear"].forEach((k) => {
    const o = window[k];
    if (o)
      window[k] = function () {
        o.apply(this, arguments);
        sync();
      };
  });
  // backup: also sync after Add to load / Clear load / remove-line taps,
  // in case the buttons don't go through the wrapped functions above
  load.addEventListener("click", function (e) {
    const b = e.target.closest("button");
    if (!b || cur !== "load") return;
    const tx = (b.textContent || "").trim();
    const oc = b.getAttribute("onclick") || "";
    if (
      tx === "Add to load" ||
      tx === "Clear load" ||
      /^cg(Add|Del|Clear)/.test(oc) ||
      /^[×✕✖xX]$/.test(tx)
    )
      setTimeout(sync, 0);
  });
  const oSetT = window.setTrailer;
  window.setTrailer = function (v) {
    oSetT(v);
    if (typeof cgPallets === "function" && cgPallets() > 0) sync();
  };
  const oAdj = window.adjP;
  window.adjP = function (id, d) {
    oAdj(id, d);
    if (d < 0 && window.cgTake) {
      cgTake(-d);
    }
  };

  // after a successful save, go back to the start screen
  const oLog = window.logStatus;
  window.logStatus = function () {
    // safety net: cargo is listed but pallet boxes are still 0 -> fill them in
    if (
      cur === "load" &&
      typeof cgPallets === "function" &&
      cgPallets() > 0 &&
      (+$("truckP").value || 0) + (+$("trailerP").value || 0) === 0
    )
      sync();
    const before = events.length;
    oLog();
    if (events.length > before) shiftGo("home", "Saved ✓");
  };
  const oSave = window.saveFillUp;
  window.saveFillUp = function () {
    $("infoMsg").innerText = "";
    oSave();
    if ($("infoMsg").innerText === "Saved.") shiftGo("home", "Fill-up saved ✓");
  };
  const oEdit = window.editEntry;
  window.editEntry = function (i) {
    oEdit(i);
    shiftGo("fill");
    $("errorMsg").innerText = "";
  };
  const oCancel = window.cancelEdit;
  window.cancelEdit = function () {
    oCancel();
    shiftGo("home");
  };
  const oStat = window.renderStatus;
  window.renderStatus = function () {
    oStat();
    updNow();
  };

  updNow();
  shiftGo("home");
})();

// Fill-up: enter Rands per liter, app works out the total.
// The saved entry still stores the total, so history, averages and CSV stay the same.
(function () {
  const $ = (id) => document.getElementById(id);
  const pv = $("pumpValue"),
    lt = $("litersFilled");
  if (!pv || !lt) return;
  pv.previousElementSibling.textContent = "Rands per liter";
  pv.placeholder = "e.g. 32.57";
  const tot = document.createElement("div");
  tot.className = "note";
  pv.after(tot);
  const money = (r, l) => (Math.round(r * l * 100) / 100).toFixed(2);
  function upd() {
    const r = parseFloat(pv.value),
      l = parseFloat(lt.value);
    tot.textContent = r > 0 && l > 0 ? "Total: R" + money(r, l) : "";
  }
  pv.addEventListener("input", upd);
  lt.addEventListener("input", upd);

  let keep = null; // when editing: the original total, kept if rate and liters are untouched
  const oSave = window.saveFillUp;
  window.saveFillUp = function () {
    const rate = pv.value,
      r = parseFloat(rate),
      l = parseFloat(lt.value);
    let total = "";
    if (keep && rate === keep.rate && l === keep.liters) total = String(keep.total);
    else if (r > 0 && l > 0) total = money(r, l);
    pv.value = total;
    oSave();
    if (pv.value !== "") pv.value = rate; // save was refused: put the rate back
    else {
      keep = null;
      upd();
    }
  };
  const oEdit = window.editEntry;
  window.editEntry = function (i) {
    oEdit(i);
    const e = logs[i];
    keep = null;
    if (e && e.pumpValue > 0 && e.liters > 0) {
      pv.value = String(+(e.pumpValue / e.liters).toFixed(4));
      keep = { rate: pv.value, liters: e.liters, total: e.pumpValue };
    }
    upd();
  };
  const oCancel = window.cancelEdit;
  window.cancelEdit = function () {
    keep = null;
    oCancel();
    upd();
  };
})();
