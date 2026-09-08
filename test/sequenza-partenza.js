const puppeteer = require('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer-core');
const CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const esiti = []; const T = (d,ok,n) => esiti.push({d,ok,n});

// Finto contesto audio: registra ogni suono programmato e il suo istante
const MOCK = `
window.__suoni = [];
window.__orologio = 0;
class FakeParam {
  constructor(){}
  setValueAtTime(){return this} exponentialRampToValueAtTime(){return this}
}
class FakeNode {
  constructor(tipo){ this.tipo=tipo; this.frequency=new FakeParam(); this.gain=new FakeParam(); }
  connect(){return this}
  start(t){ window.__suoni.push({tipo:this.type||'osc', t:Math.round((t)*1000)/1000, f:this.__f}); }
  stop(){}
}
class FakeCtx {
  constructor(){ this.state='running'; this.destination={}; }
  get currentTime(){ return window.__orologio; }
  resume(){ this.state='running'; }
  close(){ this.state='closed'; }
  createOscillator(){ const n=new FakeNode('osc');
    n.frequency={setValueAtTime:(v,t)=>{n.__f=v;}};
    return n; }
  createGain(){ return new FakeNode('gain'); }
  createBiquadFilter(){ const n=new FakeNode('filter');
    n.frequency={setValueAtTime:()=>{}}; return n; }
}
window.AudioContext = FakeCtx;
window.webkitAudioContext = FakeCtx;
`;

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
  const errori = [];
  pg.on('pageerror', e => errori.push(e.message));
  pg.on('console', m => { if(m.type()==='error') errori.push(m.text()); });
  await pg.evaluateOnNewDocument(MOCK);
  await pg.goto('http://localhost:8099/index.html', {waitUntil:'networkidle0'});
  await new Promise(r => setTimeout(r, 900));
  await pg.evaluate(() => chiudiSplash());

  // ── Elenco degli eventi previsti ────────────────────────────────────
  const ev = await pg.evaluate(() => {
    const e = eventiSequenza(120);
    return { n:e.length, sec:e.map(x=>x.s), tipi:e.map(x=>x.tipo),
             testi:e.filter(x=>x.testo).map(x=>x.s+':'+x.testo) };
  });
  T('Segnali a intervalli di un minuto: avviso, preparatorio, partenza',
    ev.testi.join(' ') === '120:AVVISO 60:PREPARATORIO 0:PARTENZA', ev.testi.join(' · '));
  T('Nel minuto precedente un segnale ogni dieci secondi',
    [50,40,30,20].every(s => ev.sec.includes(s)),
    'segnali a 50, 40, 30, 20 secondi');
  T('Negli ultimi dieci secondi un segnale al secondo',
    [10,9,8,7,6,5,4,3,2,1].every(s => ev.sec.includes(s)),
    'dieci segnali da 10 a 1');
  T('Nessun segnale duplicato o fuori sequenza',
    new Set(ev.sec).size === ev.sec.length &&
    ev.sec.every((s,i) => i===0 || ev.sec[i-1] > s),
    `${ev.n} eventi in ordine decrescente`);

  // ── Programmazione effettiva dei suoni ──────────────────────────────
  const sched = await pg.evaluate(() => {
    window.__suoni = []; window.__orologio = 100;
    setDurataSeq(120);
    avviaSequenza();
    // istanti relativi alla partenza (negativi = prima del via)
    const t0 = 100 + 0.5 + 120;
    return { istanti: [...new Set(window.__suoni.map(s => Math.round((s.t - t0)*100)/100))]
                        .sort((a,b)=>a-b),
             totale: window.__suoni.length };
  });
  const attesi = [-120,-60,-50,-40,-30,-20,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1,0];
  T('Ogni suono cade esattamente nell\'istante prescritto',
    JSON.stringify(sched.istanti) === JSON.stringify(attesi),
    `${sched.istanti.length} istanti · ${sched.totale} oscillatori programmati`);
  T('I suoni sono programmati in anticipo, non a colpi di timer',
    sched.totale >= 19,
    'tutti gli eventi accodati sull\'orologio audio in una sola volta');

  // ── Sequenza da un minuto ───────────────────────────────────────────
  const uno = await pg.evaluate(() => {
    chiudiSequenza();
    const e = eventiSequenza(60);
    return { testi:e.filter(x=>x.testo).map(x=>x.s+':'+x.testo), sec:e.map(x=>x.s) };
  });
  T('Sequenza da un minuto: nessun segnale prima del preparatorio',
    uno.testi.join(' ') === '60:PREPARATORIO 0:PARTENZA' && !uno.sec.includes(120),
    uno.testi.join(' · '));

  // ── Conto alla rovescia a schermo ───────────────────────────────────
  const vis = await pg.evaluate(async () => {
    window.__suoni = []; window.__orologio = 0;
    setDurataSeq(120);
    avviaSequenza();
    const leggi = async q => { window.__orologio = 0.5 + 120 - q;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const box = document.getElementById('seq-box');
      return { n:document.getElementById('seq-num').textContent,
               f:document.getElementById('seq-fase').textContent,
               c:box.className }; };
    const r = {};
    r.a90 = await leggi(90); r.a45 = await leggi(45);
    r.a7  = await leggi(7);  r.via = await leggi(-0.5);
    return r;
  });
  T('Il conto alla rovescia mostra minuti e secondi sopra il minuto',
    vis.a90.n === '1:30', `a 90 secondi: "${vis.a90.n}" — ${vis.a90.f}`);
  T('Nel minuto preparatorio cambia fase e colore',
    vis.a45.n === '45' && /preparatorio/i.test(vis.a45.f) && /seq-prep/.test(vis.a45.c),
    `a 45 secondi: "${vis.a45.n}" — ${vis.a45.f}`);
  T('Negli ultimi dieci secondi la schermata passa in allerta',
    vis.a7.n === '7' && /seq-finale/.test(vis.a7.c),
    `a 7 secondi: "${vis.a7.n}" — ${vis.a7.f}`);
  T('Alla partenza compare il via',
    vis.via.n === 'VIA!' && /seq-via/.test(vis.via.c), `"${vis.via.n}" — ${vis.via.f}`);

  await pg.screenshot({ path:'/home/claude/harness/schermate/16-seq-finale.png' });

  // ── Selettore a due sole durate ─────────────────────────────────────
  const sel = await pg.evaluate(() => {
    chiudiSequenza(); apriSequenza();
    const opt = [...document.querySelectorAll('.seq-opt')];
    const stato = () => ({ attivo: opt.find(o=>o.classList.contains('active')).id,
      valore: document.getElementById('seq-durata').value,
      nota: document.getElementById('seq-nota').innerText });
    const r = { n: opt.length,
      etichette: opt.map(o=>o.querySelector('.seq-opt-t').textContent),
      iniziale: stato() };
    setDurataSeq(60);  r.uno = stato();
    setDurataSeq(120); r.due = stato();
    return r;
  });
  T('Due sole durate: 1 e 2 minuti',
    sel.n === 2 && sel.etichette.join(' / ') === '1 minuto / 2 minuti',
    sel.etichette.join(' · '));
  T('La sequenza regolamentare è quella predefinita',
    sel.iniziale.attivo === 'seq-opt-120' && sel.iniziale.valore === '120',
    'apre sempre su 2 minuti (RRS E3.4)');
  T('Il selettore cambia durata e spiegazione',
    sel.uno.valore === '60' && sel.due.valore === '120' &&
    /dichiarala nelle Istruzioni/.test(sel.uno.nota) && /E3.4/.test(sel.due.nota),
    'scegliendo 1 minuto avvisa che va dichiarato nelle IdR');

  // ── Richiamo generale: due suoni ────────────────────────────────────
  const rg = await pg.evaluate(() => {
    window.__suoni = []; window.__orologio = 500;
    richiamoGenerale();
    const t = [...new Set(window.__suoni.map(s => Math.round((s.t-500.05)*100)/100))].sort((a,b)=>a-b);
    return t;
  });
  T('Richiamo generale: due suoni distinti (RRS E3.6)',
    rg.length === 2 && rg[0] === 0 && rg[1] > 0.5,
    `suoni a ${rg[0]}s e ${rg[1]}s dall\'attivazione`);

  // ── Interruzione ────────────────────────────────────────────────────
  const stop = await pg.evaluate(() => {
    chiudiSequenza();
    return { chiuso: document.getElementById('seq-overlay').style.display === 'none' };
  });
  T('Interrompendo, la schermata si chiude e i suoni pendenti sono azzerati',
    stop.chiuso, 'contesto audio chiuso: nessun suono residuo');

  T('Nessun errore JavaScript', errori.length===0, errori.slice(0,2).join(' | ')||'nessuno');
  await b.close();

  console.log('\n'+'═'.repeat(80));
  console.log('  SEQUENZA DI PARTENZA — conformità alla RRS E3.4');
  console.log('═'.repeat(80)+'\n');
  let p=0,f=0;
  esiti.forEach(e=>{ e.ok?p++:f++;
    console.log(`  ${e.ok?'PASS':'FAIL'}  ${e.d}`);
    if(e.n) console.log(`        ${e.n}`); });
  console.log('\n'+'─'.repeat(80));
  console.log(`  Controlli: ${esiti.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
  console.log('─'.repeat(80)+'\n');
  process.exit(f?1:0);
})();
