/* Passwortsperre für Lehrerwerkzeug und Prüfseite.
   Das Passwort steht hier nicht im Klartext, sondern nur als PBKDF2-Prüfwert.
   Hinweis: Auf einem statischen Webserver ist das eine Sperre im Browser –
   sie hält Schüler fern, ersetzt aber keinen Server-Zugangsschutz.

   Passwort ändern: Lehrerseite öffnen, Browserkonsole (F12) und eingeben
     await ET.Zugang.neuerPruefwert('neues Passwort')
   Die ausgegebene Zeile ersetzt unten den Block ZUGANG. */
(function (g) {
  'use strict';
  var ET = g.ET = g.ET || {};

  var ZUGANG = {
    salz: '1571c776fa3f25af145cba32ba08b821',
    runden: 300000,
    pruefwert: 'f4dda32ec4341d102738f8bb099fc4bda0978ee6a2463d763791e2a51beb8b97'
  };
  var MERK = 'etlehrer:zugang';

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function bytes(h) {
    var a = new Uint8Array(h.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  }
  function ableiten(pw, salz, runden) {
    var enc = new TextEncoder().encode(pw);
    return g.crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return g.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salz), iterations: runden }, key, 256);
    }).then(hex);
  }

  function frei() {
    try { return sessionStorage.getItem(MERK) === ZUGANG.pruefwert; } catch (e) { return false; }
  }

  function sperren() {
    document.documentElement.classList.add('gesperrt');
    var ov = document.createElement('div');
    ov.className = 'zugang';
    ov.innerHTML =
      '<form class="zugang-box" autocomplete="off">' +
      '<h1>🔒 Lehrerbereich</h1>' +
      '<p>Bitte das Zugangspasswort eingeben.</p>' +
      '<input type="password" class="zugang-pw" aria-label="Passwort" autofocus>' +
      '<button type="submit" class="btn primaer gross">Öffnen</button>' +
      '<div class="zugang-meldung" role="alert"></div>' +
      '</form>';
    document.body.appendChild(ov);
    var form = ov.querySelector('form'), inp = ov.querySelector('input'), msg = ov.querySelector('.zugang-meldung');
    if (!g.crypto || !g.crypto.subtle) {
      msg.textContent = 'Diese Seite muss über https (oder localhost) geöffnet werden.';
      return;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = 'Prüfe …';
      ableiten(inp.value, ZUGANG.salz, ZUGANG.runden).then(function (h) {
        if (h === ZUGANG.pruefwert) {
          try { sessionStorage.setItem(MERK, h); } catch (e2) { /* egal */ }
          ov.remove();
          document.documentElement.classList.remove('gesperrt');
        } else {
          msg.textContent = 'Falsches Passwort.';
          inp.value = '';
          inp.focus();
        }
      });
    });
    inp.focus();
  }

  ET.Zugang = {
    /* Hilfsfunktion zum Ändern des Passworts (Ausgabe in der Konsole) */
    neuerPruefwert: function (pw) {
      var salz = hex(g.crypto.getRandomValues(new Uint8Array(16)));
      return ableiten(pw, salz, ZUGANG.runden).then(function (h) {
        return "salz: '" + salz + "',\nrunden: " + ZUGANG.runden + ",\npruefwert: '" + h + "'";
      });
    }
  };

  /* Inhalt sofort verstecken, bis das Passwort stimmt */
  if (!frei()) {
    document.documentElement.classList.add('gesperrt');
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sperren);
    else sperren();
  }
})(window);
