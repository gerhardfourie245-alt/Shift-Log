// Shift-Log add-on: makes "Back up now" show what it is doing, and saves the file
// to the phone's Downloads folder if the share sheet cannot open.
// Load AFTER crane.js (put it last): <script src="backupfix.js"></script> just before </body>.
// To go back, delete that one line.
(function () {
  const $ = (id) => document.getElementById(id);
  const btn = $("bkNow");
  if (!btn) return;

  function msg(t) {
    const n = $("bkNote");
    if (n) n.innerText = t;
  }

  function snapshot() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf("gbt10_") === 0 && k !== "gbt10_lastbackup")
        data[k] = localStorage.getItem(k);
    }
    return { app: "shiftlog", v: 1, saved: new Date().toISOString(), data: data };
  }

  function stampDone(how) {
    const now = new Date();
    try { localStorage.setItem("gbt10_lastbackup", now.toISOString()); } catch (e) {}
    msg("Backup made ✓ " + how + " (" + todayISO() + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + ")");
  }

  btn.onclick = function () {
    msg("Making backup...");
    let file, name;
    try {
      name = "shiftlog-backup-" + todayISO() + ".json";
      file = new File([JSON.stringify(snapshot())], name, { type: "application/json" });
    } catch (e) {
      msg("Could not make the backup file: " + e);
      return;
    }

    function download() {
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        stampDone("Saved to your Downloads folder as " + name + ".");
      } catch (e) {
        msg("Could not save the backup: " + e);
      }
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: "Shift-Log backup " + todayISO() })
        .then(function () { stampDone("Sent with the share sheet."); })
        .catch(function (err) {
          if (err && err.name === "AbortError") msg("Backup cancelled.");
          else download(); // share sheet failed: save to Downloads instead
        });
    } else {
      download();
    }
  };
})();
