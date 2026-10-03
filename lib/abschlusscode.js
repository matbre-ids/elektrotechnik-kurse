/* Abschlusscode im Format XXXX-XXXX (8 Zeichen aus 32 → 40 Bit).

   Inhalt (35 Bit Nutzdaten + 5 Bit Prüfsumme):
     Blatt-ID              10 Bit  (1–1023)
     erster Check          4 Bit   (Zehnerstufe 0–10 → 0–100 %)
     letzter Check         2 Bit   (0 = 80 %, 1 = 90 %, 2 = 100 %)
     Wiederholungen        5 Bit   (0–31, darüber 31)
     Zufallsanteil         14 Bit  (0–9999, erzeugt mit crypto.getRandomValues)
     Prüfsumme             5 Bit   (abhängig von Kurs und Nutzdaten)

   Die 40 Bit werden kursabhängig umkehrbar verwürfelt, damit ähnliche Leistungen
   nicht zu ähnlichen Codes führen. Keine Verschlüsselung im kryptografischen Sinn –
   es geht um Plausibilität und Zuordnung zum Arbeitsblatt. */
(function (g) {
  'use strict';
  var ET = g.ET;
  var A = ET.ALPHABET;
  var M = 1n << 40n, MASK = M - 1n;
  var K1 = 0x9E3779B97Fn | 1n, K2 = 0xC2B2AE3D29n | 1n;

  function inv(a) { /* Inverses modulo 2^40 (Newton-Verfahren) */
    var x = a;
    for (var i = 0; i < 6; i++) x = (x * ((2n + M - (a * x) % M) % M)) % M;
    return x;
  }
  var K1i = inv(K1), K2i = inv(K2);

  function salt(kursId) {
    return ((BigInt(ET.hash('salz1:' + kursId)) << 8n) ^ BigInt(ET.hash('salz2:' + kursId))) & MASK;
  }
  function pruef(kursId, data) { return ET.hash('pruef:' + kursId + ':' + data.toString()) & 31; }

  function mix(x, s) {
    x = (x * K1) & MASK;
    x ^= x >> 21n;
    x = (x * K2) & MASK;
    return x ^ s;
  }
  function unmix(x, s) {
    x ^= s;
    x = (x * K2i) & MASK;
    x ^= x >> 21n;
    return (x * K1i) & MASK;
  }

  function encode(kursId, o) {
    var id = o.id | 0;
    if (id < 1 || id > 1023) throw new Error('Blatt-ID außerhalb 1–1023');
    var first = Math.max(0, Math.min(10, Math.floor(o.erster / 10)));
    var last = Math.max(0, Math.min(2, Math.floor(o.letzter / 10) - 8));
    var reps = Math.max(0, Math.min(31, o.wiederholungen | 0));
    var rnd = o.zufall == null ? ET.cryptoInt(10000) : o.zufall;
    var data = BigInt(id);
    data = data * 16n + BigInt(first);
    data = data * 4n + BigInt(last);
    data = data * 32n + BigInt(reps);
    data = data * 16384n + BigInt(rnd);
    var x = mix((data << 5n) | BigInt(pruef(kursId, data)), salt(kursId));
    var s = '';
    for (var i = 0; i < 8; i++) { s = A[Number(x & 31n)] + s; x >>= 5n; }
    return s.slice(0, 4) + '-' + s.slice(4);
  }

  function normalize(code) { return String(code || '').toUpperCase().replace(/[\s\-–_.]/g, ''); }

  function decode(kursId, code) {
    var s = normalize(code);
    if (s.length !== 8) return { ok: false, grund: 'Der Code muss genau 8 Zeichen haben (Format XXXX-XXXX).' };
    var x = 0n;
    for (var i = 0; i < 8; i++) {
      var k = A.indexOf(s.charAt(i));
      if (k < 0) {
        return { ok: false, grund: 'Unzulässiges Zeichen „' + s.charAt(i) + '“. Die Zeichen 0, O, 1, I kommen in Abschlusscodes nicht vor.' };
      }
      x = (x << 5n) | BigInt(k);
    }
    x = unmix(x, salt(kursId));
    var ck = Number(x & 31n), data = x >> 5n;
    if (ck !== pruef(kursId, data)) return { ok: false, grund: 'Prüfsumme stimmt nicht – Code falsch abgeschrieben oder nicht zu diesem Kurs gehörig.' };
    var rnd = Number(data % 16384n); data /= 16384n;
    var reps = Number(data % 32n); data /= 32n;
    var last = Number(data % 4n); data /= 4n;
    var first = Number(data % 16n); data /= 16n;
    var id = Number(data);
    if (id < 1 || first > 10 || last > 2 || rnd > 9999) {
      return { ok: false, grund: 'Code enthält unmögliche Werte – vermutlich falsch abgeschrieben.' };
    }
    return {
      ok: true, kurs: kursId, id: id,
      erster: first * 10, letzter: (last + 8) * 10,
      wiederholungen: reps, zufall: rnd, code: s.slice(0, 4) + '-' + s.slice(4)
    };
  }

  /* Probiert alle registrierten Kurse durch */
  function decodeAny(code) {
    var ids = Object.keys(ET.KURSE), firstErr = null;
    for (var i = 0; i < ids.length; i++) {
      var r = decode(ids[i], code);
      if (r.ok) return r;
      if (!firstErr) firstErr = r;
    }
    return firstErr || { ok: false, grund: 'Kein Kurs registriert.' };
  }

  ET.Abschlusscode = { encode: encode, decode: decode, decodeAny: decodeAny, normalize: normalize };
})(window);
