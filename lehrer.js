/* Lehrerwerkzeug: Namensliste → Blatt-IDs, Seeds, QR-Codes, personalisierte A4-Arbeitsblätter.
   Vollständig clientseitig. Namen erscheinen nur auf dem Ausdruck, nie im QR-Code. */
(function () {
  'use strict';
  var ET = window.ET;
  var $ = function (id) { return document.getElementById(id); };
  var schueler = [];

  /* ---------- Einstellungen merken (nur Komfort, ohne Namen) ---------- */
  function merke(k, v) { try { localStorage.setItem('etlehrer:' + k, v); } catch (e) { /* egal */ } }
  function hole(k) { try { return localStorage.getItem('etlehrer:' + k); } catch (e) { return null; } }

  /* ---------- Kursauswahl ---------- */
  var sel = $('kurs');
  Object.keys(ET.KURSE).forEach(function (id) {
    var o = document.createElement('option');
    o.value = id;
    o.textContent = ET.KURSE[id].titel;
    sel.appendChild(o);
  });
  if (hole('kurs') && ET.KURSE[hole('kurs')]) sel.value = hole('kurs');
  function kurs() { return ET.KURSE[sel.value]; }
  function kursInfo() {
    var k = kurs();
    $('kurs-info').textContent = 'Kurskennung: ' + k.id + ' · ' + k.schritte.length + ' Lernschritte · ' + k.papier.length + ' Papierstationen';
  }
  sel.addEventListener('change', function () { merke('kurs', sel.value); kursInfo(); });
  kursInfo();

  /* ---------- Kursadresse ---------- */
  var standard = new URL('index.html', location.href).href.split('?')[0];
  $('basis').value = hole('basis') || standard;
  function basisPruefen() {
    var b = $('basis').value.trim(), h = $('basis-hinweis');
    if (/^file:/i.test(b)) {
      h.className = 'klein hinweis falsch';
      h.textContent = 'Achtung: Diese Adresse zeigt auf eine Datei auf diesem Computer. Smartphones können sie nicht öffnen. Bitte die Online-Adresse eintragen (z. B. https://…/index.html).';
    } else if (/localhost|127\.0\.0\.1/i.test(b)) {
      h.className = 'klein hinweis falsch';
      h.textContent = 'Achtung: „localhost“ funktioniert nur auf diesem Computer. Für die Schülergeräte die Online-Adresse eintragen.';
    } else {
      h.className = 'klein grau';
      h.textContent = 'Beispiel-Link im QR-Code: ' + ET.kursUrl(b, kurs(), 17, 'K8M2');
    }
  }
  $('basis').addEventListener('input', function () { merke('basis', $('basis').value.trim()); basisPruefen(); });
  basisPruefen();

  $('klasse').value = hole('klasse') || '';
  $('klasse').addEventListener('input', function () { merke('klasse', $('klasse').value); });

  /* ---------- CSV-Datei ---------- */
  $('datei').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result);
      if (text.indexOf('�') >= 0) { /* vermutlich Windows-1252 (Excel) */
        var r2 = new FileReader();
        r2.onload = function () { $('namen').value = String(r2.result); };
        r2.readAsText(f, 'windows-1252');
      } else {
        $('namen').value = text.replace(/^﻿/, '');
      }
    };
    r.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  /* ---------- Namensliste lesen ---------- */
  var SEED_RE = /^[23456789A-HJ-NP-Z]{4}$/;
  function lesen(text, startNr) {
    var zeilen = text.split(/\r?\n/).map(function (z) { return z.trim(); }).filter(Boolean);
    var roh = [], warn = [];
    zeilen.forEach(function (z, i) {
      var sep = z.indexOf(';') >= 0 ? ';' : z.indexOf('\t') >= 0 ? '\t' : z.indexOf(',') >= 0 ? ',' : null;
      var teile = (sep ? z.split(sep) : [z]).map(function (t) { return t.trim().replace(/^"|"$/g, '').trim(); }).filter(Boolean);
      if (!teile.length) return;
      if (i === 0 && !teile.some(function (t) { return /^\d+$/.test(t); }) && teile.some(function (t) { return /^(name|vorname|nachname|nr\.?|id|blatt.*|code|seed|schüler.*)$/i.test(t); })) return; // Kopfzeile
      var id = null, seed = null;
      if (/^\d{1,4}$/.test(teile[0])) id = parseInt(teile.shift(), 10);
      if (teile.length >= 2 && SEED_RE.test(teile[teile.length - 1])) seed = teile.pop();
      var name = teile.join(sep === ',' ? ', ' : ' ').replace(/\s+/g, ' ');
      if (!name) { warn.push('Zeile ' + (i + 1) + ' ohne Namen übersprungen.'); return; }
      roh.push({ id: id, name: name, seed: seed });
    });
    var belegt = {};
    roh.forEach(function (s) { if (s.id != null) belegt[s.id] = (belegt[s.id] || 0) + 1; });
    Object.keys(belegt).forEach(function (k) { if (belegt[k] > 1) warn.push('Blatt-Nr. ' + ET.pad3(k) + ' kommt mehrfach vor.'); });
    var nr = startNr;
    roh.forEach(function (s) {
      if (s.id == null) {
        while (belegt[nr]) nr++;
        s.id = nr; belegt[nr] = 1; nr++;
      }
      if (s.id < 1 || s.id > 999) warn.push('Blatt-Nr. ' + s.id + ' (' + s.name + ') liegt nicht zwischen 1 und 999.');
      if (!s.seed) s.seed = ET.cryptoCode(4);
    });
    return { liste: roh, warn: warn };
  }

  /* ---------- Arbeitsblatt ---------- */
  function datumText() {
    var d = $('datum').value;
    if (!d) return '';
    var p = d.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  /* Zwei Spalten mit Punkten zum Verbinden (Reihenfolge rechts = wie am Bildschirm) */
  function verbindenHTML(t) {
    return '<div>Verbinde gleiche Werte mit einer Linie. Zwei Werte rechts bleiben übrig.</div>' +
      '<div class="verbinden"><div class="vb-spalte links">' +
      t.rows.map(function (r) { return '<div class="vb-item">' + r.l + '<span class="punkt"></span></div>'; }).join('') +
      '</div><div class="vb-spalte rechts">' +
      t.choices.map(function (c) { return '<div class="vb-item"><span class="punkt"></span>' + c + '</div>'; }).join('') +
      '</div></div>';
  }

  function blattHTML(k, s, basis) {
    var url = ET.kursUrl(basis, k, s.id, s.seed);
    var stationen = k.papier.map(function (p) {
      var t = ET.paperTask(k, s.seed, p);
      return '<div class="station">' +
        '<div class="st-kopf"><span class="st-nr">Station ' + p.nr + '</span><span class="st-titel">' + ET.esc(p.titel) + '</span><span class="st-haken">☐ am Bildschirm eingegeben</span></div>' +
        '<div class="st-aufgabe">' + (t.verbinden ? verbindenHTML(t) : (t.sheet || t.q)) + '</div>' +
        (p.platz ? '<div class="st-platz" style="height:' + p.platz + 'mm"><span>Rechenweg</span></div>' : '') +
        '</div>';
    }).join('');
    return '<section class="blatt">' +
      '<header class="blatt-kopf">' +
      '<div class="kopf-links">' +
      '<div class="blatt-titel">' + ET.esc(k.titel) + '</div>' +
      '<div class="blatt-unter">E-Learning-Kurs · Begleitblatt mit Papierstationen</div>' +
      '<table class="angaben">' +
      '<tr><th>Name</th><td colspan="3" class="name">' + ET.esc(s.name) + '</td></tr>' +
      '<tr><th>Klasse</th><td>' + ET.esc($('klasse').value.trim()) + '</td><th>Datum</th><td>' + datumText() + '</td></tr>' +
      '<tr><th>Blatt-Nr.</th><td class="gross">' + ET.pad3(s.id) + '</td><th>Zugangscode</th><td class="gross mono">' + s.seed + '</td></tr>' +
      '</table></div>' +
      '<div class="qr-box">' + QR.svg(url, { ecl: 'M' }) + '<div>Scannen &amp; starten</div></div>' +
      '</header>' +
      '<div class="anleitung"><b>So geht es:</b> QR-Code scannen und den Kurs bearbeiten. An jeder <b>Papierstation</b> rechnest du hier <b>vollständig</b> ' +
      '(Umrechnung, Zwischenschritte, Ergebnis mit Einheit) und gibst am Bildschirm nur das Ergebnis ein. Das Blatt wird am Ende abgegeben.' +
      '<span class="ohne-qr">Ohne QR-Code: ' + ET.esc(basis) + ' öffnen, Blatt-Nr. und Zugangscode eingeben.</span></div>' +
      stationen +
      '<div class="feedback-box">' +
      '<div class="fb-zeile"><b>Feedback zum Kurs:</b> Wie hilfreich war der Kurs? <span class="fb-skala">gar nicht <span class="kasten">1</span><span class="kasten">2</span><span class="kasten">3</span><span class="kasten">4</span><span class="kasten">5</span> sehr</span></div>' +
      '<div class="fb-zeile">Was war gut, was sollte verbessert werden? <span class="fb-linie"></span></div>' +
      '<div class="fb-zeile"><span class="fb-linie"></span></div></div>' +
      '<div class="abschluss">' +
      '<div class="abschluss-titel">Abschlusscode<span>(vom grünen Abschlussbildschirm übertragen)</span></div>' +
      '<div class="code-kaesten">' + '<span></span><span></span><span></span><span></span><b>–</b><span></span><span></span><span></span><span></span>' + '</div>' +
      '<div class="kontrolle">Kontrolle Lehrkraft: ________</div>' +
      '</div>' +
      '<footer class="blatt-fuss">erstellt von ' + ET.esc(k.autor || '') + ' | 📄 ' + ET.esc(k.kurztitel) + ' – Blatt ' + ET.pad3(s.id) + '</footer>' +
      '</section>';
  }

  function klassenlisteHTML(k) {
    return '<section class="blatt liste-blatt"><h1>' + ET.esc(k.titel) + '</h1>' +
      '<p>Klasse: <b>' + ET.esc($('klasse').value.trim() || '–') + '</b>' + (datumText() ? ' · Datum: ' + datumText() : '') + '</p>' +
      '<table class="liste"><thead><tr><th>Blatt-Nr.</th><th>Name</th><th>Zugangscode</th><th>Abschlusscode</th><th>geprüft</th></tr></thead><tbody>' +
      schueler.map(function (s) {
        return '<tr><td>' + ET.pad3(s.id) + '</td><td>' + ET.esc(s.name) + '</td><td class="mono">' + s.seed + '</td><td></td><td></td></tr>';
      }).join('') + '</tbody></table>' +
      '<footer class="blatt-fuss">erstellt von ' + ET.esc(k.autor || '') + ' | 📄 Klassenliste ' + ET.esc(k.kurztitel) + '</footer></section>';
  }

  /* ---------- Erzeugen ---------- */
  $('erzeugen').addEventListener('click', function () {
    var k = kurs(), basis = $('basis').value.trim();
    var r = lesen($('namen').value, Math.max(1, parseInt($('start').value, 10) || 1));
    var m = $('meldungen');
    m.innerHTML = '';
    if (!r.liste.length) { m.innerHTML = '<div class="hinweis falsch">Bitte zuerst Namen eingeben oder eine CSV-Datei laden.</div>'; return; }
    if (!basis) { m.innerHTML = '<div class="hinweis falsch">Bitte die Adresse des Schülerkurses eintragen.</div>'; return; }
    r.warn.forEach(function (w) { m.insertAdjacentHTML('beforeend', '<div class="hinweis falsch">' + ET.esc(w) + '</div>'); });
    schueler = r.liste;
    $('blaetter').innerHTML = schueler.map(function (s) { return blattHTML(k, s, basis); }).join('');
    $('klassenliste').innerHTML = klassenlisteHTML(k);
    $('tabelle').innerHTML = '<thead><tr><th>Blatt-Nr.</th><th>Name</th><th>Code</th><th>Link (ohne Namen)</th></tr></thead><tbody>' +
      schueler.map(function (s) {
        var u = ET.kursUrl(basis, k, s.id, s.seed);
        return '<tr><td>' + ET.pad3(s.id) + '</td><td>' + ET.esc(s.name) + '</td><td class="mono">' + s.seed + '</td>' +
          '<td class="link"><a href="' + ET.esc(u) + '" target="_blank" rel="noopener">' + ET.esc(u.replace(/^https?:\/\//, '')) + '</a></td></tr>';
      }).join('') + '</tbody>';
    /* aktuelle Liste mit Codes ins Textfeld zurückschreiben → erneutes Erzeugen behält die Codes */
    $('namen').value = schueler.map(function (s) { return ET.pad3(s.id) + ';' + s.name + ';' + s.seed; }).join('\n');
    $('ergebnis').hidden = false;
    m.insertAdjacentHTML('beforeend', '<div class="hinweis ok">' + schueler.length + ' Arbeitsblätter erzeugt. Die Liste oben enthält jetzt Nummern und Zugangscodes – bitte als CSV speichern.</div>');
    $('ergebnis').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- Drucken / Speichern ---------- */
  function druck(modus) {
    document.body.classList.remove('druck-blaetter', 'druck-liste');
    document.body.classList.add(modus);
    window.print();
  }
  $('drucken').addEventListener('click', function () { druck('druck-blaetter'); });
  $('liste-drucken').addEventListener('click', function () { druck('druck-liste'); });
  window.addEventListener('afterprint', function () { document.body.classList.remove('druck-blaetter', 'druck-liste'); });

  $('csv').addEventListener('click', function () {
    var k = kurs();
    var csv = '﻿Blatt-Nr;Name;Code\r\n' + schueler.map(function (s) {
      return [ET.pad3(s.id), '"' + s.name.replace(/"/g, '""') + '"', s.seed].join(';');
    }).join('\r\n') + '\r\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'Klassenliste-' + k.kurztitel.replace(/[^\wäöüÄÖÜß]+/g, '') + '-' + ($('klasse').value.trim() || 'Klasse').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
})();
