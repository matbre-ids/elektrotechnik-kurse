/* Lehrer-Prüfseite: dekodiert Abschlusscodes vollständig im Browser. */
(function () {
  'use strict';
  var ET = window.ET;
  var $ = function (id) { return document.getElementById(id); };
  var namen = {}; /* Blatt-Nr. → Name, nur aus optional geladener CSV */

  function zeile(k, v, cls) { return '<dt>' + k + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</dd>'; }

  function pruefen() {
    var code = $('code').value, out = $('ergebnis');
    if (!ET.Abschlusscode.normalize(code)) { out.innerHTML = ''; return; }
    var r = ET.Abschlusscode.decodeAny(code);
    if (!r.ok) {
      out.innerHTML = '<div class="pruef-ergebnis ungueltig"><div class="pruef-status">✗ Code ungültig</div><p>' + ET.esc(r.grund) + '</p></div>';
      return;
    }
    var kurs = ET.KURSE[r.kurs], blatt = ET.pad3(r.id);
    var abgleich = '';
    var soll = $('blatt').value.replace(/\D/g, '');
    if (soll) {
      abgleich = parseInt(soll, 10) === r.id
        ? '<div class="abgleich ok">✓ passt zu Arbeitsblatt ' + ET.pad3(soll) + '</div>'
        : '<div class="abgleich falsch">✗ Code gehört zu Blatt ' + blatt + ', nicht zu Blatt ' + ET.pad3(soll) + '!</div>';
    }
    out.innerHTML = '<div class="pruef-ergebnis gueltig">' +
      '<div class="pruef-status">✓ Gültiger Abschlusscode</div>' + abgleich +
      '<dl class="pruef-daten">' +
      zeile('Abschlusscode', r.code, 'mono') +
      zeile('Kurs', ET.esc(kurs.titel)) +
      zeile('Arbeitsblatt-ID', blatt, 'gross') +
      (namen[r.id] ? zeile('Name (aus Liste)', ET.esc(namen[r.id])) : '') +
      zeile('Erster Kompetenzcheck', r.erster + ' %') +
      zeile('Erfolgreicher Abschlusscheck', r.letzter + ' %') +
      zeile('Wiederholungsaufgaben', r.wiederholungen + (r.wiederholungen >= 31 ? ' oder mehr' : '')) +
      zeile('Papierstationen', 'vollständig (' + kurs.papier.length + ' / ' + kurs.papier.length + ')') +
      zeile('Status', 'Kurs erfolgreich abgeschlossen') +
      zeile('Zufallskennung', String(r.zufall)) +
      '</dl></div>';
  }

  $('pruefen').addEventListener('click', pruefen);
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') pruefen(); });
  $('blatt').addEventListener('keydown', function (e) { if (e.key === 'Enter') pruefen(); });
  $('code').addEventListener('input', function () {
    /* Bindestrich nach 4 Zeichen automatisch ergänzen */
    var s = ET.Abschlusscode.normalize($('code').value).slice(0, 8);
    $('code').value = s.length > 4 ? s.slice(0, 4) + '-' + s.slice(4) : s;
    if (s.length === 8) pruefen();
  });

  $('liste').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      namen = {};
      String(rd.result).replace(/^﻿/, '').split(/\r?\n/).forEach(function (z) {
        var t = z.split(/[;\t]/).map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
        if (/^\d{1,4}$/.test(t[0]) && t[1]) namen[parseInt(t[0], 10)] = t[1];
      });
      $('liste-info').textContent = Object.keys(namen).length + ' Namen geladen.';
      pruefen();
    };
    rd.readAsText(f, 'utf-8');
  });

  var p = new URLSearchParams(location.search);
  if (p.get('blatt')) $('blatt').value = p.get('blatt');
  if (p.get('code')) { $('code').value = p.get('code').toUpperCase(); pruefen(); }
})();
