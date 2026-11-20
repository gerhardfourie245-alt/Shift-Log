/* dashboard.js - Dashboard add-on for Shift-Log (GBT 10)
   Add AFTER crane.js in index.html:  <script src="dashboard.js"></script>
   Reads the existing logs / events data. Changes nothing in your saved data. */
(function () {
    var period = 'last';
    var overlay = null;

    function iso30() {
        var d = new Date();
        d.setDate(d.getDate() - 30);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function allIntervals() {
        var out = [];
        for (var i = 1; i < logs.length; i++) {
            var c = logs[i], p = logs[i - 1], dist = c.odometer - p.odometer;
            if (!(dist > 0) || !(c.liters > 0)) continue;
            out.push({
                date: c.date || '',
                dist: dist,
                liters: c.liters,
                rand: c.pumpValue || 0,
                dC: Math.max((c.craneHours || 0) - (p.craneHours || 0), 0),
                mix: kmBreakdown(p.odometer, c.odometer),
                kmL: dist / c.liters
            });
        }
        return out;
    }

    function pick(all) {
        if (period === 'last') return all.slice(-1);
        if (period === 'month') { var m = iso30(); return all.filter(function (x) { return x.date >= m; }); }
        return all;
    }

    function totals(sel) {
        var t = { km: 0, L: 0, kmR: 0, R: 0, RL: 0, CR: 0, S: 0, T: 0, E: 0, Ld: 0, U: 0, PK: 0 };
        sel.forEach(function (x) {
            t.km += x.dist; t.L += x.liters; t.CR += x.dC;
            if (x.rand > 0) { t.R += x.rand; t.kmR += x.dist; t.RL += x.liters; }
            t.S += x.mix.S; t.T += x.mix.T; t.E += x.mix.E; t.Ld += x.mix.L; t.U += x.mix.U; t.PK += x.mix.PK;
        });
        return t;
    }

    function tile(label, value, sub) {
        return '<div style="background:var(--card-bg);border:1px solid var(--input-border);border-radius:10px;padding:12px">' +
            '<div style="font-size:12px;color:var(--subtext-color)">' + label + '</div>' +
            '<div style="font-size:22px;font-weight:bold;color:var(--text-color);margin-top:2px">' + value + '</div>' +
            (sub ? '<div style="font-size:11px;color:var(--subtext-color);margin-top:2px">' + sub + '</div>' : '') + '</div>';
    }

    function bar(parts) {
        var tot = parts.reduce(function (a, p) { return a + p.v; }, 0);
        if (tot <= 0) return '<div class="note">No tracked km yet.</div>';
        var h = '<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;margin-top:8px">';
        var l = '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--subtext-color);margin-top:6px">';
        parts.forEach(function (p) {
            if (p.v <= 0) return;
            h += '<div style="width:' + (p.v / tot * 100) + '%;background:' + p.c + '"></div>';
            l += '<span>' + p.n + ' ' + f(p.v, 0) + ' km</span>';
        });
        return h + '</div>' + l + '</div>';
    }

    function chart(all) {
        var last = all.slice(-8);
        if (!last.length) return '<div class="note">Needs at least two fill-ups.</div>';
        var max = Math.max.apply(null, last.map(function (x) { return x.kmL; })) || 1;
        var h = '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:10px">';
        last.forEach(function (x, i) {
            var hh = Math.max(x.kmL / max * 84, 4);
            var isLast = i === last.length - 1;
            h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">' +
                '<div style="font-size:11px;color:var(--text-color);font-weight:bold">' + f(x.kmL, 2) + '</div>' +
                '<div style="width:100%;height:' + hh + 'px;border-radius:4px;background:' + (isLast ? 'var(--accent-color)' : 'var(--input-border)') + '"></div></div>';
        });
        h += '</div><div style="display:flex;gap:6px;margin-top:4px">';
        last.forEach(function (x) {
            h += '<div style="flex:1;text-align:center;font-size:10px;color:var(--subtext-color)">' + (x.date ? x.date.slice(5) : '') + '</div>';
        });
        return h + '</div>';
    }

    function label() { return period === 'last' ? 'Last tank' : (period === 'month' ? 'Last 30 days' : 'All'); }

    function reportText(t) {
        var rl = t.RL > 0 ? t.R / t.RL : null;
        return ['GBT 10 Dashboard - ' + label(),
            'Km: ' + f(t.km, 0), 'Liters: ' + f(t.L, 1),
            'Km/L: ' + (t.L > 0 ? f(t.km / t.L, 2) : '-'),
            'Rand/km: ' + (t.kmR > 0 ? f(t.R / t.kmR, 2) : '-'),
            'Rand/L: ' + (rl ? f(rl, 2) : '-'),
            'Crane hours: ' + f(t.CR, 1),
            'L per crane hour: ' + (t.CR > 0 ? f(t.L / t.CR, 1) : '-'),
            'Loaded km: ' + f(t.Ld, 0), 'Empty km: ' + f(t.E, 0),
            'Solo km: ' + f(t.S, 0), 'With trailer km: ' + f(t.T, 0)].join('\n');
    }

    function render() {
        var all = allIntervals();
        var sel = pick(all);
        var t = totals(sel);
        var tabs = [['last', 'Last tank'], ['month', 'Month'], ['all', 'All']].map(function (p) {
            var on = period === p[0];
            return '<button class="tog' + (on ? ' on' : '') + '" onclick="dashSet(\'' + p[0] + '\')">' + p[1] + '</button>';
        }).join('');
        var body = '<div class="toggle-row" style="margin-bottom:12px">' + tabs + '</div>';

        if (!sel.length) {
            body += '<div class="card"><div class="note">No fill-ups in this period yet. Log at least two full-to-full fill-ups.</div></div>';
        } else {
            var avgPal = (t.S + t.T) > 0 ? t.PK / (t.S + t.T) : null;
            body += '<div class="card" style="margin-bottom:10px"><div style="font-size:13px;color:var(--subtext-color)">Fuel consumption</div>' +
                '<div style="font-size:40px;font-weight:bold;color:var(--accent-color)">' + (t.L > 0 ? f(t.km / t.L, 2) : '–') + ' <span style="font-size:16px;color:var(--subtext-color)">km/L</span></div>' +
                '<div style="font-size:12px;color:var(--subtext-color)">' + f(t.km, 0) + ' km on ' + f(t.L, 0) + ' L</div></div>';
            body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
                tile('Rand per km', t.kmR > 0 ? 'R' + f(t.R / t.kmR, 2) : '–', t.RL > 0 ? 'R' + f(t.R / t.RL, 2) + ' per L' : 'needs pump rand value') +
                tile('Rand per tonne', '–', 'needs pallet weights') +
                tile('Crane hours', f(t.CR, 1) + ' h', t.CR > 0 ? f(t.L / t.CR, 1) + ' L per crane h (all fuel)' : 'none between fill-ups') +
                tile('Avg pallets on board', avgPal === null ? '–' : f(avgPal, 1), 'per km driven') + '</div>';
        }

        body += '<div class="card" style="margin-bottom:10px"><div style="font-size:13px;color:var(--subtext-color)">km/L per fill-up</div>' + chart(all) + '</div>';
        if (sel.length) {
            body += '<div class="card" style="margin-bottom:10px"><div style="font-size:13px;color:var(--subtext-color)">Where the km go</div>' +
                bar([{ n: 'Loaded', v: t.Ld, c: 'var(--accent-color)' }, { n: 'Empty', v: t.E, c: 'var(--input-border)' }, { n: 'Untracked', v: t.U, c: 'var(--warning-color)' }]) +
                bar([{ n: 'Solo', v: t.S, c: 'var(--success-color)' }, { n: 'With trailer', v: t.T, c: 'var(--accent-color)' }]) + '</div>';
            body += '<button class="action-btn" style="margin-top:0" onclick="dashCopy()">Copy report</button>';
        }
        body += '<div class="info-msg" id="dashMsg"></div>';
        document.getElementById('dashBody').innerHTML = body;
        window._dashT = t;
    }

    window.dashSet = function (p) { period = p; render(); };
    window.dashCopy = function () {
        var txt = reportText(window._dashT), m = document.getElementById('dashMsg');
        try {
            navigator.clipboard.writeText(txt).then(function () { m.innerText = 'Copied. Paste into WhatsApp or Notes.'; },
                function () { m.innerText = txt; });
        } catch (e) { m.innerText = txt; }
    };
    window.dashOpen = function () {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:var(--bg-color);color:var(--text-color);overflow-y:auto;padding:16px;box-sizing:border-box;white-space:pre-line';
            overlay.innerHTML = '<div class="header-row"><h2>Dashboard</h2><button class="theme-toggle-btn" onclick="dashClose()">Close</button></div><div id="dashBody" style="white-space:normal"></div>';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';
        render();
        overlay.scrollTop = 0;
    };
    window.dashClose = function () { if (overlay) overlay.style.display = 'none'; };

    var hdr = document.querySelector('.header-row');
    if (hdr) {
        var b = document.createElement('button');
        b.className = 'action-btn';
        b.style.cssText = 'margin-top:0;margin-bottom:12px';
        b.innerText = '📊 Dashboard';
        b.onclick = window.dashOpen;
        hdr.insertAdjacentElement('afterend', b);
    }
})();
