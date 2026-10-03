/* QR-Code-Erzeugung (Byte-Modus, Version 1–40, Fehlerkorrektur L/M/Q/H).
   Eigenständige Implementierung nach ISO/IEC 18004, keine externen Abhängigkeiten.
   Nutzung:  QR.svg('https://…', { ecl: 'M', scale: 4 })  → SVG-Text
             QR.encode('text', 'M')                       → { size, modules[y][x] } */
(function (global) {
  'use strict';

  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  var NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var FORMAT_ECL = { L: 1, M: 0, Q: 3, H: 2 };

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function numRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(ver, ecl) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }

  /* Reed-Solomon über GF(2^8), Polynom 0x11D */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function utf8(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    var s = unescape(encodeURIComponent(text)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function encode(text, ecl) {
    ecl = ecl || 'M';
    var data = utf8(text);
    var ver, capBits;
    for (ver = 1; ver <= 40; ver++) {
      capBits = numDataCodewords(ver, ecl) * 8;
      if (4 + (ver <= 9 ? 8 : 16) + data.length * 8 <= capBits) break;
    }
    if (ver > 40) throw new Error('Text zu lang für einen QR-Code');

    /* Bitstrom: Modus Byte (0100), Längenangabe, Daten, Terminator, Auffüllen */
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);
    put(data.length, ver <= 9 ? 8 : 16);
    data.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var codewords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      codewords.push(v);
    }

    /* Blöcke bilden, Fehlerkorrektur anhängen, verschränken */
    var numBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
    var rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    var numShort = numBlocks - rawCodewords % numBlocks;
    var shortLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsDivisor(eccLen), blocks = [];
    for (i = 0, j = 0; i < numBlocks; i++) {
      var dat = codewords.slice(j, j + shortLen - eccLen + (i < numShort ? 0 : 1));
      j += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= numShort) all.push(blocks[j][i]);
      }
    }

    /* Matrix aufbauen */
    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (i = 0; i < size; i++) {
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    var alignPos = [];
    if (ver > 1) {
      var numAlign = Math.floor(ver / 7) + 2;
      var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
      alignPos = [6];
      for (var pos = size - 7; alignPos.length < numAlign; pos -= step) alignPos.splice(1, 0, pos);
    }
    var na = alignPos.length;
    for (i = 0; i < na; i++) {
      for (j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            setF(alignPos[i] + dx, alignPos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    function drawFormat(mask) {
      var d = (FORMAT_ECL[ecl] << 3) | mask, rem = d;
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412;
      for (k = 0; k <= 5; k++) setF(8, k, bit(b, k));
      setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
      for (k = 9; k < 15; k++) setF(14 - k, 8, bit(b, k));
      for (k = 0; k < 8; k++) setF(size - 1 - k, 8, bit(b, k));
      for (k = 8; k < 15; k++) setF(8, size - 15 + k, bit(b, k));
      setF(8, size - 8, true);
    }
    drawFormat(0);

    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var a = size - 11 + i % 3, b2 = Math.floor(i / 3);
        setF(a, b2, bit(vb, i)); setF(b2, a, bit(vb, i));
      }
    }

    /* Daten im Zickzack einsetzen */
    var bi = 0, total = all.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < total) {
            mod[y][x] = bit(all[bi >>> 3], 7 - (bi & 7));
            bi++;
          }
        }
      }
    }

    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; },
      function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
      function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }
    ];
    function applyMask(m) {
      for (var yy = 0; yy < size; yy++)
        for (var xx = 0; xx < size; xx++)
          if (!fn[yy][xx] && MASKS[m](xx, yy)) mod[yy][xx] = !mod[yy][xx];
    }

    function penalty() {
      var p = 0, yy, xx, run, k;
      function line(get) {
        var s = 0, r = 1;
        for (var t = 1; t <= size; t++) {
          if (t < size && get(t) === get(t - 1)) r++;
          else { if (r >= 5) s += 3 + (r - 5); r = 1; }
        }
        var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        for (t = 0; t + 11 <= size; t++) {
          var m1 = true, m2 = true;
          for (var q = 0; q < 11; q++) {
            var c = get(t + q) ? 1 : 0;
            if (c !== pat1[q]) m1 = false;
            if (c !== pat2[q]) m2 = false;
          }
          if (m1) s += 40;
          if (m2) s += 40;
        }
        return s;
      }
      for (yy = 0; yy < size; yy++) p += line(function (t) { return mod[yy][t]; });
      for (xx = 0; xx < size; xx++) p += line(function (t) { return mod[t][xx]; });
      for (yy = 0; yy < size - 1; yy++)
        for (xx = 0; xx < size - 1; xx++) {
          run = mod[yy][xx];
          if (run === mod[yy][xx + 1] && run === mod[yy + 1][xx] && run === mod[yy + 1][xx + 1]) p += 3;
        }
      var dark = 0;
      for (yy = 0; yy < size; yy++) for (xx = 0; xx < size; xx++) if (mod[yy][xx]) dark++;
      k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
      p += Math.max(0, k) * 10;
      return p;
    }

    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var pn = penalty();
      if (pn < bestP) { bestP = pn; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, mask: best, modules: mod };
  }

  function svg(text, opts) {
    opts = opts || {};
    var qr = encode(text, opts.ecl || 'M');
    var border = opts.border == null ? 4 : opts.border;
    var n = qr.size + border * 2, d = '';
    for (var y = 0; y < qr.size; y++)
      for (var x = 0; x < qr.size; x++)
        if (qr.modules[y][x]) d += 'M' + (x + border) + ',' + (y + border) + 'h1v1h-1z';
    var px = opts.px ? ' width="' + opts.px + '" height="' + opts.px + '"' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '"' + px +
      ' shape-rendering="crispEdges" role="img" aria-label="QR-Code">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  global.QR = { encode: encode, svg: svg };
})(typeof window !== 'undefined' ? window : this);
