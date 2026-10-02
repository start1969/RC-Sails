// RC Sails Scoring — Copyright © 2026 Stefano Ragusa. Tutti i diritti riservati.
// Esportazione Excel, importazione, email, copia negli appunti, flotta doppia.
// Il file .xlsx viene generato dal browser, riaperto e verificato cella per cella.
const puppeteer = require('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer-core');
// SheetJS non è un modulo CommonJS: si valuta come script
const XLSX = (() => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const ctx = { window:{}, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/xlsx.mini.min.js'),'utf8'), ctx);
  return ctx.XLSX;
})();
const CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const esiti = []; const T = (d,ok,n) => esiti.push({d,ok,n});

// Regata di prova: flotta unica, 10 barche, 8 prove, turni, penalità, protesta
const ALLESTISCI = (multi) => `(() => {
  state.config = Object.assign(state.config, {
    name:'Regata di Prova', classe:'DF65', club:'CIRCOLO VELICO',
    venue:'Specchio acqueo', officer:'Comitato', date:'2026-02-08',
    races:8, minRaces:3, fleet:'${multi?"multi":"single"}', resultEmail:'segreteria@club.it' });
  state.useJudge = ${multi?"false":"true"};
  state.boats = Array.from({length:10},(_,i)=>({id:''+(i+1), sail:''+((i+1)*7),
    name:'Concorrente '+(i+1), club:'CV', fleet:${multi?"(i<5?'A':'B')":"null"}}));
  state.races = [];
  for(let r=0;r<8;r++){
    const mk = lista => { const o=[...lista];
      for(let k=o.length-1;k>0;k--){const j=(r*13+k*7)%(k+1);[o[k],o[j]]=[o[j],o[k]];} return o; };
    const race = {judge_a:null,judge_b:null,finishes_a:[],finishes_b:[],
      penalties:{},confirmed:true,cancelled:false,starters:null};
    state.races.push(race);
    if(${multi}){
      race.finishes_a = mk(state.boats.filter(b=>b.fleet==='A').map(b=>b.sail));
      race.finishes_b = mk(state.boats.filter(b=>b.fleet==='B').map(b=>b.sail));
    } else {
      freezeJudge(r);
      const g = getEffectiveJudge(r,'A');
      race.finishes_a = mk(state.boats.map(b=>b.sail).filter(s=>s!==g));
    }
  }
  state.races[3].penalties['14'] = {code:'OCS', pts:0};
  state.races[5].cancelled = true;
  state.protests = [{id:'1', raceIdx:3, from:'7', to:'14', rule:'RRS 11',
    outcome:'dsq', notes:'contatto alla boa'}];
  saveState(); navigate('standings');
  return state.boats.length;
})()`;

// Cattura del file generato: si intercetta XLSX.writeFile
const INTERCETTA = `(() => {
  window.__xlsx = null;
  if(!window.__writeOriginale) window.__writeOriginale = XLSX.writeFile;
  XLSX.writeFile = (wb, nome) => {
    window.__xlsx = { nome, base64: XLSX.write(wb, {type:'base64', bookType:'xlsx'}) };
  };
  return true;
})()`;

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setViewport({width:390,height:844});
  const errori = [];
  pg.on('pageerror', e => errori.push(e.message));
  pg.on('console', m => { if(m.type()==='error') errori.push(m.text()); });
  // mailto non deve far navigare via la pagina
  await pg.goto('http://localhost:8099/index.html', {waitUntil:'networkidle0'});
  await new Promise(r => setTimeout(r, 1000));
  await pg.evaluate(() => { chiudiSplash(); rifiutaBannerInstalla();
    window.__mailto = null;
    window.apriMailto = url => { window.__mailto = url; };   // non si naviga via
    // navigator.clipboard è in sola lettura: si ridefinisce
    window.__copiato = null;
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{
      writeText: t => { window.__copiato = t; return Promise.resolve(); } } });
  });

  // ════════ FLOTTA UNICA ════════════════════════════════════════════
  await pg.evaluate(ALLESTISCI(false));
  await pg.evaluate(INTERCETTA);

  const file = await pg.evaluate(() => { exportExcel(); return window.__xlsx; });
  T('Il comando Excel produce davvero un file',
    !!file && file.base64.length > 2000,
    `${file.nome} — ${Math.round(file.base64.length*3/4/1024)} KB`);

  const wb = XLSX.read(file.base64, {type:'base64'});
  T('Il file contiene i fogli attesi',
    ['REGATA','ARRIVI','CLASSIFICA','PROTESTE'].every(s => wb.SheetNames.includes(s)),
    wb.SheetNames.join(' · '));

  const leggi = n => XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:''});

  // ── Foglio REGATA ───────────────────────────────────────────────────
  const reg = leggi('REGATA').map(r => r.join('|')).join('\n');
  T('Il foglio REGATA riporta la formula applicata',
    /Regata di Prova/.test(reg) && /CIRCOLO VELICO/.test(reg) &&
    /Iscritti alla serie \+ 1/.test(reg) && /RRS A8/.test(reg),
    'evento, club, criterio DNS e parità dichiarati');

  // ── Foglio ARRIVI ───────────────────────────────────────────────────
  const arr = leggi('ARRIVI');
  const hA  = arr[0];
  T('ARRIVI ha una riga per barca e una colonna per prova',
    arr.length === 11 && hA.filter(h=>/^P\d+$/.test(h)).length === 8,
    `${arr.length-1} righe · ${hA.filter(h=>/^P\d+$/.test(h)).length} colonne prova`);

  const celle = arr.slice(1).flatMap(r => r.slice(4, 12));
  T('ARRIVI usa i codici invece di lasciare celle mute',
    celle.includes('GIUDICE') && celle.includes('ANN.') && celle.includes('OCS'),
    'GIUDICE per chi era di turno · ANN. per la prova annullata · OCS per la penalità');
  T('Nessun residuo di codice abbandonato: nessuna cella vuota in prove disputate',
    arr.slice(1).every(r => {
      for(let k=0;k<8;k++){ if(k===5) continue;           // P6 è annullata
        if(r[4+k]==='' ) return false; } return true; }),
    'ogni barca ha un valore in ogni prova valida');

  // ── Foglio CLASSIFICA ───────────────────────────────────────────────
  const cls = leggi('CLASSIFICA');
  T('CLASSIFICA elenca tutti i concorrenti in ordine',
    cls.slice(1,11).every((r,i) => r[0] === i+1),
    `posizioni da 1 a ${cls[10][0]}`);
  const testoCls = cls.map(r=>r.join('|')).join('\n');
  T('I punteggi esclusi sono segnati fra parentesi quadre',
    /\[/.test(testoCls), 'convenzione dei tabelloni ufficiali rispettata');
  T('La legenda riporta solo i codici realmente usati',
    /CODICI USATI/.test(testoCls) && /OCS/.test(testoCls) && !/BFD/.test(testoCls),
    'nessun elenco completo inutile');

  // L'ordine del foglio deve coincidere con quello a schermo
  const aSchermo = await pg.evaluate(() => {
    const t = document.querySelectorAll('#standings-tbody tr');
    return [...t].map(r => r.children[1].textContent.trim().split(' ')[0]);
  });
  const nelFile = cls.slice(1,11).map(r => String(r[1]));
  T('L\'ordine nel file coincide con la classifica a schermo',
    aSchermo.join() === nelFile.join(),
    'una sola implementazione del criterio RRS A8');

  // ── Foglio PROTESTE ─────────────────────────────────────────────────
  const pro = leggi('PROTESTE');
  T('Le proteste sono esportate con esito e regola',
    pro.length === 2 && /Accolta/.test(pro[1].join(' ')) && /RRS 11/.test(pro[1].join(' ')),
    pro[1].slice(0,5).join(' · '));

  // ════════ COPIA NEGLI APPUNTI ═════════════════════════════════════
  const copia = await pg.evaluate(async () => {
    window.__copiato = null;
    copyStandings();
    await new Promise(r => setTimeout(r, 150));
    return window.__copiato;
  });
  T('La copia negli appunti produce un testo completo',
    !!copia && /Regata di Prova/i.test(copia) && copia.split('\n').length > 10,
    copia ? `${copia.split('\n').length} righe di testo` : 'nessun testo prodotto');

  // ════════ EMAIL ═══════════════════════════════════════════════════
  const mail = await pg.evaluate(() => {
    window.__xlsx = null; window.__mailto = null;
    exportAndEmail();
    return { mailto: window.__mailto, allegato: window.__xlsx && window.__xlsx.nome };
  });
  T('L\'invio email apre il client con destinatario configurato',
    mail.mailto && mail.mailto.startsWith('mailto:segreteria@club.it'),
    (mail.mailto||'').slice(0,46));
  T('Nessun indirizzo personale resta scritto nel codice',
    !/tiscali|ilgrisa/i.test(mail.mailto||''), 'destinatario preso dalla configurazione');
  T('L\'email genera anche il file da allegare',
    !!mail.allegato, mail.allegato || '—');
  const corpo = decodeURIComponent((mail.mailto||'').split('&body=')[1]||'');
  T('Il corpo del messaggio contiene la classifica',
    /Regata di Prova/.test(corpo) && corpo.split('\n').length > 8,
    `${corpo.split('\n').length} righe`);

  // ════════ IMPORTAZIONE: giro completo ═════════════════════════════
  const giro = await pg.evaluate(async b64 => {
    const prima = {
      barche: state.boats.map(b=>b.sail).sort().join(),
      nomi:   state.boats.map(b=>b.name).sort().join()
    };
    // si azzera e si reimporta dal file appena prodotto
    state.boats = []; state.races = []; saveState();
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const finto = { files: [new File([bin], 'prova.xlsx')], value: '' };
    importFromXlsx(finto);
    await new Promise(r => setTimeout(r, 700));
    return { prima, dopo: {
      barche: state.boats.map(b=>b.sail).sort().join(),
      nomi:   state.boats.map(b=>b.name).sort().join(),
      prove:  state.races.length } };
  }, file.base64);
  T('L\'importazione ricostruisce gli stessi partecipanti',
    giro.dopo.barche === giro.prima.barche && giro.dopo.nomi === giro.prima.nomi,
    `${giro.dopo.barche.split(',').length} barche con i nomi corretti`);
  T('L\'importazione ricostruisce le prove',
    giro.dopo.prove >= 8, `${giro.dopo.prove} prove`);

  // ════════ FLOTTA DOPPIA, DALL'INTERFACCIA ═════════════════════════
  await pg.evaluate(ALLESTISCI(true));
  await pg.evaluate(INTERCETTA);
  const multi = await pg.evaluate(async () => {
    navigate('standings');
    await new Promise(r => setTimeout(r, 300));
    const leggiTab = () => [...document.querySelectorAll('#standings-tbody tr')]
      .map(r => r.children[1].textContent.trim().split(' ')[0]);
    const a = leggiTab();
    toggleFleetView();
    await new Promise(r => setTimeout(r, 300));
    const b = leggiTab();
    exportExcel();
    return { a, b, fogli: window.__xlsx ? true : false };
  });
  T('In flotta doppia la classifica mostra flotte distinte',
    multi.a.length === 5 && multi.b.length === 5 &&
    !multi.a.some(s => multi.b.includes(s)),
    `flotta A: ${multi.a.join(', ')} · flotta B: ${multi.b.join(', ')}`);

  const fileM = await pg.evaluate(() => window.__xlsx);
  const wbM = XLSX.read(fileM.base64, {type:'base64'});
  T('Il file esporta una classifica per flotta',
    wbM.SheetNames.includes('CLASSIFICA_A') && wbM.SheetNames.includes('CLASSIFICA_B'),
    wbM.SheetNames.join(' · '));
  const arrM = XLSX.utils.sheet_to_json(wbM.Sheets['ARRIVI'], {header:1, defval:''});
  T('Il foglio ARRIVI distingue le flotte',
    arrM[0].includes('FLOTTA') &&
    new Set(arrM.slice(1).map(r => r[4])).size === 2,
    'colonna FLOTTA con entrambi i valori');

  T('Nessun errore JavaScript', errori.length===0, errori.slice(0,2).join(' | ')||'nessuno');
  await b.close();

  console.log('\n'+'═'.repeat(84));
  console.log('  ESPORTAZIONE, IMPORTAZIONE, EMAIL, COPIA, FLOTTA DOPPIA');
  console.log('═'.repeat(84)+'\n');
  let p=0,f=0;
  esiti.forEach(e=>{ e.ok?p++:f++;
    console.log(`  ${e.ok?'PASS':'FAIL'}  ${e.d}`);
    if(e.n) console.log(`        ${e.n}`); });
  console.log('\n'+'─'.repeat(84));
  console.log(`  Controlli: ${esiti.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
  console.log('─'.repeat(84)+'\n');
  process.exit(f?1:0);
})();
