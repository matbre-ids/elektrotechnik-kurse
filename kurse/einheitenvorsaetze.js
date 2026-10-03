/* Kurs „Einheitenvorsätze in der Elektrotechnik“
   Inhalt: Lernschritte, Aufgabengeneratoren (kontrollierte Zahlenpools),
   Fehlertypen für die adaptive Wiederholung, Papierstationen, Kompetenzcheck.
   Grundlage: Unterrichtsunterlage „01 Einheitenvorsätze-Inhalt“. */
(function () {
  'use strict';
  var ET = window.ET, gr = ET.gr, fmt = ET.fmt, pot = ET.pot;
  var NB = ' ';
  var LUECKE = '<span class="luecke"></span>';

  /* ---------- Hilfsfunktionen ---------- */
  function ein(z, u) { return (z || '') + u; }
  function faktor(n) { return fmt(Math.pow(1000, n)); }
  function stufenWort(n) { return n === 1 ? '1 Stufe' : n + ' Stufen'; }

  function weg(v, von, nach, u) {
    var d = ET.stufen(von, nach), n = Math.abs(d), erg = v * ET.p10(3 * d);
    var richtung = d > 0 ? 'nach rechts (zum kleineren Vorsatz)' : 'nach links (zum größeren Vorsatz)';
    return 'Von ' + ein(von, u) + ' nach ' + ein(nach, u) + ': ' + stufenWort(n) + ' ' + richtung +
      ' → Zahlenwert ' + (d > 0 ? 'mal ' : 'durch ') + faktor(n) + ', Komma ' + 3 * n +
      ' Stellen nach ' + (d > 0 ? 'rechts' : 'links') + '.<br><b>' + gr(v, von, u) + ' = ' + fmt(v) +
      (d > 0 ? ' · ' : ' : ') + faktor(n) + NB + ein(nach, u) + ' = ' + gr(erg, nach, u) + '</b>';
  }

  function umrechnen(v, von, nach, u, err, q) {
    var d = ET.stufen(von, nach);
    return {
      kind: 'num', err: err, q: q || 'Rechne um.',
      fields: [{ pre: gr(v, von, u) + ' =', post: ein(nach, u), answer: v * ET.p10(3 * d) }],
      steps: d,
      explain: weg(v, von, nach, u),
      sheet: gr(v, von, u) + ' = ' + LUECKE + NB + ein(nach, u)
    };
  }

  /* Diagnose für Rechenaufgaben (Ohmsches Gesetz) */
  function diagRechnung(soll) {
    return function (vals) {
      var r = vals[0] / soll;
      if (!(r > 0)) return '';
      var k = Math.round(Math.log10(r));
      if (k === 0 || !ET.gleich(r, ET.p10(k))) return '';
      if (Math.abs(k) === 3) return 'Dein Ergebnis weicht genau um den Faktor 1000 ab. Vermutlich wurde ein Vorsatz nicht umgerechnet. Rechne zuerst alle Größen in die Grundeinheiten um.';
      if (Math.abs(k) === 6) return 'Dein Ergebnis weicht um den Faktor 1 000 000 ab – vermutlich wurden beide Vorsätze nicht umgerechnet.';
      return 'Dein Ergebnis weicht um den Faktor ' + fmt(ET.p10(Math.abs(k))) + ' ab. Prüfe die Kommaverschiebung: pro Stufe genau 3 Stellen.';
    };
  }

  /* Größe aus [Wert, Vorsatz] in Grundeinheit */
  function basis(w) { return w[0] * ET.p10(ET.vs(w[1]).e); }

  /* ---------- Aufgabengeneratoren ---------- */
  var gen = {};

  /* Einstieg: unübersichtlich ↔ übersichtlich */
  gen.einstieg = function () {
    return {
      kind: 'match', err: null,
      q: 'Welche Schreibweise gehört zu welchem Wert? Probier es einfach aus.',
      rows: [
        { l: '0,000003' + NB + 'A', a: '3' + NB + 'µA' },
        { l: '4' + ' ' + '700' + ' ' + '000' + NB + 'Ω', a: '4,7' + NB + 'MΩ' },
        { l: '0,000000470' + NB + 'F', a: '470' + NB + 'nF' }
      ],
      choices: ['3' + NB + 'µA', '4,7' + NB + 'MΩ', '470' + NB + 'nF', '4,7' + NB + 'mΩ', '470' + NB + 'µF'],
      explain: 'Gleicher Wert, kürzere Schreibweise: Der Vorsatz (µ, M, n) ersetzt die vielen Nullen. Genau darum geht es in diesem Kurs.'
    };
  };

  /* Milli im Alltag */
  gen.alltag_milli = function (r) {
    var u = r.pick([['m', 'Millimeter', 'Meter'], ['g', 'Milligramm', 'Gramm'], ['l', 'Milliliter', 'Liter']]);
    return {
      kind: 'mc', err: 'vorsatz',
      q: '1' + NB + 'm' + u[0] + ' (1 ' + u[1] + ') entspricht:',
      options: [
        { t: '0,001' + NB + u[0], ok: true },
        { t: '0,01' + NB + u[0], why: '0,01 wäre ein Hundertstel. Milli bedeutet ein Tausendstel.' },
        { t: '0,1' + NB + u[0], why: '0,1 wäre ein Zehntel. Milli bedeutet ein Tausendstel.' },
        { t: '1000' + NB + u[0], why: '1000 ' + u[2] + ' wäre Kilo. Milli macht den Wert kleiner, nicht größer.' }
      ],
      explain: 'Milli (m) = ein Tausendstel: 1' + NB + 'm' + u[0] + ' = 1 : 1000' + NB + u[0] + ' = 0,001' + NB + u[0] + '.'
    };
  };

  /* Kilometer → Meter */
  gen.alltag_kilo = function (r) {
    var v = r.pick([1.5, 2.3, 0.8, 4.2, 12.5, 0.25]);
    var t = umrechnen(v, 'k', '', 'm', 'k_base', 'Alltag: Wie viele Meter sind das?');
    return t;
  };

  /* kΩ → Ω als Auswahl mit typischen Kommafehlern */
  gen.mc_k_base = function (r) {
    var v = r.pick([2.2, 3.3, 4.7, 6.8, 1.5, 5.6]);
    var u = r.pick(['Ω', 'Ω', 'V', 'W']);
    return {
      kind: 'mc', err: 'k_base',
      q: gr(v, 'k', u) + ' entsprechen:',
      options: [
        { t: gr(v * 1000, '', u), ok: true },
        { t: gr(v * 10, '', u), why: 'Das Komma wurde nur um 1 Stelle verschoben. Kilo bedeutet · 1000 – also 3 Stellen.' },
        { t: gr(v * 100, '', u), why: 'Das Komma wurde nur um 2 Stellen verschoben. Kilo bedeutet · 1000 – also 3 Stellen.' },
        { t: gr(v * 10000, '', u), why: 'Das Komma wurde um 4 Stellen verschoben – eine zu viel. Kilo bedeutet · 1000.' }
      ],
      explain: weg(v, 'k', '', u)
    };
  };

  gen.k_base = function (r) {
    var v = r.pick([2.2, 3.6, 4.7, 6.8, 1.5, 0.47, 1.2, 8.2, 10, 2.7]);
    var u = r.pick(['Ω', 'Ω', 'V', 'W', 'Hz']);
    return umrechnen(v, 'k', '', u, 'k_base');
  };
  gen.base_k = function (r) {
    var v = r.pick([4700, 2200, 1500, 6800, 3300, 12000, 470, 820, 1800]);
    var u = r.pick(['Ω', 'Ω', 'V', 'W']);
    return umrechnen(v, '', 'k', u, 'base_k');
  };
  gen.m_base = function (r) {
    var v = r.pick([20, 150, 47, 350, 5, 12, 250, 75]);
    var u = r.pick(['A', 'A', 'V', 'W']);
    return umrechnen(v, 'm', '', u, 'm_base');
  };
  gen.base_m = function (r) {
    var v = r.pick([0.047, 0.02, 0.15, 0.005, 0.35, 0.012, 0.0025, 0.8]);
    var u = r.pick(['A', 'A', 'V']);
    return umrechnen(v, '', 'm', u, 'base_m');
  };

  /* Mega vs. Milli */
  gen.mc_Mm = function (r) {
    var v = r.pick([4.7, 2.2, 1.5, 3.3, 6.8]);
    if (r.next() < 0.5) {
      return {
        kind: 'mc', err: 'mM', q: gr(v, 'M', 'Ω') + ' entsprechen:',
        options: [
          { t: gr(v * 1e6, '', 'Ω'), ok: true },
          { t: gr(v * 0.001, '', 'Ω'), why: 'Das wäre ' + gr(v, 'm', 'Ω') + ' (klein m = Milli). Groß M ist Mega = 1 000 000.' },
          { t: gr(v * 1000, '', 'Ω'), why: 'Das wäre ' + gr(v, 'k', 'Ω') + ' (Kilo). Mega ist eine Stufe größer: · 1 000 000.' },
          { t: gr(v * 1e9, '', 'Ω'), why: 'Das wäre Giga. Mega bedeutet · 1 000 000 (6 Stellen).' }
        ],
        explain: 'Groß <b>M</b> = Mega = 10<sup>6</sup>: ' + gr(v, 'M', 'Ω') + ' = ' + fmt(v) + ' · 1 000 000' + NB + 'Ω = ' + gr(v * 1e6, '', 'Ω') + '.'
      };
    }
    var w = r.pick([20, 50, 150, 300, 15]);
    return {
      kind: 'mc', err: 'mM', q: gr(w, 'm', 'A') + ' entsprechen:',
      options: [
        { t: gr(w * 0.001, '', 'A'), ok: true },
        { t: gr(w * 1e6, '', 'A'), why: 'Das wäre ' + gr(w, 'M', 'A') + ' (groß M = Mega). Klein m ist Milli = ein Tausendstel.' },
        { t: gr(w * 1000, '', 'A'), why: 'Das wäre Kilo. Milli macht den Zahlenwert in der Grundeinheit kleiner: : 1000.' },
        { t: gr(w * 1e-6, '', 'A'), why: 'Das wäre Mikro (µ). Milli bedeutet : 1000 (3 Stellen).' }
      ],
      explain: 'Klein <b>m</b> = Milli = 10<sup>−3</sup>: ' + gr(w, 'm', 'A') + ' = ' + fmt(w) + ' : 1000' + NB + 'A = ' + gr(w * 0.001, '', 'A') + '.'
    };
  };

  /* Vorsatz aus Beschreibung erkennen */
  gen.mc_vorsatz = function (r) {
    var p = r.pick([
      ['fünf Millionstel Ampere', 5, 'µ', 'A', ['m', 'M', 'n']],
      ['drei Tausendstel Volt', 3, 'm', 'V', ['M', 'µ', 'k']],
      ['zwei Milliardstel Farad', 2, 'n', 'F', ['µ', 'p', 'm']],
      ['vier Millionen Ohm', 4, 'M', 'Ω', ['m', 'k', 'G']],
      ['zweieinhalb Milliarden Hertz', 2.5, 'G', 'Hz', ['M', 'T', 'n']],
      ['achtzig Tausendstel Ampere', 80, 'm', 'A', ['µ', 'k', 'M']]
    ]);
    var why = function (z) {
      var v = ET.vs(z);
      return gr(p[1], z, p[3]) + ' bedeutet ' + fmt(p[1]) + ' · ' + pot(v.e) + NB + p[3] + ' (' + v.name + ').';
    };
    return {
      kind: 'mc', err: 'vorsatz',
      q: 'Welche Angabe bedeutet <b>' + p[0] + '</b>?',
      options: [{ t: gr(p[1], p[2], p[3]), ok: true }].concat(p[4].map(function (z) {
        return { t: gr(p[1], z, p[3]), why: why(z) };
      })),
      explain: why(p[2])
    };
  };

  /* Vorsatz ↔ Zehnerpotenz zuordnen */
  gen.match_potenz = function (r) {
    var sel = r.sample(['T', 'G', 'M', 'k', 'm', 'µ', 'n', 'p'], 4);
    var rest = ['T', 'G', 'M', 'k', 'm', 'µ', 'n', 'p'].filter(function (z) { return sel.indexOf(z) < 0; });
    var extra = r.sample(rest, 2);
    function lab(z) { return pot(ET.vs(z).e); }
    return {
      kind: 'match', err: 'potenz',
      q: 'Ordne jedem Vorsatz die Zehnerpotenz zu.',
      rows: sel.map(function (z) { return { l: z + ' (' + ET.vs(z).name + ')', a: lab(z) }; }),
      choices: sel.concat(extra).map(lab),
      explain: 'T = 10<sup>12</sup>, G = 10<sup>9</sup>, M = 10<sup>6</sup>, k = 10<sup>3</sup>, m = 10<sup>−3</sup>, µ = 10<sup>−6</sup>, n = 10<sup>−9</sup>, p = 10<sup>−12</sup>. Jede Stufe: 3 Zehnerpotenzen.'
    };
  };

  /* Stufenleiter: Richtung, Stufen, Rechenart */
  var LEITER_PAARE = [
    ['µ', 'm', 'A'], ['n', 'µ', 'F'], ['M', '', 'Ω'], ['k', '', 'V'], ['m', 'µ', 'A'],
    ['G', 'M', 'Hz'], ['', 'k', 'Ω'], ['p', 'n', 'F'], ['', 'm', 'A'], ['n', 'm', 'F'], ['k', 'm', 'V'], ['M', 'k', 'Hz']
  ];
  gen.leiter = function (r) {
    var p = r.pick(LEITER_PAARE), d = ET.stufen(p[0], p[1]), n = Math.abs(d);
    return {
      kind: 'ladder', err: 'leiter', von: p[0], nach: p[1], u: p[2],
      q: 'Umrechnung <b>' + ein(p[0], p[2]) + ' → ' + ein(p[1], p[2]) + '</b>',
      explain: ein(p[0], p[2]) + ' → ' + ein(p[1], p[2]) + ': ' + stufenWort(n) + ' nach ' +
        (d > 0 ? 'rechts (kleinerer Vorsatz). Der Zahlenwert wird größer: mal ' : 'links (größerer Vorsatz). Der Zahlenwert wird kleiner: durch ') +
        faktor(n) + '.'
    };
  };

  gen.u_m = function (r) {
    if (r.next() < 0.6) return umrechnen(r.pick([470, 2500, 50, 1200, 330, 15]), 'µ', 'm', r.pick(['A', 'A', 'V']), 'u_m');
    return umrechnen(r.pick([0.5, 0.047, 2.2, 0.02, 0.33]), 'm', 'µ', r.pick(['A', 'V']), 'u_m');
  };
  gen.n_u = function (r) {
    if (r.next() < 0.6) return umrechnen(r.pick([2200, 470, 100, 4700, 330, 68000, 10]), 'n', 'µ', 'F', 'n_u');
    return umrechnen(r.pick([0.1, 0.047, 2.2, 0.33, 0.022]), 'µ', 'n', 'F', 'n_u');
  };
  gen.M_base = function (r) {
    if (r.next() < 0.5) return umrechnen(r.pick([4.7, 1, 2.2, 1.5, 10, 0.47]), 'M', '', r.pick(['Ω', 'Ω', 'Hz', 'W']), 'M_base');
    return umrechnen(r.pick([4700000, 2200000, 1500000, 12400000, 330000]), '', 'M', 'Ω', 'M_base');
  };

  /* Mehrere Stufen – Pool A (Lernschritte), Pool B (Papierstation) */
  var MULTI_A = [[3.3, 'M', '', 'Ω'], [470, 'µ', '', 'A'], [0.000047, '', 'µ', 'F'], [4700000, '', 'M', 'Ω'], [2.4, 'G', 'k', 'Hz'], [3300, 'n', 'm', 'A']];
  var MULTI_B = [[1800000, '', 'M', 'Hz'], [0.47, 'µ', 'p', 'F'], [22000, 'n', 'm', 'F'], [6.8, 'M', '', 'Ω'], [0.000033, '', 'µ', 'F'], [0.0056, '', 'µ', 'A']];
  gen.multi = function (r) {
    var p = r.pick(MULTI_A);
    return umrechnen(p[0], p[1], p[2], p[3], 'multi', 'Rechne um (mehrere Stufen).');
  };
  gen.multi_b = function (r) {
    var p = r.pick(MULTI_B);
    return umrechnen(p[0], p[1], p[2], p[3], 'multi', 'Rechne um (mehrere Stufen).');
  };

  /* Technisch sinnvolle Schreibweise */
  var ROH = [[12400000, 'Ω'], [4700, 'Ω'], [0.000003, 'A'], [0.00000047, 'F'], [0.015, 'V'], [2400000000, 'Hz'],
    [330000, 'Ω'], [0.0022, 'A'], [0.000068, 'F'], [0.00000000022, 'F'], [1500, 'W'], [0.00005, 'A']];
  gen.mc_sinnvoll = function (r) {
    var p = r.pick(ROH.slice(0, 6)), x = p[0], u = p[1], e = ET.eng(x);
    var oben = ET.vsByE(e.e + 3), unten = ET.vsByE(e.e - 3);
    var falsch = ET.vsByE(-e.e) && e.e !== 0 ? ET.vsByE(-e.e) : (oben || unten);
    var opts = [{ t: gr(e.m, e.z, u), ok: true }];
    if (oben) opts.push({ t: gr(x / ET.p10(oben.e), oben.z, u), why: 'Der Wert stimmt, aber die Zahl ist kleiner als 1. Mit einem Vorsatz weniger wird es übersichtlicher.' });
    if (unten) opts.push({ t: gr(x / ET.p10(unten.e), unten.z, u), why: 'Der Wert stimmt, aber die Zahl ist größer als 999. Mit dem nächstgrößeren Vorsatz wird es übersichtlicher.' });
    opts.push({ t: gr(e.m, falsch.z, u), why: 'Die Zahl passt, aber der Vorsatz nicht: ' + (falsch.z || 'ohne Vorsatz') + ' bedeutet ' + pot(falsch.e) + ' – das ist ein ganz anderer Wert.' });
    return {
      kind: 'mc', err: 'sinnvoll',
      q: 'Technisch sinnvolle Schreibweise für <b>' + gr(x, '', u) + '</b>:',
      options: opts,
      explain: 'Vorsatz so wählen, dass die Zahl zwischen 1 und 999 liegt: ' + gr(x, '', u) + ' = <b>' + gr(e.m, e.z, u) + '</b>.'
    };
  };
  function engAufgabe(x, u, err, q) {
    var e = ET.eng(x);
    return {
      kind: 'eng', err: err, value: x, u: u,
      q: q || 'Schreibe technisch sinnvoll (Zahl zwischen 1 und 999).',
      pre: gr(x, '', u) + ' =',
      explain: gr(x, '', u) + ' = <b>' + gr(e.m, e.z, u) + '</b> – die Zahl liegt zwischen 1 und 999.',
      sheet: gr(x, '', u) + ' = ' + LUECKE
    };
  }
  gen.eng = function (r) { var p = r.pick(ROH.slice(6)); return engAufgabe(p[0], p[1], 'sinnvoll'); };

  /* Zehnerpotenzen */
  var POT = [[4.7, 'k', 'Ω'], [3, 'µ', 'A'], [470, 'n', 'F'], [2.2, 'M', 'Ω'], [20, 'm', 'A'], [100, 'µ', 'F'], [2.4, 'G', 'Hz'], [15, 'n', 'F'], [330, 'p', 'F'], [12, 'm', 'V']];
  gen.pot_exp = function (r) {
    var p = r.pick(POT), e = ET.vs(p[1]).e;
    return {
      kind: 'num', err: 'potenz', q: 'Ergänze die Hochzahl.',
      fields: [{ pre: gr(p[0], p[1], p[2]) + ' = ' + fmt(p[0]) + ' · 10', sup: true, post: p[2], answer: e }],
      explain: p[1] + ' (' + ET.vs(p[1]).name + ') = ' + pot(e) + ', also ' + gr(p[0], p[1], p[2]) + ' = ' + fmt(p[0]) + ' · ' + pot(e) + NB + p[2] + '.',
      diagnose: function (v) {
        if (v[0] === -e) return 'Das Vorzeichen stimmt nicht: Vorsätze für kleine Werte (m, µ, n, p) haben negative Hochzahlen, große (k, M, G, T) positive.';
        return '';
      }
    };
  };
  gen.mc_pot_rev = function (r) {
    var p = r.pick([[470, -9, 'F'], [3, -6, 'A'], [4.7, 3, 'Ω'], [2.2, 6, 'Ω'], [15, -3, 'A'], [68, -12, 'F'], [1.8, 9, 'Hz']]);
    var richtig = ET.vsByE(p[1]);
    var kand = [-p[1], p[1] + 3, p[1] - 3].filter(function (e, i, a) {
      return e !== 0 && e !== p[1] && ET.vsByE(e) && a.indexOf(e) === i;
    });
    var opts = [{ t: gr(p[0], richtig.z, p[2]), ok: true }];
    kand.forEach(function (e) {
      var v = ET.vsByE(e);
      opts.push({ t: gr(p[0], v.z, p[2]), why: v.z + ' (' + v.name + ') steht für ' + pot(e) + ', nicht für ' + pot(p[1]) + '.' });
    });
    return {
      kind: 'mc', err: 'potenz',
      q: fmt(p[0]) + ' · ' + pot(p[1]) + NB + p[2] + ' = ?',
      options: opts,
      explain: pot(p[1]) + ' gehört zu ' + richtig.z + ' (' + richtig.name + '): ' + fmt(p[0]) + ' · ' + pot(p[1]) + NB + p[2] + ' = <b>' + gr(p[0], richtig.z, p[2]) + '</b>.'
    };
  };

  /* Taschenrechner */
  function kbd(t) { return '<kbd>' + t + '</kbd>'; }
  gen.mc_exp = function (r) {
    var p = r.pick([[4.7, 'k', 'Ω'], [3, 'µ', 'A'], [470, 'n', 'F'], [2.2, 'M', 'Ω'], [15, 'm', 'A'], [100, 'µ', 'F']]);
    var e = ET.vs(p[1]).e, z = String(p[0]).replace('.', ',');
    function folge(zahl, ex, mal10) {
      return zahl.split('').map(kbd).join(' ') + (mal10 ? ' ' + kbd('×') + ' ' + kbd('1') + ' ' + kbd('0') : '') + ' ' + kbd('EXP') + ' ' +
        (ex < 0 ? kbd('(−)') + ' ' : '') + String(Math.abs(ex)).split('').map(kbd).join(' ');
    }
    return {
      kind: 'mc', err: 'exp',
      q: 'Wie gibst du <b>' + gr(p[0], p[1], p[2]) + '</b> (in ' + p[2] + ') am Taschenrechner ein?',
      options: [
        { t: folge(z, e, false), ok: true },
        { t: folge(z, e, true), why: 'Die EXP-Taste bedeutet bereits „· 10 hoch“. Mit dem zusätzlichen „× 10“ wird der Wert 10-mal zu groß.' },
        { t: folge(z, -e, false), why: 'Das Vorzeichen der Hochzahl ist falsch: ' + p[1] + ' = ' + pot(e) + '.' },
        { t: folge(z, e > 0 ? e + 3 : e - 3, false), why: 'Die Hochzahl gehört zu einem anderen Vorsatz. ' + p[1] + ' = ' + pot(e) + '.' }
      ],
      explain: gr(p[0], p[1], p[2]) + ' = ' + fmt(p[0]) + ' · ' + pot(e) + NB + p[2] + ' → Eingabe: ' + folge(z, e, false)
    };
  };
  gen.tr_anzeige = function (r) {
    var p = r.pick([[2.2, -3, 'A', 'm'], [4.7, -5, 'A', 'µ'], [1.5, 4, 'Ω', 'k'], [3.3, -7, 'F', 'n'], [6.8, 5, 'Ω', 'k'], [1.2, -2, 'A', 'm'], [4.7, -4, 'F', 'µ']]);
    var x = p[0] * ET.p10(p[1]), ziel = ET.vs(p[3]), erg = x / ET.p10(ziel.e);
    var anz = String(p[0]).replace('.', ',') + '×10<sup>' + (p[1] < 0 ? '−' : '') + (Math.abs(p[1]) < 10 ? '0' : '') + Math.abs(p[1]) + '</sup>';
    return {
      kind: 'num', err: 'potenz',
      q: 'Der Taschenrechner zeigt als Ergebnis (in ' + p[2] + '):<div class="tr-display">' + anz + '</div>Gib den Wert in ' + ein(p[3], p[2]) + ' an.',
      fields: [{ pre: '', post: ein(p[3], p[2]), answer: erg }],
      explain: fmt(p[0]) + ' · ' + pot(p[1]) + NB + p[2] + ' = ' + gr(x, '', p[2]) + ' = <b>' + gr(erg, p[3], p[2]) + '</b> (' + p[3] + ' = ' + pot(ziel.e) + ').',
      diagnose: function (v) {
        if (ET.gleich(v[0], p[0]) && p[1] !== ziel.e) return 'Die Hochzahl ' + p[1] + ' gehört nicht direkt zu ' + p[3] + ' (' + pot(ziel.e) + '). Du musst das Komma noch verschieben.';
        return '';
      }
    };
  };

  /* Ohmsches Gesetz */
  function ohmU(R, I, err, q) {
    var Rb = basis(R), Ib = basis(I), U = Rb * Ib;
    return {
      kind: 'num', err: err,
      q: q || ('Gegeben: <b>R = ' + gr(R[0], R[1], 'Ω') + '</b>, <b>I = ' + gr(I[0], I[1], 'A') + '</b>. Berechne die Spannung U = R · I.'),
      fields: [{ pre: 'U =', post: 'V', answer: U }],
      explain: 'Erst in Grundeinheiten umrechnen, dann rechnen:<br><b>U = R · I = ' + gr(Rb, '', 'Ω') + ' · ' + gr(Ib, '', 'A') + ' = ' + gr(U, '', 'V') + '</b>',
      diagnose: diagRechnung(U),
      sheet: 'Gegeben: R = ' + gr(R[0], R[1], 'Ω') + ', I = ' + gr(I[0], I[1], 'A') + '. Gesucht: U.'
    };
  }
  gen.ohm_U = function (r) {
    var p = r.pick([[[2.2, 'k'], [5, 'm']], [[4.7, 'k'], [2, 'm']], [[1.5, 'k'], [8, 'm']], [[3.3, 'k'], [3, 'm']],
      [[470, ''], [20, 'm']], [[10, 'k'], [500, 'µ']], [[6.8, 'k'], [0.5, 'm']], [[1, 'M'], [12, 'µ']], [[220, ''], [50, 'm']], [[2.7, 'k'], [4, 'm']]]);
    return ohmU(p[0], p[1], 'ohm');
  };
  gen.ohm_I = function (r) {
    var p = r.pick([[12, [4.8, 'k']], [9, [1.5, 'k']], [5, [250, '']], [24, [1.2, 'k']], [3.3, [2.2, 'k']], [10, [2, 'k']]]);
    var Rb = basis(p[1]), I = p[0] / Rb, ImA = I * 1000;
    return {
      kind: 'num', err: 'ohm',
      q: 'Gegeben: <b>U = ' + gr(p[0], '', 'V') + '</b>, <b>R = ' + gr(p[1][0], p[1][1], 'Ω') + '</b>. Berechne den Strom I = U : R in mA.',
      fields: [{ pre: 'I =', post: 'mA', answer: ImA }],
      explain: 'I = U : R = ' + gr(p[0], '', 'V') + ' : ' + gr(Rb, '', 'Ω') + ' = ' + gr(I, '', 'A') + ' = <b>' + gr(ImA, 'm', 'A') + '</b>',
      diagnose: diagRechnung(ImA)
    };
  };

  /* Zusätzliche Fragen zu Vorsatz und Stufen (für Wiederholungen) */
  gen.frage_potenz = function (r) {
    var e = r.pick([-6, -9, 6, -3, 9]);
    var v = ET.vsByE(e);
    var others = r.sample([-6, -9, 6, -3, 9, 3, -12].filter(function (x) { return x !== e; }), 3);
    return {
      kind: 'mc', err: 'vorsatz',
      q: 'Welcher Vorsatz steht für ' + pot(e) + '?',
      options: [{ t: v.name + ' (' + v.z + ')', ok: true }].concat(others.map(function (x) {
        var w = ET.vsByE(x);
        return { t: w.name + ' (' + w.z + ')', why: w.name + ' steht für ' + pot(x) + '.' };
      })),
      explain: v.name + ' (' + v.z + ') = ' + pot(e) + '.'
    };
  };
  gen.frage_stufen = function (r) {
    var p = r.pick([['k', 'm'], ['M', 'm'], ['m', 'n'], ['G', 'k'], ['M', 'µ']]);
    var n = Math.abs(ET.stufen(p[0], p[1]));
    var reihe = ET.VORSAETZE.map(function (v) { return v.z || 'Einheit'; });
    var i0 = reihe.indexOf(p[0] || 'Einheit'), i1 = reihe.indexOf(p[1] || 'Einheit');
    var pfad = reihe.slice(Math.min(i0, i1), Math.max(i0, i1) + 1);
    if (i0 > i1) pfad.reverse();
    var zaehl = 'Zähle die Schritte: ' + pfad.join(' → ') + ' = ' + stufenWort(n) + '.';
    return {
      kind: 'mc', err: 'leiter',
      q: 'Wie weit liegen <b>' + p[0] + '</b> und <b>' + p[1] + '</b> auseinander?',
      options: [
        { t: stufenWort(n) + ' → Faktor ' + faktor(n), ok: true },
        { t: stufenWort(n) + ' → Faktor ' + fmt(1000 * n), why: 'Die Faktoren werden multipliziert, nicht addiert: 1000 · 1000 = 1 000 000.' },
        { t: stufenWort(n - 1 || n + 1) + ' → Faktor ' + faktor(n - 1 || n + 1), why: zaehl + (pfad.indexOf('Einheit') > 0 ? ' Die Einheit ohne Vorsatz zählt als eigene Stufe.' : '') },
        { t: stufenWort(n + 1 === (n - 1 || n + 1) ? n + 2 : n + 1) + ' → Faktor ' + faktor(n + 1 === (n - 1 || n + 1) ? n + 2 : n + 1), why: zaehl }
      ],
      explain: zaehl + ' Faktor ' + faktor(n) + '.'
    };
  };

  /* ---------- Papierstationen ---------- */
  gen.p_einfach = function (r) {
    var v = r.pick([0.047, 0.025, 0.33, 0.012, 0.18, 0.068, 0.0047]);
    var u = v === 0.0047 ? 'V' : 'A';
    var t = umrechnen(v, '', 'm', u, 'base_m', 'Rechne vollständig um – mit Rechenweg auf dem Blatt.');
    return t;
  };
  gen.p_leiter = function (r) {
    var z = r.pick(['µ', 'n', 'M', 'G', 'p', 'T', 'm']);
    var pa = r.pick([['M', 'm'], ['k', 'µ'], ['G', 'm'], ['m', 'n'], ['T', 'M'], ['k', 'n'], ['M', 'µ']]);
    var v = ET.vs(z), n = Math.abs(ET.stufen(pa[0], pa[1]));
    var kopf = ET.VORSAETZE.map(function (x) { return x.e === 0 ? '<td class="fix">Einheit</td>' : '<td></td>'; }).join('');
    var pz = ET.VORSAETZE.map(function (x) { return x.e === 0 ? '<td class="fix">10<sup>0</sup></td>' : '<td></td>'; }).join('');
    return {
      kind: 'num', err: 'leiter',
      q: 'Vervollständige die Vorsatzleiter auf dem Blatt (Zeichen und Zehnerpotenz). Beantworte dann:',
      fields: [
        { pre: 'Zehnerpotenz von ' + v.name + ' (' + v.z + '): 10', sup: true, post: '', answer: v.e },
        { pre: 'Von ' + pa[0] + ' nach ' + pa[1] + ' sind es', post: 'Stufen', answer: n }
      ],
      explain: v.name + ' (' + v.z + ') = ' + pot(v.e) + '. Von ' + pa[0] + ' nach ' + pa[1] + ': ' + stufenWort(n) + ' (Faktor ' + faktor(n) + ').',
      sheet: '<table class="leiter-blatt"><tr><th>Zeichen</th>' + kopf + '</tr><tr><th>Potenz</th>' + pz + '</tr></table>' +
        '<div>a) Zehnerpotenz von ' + v.name + ' (' + v.z + '): ' + LUECKE + ' &nbsp; b) Von ' + pa[0] + ' nach ' + pa[1] + ': ' + LUECKE + ' Stufen</div>'
    };
  };
  gen.p_multi = gen.multi_b;

  /* Papierstation „Verbinden“: gleiche Werte auf dem Blatt mit Linien verbinden */
  var VERBINDEN = [[0.047, '', 'm', 'A'], [3300000, '', 'M', 'Ω'], [0.00022, '', 'µ', 'F'], [2500, 'm', '', 'V'],
    [4700, 'n', 'µ', 'F'], [0.33, 'm', 'µ', 'A'], [1800, 'k', 'M', 'Hz'], [0.000015, '', 'µ', 'A'],
    [470000, 'p', 'µ', 'F'], [0.0068, 'M', 'k', 'Ω']];
  gen.p_verbinden = function (r) {
    var rows = r.sample(VERBINDEN, 4).map(function (p) {
      var erg = p[0] * ET.p10(3 * ET.stufen(p[1], p[2]));
      return { l: gr(p[0], p[1], p[3]), a: gr(erg, p[2], p[3]), p: p, erg: erg };
    });
    var richtige = rows.map(function (x) { return x.a; }), falsch = [];
    /* Ablenker: richtige Zahl, aber eine Stufe daneben (typischer Fehler) */
    rows.forEach(function (x) {
      var e = ET.vs(x.p[2]).e, nb = ET.vsByE(e + (r.next() < 0.5 ? 3 : -3)) || ET.vsByE(e - 3);
      var t = gr(x.erg, nb.z, x.p[3]);
      if (richtige.indexOf(t) < 0 && falsch.indexOf(t) < 0) falsch.push(t);
    });
    falsch = r.sample(falsch, 2);
    return {
      kind: 'match', err: 'multi', verbinden: true,
      q: 'Verbinde auf deinem Blatt gleiche Werte mit Linien – zwei Werte rechts bleiben übrig. Übertrage dann deine Verbindungen hierher.',
      rows: rows.map(function (x) { return { l: x.l, a: x.a }; }),
      choices: richtige.concat(falsch),
      explain: rows.map(function (x) { return x.l + ' = ' + x.a; }).join(' · ')
    };
  };
  gen.p_potenz = function (r) {
    var p = r.pick([[470, 'µ', 'F'], [2.2, 'k', 'Ω'], [33, 'n', 'F'], [4.7, 'M', 'Ω'], [15, 'm', 'A'], [680, 'p', 'F'], [2.4, 'G', 'Hz'], [12, 'µ', 'A']]);
    var e = ET.vs(p[1]).e, x = p[0] * ET.p10(e);
    return {
      kind: 'num', err: 'potenz',
      q: 'Schreibe <b>' + gr(p[0], p[1], p[2]) + '</b> in Zehnerpotenzschreibweise in der Grundeinheit ' + p[2] + '. Notiere auf dem Blatt auch die Tastenfolge für den Taschenrechner (EXP).',
      fields: [
        { pre: gr(p[0], p[1], p[2]) + ' =', post: '·', answer: p[0], w: 'mittel' },
        { pre: '10', sup: true, post: p[2], answer: e, inline: true }
      ],
      check: function (v) { return ET.gleich(v[0] * ET.p10(v[1]), x); },
      explain: p[1] + ' = ' + pot(e) + ' → <b>' + gr(p[0], p[1], p[2]) + ' = ' + fmt(p[0]) + ' · ' + pot(e) + NB + p[2] + '</b>. Tastenfolge: ' +
        String(p[0]).replace('.', ',').split('').map(kbd).join(' ') + ' ' + kbd('EXP') + ' ' + (e < 0 ? kbd('(−)') + ' ' : '') + String(Math.abs(e)).split('').map(kbd).join(' '),
      diagnose: function (v) {
        if (ET.gleich(v[0] * ET.p10(-v[1]), x)) return 'Das Vorzeichen der Hochzahl ist falsch.';
        return '';
      },
      sheet: gr(p[0], p[1], p[2]) + ' = ' + LUECKE + ' · 10<sup>' + '<span class="luecke kurz"></span></sup>' + NB + p[2] + ' &nbsp; Tastenfolge: <span class="luecke lang"></span>'
    };
  };
  gen.p_ohm = function (r) {
    var p = r.pick([[[3.3, 'k'], [4, 'm']], [[5.6, 'k'], [2, 'm']], [[1.2, 'k'], [15, 'm']], [[680, ''], [25, 'm']],
      [[4.7, 'k'], [3, 'm']], [[22, 'k'], [500, 'µ']], [[8.2, 'k'], [1.5, 'm']], [[1.8, 'k'], [5, 'm']]]);
    var t = ohmU(p[0], p[1], 'ohm');
    t.q = 'Berechne auf dem Blatt in drei Schritten: 1. in Grundeinheiten umrechnen, 2. U = R · I rechnen, 3. Ergebnis mit Einheit.<br>' +
      'Gegeben: <b>R = ' + gr(p[0][0], p[0][1], 'Ω') + '</b>, <b>I = ' + gr(p[1][0], p[1][1], 'A') + '</b>.';
    t.sheet = 'Gegeben: R = ' + gr(p[0][0], p[0][1], 'Ω') + ', I = ' + gr(p[1][0], p[1][1], 'A') + '. Gesucht: U (in V).';
    return t;
  };
  gen.p_abschluss = function (r) {
    var p = r.pick([[3, [20, 'm']], [9, [15, 'm']], [12, [25, 'm']], [7.2, [20, 'm']], [10, [2, 'm']],
      [4.5, [300, 'µ']], [6, [1.2, 'm']], [3.3, [10, 'm']], [24, [12, 'm']]]);
    var Ib = basis(p[1]), R = p[0] / Ib, e = ET.eng(R);
    var t = engAufgabe(R, 'Ω', 'ohm');
    t.q = 'Vorwiderstand einer LED: Am Widerstand liegen <b>U = ' + gr(p[0], '', 'V') + '</b>, es fließt <b>I = ' + gr(p[1][0], p[1][1], 'A') +
      '</b>. Berechne R = U : I und gib das Ergebnis technisch sinnvoll an.';
    t.pre = 'R =';
    t.explain = 'R = U : I = ' + gr(p[0], '', 'V') + ' : ' + gr(Ib, '', 'A') + ' = ' + gr(R, '', 'Ω') + ' = <b>' + gr(e.m, e.z, 'Ω') + '</b>';
    t.sheet = 'Gegeben: U = ' + gr(p[0], '', 'V') + ', I = ' + gr(p[1][0], p[1][1], 'A') + '. Gesucht: R – technisch sinnvoll angegeben.';
    t.diagnose = function (x) {
      var k = Math.round(Math.log10(x / R));
      if (x > 0 && k !== 0 && ET.gleich(x / R, ET.p10(k)) && Math.abs(k) === 3) return 'Der Wert weicht um den Faktor 1000 ab: Rechne den Strom zuerst in A um.';
      return '';
    };
    return t;
  };

  /* ---------- Fehlertypen (adaptive Wiederholung) ---------- */
  var fehler = {
    k_base: { label: 'k → Einheit (z. B. kΩ → Ω)', gen: ['k_base', 'mc_k_base'], tipp: 'Von k zur Einheit: 1 Stufe zum kleineren Vorsatz → mal 1000.' },
    base_k: { label: 'Einheit → k (z. B. Ω → kΩ)', gen: ['base_k'], tipp: 'Von der Einheit zu k: 1 Stufe zum größeren Vorsatz → durch 1000.' },
    m_base: { label: 'm → Einheit (z. B. mA → A)', gen: ['m_base'], tipp: 'Von m zur Einheit: 1 Stufe zum größeren Vorsatz → durch 1000.' },
    base_m: { label: 'Einheit → m (z. B. A → mA)', gen: ['base_m'], tipp: 'Von der Einheit zu m: 1 Stufe zum kleineren Vorsatz → mal 1000.' },
    u_m: { label: 'µA ↔ mA', gen: ['u_m'], tipp: 'µ und m liegen 1 Stufe auseinander: Faktor 1000.' },
    n_u: { label: 'nF ↔ µF', gen: ['n_u'], tipp: 'n und µ liegen 1 Stufe auseinander: Faktor 1000.' },
    M_base: { label: 'MΩ ↔ Ω', gen: ['M_base'], tipp: 'M und Einheit liegen 2 Stufen auseinander: Faktor 1 000 000.' },
    multi: { label: 'Umrechnen über mehrere Stufen', gen: ['multi', 'multi_b'], tipp: 'Stufen zählen, je Stufe Faktor 1000 bzw. 3 Kommastellen.' },
    mM: { label: 'M (Mega) und m (Milli) unterscheiden', gen: ['mc_Mm'], tipp: 'Groß M = Mega = 10⁶, klein m = Milli = 10⁻³.' },
    vorsatz: { label: 'Einheitenvorsatz erkennen', gen: ['mc_vorsatz', 'frage_potenz', 'alltag_milli'], tipp: 'Leiter: T G M k – m µ n p, jede Stufe Faktor 1000.' },
    leiter: { label: 'Richtung und Stufen auf der Leiter', gen: ['leiter', 'frage_stufen'], tipp: 'Nach rechts (kleinerer Vorsatz): Zahl wird größer. Nach links: Zahl wird kleiner.' },
    sinnvoll: { label: 'passenden Einheitenvorsatz wählen', gen: ['mc_sinnvoll', 'eng'], tipp: 'Vorsatz so wählen, dass die Zahl zwischen 1 und 999 liegt.' },
    potenz: { label: 'Zehnerpotenz erkennen', gen: ['pot_exp', 'mc_pot_rev', 'tr_anzeige'], tipp: 'k = 10³, M = 10⁶, m = 10⁻³, µ = 10⁻⁶, n = 10⁻⁹.' },
    exp: { label: 'EXP-Taste am Taschenrechner', gen: ['mc_exp'], tipp: 'EXP bedeutet „· 10 hoch“ – kein zusätzliches × 10 eintippen.' },
    ohm: { label: 'Einheiten im Ohmschen Gesetz (U = R · I)', gen: ['ohm_U'], tipp: 'Erst alle Größen in V, A, Ω umrechnen, dann rechnen.' },
  };

  /* ---------- Papierstationen (gleiche Aufgabe auf Blatt und Bildschirm) ---------- */
  var papier = [
    { id: 'P1', nr: 1, titel: 'Einfache Umrechnung', gen: 'p_einfach', platz: 18 },
    { id: 'P2', nr: 2, titel: 'Vorsatzleiter', gen: 'p_leiter', platz: 0 },
    { id: 'P3', nr: 3, titel: 'Gleiche Werte verbinden', gen: 'p_verbinden', platz: 0 },
    { id: 'P4', nr: 4, titel: 'Zehnerpotenz und Taschenrechner', gen: 'p_potenz', platz: 14 },
    { id: 'P5', nr: 5, titel: 'Abschlussaufgabe: U = R · I', gen: 'p_ohm', platz: 26 }
  ];

  /* ---------- Lernschritte (7, davon 5 mit Papierstation) ---------- */
  var schritte = [
    {
      id: 'kilo-milli', titel: 'Warum Vorsätze? Kilo und Milli', min: 4,
      html: '<p>In Datenblättern stehen oft Werte wie <b>0,000003' + NB + 'A</b> oder <b>4' + ' ' + '700' + ' ' + '000' + NB + 'Ω</b> – schwer zu lesen. ' +
        'Einheitenvorsätze machen daraus <b>3' + NB + 'µA</b> und <b>4,7' + NB + 'MΩ</b>.</p>' +
        '<div class="leiter" data-nur="k,,m"></div>' +
        '<table class="tab"><tr><td><b>k</b> = Kilo</td><td>· 1000</td><td>1' + NB + 'km = 1000' + NB + 'm</td></tr>' +
        '<tr><td><b>m</b> = Milli</td><td>: 1000</td><td>1' + NB + 'mm = 0,001' + NB + 'm</td></tr></table>' +
        '<div class="merke"><b>Merke:</b> Zwischen zwei Stufen liegt immer der Faktor <b>1000</b> – das Komma wandert um <b>3 Stellen</b>.</div>' +
        '<div class="bsp">2,2' + NB + 'kΩ = 2,2 · 1000' + NB + 'Ω = 2200' + NB + 'Ω</div>',
      tasks: ['einstieg', 'mc_k_base']
    },
    {
      id: 'et-k-m', titel: 'Kilo und Milli in der Elektrotechnik', min: 5, papier: 'P1',
      html: '<table class="tab"><tr><td>4,7' + NB + 'kΩ</td><td>= 4700' + NB + 'Ω</td><td class="klein">Vorwiderstand</td></tr>' +
        '<tr><td>230' + NB + 'kV</td><td>= 230' + ' ' + '000' + NB + 'V</td><td class="klein">Hochspannungsleitung</td></tr>' +
        '<tr><td>20' + NB + 'mA</td><td>= 0,020' + NB + 'A</td><td class="klein">LED-Strom</td></tr>' +
        '<tr><td>12' + NB + 'mV</td><td>= 0,012' + NB + 'V</td><td class="klein">Messsignal</td></tr></table>' +
        '<div class="merke">Zum <b>größeren</b> Vorsatz (z. B. Ω → kΩ): Zahl wird <b>kleiner</b>, Komma nach links.<br>' +
        'Zum <b>kleineren</b> Vorsatz (z. B. A → mA): Zahl wird <b>größer</b>, Komma nach rechts.</div>',
      tasks: ['base_k', 'm_base']
    },
    {
      id: 'leiter', titel: 'Mega, Mikro, Nano – die Stufenleiter', min: 5, papier: 'P2',
      html: '<p>Für sehr große und sehr kleine Werte gibt es weitere Stufen – wieder jeweils Faktor 1000:</p>' +
        '<div class="leiter" data-pfeile="1"></div>' +
        '<table class="tab"><tr><td>1' + NB + 'MΩ = 1' + ' ' + '000' + ' ' + '000' + NB + 'Ω</td><td class="klein">Isolationsmessung</td></tr>' +
        '<tr><td>5' + NB + 'µA = 0,000005' + NB + 'A</td><td class="klein">Ruhestrom Mikrocontroller</td></tr>' +
        '<tr><td>10' + NB + 'nF = 0,00000001' + NB + 'F</td><td class="klein">Keramikkondensator</td></tr></table>' +
        '<div class="merke"><b>Nach rechts</b> (kleinerer Vorsatz): Zahl wird größer → <b>mal 1000</b> je Stufe.<br>' +
        '<b>Nach links</b> (größerer Vorsatz): Zahl wird kleiner → <b>durch 1000</b> je Stufe.</div>' +
        '<div class="warn"><b>Achtung Groß/Klein:</b> <b>M</b> = Mega = Million · <b>m</b> = Milli = Tausendstel.</div>',
      tasks: ['mc_Mm', 'leiter']
    },
    {
      id: 'stufenweise', titel: 'Stufenweise umrechnen', min: 5, papier: 'P3',
      html: '<p>Gehe Stufe für Stufe – bei jedem Schritt Komma um 3 Stellen:</p>' +
        '<div class="bsp">5' + NB + 'µA = 0,005' + NB + 'mA = 0,000005' + NB + 'A<br>2200' + NB + 'nF = 2,2' + NB + 'µF</div>' +
        '<p>Bei mehreren Stufen werden die Faktoren <b>multipliziert</b>: 2 Stufen = 1000 · 1000 = 1' + ' ' + '000' + ' ' + '000 → Komma 6 Stellen.</p>',
      tasks: ['u_m', 'n_u']
    },
    {
      id: 'schreibweise', titel: 'Sinnvolle Schreibweise und Zehnerpotenz', min: 5, papier: 'P4',
      html: '<div class="merke"><b>Technikerregel:</b> Vorsatz so wählen, dass die Zahl zwischen <b>1 und 999</b> liegt: ' +
        '4700' + NB + 'Ω → 4,7' + NB + 'kΩ, 0,000003' + NB + 'A → 3' + NB + 'µA.</div>' +
        '<p>Jeder Vorsatz steht für eine Zehnerpotenz:</p>' +
        '<div class="bsp">4,7' + NB + 'kΩ = 4,7 · 10<sup>3</sup>' + NB + 'Ω<br>3' + NB + 'µA = 3 · 10<sup>−6</sup>' + NB + 'A</div>' +
        '<p>Am Taschenrechner bedeutet <kbd>EXP</kbd> (oder <kbd>×10<sup>x</sup></kbd>) „· 10 hoch“: ' +
        '3' + NB + 'µA → <kbd>3</kbd> <kbd>EXP</kbd> <kbd>(−)</kbd> <kbd>6</kbd>. ' +
        '<kbd>ENG</kbd> zeigt Ergebnisse mit Hochzahlen 3, 6, −3, −6 … – passend zu den Vorsätzen.</p>',
      tasks: ['eng', 'mc_exp']
    },
    {
      id: 'ohm', titel: 'Vorsätze im Ohmschen Gesetz: U = R · I', min: 6, papier: 'P5',
      html: '<div class="merke"><b>Sicherer Weg:</b> Erst R und I in Grundeinheiten (Ω, A) umrechnen, dann U = R · I rechnen.</div>' +
        '<div class="bsp">R = 2,2' + NB + 'kΩ, I = 5' + NB + 'mA<br>U = R · I = 2200' + NB + 'Ω · 0,005' + NB + 'A = <b>11' + NB + 'V</b></div>' +
        '<p class="klein">Profi-Tipp: kΩ · mA ergibt direkt V, weil sich 10<sup>3</sup> und 10<sup>−3</sup> aufheben.</p>',
      tasks: ['ohm_U', 'ohm_U']
    },
    { id: 'check', check: true, titel: 'Kompetenzcheck', min: 6 }
  ];

  ET.registerKurs({
    id: 'ev',
    titel: 'Einheitenvorsätze in der Elektrotechnik',
    kurztitel: 'Einheitenvorsätze',
    autor: 'm.breyer',
    schritte: schritte,
    papier: papier,
    fehler: fehler,
    maxWiederholungen: 3,   /* höchstens 3 Wiederholungsaufgaben je Fehlertyp */
    gen: gen,
    check: {
      voll: ['mc_vorsatz', 'mc_Mm', 'k_base', 'base_m', 'u_m', 'n_u', 'multi', 'eng', 'pot_exp', 'ohm_U'],
      kurzAnzahl: 5,
      grenze: 80
    },
    lernziele: [
      'wichtige Einheitenvorsätze und ihre Zehnerpotenzen kennen',
      'zwischen Vorsätzen umrechnen – auch über mehrere Stufen',
      'technisch sinnvoll schreiben (Zahl zwischen 1 und 999)',
      'EXP am Taschenrechner nutzen',
      'Vorsätze in U = R · I richtig behandeln'
    ]
  });
})();
