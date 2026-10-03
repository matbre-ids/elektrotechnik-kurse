/* Schülerkurs: allgemeine Lernlogik (kursunabhängig).
   Ablauf: Lernschritte → (adaptive Wiederholungen) → Papierstationen → Kompetenzcheck
           → ggf. Nacharbeit + neuer Kurzcheck → Abschluss mit Code.
   Alle Daten bleiben im Browser (localStorage, Schlüssel je Kurs/Blatt/Seed). */
(function () {
  'use strict';
  var ET = window.ET;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var kursIds = Object.keys(ET.KURSE);
  var kurs = ET.KURSE[params.get('k')] || ET.KURSE[kursIds[0]];
  document.title = kurs.titel;

  /* ---------- DOM-Helfer ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(text, cls, onclick) {
    var b = el('button', cls || 'btn', text);
    b.type = 'button';
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }
  function supUnicode(html) {
    var m = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻', '-': '⁻' };
    return html.replace(/<sup>(.*?)<\/sup>/g, function (_, s) {
      return s.split('').map(function (c) { return m[c] || c; }).join('');
    }).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  }

  /* ---------- Start ohne QR-Parameter ---------- */
  var rawId = (params.get('id') || '').trim(), rawSeed = (params.get('seed') || '').trim().toUpperCase();
  var seedOk = /^[23456789A-HJ-NP-Z]{4,8}$/.test(rawSeed);
  if (!/^\d{1,4}$/.test(rawId) || parseInt(rawId, 10) < 1 || parseInt(rawId, 10) > 1023 || !seedOk) {
    renderStart(rawId || rawSeed ? 'Der Link ist unvollständig oder fehlerhaft. Bitte gib Blatt-Nr. und Zugangscode von deinem Arbeitsblatt ein.' : '');
    return;
  }
  var BLATT = ET.pad3(parseInt(rawId, 10)), SEED = rawSeed;
  var KEY = 'etkurs:' + kurs.id + ':' + BLATT + ':' + SEED;

  function renderStart(meldung) {
    app.innerHTML = '';
    var c = el('main', 'karte start');
    c.innerHTML = '<h1>' + ET.esc(kurs.titel) + '</h1>' +
      '<p>Scanne den QR-Code auf deinem Arbeitsblatt – oder gib die Angaben vom Blatt hier ein.</p>' +
      (meldung ? '<div class="hinweis falsch">' + ET.esc(meldung) + '</div>' : '') +
      '<label class="feld">Blatt-Nr.<input id="s-id" inputmode="numeric" autocomplete="off" placeholder="z. B. 017" value="' + ET.esc(rawId) + '"></label>' +
      '<label class="feld">Zugangscode<input id="s-seed" autocomplete="off" autocapitalize="characters" placeholder="z. B. K8M2" value="' + ET.esc(rawSeed) + '"></label>';
    c.appendChild(btn('Kurs starten', 'btn primaer', function () {
      var i = document.getElementById('s-id').value.replace(/\D/g, ''), s = document.getElementById('s-seed').value.trim().toUpperCase();
      location.search = '?k=' + encodeURIComponent(kurs.id) + '&id=' + encodeURIComponent(i) + '&seed=' + encodeURIComponent(s);
    }));
    app.appendChild(c);
  }

  /* ---------- Speicher ---------- */
  var speicherOk = true;
  try { localStorage.setItem('etkurs:test', '1'); localStorage.removeItem('etkurs:test'); } catch (e) { speicherOk = false; }

  function neuerZustand() {
    return {
      v: 4, kurs: kurs.id, id: BLATT, seed: SEED, start: Date.now(),
      phase: 'lernen', idx: 0, screen: { typ: 'schritt', idx: 0 }, zaehler: 0,
      ans: {}, offen: {}, behoben: [], alleFehler: [], gesehen: [], done: {}, papier: {},
      checks: [], lastRep: false,
      stat: { gestellt: 0, ersterVersuch: 0, falsch: 0, wiederholungen: 0, korrigiert: 0 },
      ersterCheck: null, letzterCheck: null, abgeschlossen: false, code: null, fertigAm: null
    };
  }
  function laden() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 4) return s; } catch (e) { /* leer */ }
    return null;
  }
  function speichern() {
    if (!speicherOk) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { speicherOk = false; }
  }
  var S = laden() || neuerZustand();

  /* ---------- Aufgaben ---------- */
  var cache = {};
  function aufgabe(gen, key) { return cache[key] || (cache[key] = ET.makeTask(kurs, gen, key)); }
  /* Aufgaben eines Lernschritts: erst die Bildschirmaufgaben, am Ende ggf. die Papierstation */
  function schrittAufgaben(st) {
    var a = lernAufgaben(st);
    return st.papier ? a.concat([papierAufgabe(st)]) : a;
  }
  function papierAufgabe(st) { return ET.paperTask(kurs, SEED, papierStation(st.papier)); }
  function lernAufgaben(st) {
    var sigs = [];
    return (st.tasks || []).map(function (g, i) {
      /* gleiche Aufgabe zweimal im selben Schritt vermeiden (reproduzierbar) */
      for (var n = 0; n < 20; n++) {
        var t = aufgabe(g, [kurs.id, SEED, st.id, i].join('|') + (n ? '|' + n : ''));
        if (sigs.indexOf(t.sig) < 0) break;
      }
      sigs.push(t.sig);
      return t;
    });
  }
  function papierStation(pid) {
    for (var i = 0; i < kurs.papier.length; i++) if (kurs.papier[i].id === pid) return kurs.papier[i];
    throw new Error('Papierstation fehlt: ' + pid);
  }
  function screenAufgaben(sc) {
    if (sc.typ === 'schritt') return schrittAufgaben(kurs.schritte[sc.idx]);
    if (sc.typ === 'wdh') return [aufgabe(sc.gen, sc.key)];
    if (sc.typ === 'check') { var a = aktCheck().aufgaben[sc.j]; return [aufgabe(a.gen, a.key)]; }
    return [];
  }
  function aktCheck() { return S.checks[S.checks.length - 1]; }

  /* ---------- Fehlertypen ---------- */
  /* Ein Fehlertyp ist erst beherrscht, wenn später genug vergleichbare Aufgaben richtig waren:
     nach einem Fehler 1, nach mehreren Fehlern dieses Typs 2 Aufgaben in Folge. */
  function noetig(o) { return o.fehl >= 2 ? 2 : 1; }
  /* Höchstzahl an Wiederholungsaufgaben je Fehlertyp (danach kein weiteres Nachüben dieses Typs) */
  var MAX_WDH = kurs.maxWiederholungen || 3;
  function wdhZahl(err) { return (S.wdhZahl && S.wdhZahl[err]) || 0; }
  function markiereFehler(err) {
    S.fehlZahl = S.fehlZahl || {};
    if (wdhZahl(err) >= MAX_WDH) { S.fehlZahl[err] = (S.fehlZahl[err] || 0) + 1; return; }
    var o = S.offen[err] || (S.offen[err] = { n: 0 });
    o.seit = S.zaehler;
    o.richtig = 0;
    S.fehlZahl[err] = (S.fehlZahl[err] || 0) + 1;
    o.fehl = S.fehlZahl[err];
    if (S.alleFehler.indexOf(err) < 0) S.alleFehler.push(err);
  }
  function behebe(err) {
    delete S.offen[err];
    if (S.behoben.indexOf(err) < 0) S.behoben.push(err);
    S.stat.korrigiert = S.behoben.length;
  }
  /* Nächster fälliger Fehlertyp; sofort=true ignoriert den Mindestabstand */
  function faellig(sofort) {
    var best = null;
    Object.keys(S.offen).forEach(function (e) {
      var o = S.offen[e];
      if ((sofort || S.zaehler - o.seit >= 2) && (!best || o.seit < S.offen[best].seit)) best = e;
    });
    return best;
  }
  /* Neue Wiederholungsaufgabe desselben Typs mit anderen Zahlen */
  function neueWdh(err) {
    var f = kurs.fehler[err], o = S.offen[err], key, gen;
    for (var k = 0; k < 30; k++) {
      var nr = o.n + k;
      gen = f.gen[nr % f.gen.length];
      key = [kurs.id, SEED, 'w', err, nr].join('|');
      var t = aufgabe(gen, key);
      if (S.gesehen.indexOf(t.sig) < 0) break;
    }
    o.n = nr + 1;
    return { typ: 'wdh', err: err, gen: gen, key: key };
  }

  /* Antwort verbuchen */
  function erfasse(t, ok, val, modus) {
    var a = S.ans[t.key] || (S.ans[t.key] = { versuche: 0 });
    a.versuche++;
    a.val = val;
    a.ok = ok;
    if (a.versuche === 1) {
      S.stat.gestellt++;
      if (ok) S.stat.ersterVersuch++;
      if (modus === 'wdh') S.stat.wiederholungen++;
    }
    var grenzeErreicht = false;
    if (modus === 'wdh' && a.versuche === 1 && t.err) {
      S.wdhZahl = S.wdhZahl || {};
      S.wdhZahl[t.err] = (S.wdhZahl[t.err] || 0) + 1;
      grenzeErreicht = S.wdhZahl[t.err] >= MAX_WDH;
    }
    if (!ok) S.stat.falsch++;
    if (ok || modus !== 'papier') a.fertig = true;
    if (S.gesehen.indexOf(t.sig) < 0) S.gesehen.push(t.sig);
    if (t.err) {
      if (!ok && a.versuche === 1) markiereFehler(t.err);
      else if (ok && a.versuche === 1 && S.offen[t.err] && S.zaehler > S.offen[t.err].seit) {
        var o = S.offen[t.err];
        o.richtig = (o.richtig || 0) + 1;
        o.seit = S.zaehler;
        if (o.richtig >= noetig(o)) behebe(t.err);
      }
      if (grenzeErreicht && S.offen[t.err]) {
        delete S.offen[t.err];
        S.ausgesetzt = S.ausgesetzt || [];
        if (S.ausgesetzt.indexOf(t.err) < 0) S.ausgesetzt.push(t.err);
      }
    }
    speichern();
  }

  /* ---------- Bewertung ---------- */
  function diagStufen(t, x) {
    var soll = t.fields[0].answer;
    if (!soll || !(x / soll > 0)) return '';
    var r = x / soll, k = Math.round(Math.log10(r));
    if (!ET.gleich(r, ET.p10(k))) return '';
    var E = 3 * t.steps, G = E + k;
    if (G === 0) return 'Du hast den Zahlenwert nicht verändert. Wenn sich der Vorsatz ändert, muss sich auch die Zahl ändern.';
    if (E !== 0 && G === -E) {
      return 'Du hast in die falsche Richtung gerechnet. ' + (E > 0
        ? 'Zum kleineren Vorsatz wird der Zahlenwert größer – also multiplizieren.'
        : 'Zum größeren Vorsatz wird der Zahlenwert kleiner – also dividieren.');
    }
    if (G % 3 !== 0) return 'Du hast das Komma um ' + Math.abs(G) + (Math.abs(G) === 1 ? ' Stelle' : ' Stellen') + ' verschoben. Pro Stufe sind es genau 3 Stellen.';
    if ((G > 0) === (E > 0)) return 'Du hast ' + Math.abs(G / 3) + ' Stufe(n) gerechnet – es sind aber ' + Math.abs(t.steps) + '.';
    return '';
  }

  var ART = {};

  ART.mc = {
    ui: function (t, a, fertig, zeigen) {
      var wrap = el('div', 'mc'), gewaehlt = a ? a.val : null;
      t.options.forEach(function (o, i) {
        var b = btn(o.t, 'option');
        b.setAttribute('role', 'radio');
        if (gewaehlt === i) b.classList.add('gewaehlt');
        if (fertig) {
          b.disabled = true;
          if (zeigen && o.ok) b.classList.add('richtig');
          if (zeigen && gewaehlt === i && !o.ok) b.classList.add('falsch');
        } else {
          b.addEventListener('click', function () {
            gewaehlt = i;
            wrap.querySelectorAll('.option').forEach(function (x) { x.classList.remove('gewaehlt'); });
            b.classList.add('gewaehlt');
          });
        }
        wrap.appendChild(b);
      });
      return { el: wrap, lesen: function () { return gewaehlt == null ? { fehler: 'Bitte wähle eine Antwort aus.' } : { val: gewaehlt }; } };
    },
    pruefe: function (t, v) { return !!t.options[v].ok; },
    diagnose: function (t, v) { return t.options[v].why || ''; }
  };

  ART.num = {
    ui: function (t, a, fertig) {
      var wrap = el('div', 'num'), inputs = [];
      var row;
      t.fields.forEach(function (f, i) {
        if (!(f.inline && row)) row = el('div', 'num-zeile' + (f.sup ? ' mit-hoch' : ''));
        var grp = el('span', 'feldgruppe');
        if (f.pre) grp.appendChild(el('span', 'vor', f.pre));
        var inp = el('input', 'eingabe' + (f.sup ? ' hoch' : '') + (f.w ? ' ' + f.w : ''));
        inp.setAttribute('inputmode', f.sup ? 'text' : 'decimal');
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('aria-label', 'Eingabe ' + (i + 1));
        if (a && a.val) inp.value = a.rohe ? a.rohe[i] : String(a.val[i]).replace('.', ',');
        inp.disabled = fertig;
        inputs.push(inp);
        grp.appendChild(inp);
        if (f.post) grp.appendChild(el('span', 'nach', f.post));
        row.appendChild(grp);
        if (!row.parentNode) wrap.appendChild(row);
      });
      if (!fertig && t.fields.some(function (f) { return !f.sup; })) {
        wrap.appendChild(el('div', 'klein grau', 'Dezimalkomma oder -punkt erlaubt. Keine Tausenderpunkte.'));
      }
      return {
        el: wrap, inputs: inputs,
        lesen: function () {
          var vals = [], roh = [];
          for (var i = 0; i < inputs.length; i++) {
            var p = ET.parseNum(inputs[i].value);
            if (p.fehler === 'leer') return { fehler: 'Bitte fülle alle Felder aus.' };
            if (p.fehler === 'tausenderpunkt') return { fehler: 'Bitte keine Tausenderpunkte verwenden – schreibe z. B. 4700 oder 4 700.' };
            if (p.fehler) return { fehler: '„' + inputs[i].value + '“ ist keine gültige Zahl.' };
            if (t.fields[i].sup && p.wert !== Math.round(p.wert)) return { fehler: 'Die Hochzahl ist eine ganze Zahl.' };
            vals.push(p.wert); roh.push(inputs[i].value.trim());
          }
          return { val: vals, roh: roh };
        }
      };
    },
    pruefe: function (t, v) {
      if (t.check) return t.check(v);
      return t.fields.every(function (f, i) { return ET.gleich(v[i], f.answer); });
    },
    diagnose: function (t, v) {
      if (t.diagnose) { var d = t.diagnose(v); if (d) return d; }
      if (t.steps != null && t.fields.length === 1) return diagStufen(t, v[0]);
      return '';
    }
  };

  ART.eng = {
    ui: function (t, a, fertig) {
      var wrap = el('div', 'num eng'), z = a && a.val ? a.val.z : null;
      var row = el('div', 'num-zeile');
      row.appendChild(el('span', 'vor', t.pre));
      var inp = el('input', 'eingabe');
      inp.setAttribute('inputmode', 'decimal');
      inp.setAttribute('autocomplete', 'off');
      inp.setAttribute('aria-label', 'Zahlenwert');
      if (a && a.val) inp.value = String(a.val.m).replace('.', ',');
      inp.disabled = fertig;
      row.appendChild(inp);
      var anzeige = el('span', 'nach', (z == null ? '?' : z) + t.u);
      row.appendChild(anzeige);
      wrap.appendChild(row);
      wrap.appendChild(el('div', 'klein grau', 'Vorsatz wählen:'));
      var grp = el('div', 'vorsatzwahl');
      ['G', 'M', 'k', '', 'm', 'µ', 'n', 'p'].forEach(function (p) {
        var b = btn(p === '' ? 'ohne' : p, 'chip');
        if (p === z) b.classList.add('gewaehlt');
        b.disabled = fertig;
        b.addEventListener('click', function () {
          z = p;
          grp.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('gewaehlt'); });
          b.classList.add('gewaehlt');
          anzeige.textContent = p + t.u;
        });
        grp.appendChild(b);
      });
      wrap.appendChild(grp);
      return {
        el: wrap, inputs: [inp],
        lesen: function () {
          var p = ET.parseNum(inp.value);
          if (p.fehler === 'leer') return { fehler: 'Bitte gib eine Zahl ein.' };
          if (p.fehler === 'tausenderpunkt') return { fehler: 'Bitte keine Tausenderpunkte verwenden.' };
          if (p.fehler) return { fehler: 'Das ist keine gültige Zahl.' };
          if (z == null) return { fehler: 'Bitte wähle einen Vorsatz (oder „ohne“).' };
          return { val: { m: p.wert, z: z } };
        }
      };
    },
    wert: function (v) { return v.m * ET.p10(ET.vs(v.z).e); },
    pruefe: function (t, v) {
      return ET.gleich(ART.eng.wert(v), t.value) && Math.abs(v.m) >= 1 && Math.abs(v.m) < 1000;
    },
    diagnose: function (t, v) {
      var x = ART.eng.wert(v), soll = ET.eng(t.value);
      if (ET.gleich(x, t.value)) return 'Der Wert stimmt, aber die Zahl liegt nicht zwischen 1 und 999. Wähle einen anderen Vorsatz.';
      if (t.diagnose) { var d = t.diagnose(x); if (d) return d; }
      if (ET.gleich(v.m, soll.m) && v.z !== soll.z) {
        if ((v.z === 'M' && soll.z === 'm') || (v.z === 'm' && soll.z === 'M')) return 'Groß-/Kleinschreibung: M ist Mega (10⁶), m ist Milli (10⁻³).';
        return 'Die Zahl passt, aber der Vorsatz nicht. Richtig ist ' + (soll.z || 'kein Vorsatz') + '.';
      }
      return '';
    }
  };

  ART.match = {
    ui: function (t, a, fertig, zeigen) {
      var wrap = el('div', 'match'), sels = [];
      t.rows.forEach(function (r, i) {
        var row = el('label', 'match-zeile');
        row.appendChild(el('span', 'links', r.l));
        var s = el('select', 'auswahl');
        s.appendChild(el('option', null, 'bitte wählen …'));
        s.options[0].value = '';
        t.choices.forEach(function (c, j) {
          var o = el('option', null, ET.esc(supUnicode(c)));
          o.value = String(j);
          s.appendChild(o);
        });
        if (a && a.val) s.value = String(a.val[i]);
        s.disabled = fertig;
        if (fertig && zeigen) row.classList.add(t.choices[a.val[i]] === r.a ? 'richtig' : 'falsch');
        sels.push(s);
        row.appendChild(s);
        wrap.appendChild(row);
      });
      return {
        el: wrap,
        lesen: function () {
          var v = sels.map(function (s) { return s.value === '' ? null : parseInt(s.value, 10); });
          if (v.indexOf(null) >= 0) return { fehler: 'Bitte ordne alle Zeilen zu.' };
          return { val: v };
        }
      };
    },
    pruefe: function (t, v) { return t.rows.every(function (r, i) { return t.choices[v[i]] === r.a; }); },
    diagnose: function (t, v, modus, versuche) {
      var f = t.rows.filter(function (r, i) { return t.choices[v[i]] !== r.a; });
      if (modus === 'papier' && versuche < 2) return (f.length === 1 ? '1 Verbindung stimmt' : f.length + ' Verbindungen stimmen') + ' noch nicht.';
      return 'Richtig wäre: ' + f.map(function (r) { return r.l + ' → ' + r.a; }).join('; ') + '.';
    }
  };

  ART.ladder = {
    ui: function (t, a, fertig) {
      var wrap = el('div', 'ladder-aufgabe'), v = a && a.val ? JSON.parse(JSON.stringify(a.val)) : {};
      wrap.appendChild(el('div', 'leiter', leiterHTML({ von: t.von, nach: t.nach })));
      function gruppe(titel, feld, opts) {
        var g = el('div', 'gruppe');
        g.appendChild(el('div', 'gruppe-titel', titel));
        var row = el('div', 'chips');
        opts.forEach(function (o) {
          var b = btn(o[1], 'chip');
          if (v[feld] === o[0]) b.classList.add('gewaehlt');
          b.disabled = fertig;
          b.addEventListener('click', function () {
            v[feld] = o[0];
            row.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('gewaehlt'); });
            b.classList.add('gewaehlt');
          });
          row.appendChild(b);
        });
        g.appendChild(row);
        wrap.appendChild(g);
      }
      gruppe('1. Richtung auf der Leiter', 'r', [['l', '← nach links'], ['r', 'nach rechts →']]);
      gruppe('2. Wie viele Stufen?', 'n', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]);
      gruppe('3. Der Zahlenwert …', 'op', [['mal', 'wird größer (· 1000 je Stufe)'], ['durch', 'wird kleiner (: 1000 je Stufe)']]);
      return {
        el: wrap,
        lesen: function () {
          if (!v.r || !v.n || !v.op) return { fehler: 'Bitte beantworte alle drei Teile.' };
          return { val: v };
        }
      };
    },
    soll: function (t) {
      var d = ET.stufen(t.von, t.nach);
      return { r: d > 0 ? 'r' : 'l', n: Math.abs(d), op: d > 0 ? 'mal' : 'durch' };
    },
    pruefe: function (t, v) {
      var s = ART.ladder.soll(t);
      return v.r === s.r && v.n === s.n && v.op === s.op;
    },
    diagnose: function (t, v) {
      var s = ART.ladder.soll(t), m = [];
      if (v.r !== s.r) m.push('Richtung: ' + (t.nach || 'Einheit') + ' liegt ' + (s.r === 'r' ? 'rechts' : 'links') + ' von ' + (t.von || 'Einheit') + '.');
      if (v.n !== s.n) m.push('Stufen: Zähle die Schritte von ' + (t.von || 'Einheit') + ' bis ' + (t.nach || 'Einheit') + ' – es sind ' + s.n + '.');
      if (v.op !== s.op) m.push('Zahlenwert: Zum ' + (s.op === 'mal' ? 'kleineren Vorsatz wird die Zahl größer.' : 'größeren Vorsatz wird die Zahl kleiner.'));
      return m.join(' ');
    }
  };

  /* ---------- Stufenleiter ---------- */
  function leiterHTML(o) {
    o = o || {};
    var liste = ET.VORSAETZE.filter(function (v) { return !o.nur || o.nur.indexOf(v.z) >= 0; });
    var h = '<div class="leiter-reihe">' + liste.map(function (v) {
      var c = 'stufe' + (v.e === 0 ? ' einheit' : '') + (o.von != null && v.z === o.von ? ' von' : '') + (o.nach != null && v.z === o.nach ? ' nach' : '');
      return '<div class="' + c + '"><span class="z">' + (v.z || '1') + '</span><span class="p">' + ET.pot(v.e) + '</span><span class="n">' + v.name + '</span></div>';
    }).join('') + '</div>';
    if (o.pfeile) {
      h += '<div class="leiter-pfeile"><span>← größerer Vorsatz: Zahl : 1000</span><span>kleinerer Vorsatz: Zahl · 1000 →</span></div>';
    } else {
      h += '<div class="leiter-info">jeder Schritt: Faktor 1000 · Komma um 3 Stellen</div>';
    }
    return h;
  }
  function leiternFuellen(root) {
    root.querySelectorAll('div.leiter:not([data-fertig])').forEach(function (d) {
      if (d.innerHTML.trim()) return;
      d.innerHTML = leiterHTML({
        nur: d.getAttribute('data-nur') ? d.getAttribute('data-nur').split(',') : null,
        pfeile: d.getAttribute('data-pfeile') === '1'
      });
      d.setAttribute('data-fertig', '1');
    });
  }

  /* ---------- Rückmeldung ---------- */
  function rueckmeldung(t, a, modus) {
    var art = ART[t.kind], v = a.val;
    if (a.ok) {
      return '<div class="fb ok" role="status"><b>✓ Richtig.</b> <span class="erkl">' + (t.explain || '') + '</span></div>';
    }
    var diag = art.diagnose(t, v, modus, a.versuche);
    if (modus === 'papier') {
      return '<div class="fb falsch" role="status"><b>✗ Das Ergebnis stimmt noch nicht.</b> ' + (diag ? diag + ' ' : '') +
        (a.versuche >= 2
          ? '<div class="loesung"><b>Lösungsweg:</b> ' + t.explain + '</div>Übertrage den richtigen Rechenweg auf dein Blatt und gib das Ergebnis erneut ein.'
          : 'Prüfe deinen Rechenweg auf dem Blatt, korrigiere ihn und gib das Ergebnis erneut ein.') + '</div>';
    }
    return '<div class="fb falsch" role="status"><b>✗ Nicht richtig.</b> ' + (diag ? diag : '') +
      '<div class="loesung"><b>So geht es:</b> ' + t.explain + '</div>' +
      (t.err ? '<div class="klein">Eine ähnliche Aufgabe kommt später noch einmal.</div>' : '') + '</div>';
  }

  /* Eine Aufgabe in ein Kästchen zeichnen */
  function zeichneAufgabe(box, t, modus, nachAbgabe) {
    var a = S.ans[t.key], fertig = !!(a && a.fertig), zeigen = modus !== 'check';
    box.innerHTML = '';
    box.className = 'aufgabe' + (fertig && modus !== 'check' ? (a.ok ? ' ist-ok' : ' ist-falsch') : '');
    box.appendChild(el('div', 'frage', t.q));
    var ui = ART[t.kind].ui(t, a, fertig, zeigen);
    box.appendChild(ui.el);

    var haken = null;
    if (modus === 'papier' && !fertig) {
      var lab = el('label', 'papierhaken');
      haken = el('input');
      haken.type = 'checkbox';
      haken.checked = !!(a && a.versuche);
      lab.appendChild(haken);
      lab.appendChild(el('span', null, 'Ich habe Rechenweg und Ergebnis auf meinem Arbeitsblatt notiert.'));
      box.appendChild(lab);
    }
    var meldung = el('div', 'meldung');
    box.appendChild(meldung);

    if (!fertig) {
      var b = btn(modus === 'check' ? 'Antwort abgeben' : 'Prüfen', 'btn primaer', function () {
        if (haken && !haken.checked) { meldung.textContent = 'Bitte zuerst auf dem Arbeitsblatt rechnen und das Häkchen setzen.'; return; }
        var r = ui.lesen();
        if (r.fehler) { meldung.textContent = r.fehler; return; }
        var ok = ART[t.kind].pruefe(t, r.val);
        erfasse(t, ok, r.val, modus);
        if (r.roh) S.ans[t.key].rohe = r.roh;
        speichern();
        nachAbgabe(t, ok);
      });
      box.appendChild(b);
      if (ui.inputs) {
        ui.inputs.forEach(function (inp) {
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') b.click(); });
        });
      }
    }
    if (a && a.versuche && modus !== 'check') box.insertAdjacentHTML('beforeend', rueckmeldung(t, a, modus));
  }

  /* ---------- Ablaufsteuerung ---------- */
  function hauptSchritte() { return kurs.schritte.filter(function (s) { return !s.check; }); }

  function naechster() {
    var sc = S.screen;
    if (S.phase === 'lernen') {
      if (sc.typ === 'schritt') S.idx = sc.idx + 1;
      var st = kurs.schritte[S.idx];
      if (st && !st.check) {
        var e = !S.lastRep && faellig(false);
        if (e) return neueWdh(e);
        return { typ: 'schritt', idx: S.idx };
      }
      var e2 = faellig(true);
      if (e2) return neueWdh(e2);
      return { typ: 'checkStart' };
    }
    if (S.phase === 'check') {
      if (sc.typ === 'check' && sc.j + 1 < aktCheck().aufgaben.length) return { typ: 'check', j: sc.j + 1 };
      auswerten();
      S.phase = 'ergebnis';
      return { typ: 'checkErgebnis' };
    }
    if (S.phase === 'ergebnis' || S.phase === 'nacharbeit') {
      S.phase = 'nacharbeit';
      var e3 = faellig(true);
      if (e3) return neueWdh(e3);
      if (aktCheck().bestanden) return abschluss();
      return { typ: 'checkStart' };
    }
    return { typ: 'fertig' };
  }

  function weiter() {
    var sc = S.screen;
    if (sc.typ === 'schritt') {
      var st = kurs.schritte[sc.idx];
      S.done[st.id] = true;
      if (st.papier) S.papier[st.papier] = true;
      S.lastRep = false;
    } else if (sc.typ === 'wdh') {
      S.lastRep = true;
    }
    S.zaehler++;
    S.screen = naechster();
    speichern();
    render();
    window.scrollTo(0, 0);
  }

  function beginCheck() {
    var runde = S.checks.length + 1, voll = kurs.check.voll, gens;
    var r = ET.rng([kurs.id, SEED, 'check', runde].join('|'));
    if (runde === 1) gens = voll.slice();
    else {
      var schwach = aktCheck().falschGens.filter(function (g, i, a) { return a.indexOf(g) === i; });
      gens = schwach.concat(r.shuffle(voll.filter(function (g) { return schwach.indexOf(g) < 0; })))
        .slice(0, kurs.check.kurzAnzahl);
      gens = r.shuffle(gens);
    }
    var auf = gens.map(function (g, j) {
      var key;
      for (var n = 0; n < 25; n++) {
        key = [kurs.id, SEED, 'c', runde, j, n].join('|');
        if (S.gesehen.indexOf(aufgabe(g, key).sig) < 0) break;
      }
      return { gen: g, key: key };
    });
    S.checks.push({ runde: runde, aufgaben: auf, antworten: [], falschGens: [] });
    S.phase = 'check';
    S.screen = { typ: 'check', j: 0 };
    speichern();
    render();
    window.scrollTo(0, 0);
  }

  function auswerten() {
    var c = aktCheck(), richtig = 0;
    c.aufgaben.forEach(function (x) {
      var a = S.ans[x.key];
      if (a && a.ok) richtig++; else c.falschGens.push(x.gen);
    });
    c.richtig = richtig;
    c.gesamt = c.aufgaben.length;
    c.pct = Math.round(100 * richtig / c.gesamt);
    c.bestanden = c.pct >= kurs.check.grenze;
    if (c.runde === 1) S.ersterCheck = c.pct;
    if (c.bestanden) S.letzterCheck = c.pct;
  }

  function bedingungen() {
    var fehlt = [];
    hauptSchritte().forEach(function (s) { if (!S.done[s.id]) fehlt.push('Lernschritt „' + s.titel + '“'); });
    kurs.papier.forEach(function (p) { if (!S.papier[p.id]) fehlt.push('Papierstation ' + p.nr); });
    if (!S.checks.length || !aktCheck().bestanden) fehlt.push('Kompetenzcheck');
    if (Object.keys(S.offen).length) fehlt.push('offene Fehlertypen');
    return fehlt;
  }

  function abschluss() {
    if (bedingungen().length) return { typ: 'checkErgebnis' };
    if (!S.code) {
      S.code = ET.Abschlusscode.encode(kurs.id, {
        id: parseInt(BLATT, 10), erster: S.ersterCheck, letzter: S.letzterCheck, wiederholungen: S.stat.wiederholungen
      });
      S.abgeschlossen = true;
      S.fertigAm = Date.now();
    }
    S.phase = 'fertig';
    return { typ: 'fertig' };
  }

  /* ---------- Darstellung ---------- */
  function kopf() {
    var k = el('header', 'kopf');
    var zeile = el('div', 'kopf-zeile');
    zeile.appendChild(el('div', 'kopf-titel', '<span class="kurs">' + ET.esc(kurs.kurztitel) + '</span><span class="blatt">Arbeitsblatt ' + BLATT + '</span>'));
    zeile.appendChild(btn('☰ Übersicht', 'btn klein-btn', zeigeUebersicht));
    k.appendChild(zeile);

    var n = kurs.schritte.length, akt = S.phase === 'lernen' ? Math.min(S.idx, n - 1) : n - 1;
    var sc = S.screen, zusatz = '';
    if (sc.typ === 'wdh') zusatz = ' · Wiederholung';
    if (sc.typ === 'check') zusatz = ' · Aufgabe ' + (sc.j + 1) + ' von ' + aktCheck().aufgaben.length;
    var pz = kurs.papier.filter(function (p) { return S.papier[p.id]; }).length;
    var info = el('div', 'fortschritt-info', '<span>Lernschritt ' + (akt + 1) + ' von ' + n + zusatz + '</span><span class="papierzahl" title="Papierstationen">📝 ' + pz + ' / ' + kurs.papier.length + '</span>');
    k.appendChild(info);
    var bar = el('div', 'fortschritt');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(n));
    bar.setAttribute('aria-valuenow', String(akt));
    kurs.schritte.forEach(function (s, i) {
      var seg = el('span', 'seg' + (s.papier ? ' papier' : '') + (s.check ? ' check' : ''));
      if (S.done[s.id] || (s.check && S.phase === 'fertig')) seg.classList.add('fertig');
      else if (i === akt) seg.classList.add('aktuell');
      bar.appendChild(seg);
    });
    k.appendChild(bar);
    if (!speicherOk) k.appendChild(el('div', 'hinweis falsch', 'Achtung: Der Fortschritt kann in diesem Browser nicht gespeichert werden (privater Modus?). Bitte die Seite nicht neu laden.'));
    return k;
  }

  function weiterLeiste(aufgaben, text) {
    var leiste = el('div', 'weiter-leiste');
    var offen = aufgaben.filter(function (t) { return !(S.ans[t.key] && S.ans[t.key].fertig); }).length;
    var b = btn(text || 'Weiter', 'btn primaer gross', weiter);
    b.disabled = offen > 0;
    leiste.appendChild(b);
    if (offen) leiste.appendChild(el('div', 'klein grau', offen === 1 ? 'Bearbeite zuerst die Aufgabe.' : 'Bearbeite zuerst alle ' + offen + ' Aufgaben.'));
    return leiste;
  }

  function aufgabenBlock(karte, aufgaben, modus, alle) {
    aufgaben.forEach(function (t) {
      var box = el('section', 'aufgabe');
      karte.appendChild(box);
      zeichneAufgabe(box, t, modus, function nachAbgabe() {
        if (modus === 'check') { weiter(); return; }
        zeichneAufgabe(box, t, modus, nachAbgabe);
        var alt = app.querySelector('.weiter-leiste');
        alt.parentNode.replaceChild(weiterLeiste(alle || aufgaben), alt);
        var fb = box.querySelector('.fb');
        if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  function render() {
    app.innerHTML = '';
    document.body.classList.toggle('erfolg-modus', S.screen.typ === 'fertig');
    if (S.screen.typ === 'fertig') { renderFertig(); return; }
    app.appendChild(kopf());
    var main = el('main', 'karte');
    app.appendChild(main);
    var sc = S.screen;
    if (sc.typ === 'schritt') renderSchritt(main, sc.idx);
    else if (sc.typ === 'wdh') renderWdh(main, sc);
    else if (sc.typ === 'checkStart') renderCheckStart(main);
    else if (sc.typ === 'check') renderCheck(main, sc);
    else if (sc.typ === 'checkErgebnis') renderCheckErgebnis(main);
    leiternFuellen(main);
  }

  function renderSchritt(main, idx) {
    var st = kurs.schritte[idx], alle = schrittAufgaben(st);
    main.appendChild(el('div', 'badge', 'Lernschritt ' + (idx + 1)));
    main.appendChild(el('h2', null, ET.esc(st.titel)));
    if (st.html) main.appendChild(el('div', 'erklaerung', st.html));
    if (st.video) main.appendChild(videoBlock(st.video));
    aufgabenBlock(main, lernAufgaben(st), 'lernen', alle);
    if (st.papier) {
      var p = papierStation(st.papier), teil = el('div', 'papier-teil');
      teil.appendChild(el('div', 'badge papier', '📝 Papierstation ' + p.nr + ' von ' + kurs.papier.length));
      teil.appendChild(el('h3', null, ET.esc(p.titel)));
      teil.appendChild(el('div', 'papier-anleitung',
        '<ol><li>Nimm dein <b>Arbeitsblatt</b> – Station ' + p.nr + '.</li>' +
        '<li>Bearbeite die Aufgabe dort <b>vollständig</b> (Rechenweg, Zwischenschritte, Ergebnis).</li>' +
        '<li>Gib hier <b>nur dein Ergebnis</b> ein.</li></ol>'));
      main.appendChild(teil);
      aufgabenBlock(teil, [papierAufgabe(st)], 'papier', alle);
    }
    main.appendChild(weiterLeiste(alle));
  }

  function videoBlock(v) {
    var box = el('div', 'video');
    var ph = el('div', 'video-platzhalter',
      '<div class="video-titel">▶ Video: „' + ET.esc(v.titel) + '“</div><div class="klein">' + ET.esc(v.kanal) + ' · YouTube</div>');
    var b = btn('Video laden', 'btn', function () {
      var f = el('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.yt) + '?rel=0';
      f.title = v.titel;
      f.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.innerHTML = '';
      box.classList.add('geladen');
      box.appendChild(f);
    });
    ph.appendChild(b);
    ph.appendChild(el('div', 'klein grau', 'Erst beim Klick wird eine Verbindung zu YouTube (youtube-nocookie.com) aufgebaut. Funktioniert das Video nicht, mach einfach mit den Fragen weiter.'));
    box.appendChild(ph);
    return box;
  }

  function renderWdh(main, sc) {
    var t = aufgabe(sc.gen, sc.key), f = kurs.fehler[sc.err];
    main.appendChild(el('div', 'badge wdh', '↻ Wiederholung'));
    main.appendChild(el('h2', null, ET.esc(f.label)));
    if (S.phase === 'lernen' && kurs.schritte[S.idx] && kurs.schritte[S.idx].check) {
      main.appendChild(el('p', null, 'Bevor der Kompetenzcheck beginnt, übst du noch offene Punkte.'));
    } else {
      main.appendChild(el('p', null, 'Hier hattest du vorhin einen Fehler. Jetzt eine neue Aufgabe dieser Art:'));
    }
    var o = S.offen[sc.err];
    if (wdhZahl(sc.err) === MAX_WDH - 1) {
      main.appendChild(el('p', 'klein grau', 'Letzte Wiederholung zu diesem Bereich. Frag bei Unklarheiten deine Lehrkraft.'));
    } else if (o && noetig(o) - (o.richtig || 0) > 1) {
      main.appendChild(el('p', 'klein grau', 'Dieser Bereich war mehrfach falsch – du übst ihn noch ' + (noetig(o) - (o.richtig || 0)) + '-mal richtig, dann ist er geschafft.'));
    }
    var tipp = el('details', 'tipp', '<summary>Tipp anzeigen</summary><div>' + f.tipp + '</div>');
    main.appendChild(tipp);
    aufgabenBlock(main, [t], 'wdh');
    main.appendChild(weiterLeiste([t]));
  }

  function renderCheckStart(main) {
    var runde = S.checks.length + 1, anzahl = runde === 1 ? kurs.check.voll.length : kurs.check.kurzAnzahl;
    main.appendChild(el('div', 'badge check', runde === 1 ? 'Kompetenzcheck' : 'Neuer Kurzcheck'));
    main.appendChild(el('h2', null, runde === 1 ? 'Kompetenzcheck' : 'Noch einmal – mit neuen Zahlen'));
    main.appendChild(el('div', 'erklaerung',
      '<ul><li><b>' + anzahl + ' Aufgaben</b> zu allen Themen des Kurses.</li>' +
      '<li>Die Auswertung bekommst du erst am Ende.</li>' +
      '<li>Bestanden ab <b>' + kurs.check.grenze + ' %</b>.</li>' +
      '<li>Taschenrechner und Arbeitsblatt darfst du benutzen.</li></ul>'));
    var leiste = el('div', 'weiter-leiste');
    leiste.appendChild(btn('Check starten', 'btn primaer gross', beginCheck));
    main.appendChild(leiste);
  }

  function renderCheck(main, sc) {
    var t = screenAufgaben(sc)[0];
    main.appendChild(el('div', 'badge check', (S.checks.length === 1 ? 'Kompetenzcheck' : 'Kurzcheck') + ' · Aufgabe ' + (sc.j + 1) + ' von ' + aktCheck().aufgaben.length));
    aufgabenBlock(main, [t], 'check');
  }

  function renderCheckErgebnis(main) {
    var c = aktCheck(), offen = Object.keys(S.offen);
    var leiste = el('div', 'weiter-leiste');
    if (c.bestanden) {
      main.appendChild(el('div', 'badge ok', 'Kompetenzcheck bestanden'));
      main.appendChild(el('h2', null, c.richtig + ' von ' + c.gesamt + ' Aufgaben richtig'));
      if (offen.length) {
        main.appendChild(el('p', null, 'Gut gemacht! Zum Abschluss übst du noch kurz diese Bereiche:'));
        main.appendChild(el('ul', 'bereiche', offen.map(function (e) { return '<li>' + kurs.fehler[e].label + '</li>'; }).join('')));
        leiste.appendChild(btn('Gezielt üben', 'btn primaer gross', weiter));
      } else {
        main.appendChild(el('p', null, 'Alle Bedingungen sind erfüllt.'));
        leiste.appendChild(btn('Zum Abschluss', 'btn primaer gross', weiter));
      }
    } else {
      main.appendChild(el('div', 'badge wdh', 'Kompetenzcheck'));
      main.appendChild(el('h2', null, 'Fast geschafft.'));
      main.appendChild(el('p', null, c.richtig + ' von ' + c.gesamt + ' Aufgaben richtig – für den Abschluss brauchst du ' + kurs.check.grenze + ' %. Diese Bereiche solltest du noch einmal üben:'));
      main.appendChild(el('ul', 'bereiche', offen.map(function (e) { return '<li>' + kurs.fehler[e].label + '</li>'; }).join('')));
      main.appendChild(el('p', 'klein', 'Danach folgt ein neuer kurzer Check mit ähnlichen Aufgaben.'));
      leiste.appendChild(btn('Gezielt üben', 'btn primaer gross', weiter));
    }
    var falsche = c.aufgaben.filter(function (x) { return !(S.ans[x.key] && S.ans[x.key].ok); });
    if (falsche.length) {
      var d = el('details', 'check-review');
      d.appendChild(el('summary', null, 'Deine Fehler im Check ansehen (' + falsche.length + ')'));
      falsche.forEach(function (x) {
        var t = aufgabe(x.gen, x.key);
        d.appendChild(el('div', 'review', '<div class="frage">' + t.q + '</div><div class="loesung">' + t.explain + '</div>'));
      });
      main.appendChild(d);
    }
    main.appendChild(leiste);
  }

  function renderFertig() {
    var f = bedingungen();
    if (f.length) { /* Sicherheitsnetz: grüner Bildschirm nur, wenn wirklich alles erfüllt ist */
      S.phase = 'lernen'; S.screen = naechster(); speichern(); render(); return;
    }
    var url = new URL('pruefen.html?code=' + encodeURIComponent(S.code), location.href).href;
    var pz = kurs.papier.length;
    var w = el('main', 'erfolg');
    w.innerHTML =
      '<div class="haken" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#fff"/>' +
      '<path d="M26 52 L43 69 L76 33" fill="none" stroke="#147a3c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h1>✓ KURS ERFOLGREICH ABGESCHLOSSEN</h1>' +
      '<div class="erfolg-kurs">' + ET.esc(kurs.titel) + '</div>' +
      '<dl class="erfolg-daten">' +
      '<dt>Arbeitsblatt</dt><dd>' + BLATT + '</dd>' +
      '<dt>Erster Kompetenzcheck</dt><dd>' + S.ersterCheck + ' %</dd>' +
      '<dt>Abschließender Kompetenzcheck</dt><dd>' + S.letzterCheck + ' %</dd>' +
      '<dt>Papierstationen</dt><dd>' + pz + ' / ' + pz + '</dd>' +
      '<dt>Wiederholungsaufgaben</dt><dd>' + S.stat.wiederholungen + '</dd></dl>' +
      '<div class="code-titel">Abschlusscode</div>' +
      '<div class="code" aria-label="Abschlusscode">' + S.code + '</div>' +
      '<p class="erfolg-text">Übertrage den Abschlusscode auf dein Arbeitsblatt und zeige diesen Bildschirm anschließend deiner Lehrkraft.</p>' +
      '<div class="erfolg-qr"><div class="qr">' + QR.svg(url, { ecl: 'M' }) + '</div><div class="klein">QR-Code für die Lehrkraft (Prüfseite)</div></div>';
    var u = el('div', 'erfolg-unten');
    u.appendChild(btn('Übersicht', 'btn hell', zeigeUebersicht));
    w.appendChild(u);
    app.appendChild(w);
  }

  /* ---------- Übersicht / Neustart ---------- */
  function zeigeUebersicht() {
    var ov = el('div', 'overlay');
    var p = el('div', 'panel');
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Übersicht');
    var aktIdx = S.phase === 'lernen' ? S.idx : kurs.schritte.length - 1;
    p.appendChild(el('h2', null, 'Übersicht · Arbeitsblatt ' + BLATT));
    p.appendChild(el('ol', 'uebersicht', kurs.schritte.map(function (s, i) {
      var fertig = S.done[s.id] || (s.check && S.phase === 'fertig');
      var st = fertig ? '✓' : (i === aktIdx ? '▶' : '');
      var name = s.titel + (s.papier ? ' + 📝 Papierstation ' + papierStation(s.papier).nr : '');
      return '<li class="' + (fertig ? 'erledigt' : i === aktIdx ? 'aktuell' : '') + '"><span class="st">' + st + '</span>' + ET.esc(name) + '</li>';
    }).join('')));
    var offen = Object.keys(S.offen);
    if (offen.length) p.appendChild(el('p', 'klein', 'Noch zu wiederholen: ' + offen.map(function (e) { return kurs.fehler[e].label; }).join(', ')));
    var z = el('div', 'panel-knoepfe');
    z.appendChild(btn('Schließen', 'btn primaer', function () { document.body.removeChild(ov); }));
    z.appendChild(btn('Kurs neu starten …', 'btn gefahr', function () {
      if (confirm('Kurs auf diesem Gerät wirklich NEU starten?\n\nDein gesamter Fortschritt' + (S.code ? ' und dein Abschlusscode' : '') + ' werden gelöscht.')) {
        try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
        S = neuerZustand();
        cache = {};
        speichern();
        document.body.removeChild(ov);
        render();
        window.scrollTo(0, 0);
      }
    }));
    p.appendChild(z);
    ov.appendChild(p);
    ov.addEventListener('click', function (e) { if (e.target === ov) document.body.removeChild(ov); });
    document.body.appendChild(ov);
  }

  /* Testzugriff für die Qualitätssicherung (Konsole) */
  window.__kurs = { state: function () { return S; }, aufgaben: function () { return screenAufgaben(S.screen); }, ART: ART };

  render();
})();
