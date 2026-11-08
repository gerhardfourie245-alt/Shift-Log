// Shift-Log add-on: crane meter reading at each Loaded / Offloaded.
// Load AFTER home.js: <script src="crane.js"></script> just before </body>.
// To go back, delete that one line.
(function () {
  const $ = (id) => document.getElementById(id);

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
        '<button class="small-btn" style="margin:0" onclick="deleteEvent(' +
        i +
        ')">Delete</button></div>';
    }
    $("evList").innerHTML = h;
  };

  showHint();
  renderStatus();
})();
