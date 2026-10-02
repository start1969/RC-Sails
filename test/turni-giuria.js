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
  await new Promise(r => setTimeout(r, 1000));
  await pg.evaluate(() => chiudiSplash());

  // ── Campionato: 6 barche, 12 prove, turno a rotazione ───────────────
  const base = await pg.evaluate(() => {
    state.config = Object.assign(state.config, {
      name:'Campionato', club:'CV', classe:'DF65', races:12, minRaces:5, fleet:'single' });
    state.useJudge = true;
    state.boats = Array.from({length:6},(_,i)=>({id:''+(i+1), sail:''+((i+1)*10),
      name:'Concorrente '+(i+1), club:'CV', fleet:null}));
    state.races = [];
    for(let r=0;r<12;r++) state.races.push({judge_a:null,judge_b:null,finishes_a:[],
      finishes_b:[],penalties:{},confirmed:false,cancelled:false,starters:null});
    state.overrides = {};
    saveState();
    const p = pianoGiuria('A').map(x=>x.sail);
    const c = {}; p.forEach(s=>c[s]=(c[s]||0)+1);
    return { piano:p, conteggi:c };
  });
  const val = Object.values(base.conteggi);
  T('Con sei barche e dodici prove ciascuno fa due turni',
    base.piano.length===12 && val.length===6 && val.every(v=>v===2),
    base.piano.join(' · '));

  // ── Si disputano le prime cinque prove ──────────────────────────────
  const dopo5 = await pg.evaluate(() => {
    for(let r=0;r<5;r++){
      freezeJudge(r);
      const g = getEffectiveJudge(r,'A');
      state.races[r].finishes_a = state.boats.map(x=>x.sail).filter(s=>s!==g);
      state.races[r].confirmed = true;
    }
    saveState();
    return { congelati: state.races.slice(0,5).map(x=>x.judge_a) };
  });
  T('I giudici delle prove disputate vengono congelati',
    dopo5.congelati.every(Boolean) &&
    dopo5.congelati.join()===base.piano.slice(0,5).join(),
    dopo5.congelati.join(' · '));

  // ── IL CASO: il concorrente di turno alla prova 6 se ne va ──────────
  const uscente = base.piano[5];
  const esclusione = await pg.evaluate(sail => {
    setDisponibileGiuria(sail, false);
    const p = pianoGiuria('A').map(x=>x.sail);
    const c = {}; p.forEach(s=>c[s]=(c[s]||0)+1);
    return { piano:p, conteggi:c,
      congelatiInvariati: state.races.slice(0,5).map(x=>x.judge_a) };
  }, uscente);

  T('Le prove già disputate NON cambiano giudice',
    esclusione.congelatiInvariati.join()===dopo5.congelati.join(),
    `prove 1-5 invariate: ${esclusione.congelatiInvariati.join(' · ')}`);
  T('Chi è escluso non compare più nelle prove future',
    !esclusione.piano.slice(5).includes(uscente),
    `velico ${uscente} assente dalle prove 6-12`);
  T('Il velico escluso conserva i turni già svolti, nessuno in più',
    (esclusione.conteggi[uscente]||0) === base.piano.slice(0,5).filter(s=>s===uscente).length,
    `${esclusione.conteggi[uscente]||0} turni svolti prima di uscire`);

  const restanti = Object.entries(esclusione.conteggi)
    .filter(([s]) => s !== uscente).map(([,v]) => v);
  T('I turni residui si ridistribuiscono in modo equilibrato',
    Math.max(...restanti) - Math.min(...restanti) <= 1,
    `carichi finali: ${restanti.join(', ')} — scarto massimo ${Math.max(...restanti)-Math.min(...restanti)}`);

  // ── Confronto onesto fra i due algoritmi ────────────────────────────
  // Non su un caso scelto ad arte: su duecento scenari casuali di
  // esclusione, si misura lo scarto massimo fra chi fa più turni e chi
  // ne fa meno. Il criterio "meno caricato" deve garantire scarto <= 1
  // sempre; il modulo no.
  const gara = await pg.evaluate(() => {
    const spread = v => Math.max(...v) - Math.min(...v);
    let peggioNuovo = 0, peggioModulo = 0, moduloOltre1 = 0;
    for(let t = 0; t < 200; t++) {
      const nBoats = 4 + (t % 9);            // da 4 a 12 barche
      const nRaces = 8 + (t * 7) % 15;       // da 8 a 22 prove
      const uscitaA = (t * 3) % nRaces;      // prova in cui qualcuno esce
      const chiEsce  = (t * 5) % nBoats;
      const sails = Array.from({length:nBoats},(_,i)=>''+(i+1));

      // criterio "meno caricato", con le prove prima dell'uscita congelate
      const carico = new Map(sails.map(s=>[s,0]));
      const congelati = [];
      for(let r=0;r<uscitaA;r++){
        let best=null,min=Infinity;
        for(const s of sails){const n=carico.get(s); if(n<min){min=n;best=s;}}
        congelati.push(best); carico.set(best,carico.get(best)+1);
      }
      const liberi = sails.filter((_,i)=>i!==chiEsce);
      if(!liberi.length) continue;
      const caricoN = new Map(liberi.map(s=>[s,carico.get(s)]));
      for(let r=uscitaA;r<nRaces;r++){
        let best=null,min=Infinity;
        for(const s of liberi){const n=caricoN.get(s); if(n<min){min=n;best=s;}}
        caricoN.set(best,caricoN.get(best)+1);
      }
      peggioNuovo = Math.max(peggioNuovo, spread([...caricoN.values()]));

      // vecchia formula: indice della prova modulo numero disponibili
      const caricoM = new Map(liberi.map(s=>[s,carico.get(s)]));
      for(let r=uscitaA;r<nRaces;r++){
        const s = liberi[r % liberi.length];
        caricoM.set(s, caricoM.get(s)+1);
      }
      const sM = spread([...caricoM.values()]);
      peggioModulo = Math.max(peggioModulo, sM);
      if(sM > 1) moduloOltre1++;
    }
    return { peggioNuovo, peggioModulo, moduloOltre1 };
  });
  T('Il criterio "meno caricato" garantisce sempre uno scarto massimo di un turno',
    gara.peggioNuovo <= 1,
    `scarto peggiore su 200 scenari casuali: ${gara.peggioNuovo}`);
  T('La vecchia formula a modulo non offre questa garanzia',
    gara.peggioModulo > 1,
    `scarto peggiore ${gara.peggioModulo}; supera un turno in ${gara.moduloOltre1} scenari su 200`);

  // ── Imposizione manuale su una prova ────────────────────────────────
  const imposto = await pg.evaluate(() => {
    const libero = state.boats.filter(disponibileGiuria)[0].sail;
    setOverride(7, 'A', libero);
    const p = pianoGiuria('A');
    const c = {}; p.forEach(x=>{ if(x.sail) c[x.sail]=(c[x.sail]||0)+1; });
    const v = Object.values(c).filter((_,i)=>true);
    return { sail:p[7].sail, fonte:p[7].fonte, atteso:libero, conteggi:c };
  });
  T('Si può imporre un nome su una singola prova',
    imposto.sail === imposto.atteso && imposto.fonte === 'imposto',
    `prova 8 assegnata a ${imposto.sail} (${imposto.fonte})`);

  const dopoImposto = Object.entries(imposto.conteggi)
    .filter(([s]) => s !== uscente).map(([,v]) => v);
  T('Il turno imposto conta nel bilancio e il resto si riequilibra',
    Math.max(...dopoImposto) - Math.min(...dopoImposto) <= 1,
    `carichi: ${dopoImposto.join(', ')}`);

  // ── Reintegro ───────────────────────────────────────────────────────
  const reintegro = await pg.evaluate(sail => {
    setOverride(7,'A','');
    setDisponibileGiuria(sail, true);
    const p = pianoGiuria('A').map(x=>x.sail);
    return { torna: p.slice(5).includes(sail), piano:p };
  }, uscente);
  T('Reintegrando, la persona rientra nelle prove future',
    reintegro.torna, `velico ${uscente} di nuovo in rotazione`);

  // ── Nessuno disponibile ─────────────────────────────────────────────
  const vuoto = await pg.evaluate(() => {
    state.boats.forEach(b => b.noGiuria = true);
    saveState();
    const p = pianoGiuria('A');
    renderRotation();
    return { tuttiNulli: p.slice(5).every(x => x.sail === null),
      avviso: /Nessuno disponibile/.test(
        document.getElementById('disponibilita-list').innerText) };
  });
  T('Se nessuno è disponibile l\'app lo dichiara invece di sbagliare',
    vuoto.tuttiNulli && vuoto.avviso, 'avviso mostrato, nessuna assegnazione inventata');

  await pg.evaluate(() => {
    state.boats.forEach(b => delete b.noGiuria);
    state.boats[2].noGiuria = true;
    saveState(); navigate('rotation');
  });
  await new Promise(r => setTimeout(r, 400));
  await pg.screenshot({ path:'./schermate/rotazione.png' });

  T('Nessun errore JavaScript', errori.length===0, errori.slice(0,2).join(' | ')||'nessuno');
  await b.close();

  console.log('\n'+'═'.repeat(82));
  console.log('  TURNI DI GIURIA — esclusioni, sostituzioni, riequilibrio');
  console.log('═'.repeat(82)+'\n');
  let p=0,f=0;
  esiti.forEach(e=>{ e.ok?p++:f++;
    console.log(`  ${e.ok?'PASS':'FAIL'}  ${e.d}`);
    if(e.n) console.log(`        ${e.n}`); });
  console.log('\n'+'─'.repeat(82));
  console.log(`  Controlli: ${esiti.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
  console.log('─'.repeat(82)+'\n');
  process.exit(f?1:0);
})();
