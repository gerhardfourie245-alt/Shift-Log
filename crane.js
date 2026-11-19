// Shift-Log add-on: crane meter reading at each Loaded / Offloaded.
// Load AFTER home.js: <script src="crane.js"></script> just before </body>.
// To go back, delete that one line.
// v3: "Edit" button on each status entry (odometer, invoice, crane reading) + big-jump check (catches a missing decimal point).
(function () {
  const $ = (id) => document.getElementById(id);
  const MAX_JUMP = 100; // hours; a bigger jump than this asks "are you sure?"

  // every crane meter reading we know of, in odometer order (stops + fill-ups)
  function pts() {
    const p = [];
    events.forEach((e, i) => {
      if (e.ch > 0) p.push({ odo: e.odo, ch: e.ch, ev: i });
    });
    logs.forEach((l) => {
      if (l.craneHours > 0)
        p.push({ odo: l.odometer, ch: l.craneHours, ev: -1 });
    });
    p.sort((a, b) => a.odo - b.odo || a.ch - b.ch);
    return p;
  }
  function lastReading() {
    const p = pts();
    return p.length ? p[p.length - 1] : null;
  }

  // ---- the input box, under the odometer ----
  const box = document.createElement("div");
  box.id = "craneBox";
  box.innerHTML =
    "<label>Crane hours (meter, optional)</label>" +
    '<input type="number" inputmode="decimal" step="0.1" id="evCrane">' +
    '<div class="note">Read the crane meter after the crane has finished, then enter it here.</div>';
  $("evOdo").after(box);

  function showHint() {
    const l = lastReading();
    $("evCrane").placeholder = l ? "Last: " + l.ch : "e.g. 1204.3";
  }

  // show the box on Loaded and Offloaded only
  const oGo = window.shiftGo;
  if (oGo) {
    window.shiftGo = function (m) {
      oGo.apply(this, arguments);
      const on = m === "load" || m === "off";
      box.style.display = on ? "block" : "none";
      if (on) showHint();
    };
    box.style.display = "none";
  }

  // ---- log: check the reading, then stamp it on the new status change ----
  const oLog = window.logStatus;
  window.logStatus = function () {
    const raw = $("evCrane").value.trim();
    let v = null;
    if (raw !== "") {
      v = parseFloat(raw);
      if (isNaN(v) || v < 0) {
        $("evError").innerText =
          "Crane hours must be a number, or leave the box empty.";
        return;
      }
      const l = lastReading();
      if (l && v < l.ch) {
        $("evError").innerText =
          "Crane hours are lower than the last reading (" +
          l.ch +
          "). Check the number.";
        return;
      }
      if (
        l &&
        v - l.ch > MAX_JUMP &&
        !confirm(
          "That is " +
            f(v - l.ch, 1) +
            " h more than the last reading (" +
            l.ch +
            "). Did you leave out a decimal point? Save anyway?"
        )
      ) {
        $("evError").innerText = "Check the crane hours.";
        return;
      }
    }
    const before = events.length;
    oLog();
    if (events.length > before) {
      if (v !== null) {
        events[events.length - 1].ch = v;
        persistEvents();
      }
      $("evCrane").value = "";
      renderStatus();
      renderHistory();
    }
  };

  // ---- edit a status entry: odometer, invoice number, crane reading ----
  // Pallets, trailer on/off and cargo are NOT touched (delete and re-log for those).
  window.editStop = function (i) {
    const e = events[i];
    if (!e) return;

    // 1. odometer
    const a1 = prompt("Odometer (km) for this stop:", e.odo);
    if (a1 === null) return;
    const odo = parseFloat(a1);
    if (isNaN(odo) || odo < 0) {
      alert("Odometer must be a number.");
      return;
    }
    const pe = events[i - 1],
      ne = events[i + 1];
    if (pe && odo < pe.odo) {
      alert("That is lower than the stop before it (" + pe.odo + " km).");
      return;
    }
    if (ne && odo > ne.odo) {
      alert("That is higher than the stop after it (" + ne.odo + " km).");
      return;
    }

    // 2. invoice
    const a2 = prompt("Invoice number (leave empty for none):", e.inv || "");
    if (a2 === null) return;
    const inv = a2.trim();

    // 3. crane reading
    const a3 = prompt(
      "Crane meter at this stop (leave empty for none):",
      e.ch > 0 ? e.ch : ""
    );
    if (a3 === null) return;
    const raw = a3.trim();
    let ch = null;
    if (raw !== "") {
      ch = parseFloat(raw);
      if (isNaN(ch) || ch < 0) {
        alert("Crane hours must be a number.");
        return;
      }
      const others = pts().filter((p) => p.ev !== i);
      let prev = null,
        next = null;
      others.forEach((p) => {
        if (p.odo <= odo) prev = p;
      });
      for (let k = 0; k < others.length; k++) {
        if (others[k].odo >= odo) {
          next = others[k];
          break;
        }
      }
      if (prev && ch < prev.ch) {
        alert("Crane hours are lower than the reading before it (" + prev.ch + "). Check the number.");
        return;
      }
      if (next && ch > next.ch) {
        alert("Crane hours are higher than the reading after it (" + next.ch + "). Check the number.");
        return;
      }
      if (
        prev &&
        ch - prev.ch > MAX_JUMP &&
        !confirm(
          "That is " +
            f(ch - prev.ch, 1) +
            " h more than the reading before it (" +
            prev.ch +
            "). Save anyway?"
        )
      )
        return;
    }

    // apply everything at once
    e.odo = odo;
    if (inv) e.inv = inv;
    else delete e.inv;
    if (ch === null) delete e.ch;
    else e.ch = ch;
    persistEvents();
    renderStatus();
    renderHistory();
    setInfo("Status entry updated.");
  };

  // ---- show the readings: home screen line + status log ----
  const oStat = window.renderStatus;
  window.renderStatus = function () {
    oStat();
    if (!events.length) return;
    const c = events[events.length - 1];
    if (c.ch > 0) {
      $("nowStatus").innerText += " · crane meter " + c.ch;
      if ($("homeNow")) $("homeNow").innerText = $("nowStatus").innerText;
    }
    const P = pts();
    let h = "";
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i],
        nx = events[i + 1];
      const leg = nx ? f(nx.odo - e.odo, 0) + " km at this load" : "Current leg";
      let cr = "";
      if (e.ch > 0) {
        const k = P.findIndex((p) => p.ev === i);
        const pr = k > 0 ? P[k - 1] : null;
        cr =
          " · crane meter " +
          e.ch +
          (pr && e.ch >= pr.ch ? " (+" + f(e.ch - pr.ch, 1) + " h)" : "");
      }
      h +=
        '<div class="est-row"><span>' +
        esc(e.odo) +
        " km · " +
        statusText(e) +
        (e.inv ? " · Inv " + esc(e.inv) : "") +
        '<span class="mix">' +
        leg +
        cr +
        "</span></span>" +
        '<span style="display:flex;flex-direction:column;gap:6px">' +
        '<button class="small-btn" style="margin:0" onclick="editStop(' +
        i +
        ')">Edit</button>' +
        '<button class="small-btn" style="margin:0" onclick="deleteEvent(' +
        i +
        ')">Delete</button></span></div>';
    }
    $("evList").innerHTML = h;
  };

  showHint();
  renderStatus();
})();

// Offline: register the service worker (sw.js must sit next to index.html)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
