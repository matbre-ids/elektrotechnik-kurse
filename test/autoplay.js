/* Nur für Tests: spielt den Kurs automatisch durch. */
window.autoplay = async function (opt) {
  opt = opt || {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  let wrongCount = 0;
  function fill(box, t, wrong) {
    const A = __kurs.ART;
    if (t.kind === 'mc') {
      const idx = t.options.findIndex(o => wrong ? !o.ok : o.ok);
      box.querySelectorAll('.option')[idx].click();
    } else if (t.kind === 'num') {
      const ins = box.querySelectorAll('input.eingabe');
      t.fields.forEach((f, i) => { ins[i].value = ET.fmt(wrong && i === 0 ? f.answer * 1000 + (f.answer === 0 ? 1 : 0) : f.answer).replace(/ /g, ' '); });
    } else if (t.kind === 'eng') {
      const e = ET.eng(t.value);
      box.querySelector('input.eingabe').value = ET.fmt(wrong ? e.m * 1000 : e.m);
      [...box.querySelectorAll('.chip')].find(c => c.textContent === (e.z === '' ? 'ohne' : e.z)).click();
    } else if (t.kind === 'match') {
      const sels = box.querySelectorAll('select');
      t.rows.forEach((r, i) => { let j = t.choices.indexOf(r.a); if (wrong && i === 0) j = (j + 1) % t.choices.length; sels[i].value = String(j); });
    } else if (t.kind === 'ladder') {
      const s = A.ladder.soll(t);
      const grp = box.querySelectorAll('.gruppe');
      const pick = (g, f) => [...grp[g].querySelectorAll('.chip')].find(c => f(c.textContent)).click();
      pick(0, x => wrong ? x.includes(s.r === 'r' ? 'links' : 'rechts') : x.includes(s.r === 'r' ? 'rechts' : 'links'));
      pick(1, x => x === String(s.n));
      pick(2, x => x.includes(s.op === 'mal' ? 'größer' : 'kleiner'));
    }
    const hk = box.querySelector('.papierhaken input'); if (hk) hk.checked = true;
  }
  for (let step = 0; step < (opt.max || 400); step++) {
    const S = __kurs.state(), sc = S.screen;
    if (sc.typ === 'fertig') { log.push('FERTIG ' + S.code); break; }
    if (opt.stopAt && opt.stopAt(sc, S)) { log.push('STOP'); break; }
    if (sc.typ === 'checkStart') { [...document.querySelectorAll('button')].find(b => b.textContent === 'Check starten').click(); await sleep(5); continue; }
    if (sc.typ === 'checkErgebnis') {
      const c = S.checks.slice(-1)[0];
      log.push('CHECK R' + c.runde + ' ' + c.pct + '% offen=' + Object.keys(S.offen).join(','));
      document.querySelector('.weiter-leiste button').click(); await sleep(5); continue;
    }
    const tasks = __kurs.aufgaben();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      let guard = 0;
      while (!(S.ans[t.key] && S.ans[t.key].fertig) && guard++ < 4) {
        const box = document.querySelectorAll('section.aufgabe')[i];
        const wrong = opt.wrong ? (!(S.ans[t.key] && S.ans[t.key].versuche) && opt.wrong(t, sc, S)) : false;
        if (wrong) wrongCount++;
        fill(box, t, wrong);
        [...box.querySelectorAll('button')].find(b => b.textContent === 'Prüfen' || b.textContent === 'Antwort abgeben').click();
        await sleep(2);
        if (sc.typ === 'check') break;
        const m = box.querySelector('.meldung');
        if (m && m.textContent) log.push('Meldung: ' + m.textContent + ' @' + t.gen);
      }
    }
    if (sc.typ === 'check') { await sleep(2); continue; }
    const w = document.querySelector('.weiter-leiste button');
    if (!w || w.disabled) { log.push('BLOCKIERT bei ' + JSON.stringify(sc)); break; }
    log.push(sc.typ === 'wdh' ? 'WDH ' + sc.err + ' (' + sc.gen + ')' : 'S' + (sc.idx + 1) + ' ' + __kurs.state().screen.typ);
    w.click();
    await sleep(2);
  }
  return { wrongCount, log };
};
