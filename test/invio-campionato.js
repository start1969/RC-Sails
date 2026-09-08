const puppeteer = require('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer-core');
const CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const esiti = []; const T = (d,ok,n) => esiti.push({d,ok,n});

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
  const errori = [];
  pg.on('pageerror', e => errori.push(e.message));
  pg.on('console', m => { if(m.type()==='error') errori.push(m.text()); });
  await pg.goto('http://localhost:8099/index.html', {waitUntil:'networkidle0'});
  await pg.evaluate(()=>chiudiSplash());

  const allestisci = (nome, data) => pg.evaluate((nome,data)=>{
    state.config = Object.assign(state.config, {
      name:nome, classe:'DF65', club:'CIRCOLO VELICO', venue:'Lago',
      officer:'Comitato', date:data, races:15, minRaces:5, fleet:'single' });
    state.useJudge = false;
    state.boats = Array.from({length:10},(_,i)=>({id:''+(i+1), sail:''+((i+1)*7),
      name:'Concorrente '+(i+1), club:'CV', fleet:null}));
    state.races = [];
    for(let r=0;r<15;r++){
      const o = state.boats.map(x=>x.sail);
      for(let k=o.length-1;k>0;k--){ const j=(r*13+k*7)%(k+1); [o[k],o[j]]=[o[j],o[k]]; }
      state.races.push({judge_a:null,judge_b:null,finishes_a:o,finishes_b:[],
        penalties:{},confirmed:true,cancelled:false,starters:null});
    }
    saveState(); navigate('standings');
  }, nome, data);

  // ── Prima giornata: invio diretto ───────────────────────────────────
  await allestisci('1ª Giornata', '2026-01-11');
  await pg.evaluate(()=>inviaAlCampionato());
  await new Promise(r=>setTimeout(r,900));
  let st = await pg.evaluate(()=>({ n:camp.eventi.length, nome:camp.eventi[0]?.evento.nome,
    class:camp.eventi[0]?.risultati.length, pagina:document.querySelector('.page.active')?.id }));
  T('Invio diretto dalla classifica, senza passare da un file',
    st.n===1 && st.class===10, `${st.n} tappa · ${st.class} classificati · "${st.nome}"`);
  T('Dopo l\'invio si apre la pagina Campionato', st.pagina==='page-champ', st.pagina);

  // ── Seconda giornata ────────────────────────────────────────────────
  await allestisci('2ª Giornata', '2026-02-08');
  await pg.evaluate(()=>inviaAlCampionato());
  await new Promise(r=>setTimeout(r,900));
  st = await pg.evaluate(()=>({n:camp.eventi.length}));
  T('Una seconda giornata si aggiunge come nuova tappa', st.n===2, `${st.n} tappe`);

  // ── Correzione e reinvio della PRIMA giornata ───────────────────────
  await allestisci('1ª Giornata', '2026-01-11');
  const primaCorr = await pg.evaluate(()=>{
    const t = camp.eventi.find(e=>e.evento.nome==='1ª Giornata');
    return { imp:t.impronta, vincitore:t.risultati[0].velico };
  });
  // Si squalifica il vincitore: la classifica cambia
  await pg.evaluate(()=>{
    const primo = state.races[0].finishes_a[0];
    setPenalty(0, primo, 'DNE', 0, 'RRS 2');
    setPenalty(3, primo, 'DSQ', 0, 'protesta');
  });
  await pg.evaluate(()=>inviaAlCampionato());
  await new Promise(r=>setTimeout(r,500));
  const dialogo = await pg.evaluate(()=>({
    aperto: document.getElementById('confirm-overlay').style.display==='flex',
    titolo: document.getElementById('confirm-title').textContent,
    msg: document.getElementById('confirm-msg').textContent
  }));
  T('Il reinvio di una tappa già presente chiede conferma invece di duplicare',
    dialogo.aperto && /già presente/i.test(dialogo.titolo),
    dialogo.titolo + ' — ' + dialogo.msg.slice(0,90));
  T('Il messaggio segnala che la classifica è cambiata',
    /diversa da quella salvata/.test(dialogo.msg), 'differenza rilevata via impronta');

  await pg.evaluate(()=>document.getElementById('confirm-ok').click());
  await new Promise(r=>setTimeout(r,500));
  const dopo = await pg.evaluate(()=>{
    const t = camp.eventi.find(e=>e.evento.nome==='1ª Giornata');
    return { n:camp.eventi.length, imp:t.impronta, class:t.risultati.length,
      ordine:camp.eventi.map(e=>e.evento.data) };
  });
  T('La tappa viene AGGIORNATA, non duplicata',
    dopo.n===2 && dopo.imp!==primaCorr.imp,
    `${dopo.n} tappe · impronta passata da ${primaCorr.imp.slice(0,8)} a ${dopo.imp.slice(0,8)}`);
  T('Le tappe restano in ordine cronologico',
    dopo.ordine.join(',')==='2026-01-11,2026-02-08', dopo.ordine.join(' · '));

  // ── Annullare la sostituzione lascia la tappa intatta ───────────────
  await pg.evaluate(()=>inviaAlCampionato());
  await new Promise(r=>setTimeout(r,400));
  await pg.evaluate(()=>closeConfirm());
  const invariata = await pg.evaluate(()=>({n:camp.eventi.length,
    imp:camp.eventi.find(e=>e.evento.nome==='1ª Giornata').impronta}));
  T('Annullando la conferma nulla cambia',
    invariata.n===2 && invariata.imp===dopo.imp, `${invariata.n} tappe, impronta invariata`);

  // ── Regata senza nome o data: rifiutata ─────────────────────────────
  await pg.evaluate(()=>{ state.config.date=''; saveState(); inviaAlCampionato(); });
  await new Promise(r=>setTimeout(r,300));
  const senzaData = await pg.evaluate(()=>camp.eventi.length);
  T('Una regata senza data non entra in campionato', senzaData===2,
    'invio rifiutato con avviso');

  T('Nessun errore JavaScript', errori.length===0, errori.slice(0,2).join(' | ')||'nessuno');
  await b.close();

  console.log('\n'+'═'.repeat(78));
  console.log('  INVIO DIRETTO AL CAMPIONATO');
  console.log('═'.repeat(78)+'\n');
  let p=0,f=0;
  esiti.forEach(e=>{ e.ok?p++:f++;
    console.log(`  ${e.ok?'PASS':'FAIL'}  ${e.d}`);
    if(e.n) console.log(`        ${e.n}`); });
  console.log('\n'+'─'.repeat(78));
  console.log(`  Controlli: ${esiti.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
  console.log('─'.repeat(78)+'\n');
  process.exit(f?1:0);
})();
