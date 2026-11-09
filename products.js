// Shift-Log add-on: products, pallet sizes, cargo weight (kg), tonne-km.
// Load AFTER the main script: <script src="products.js"></script> just before </body>.
(function () {
    const KEY = 'gbt10_products';
    const D = [
        ['Kerb - CK5',92.10,0],['Kerb - BK1',67.60,0],['Kerb - BK2',67.60,0],['Kerb - E1',24.90,0],
        ['Kerb - E2',31.60,0],['Kerb - MK10',68.70,0],['Kerb - C1',69.20,0],['Kerb - Inlet',39.10,0],
        ['Kerb - Rainwater Channel',39.70,0],['Underberg Bird Bath Bottom',37.50,0],['Underberg Bird Bath Top',18.10,0],
        ['Feet Paver (L) 600mm',17.30,0],['Feet Paver (R) 600mm',17.30,0],['Flagstone Square 400x400mm',16.30,0],
        ['Pansy Paver',9.40,0],['Pot Plant',47.50,0],['Round Paver 400mm',15,0],['Slab 450x450mm',21,0],
        ['Slab 500x500mm',26.90,0],['Slab 600x600mm',37.43,0],['Sleeper 900mm',14.50,0],['Tree Stump Paver 400mm',11.10,0],
        ['Air Vent',1.30,0],['Cobble Paver 100x100mm',1.5,0],['Sand Bags',40,0],['Stone 19mm Bag',40,0],
        ['Stone 13mm Bag',40,0],['Crusher Dust Bag',40,0],['Concrete 19mm Mix Bag',40,0],['Quick Mix Concrete Bag',40,0],
        ['Quick Mix Mortar Bag',40,0],['110 Lintels',14.30,0],['150 Lintels',19.00,0],['Brick Imperial',3.60,500],
        ['Brick Maxi',3.80,400],['Brick ROK NFX Bredasdorp (500P)',3.0,500],['Block 90',10.10,130],['Block 140',14.60,100],['Block 190',16.20,75],
        ['Bond Paver',2.20,0],['Interlocker paver',3.30,0]
    ];
    let prods = null;
    try { prods = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!Array.isArray(prods) || !prods.length) prods = D.map(a => ({ n: a[0], kg: a[1], pp: a[2] }));
    function saveProds() { try { localStorage.setItem(KEY, JSON.stringify(prods)); } catch (e) {} }
    let sel = 0;

    let lines = [];
    const lastEv = events.length ? events[events.length - 1] : null;
    if (lastEv && Array.isArray(lastEv.cargo)) lines = lastEv.cargo.map(x => Object.assign({}, x));
    const total = () => lines.reduce((t, l) => t + l.p * l.pp * l.kg, 0);

    // ---- styles + UI ----
    const st = document.createElement('style');
    st.textContent = 'select{width:100%;padding:12px;margin-top:4px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text-color);border-radius:6px;font-size:16px;font-weight:bold;box-sizing:border-box}' +
        '.pm-row{display:grid;grid-template-columns:1fr 70px 70px 36px;gap:6px;align-items:center;margin-top:6px;font-size:13px}' +
        '.pm-row input{padding:8px;font-size:14px;margin:0}';
    document.head.appendChild(st);

    const box = document.createElement('div');
    box.innerHTML =
        '<label>Cargo on board now (weight)</label>' +
        '<select id="cgProd"></select>' +
        '<div class="qrow"><input style="flex:1;min-width:0" type="number" inputmode="numeric" id="cgPal" placeholder="Pallets">' +
        '<input style="flex:1;min-width:0" type="number" inputmode="numeric" id="cgPP" placeholder="Pieces per pallet"></div>' +
        '<div style="margin-top:8px"><button class="small-btn" onclick="cgAdd()">Add to load</button>' +
        '<button class="small-btn" onclick="cgClear()">Clear load</button></div>' +
        '<div id="cgList"></div>' +
        '<details><summary>Products &amp; weights</summary><div id="pmList"></div>' +
        '<button class="small-btn" style="margin-top:10px" onclick="pmAdd()">Add product</button></details>';
    const anchor = document.getElementById('evOdo').previousElementSibling;
    anchor.parentNode.insertBefore(box, anchor);
    const wBox = document.createElement('div');
    document.getElementById('estimates').after(wBox);

    function fillSel(i) {
        if (i !== undefined) sel = i;
        if (sel >= prods.length || sel < 0) sel = 0;
        const el = document.getElementById('cgProd');
        el.innerHTML = prods.map((p, k) => '<option value="' + k + '">' + esc(p.n) + ' (' + p.kg + ' kg)</option>').join('') +
            '<option value="new">+ Add new product...</option>';
        el.value = String(sel);
        pickProd();
    }
    function pickProd() {
        const el = document.getElementById('cgProd');
        if (el.value === 'new') { if (!pmAdd()) el.value = String(sel); return; }
        sel = parseInt(el.value, 10) || 0;
        const p = prods[sel];
        document.getElementById('cgPP').value = p && p.pp ? p.pp : '';
    }
    document.getElementById('cgProd').onchange = pickProd;

    function cgRender() {
        const el = document.getElementById('cgList');
        if (!lines.length) { el.innerHTML = '<div class="note">No cargo entered. Weight stays unknown for this status.</div>'; return; }
        let h = '', pal = 0;
        lines.forEach((l, i) => {
            pal += l.p;
            h += '<div class="est-row"><span>' + l.p + ' × ' + esc(l.n) + ' <span class="mix">' + l.pp + ' per pallet · ' + f(l.p * l.pp * l.kg, 0) + ' kg</span></span>' +
                '<button class="small-btn" style="margin:0" onclick="cgDel(' + i + ')">✕</button></div>';
        });
        h += '<div class="now" style="margin-top:8px">Total: ' + f(total(), 0) + ' kg (' + f(total() / 1000, 2) + ' t) on ' + pal + ' pallets</div>';
        const tp = parseInt(document.getElementById('truckP').value, 10) || 0;
        const rp = selTrailer ? (parseInt(document.getElementById('trailerP').value, 10) || 0) : 0;
        if (pal !== tp + rp) h += '<div class="note" style="color:var(--warning-color)">Cargo has ' + pal + ' pallets but truck + trailer above show ' + (tp + rp) + '.</div>';
        h += '<div class="note">Product weight only, pallets themselves not included.</div>';
        el.innerHTML = h;
    }
    window.cgAdd = function () {
        const p = prods[parseInt(document.getElementById('cgProd').value, 10)];
        const n = parseInt(document.getElementById('cgPal').value, 10);
        const pp = parseInt(document.getElementById('cgPP').value, 10);
        if (!p || !(n > 0) || !(pp > 0)) { document.getElementById('evError').innerText = 'Enter pallets and pieces per pallet.'; return; }
        document.getElementById('evError').innerText = '';
        if (!p.pp) { p.pp = pp; saveProds(); pmRender(); }
        lines.push({ n: p.n, p: n, pp: pp, kg: p.kg });
        document.getElementById('cgPal').value = '';
        cgRender();
    };
    window.cgDel = function (i) { lines.splice(i, 1); cgRender(); };
    window.cgClear = function () { lines = []; cgRender(); };

    function pmRender() {
        document.getElementById('pmList').innerHTML = '<div class="pm-row"><b>Product</b><b>kg/piece</b><b>Pieces/pallet</b><span></span></div>' +
            prods.map((p, i) => '<div class="pm-row"><span>' + esc(p.n) + '</span>' +
                '<input type="number" inputmode="decimal" step="any" value="' + p.kg + '" onchange="pmSet(' + i + ',\'kg\',this.value)">' +
                '<input type="number" inputmode="numeric" value="' + (p.pp || '') + '" onchange="pmSet(' + i + ',\'pp\',this.value)">' +
                '<button class="small-btn" style="margin:0;padding:6px" onclick="pmDel(' + i + ')">✕</button></div>').join('');
    }
    window.pmSet = function (i, k, v) {
        const x = parseFloat(v);
        prods[i][k] = isNaN(x) || x < 0 ? 0 : x;
        saveProds(); fillSel();
    };
    window.pmDel = function (i) { if (confirm('Remove ' + prods[i].n + '?')) { prods.splice(i, 1); saveProds(); fillSel(); pmRender(); } };
    window.pmAdd = function () {
        const n = prompt('Product name?'); if (!n || !n.trim()) return false;
        const kg = parseFloat(prompt('Weight of one piece (kg)?'));
        if (!(kg > 0)) return false;
        const pp = parseInt(prompt('Pieces per pallet? (leave empty if unknown)'), 10);
        prods.push({ n: n.trim(), kg: kg, pp: pp > 0 ? pp : 0 });
        saveProds(); fillSel(prods.length - 1); pmRender();
        return true;
    };

    // ---- log status: stamp the cargo weight on the new status change ----
    const origLog = window.logStatus;
    window.logStatus = function () {
        const before = events.length;
        origLog();
        if (events.length > before) {
            const e = events[events.length - 1];
            const pal = e.truckP + (e.trailer ? e.trailerP : 0);
            if (pal === 0) { lines = []; e.kg = 0; e.cargo = []; }
            else if (lines.length) { e.kg = total(); e.cargo = lines.map(x => Object.assign({}, x)); }
            persistEvents();
            cgRender();
            renderStatus();
            renderHistory();
        }
    };

    const origStatus = window.renderStatus;
    window.renderStatus = function () {
        origStatus();
        if (!events.length) return;
        const c = events[events.length - 1];
        if (c.kg !== undefined) document.getElementById('nowStatus').innerText += ' · ' + f(c.kg, 0) + ' kg';
    };

    // ---- weight stats per fill-up ----
    function wstats(P, X) {
        let cur = null, pos = P, kgk = 0, lk = 0, unk = 0;
        events.forEach(e => { if (e.odo <= P) cur = e; });
        function add(s, k) {
            if (!s || k <= 0) return;
            const pal = s.truckP + (s.trailer ? s.trailerP : 0);
            if (pal <= 0) return;
            if (s.kg === undefined) { unk += k; return; }
            lk += k; kgk += s.kg * k;
        }
        events.filter(e => e.odo > P && e.odo < X).forEach(e => { add(cur, e.odo - pos); pos = e.odo; cur = e; });
        add(cur, X - pos);
        return { tk: kgk / 1000, lk: lk, unk: unk, avg: lk ? kgk / lk : 0 };
    }
    function renderW() {
        let rows = [], sumTk = 0, sumL = 0;
        for (let i = logs.length - 1; i >= 1; i--) {
            const c = logs[i], p = logs[i - 1], w = wstats(p.odometer, c.odometer);
            if (w.lk <= 0 && w.unk <= 0) continue;
            if (w.unk === 0 && w.tk > 0) { sumTk += w.tk; sumL += c.liters; }
            rows.push('<div class="est-row"><span>' + esc(c.date || '') + '<span class="mix">' + (w.lk > 0 ? 'avg ' + f(w.avg, 0) + ' kg on ' + f(w.lk, 0) + ' loaded km' : '') +
                (w.unk > 0 ? ' · weight missing on ' + f(w.unk, 0) + ' km' : '') + '</span></span><span>' +
                (w.lk > 0 ? f(w.tk, 1) + ' t·km' + (w.unk === 0 && c.liters > 0 ? ' · ' + f(w.tk / c.liters, 2) + ' t·km/L' : '') : '') + '</span></div>');
        }
        if (!rows.length) { wBox.innerHTML = ''; return; }
        wBox.innerHTML = '<div class="log-entry" style="border-left-color:var(--success-color)"><strong>Cargo weight</strong>' +
            (sumL > 0 ? '<span class="metric-highlight" style="color:var(--success-color)">Overall ' + f(sumTk / sumL, 2) + ' t·km per L (fully weighed fill-ups)</span>' : '') +
            rows.slice(0, 6).join('') + '<div class="note">t·km = tonnes carried × km. Higher t·km/L means more cargo moved per litre.</div></div>';
    }
    const origHist = window.renderHistory;
    window.renderHistory = function () { origHist(); renderW(); };

    // ---- CSV with weight ----
    window.copyCSV = function () {
        let rows = ['date,odometer_km,engine_hours,crane_hours,liters,rand_total']
            .concat(logs.map(e => [e.date, e.odometer, e.engineHours, e.craneHours, e.liters, e.pumpValue].join(','))).join('\n');
        if (events.length) rows += '\n\nodometer_km,trailer,truck_pallets,trailer_pallets,invoice,cargo_kg,cargo\n' +
            events.map(e => [e.odo, e.trailer ? 'yes' : 'no', e.truckP, e.trailerP, '"' + String(e.inv || '').replace(/"/g, '') + '"',
                e.kg === undefined ? '' : Math.round(e.kg),
                '"' + (e.cargo || []).map(l => l.p + 'x' + l.n + ' @' + l.pp).join('; ').replace(/"/g, '') + '"'].join(',')).join('\n');
        try { navigator.clipboard.writeText(rows).then(() => setInfo('Copied. Paste into Notes or a spreadsheet.'), () => setInfo(rows)); }
        catch (e) { setInfo(rows); }
    };

    fillSel(); pmRender(); cgRender();
    renderStatus(); renderHistory();
})();
