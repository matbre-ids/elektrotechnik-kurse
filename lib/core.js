/* Gemeinsame Grundfunktionen der Lernplattform:
   Kursregister, Zufall mit Seed, Zahlenformat, Eingabe-Parser, Einheitenvorsätze.
   Wird von index.html (Schülerkurs), lehrer.html und pruefen.html geladen. */
(function (g) {
  'use strict';
  var ET = g.ET = g.ET || {};

  /* ---------- Kursregister ---------- */
  ET.KURSE = ET.KURSE || {};
  ET.registerKurs = function (kurs) { ET.KURSE[kurs.id] = kurs; };

  /* Zeichenvorrat für Seeds und Abschlusscodes: ohne 0/O, 1/I/l (32 Zeichen) */
  ET.ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  /* ---------- Zufall ---------- */
  /* Reproduzierbarer Hash eines Textes (32 Bit) */
  ET.hash = function (str) {
    str = String(str);
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ (h2 >>> 1)) >>> 0;
  };

  /* Pseudozufall mit Seed (mulberry32) – gleiche Seeds liefern gleiche Aufgaben */
  ET.rng = function (seedStr) {
    var a = ET.hash(seedStr);
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var r = {
      next: next,
      int: function (n) { return Math.floor(next() * n); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      shuffle: function (arr) {
        var b = arr.slice();
        for (var i = b.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1)), t = b[i];
          b[i] = b[j]; b[j] = t;
        }
        return b;
      },
      sample: function (arr, n) { return r.shuffle(arr).slice(0, n); }
    };
    return r;
  };

  /* Echter Zufall (crypto) – für Seeds und Zufallsanteil des Abschlusscodes */
  ET.cryptoInt = function (n) {
    var buf = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do { g.crypto.getRandomValues(buf); } while (buf[0] >= lim);
    return buf[0] % n;
  };
  ET.cryptoCode = function (len) {
    var b = new Uint8Array(len), s = '';
    g.crypto.getRandomValues(b);
    for (var i = 0; i < len; i++) s += ET.ALPHABET[b[i] & 31];
    return s;
  };

  /* ---------- Einheitenvorsätze ---------- */
  ET.VORSAETZE = [
    { z: 'T', name: 'Tera', e: 12 },
    { z: 'G', name: 'Giga', e: 9 },
    { z: 'M', name: 'Mega', e: 6 },
    { z: 'k', name: 'Kilo', e: 3 },
    { z: '', name: 'Einheit', e: 0 },
    { z: 'm', name: 'Milli', e: -3 },
    { z: 'µ', name: 'Mikro', e: -6 },
    { z: 'n', name: 'Nano', e: -9 },
    { z: 'p', name: 'Piko', e: -12 }
  ];
  ET.vs = function (z) {
    for (var i = 0; i < ET.VORSAETZE.length; i++) if (ET.VORSAETZE[i].z === z) return ET.VORSAETZE[i];
    throw new Error('Unbekannter Vorsatz: ' + z);
  };
  ET.vsByE = function (e) {
    for (var i = 0; i < ET.VORSAETZE.length; i++) if (ET.VORSAETZE[i].e === e) return ET.VORSAETZE[i];
    return null;
  };
  /* Stufen zwischen zwei Vorsätzen: positiv = Richtung kleinerer Vorsatz (Zahl wird größer) */
  ET.stufen = function (von, nach) { return (ET.vs(von).e - ET.vs(nach).e) / 3; };

  /* ---------- Zahlen ---------- */
  ET.p10 = function (e) { return Number('1e' + e); };

  /* Rundet auf 12 gültige Stellen und liefert eine Dezimalzahl ohne Exponent ("0.00047") */
  ET.plain = function (x) {
    x = Number(x);
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    var s = x.toPrecision(12), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var parts = s.split('e'), exp = parts[1] ? parseInt(parts[1], 10) : 0;
    var mp = parts[0].split('.');
    var digits = mp[0] + (mp[1] || ''), point = mp[0].length + exp;
    if (point <= 0) { digits = new Array(-point + 2).join('0') + digits; point = 1; }
    if (point > digits.length) digits += new Array(point - digits.length + 1).join('0');
    var ip = digits.slice(0, point).replace(/^0+(?=\d)/, ''), fp = digits.slice(point).replace(/0+$/, '');
    return (neg ? '-' : '') + ip + (fp ? '.' + fp : '');
  };

  /* Deutsches Zahlenformat: Dezimalkomma, Tausendergruppen ab 5 Stellen (schmales Leerzeichen) */
  ET.fmt = function (x) {
    var s = ET.plain(x), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var p = s.split('.'), ip = p[0];
    if (ip.length > 4) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + ip + (p[1] ? ',' + p[1] : '');
  };

  /* Größe mit Vorsatz und Einheit: "4,7 kΩ" (geschütztes Leerzeichen) */
  ET.gr = function (x, z, u) { return ET.fmt(x) + ' ' + (z || '') + (u || ''); };

  /* Zehnerpotenz als HTML: 10⁻⁶ */
  ET.pot = function (e) { return '10<sup>' + (e < 0 ? '−' + (-e) : e) + '</sup>'; };

  /* Eingabe lesen: akzeptiert Komma oder Punkt, Leerzeichen als Tausendertrenner.
     Liefert { wert } oder { fehler: 'leer' | 'tausenderpunkt' | 'ungueltig' } */
  ET.parseNum = function (str) {
    var s = String(str == null ? '' : str).trim()
      .replace(/[\s  ']/g, '').replace(/[−–]/g, '-');
    if (!s) return { fehler: 'leer' };
    if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) return { fehler: 'tausenderpunkt' };
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return { fehler: 'ungueltig' };
    return { wert: parseFloat(s) };
  };

  ET.gleich = function (a, b) {
    if (a === b) return true;
    var m = Math.max(Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= 1e-9 * m;
  };

  /* Technisch sinnvolle Darstellung: Zahl zwischen 1 und 999 */
  ET.eng = function (x) {
    for (var i = 0; i < ET.VORSAETZE.length; i++) {
      var v = ET.VORSAETZE[i], m = Number(ET.plain(x / ET.p10(v.e)));
      if (Math.abs(m) >= 1 - 1e-12 && Math.abs(m) < 1000) return { m: m, z: v.z, e: v.e };
    }
    return { m: x, z: '', e: 0 };
  };

  /* ---------- Kleinkram ---------- */
  ET.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  ET.pad3 = function (n) { n = String(n); while (n.length < 3) n = '0' + n; return n; };

  /* Aufgabe aus einem Generator des Kurses erzeugen (reproduzierbar über seedStr) */
  ET.makeTask = function (kurs, genName, seedStr) {
    var gen = kurs.gen[genName];
    if (!gen) throw new Error('Unbekannter Aufgabengenerator: ' + genName);
    var r = ET.rng(seedStr);
    var t = gen(r);
    t.gen = genName;
    t.key = seedStr;
    if (t.kind === 'mc') t.options = r.shuffle(t.options);
    if (t.kind === 'match') t.choices = r.shuffle(t.choices);
    /* Signatur: erkennt „dieselbe Aufgabe“ (für Wiederholungen mit anderen Zahlen) */
    t.sig = genName + '|' + (t.sig || t.q + '|' + JSON.stringify([
      (t.fields || []).map(function (f) { return f.pre + f.answer; }), t.value,
      (t.rows || []).map(function (x) { return x.l; }).sort(), t.von, t.nach
    ]));
    return t;
  };

  /* Papierstation: Aufgabe hängt nur von Kurs, Seed und Station ab (Blatt = Bildschirm) */
  ET.paperTask = function (kurs, seed, station) {
    return ET.makeTask(kurs, station.gen, [kurs.id, seed, station.id].join('|'));
  };

  /* Adresse des Schülerkurses für ein Blatt (nur neutrale Daten, keine Namen) */
  ET.kursUrl = function (basis, kurs, id, seed) {
    return basis + '?k=' + encodeURIComponent(kurs.id) + '&id=' + ET.pad3(id) + '&seed=' + seed;
  };
})(window);
