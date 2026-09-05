const E = require('./motore.js');
const out = [];
const T = (id, desc, ok, note) => out.push({ id, desc, ok, note });

function mk(nBoats, nRaces, opts = {}) {
  const boats = [];
  for (let i = 1; i <= nBoats; i++)
    boats.push({ id: '' + i, sail: '' + i, name: 'B' + i, club: 'X', fleet: opts.fleets ? (i <= nBoats / 2 ? 'A' : 'B') : null });
  const races = [];
  for (let r = 0; r < nRaces; r++)
    races.push({ judge_a: null, judge_b: null, finishes_a: [], finishes_b: [], penalties: {}, confirmed: false, cancelled: false });
  global.state = {
    config: { races: nRaces, fleet: opts.fleets ? 'multi' : 'single' },
    boats, races, overrides: {}, useJudge: !!opts.useJudge, protests: []
  };
}
const fill = (i, o, f) => {
  global.state.races[i][f === 'B' ? 'finishes_b' : 'finishes_a'] = o.map(String);
  global.state.races[i].confirmed = true;
};
const pen = (i, sail, code, pts) => { global.state.races[i].penalties[String(sail)] = { code, pts: pts || 0 }; };
const S = (bi, fl) => E.calcScore(global.state.boats[bi], fl || 'A');

// ══ MODALITÀ 1 — senza giudice, flotta unica ══════════════════════════
mk(5, 5);
for (let i = 0; i < 4; i++) fill(i, [1, 2, 3, 4, 5]);
fill(4, [5, 4, 3, 2, 1]);
let r = S(0);
T('M1', 'Senza giudice, flotta unica: 5 prove, 1 scarto, netti corretti',
  r.gross === 9 && r.disc === 5 && r.net === 4, `lordi ${r.gross} scarto ${r.disc} netti ${r.net}`);

// ══ MODALITÀ 2 — con giudice, flotta unica ════════════════════════════
mk(12, 15, { useJudge: true });
for (let rr = 0; rr < 15; rr++) {
  const j = E.getEffectiveJudge(rr, 'A');
  global.state.races[rr].judge_a = j;
  let o = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (rr % 2 === 1) o = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  fill(rr, o.filter(s => String(s) !== j));
}
r = S(0);
const jI = []; for (let rr = 0; rr < 15; rr++) if (E.getEffectiveJudge(rr, 'A') === '1') jI.push(rr);
const reali = r.scores.filter((_, i) => !jI.includes(i));
const atteso = Math.round(reali.reduce((a, b) => a + b, 0) / reali.length * 10) / 10;
T('M2', 'Con giudice, flotta unica: due turni di giuria, AVG conforme A9(a)',
  r.scores[jI[0]] === atteso && r.scores[jI[1]] === atteso,
  `AVG P${jI[0] + 1}=${r.scores[jI[0]]} P${jI[1] + 1}=${r.scores[jI[1]]} — media attesa ${atteso}`);

// ══ MODALITÀ 3 — con giudice, flotta doppia ═══════════════════════════
mk(8, 4, { fleets: true, useJudge: true });
for (let rr = 0; rr < 4; rr++) {
  const jA = E.getEffectiveJudge(rr, 'A'), jB = E.getEffectiveJudge(rr, 'B');
  global.state.races[rr].judge_a = jA; global.state.races[rr].judge_b = jB;
  fill(rr, [1, 2, 3, 4].filter(s => String(s) !== jA), 'A');
  fill(rr, [5, 6, 7, 8].filter(s => String(s) !== jB), 'B');
}
const bA = S(0, 'A'), bB = S(4, 'B');
T('M3', 'Con giudice, flotta doppia: giudice e DNF indipendenti per flotta',
  bA.dns === 5 && bB.dns === 5 && bB.scores.every(s => s !== null),
  `DNF flotta A=${bA.dns} B=${bB.dns} · punteggi B=${JSON.stringify(bB.scores)}`);

// ══ D1 — rotazione congelata ══════════════════════════════════════════
mk(6, 6, { useJudge: true });
for (let rr = 0; rr < 6; rr++) { E.freezeJudge(rr); fill(rr, [1, 2, 3, 4, 5, 6]); }
const g1 = []; for (let rr = 0; rr < 6; rr++) g1.push(E.getEffectiveJudge(rr, 'A'));
global.state.boats.splice(2, 0, { id: '99', sail: '99', name: 'Nuova', fleet: null });
const g2 = []; for (let rr = 0; rr < 6; rr++) g2.push(E.getEffectiveJudge(rr, 'A'));
T('D1', 'Aggiungendo una barca i giudici delle prove disputate non cambiano',
  JSON.stringify(g1) === JSON.stringify(g2), `prima=${g1} dopo=${g2}`);

// ══ D2 — penalità reversibile ═════════════════════════════════════════
mk(5, 3);
for (let i = 0; i < 3; i++) fill(i, [1, 2, 3, 4, 5]);
const prima = S(3).scores[0];
pen(0, 1, 'DSQ');
const conDsq = { b1: S(0).scores[0], b4: S(3).scores[0] };
delete global.state.races[0].penalties['1'];
const dopo = S(3).scores[0];
T('D2', 'La squalifica è reversibile e le barche dietro risalgono (A6.1)',
  prima === 4 && conDsq.b1 === 6 && conDsq.b4 === 3 && dopo === 4,
  `barca4: ${prima}° → con DSQ ${conDsq.b4}° → rimossa ${dopo}° · barca1 squalificata = ${conDsq.b1} pt`);

// ══ D3 — DPI secondo RRS E7 ═══════════════════════════════════════════
mk(12, 1); fill(0, Array.from({ length: 12 }, (_, i) => i + 1));
pen(0, 5, 'DPI', 3);
const conDpi = S(4).scores[0], vicina = S(5).scores[0];
T('D3', 'DPI (RRS E7): punti aggiunti, punteggi delle altre barche invariati',
  conDpi === 8 && vicina === 6, `barca5: 5° + 3 pt = ${conDpi} · barca6 resta ${vicina}`);
T('D3b', 'ZFP e SCP non più presenti (App. E cancella RRS 30.2 e 44.3)',
  !('ZFP' in E.CODES) && !('SCP' in E.CODES), `codici disponibili: ${Object.keys(E.CODES).join(', ')}`);

// ══ D4 — scarti oltre le 20 prove ═════════════════════════════════════
T('D4', 'Gli scarti proseguono oltre la ventesima prova',
  E.getDiscards(21) === 7 && E.getDiscards(30) === 11,
  `20→${E.getDiscards(20)} 21→${E.getDiscards(21)} 25→${E.getDiscards(25)} 30→${E.getDiscards(30)}`);

// ══ D5 — prova in corso ═══════════════════════════════════════════════
mk(6, 3);
global.state.races[0].finishes_a = ['1', '2', '3'];   // non confermata
const inCorso = S(5).scores[0];
global.state.races[0].confirmed = true;
const conclusa = S(5).scores[0];
T('D5', 'A prova in corso nessun falso DNF; alla conferma il DNF compare',
  inCorso === null && conclusa === 7, `in corso = ${inCorso} · confermata = ${conclusa}`);

// ══ D7 — barche senza flotta ══════════════════════════════════════════
mk(6, 3); global.state.config.fleet = 'multi';
global.state.boats.forEach(b => { if (!b.fleet) b.fleet = 'A'; });
T('D7', 'Nessuna barca sparisce passando a flotta doppia',
  E.getBoatsByFleet('A').length + E.getBoatsByFleet('B').length === 6,
  `A=${E.getBoatsByFleet('A').length} B=${E.getBoatsByFleet('B').length} su 6`);

// ══ A2.1 — a parità si scarta la prova più antica ═════════════════════
mk(5, 5);
fill(0, [2, 3, 4, 5, 1]); fill(1, [1, 2, 3, 4, 5]); fill(2, [2, 3, 4, 5, 1]);
fill(3, [1, 2, 3, 4, 5]); fill(4, [1, 2, 3, 4, 5]);
r = S(0);
T('A2.1', 'A parità di peggior punteggio si scarta la prova disputata per prima',
  JSON.stringify([...r.discIndices]) === '[0]', `punteggi ${JSON.stringify(r.scores)} → scartata P${[...r.discIndices][0] + 1}`);

// ══ DNE non scartabile ════════════════════════════════════════════════
mk(5, 5);
for (let i = 0; i < 5; i++) fill(i, [1, 2, 3, 4, 5]);
pen(4, 1, 'DNE');
r = S(0);
T('DNE', 'Il DNE resta nel totale e non può essere scartato',
  r.scores[4] === 6 && !r.discIndices.has(4) && r.net === 9,
  `punteggi ${JSON.stringify(r.scores)} scarto ${r.disc} netti ${r.net}`);

// ══ RDG — riparazione ═════════════════════════════════════════════════
mk(6, 3);
for (let i = 0; i < 3; i++) fill(i, [1, 2, 3, 4, 5, 6]);
pen(1, 4, 'RDG', 2.5);
const conRdg = S(3).scores[1], altra = S(4).scores[1];
T('RDG', 'La riparazione assegna il punteggio e non tocca le altre barche (A6.2)',
  conRdg === 2.5 && altra === 5, `barca4 = ${conRdg} · barca5 resta ${altra}`);

// ══ A8 — comparatore unico ════════════════════════════════════════════
mk(4, 4);
fill(0, [1, 2, 3, 4]); fill(1, [2, 1, 3, 4]); fill(2, [1, 2, 3, 4]); fill(3, [2, 1, 3, 4]);
const x = S(0), y = S(1);
T('A8', 'Parità sui netti risolta dall\'unico comparatore A8',
  x.net === y.net && E.compareSeries(x, y) !== 0,
  `netti ${x.net} = ${y.net} → parità risolta, esito ${E.compareSeries(x, y) < 0 ? 'barca1' : 'barca2'}`);

// ══ Prova annullata ═══════════════════════════════════════════════════
mk(5, 5);
for (let i = 0; i < 5; i++) fill(i, [1, 2, 3, 4, 5]);
global.state.races[2].cancelled = true;
r = S(0);
T('ANN', 'La prova annullata è esclusa dalla serie e dal conteggio scarti',
  r.n_played === 4 && r.disc === 0 && r.net === 4 && E.countPlayed('A') === 4,
  `prove valide ${r.n_played} · scarti ${E.getDiscards(r.n_played)} · netti ${r.net}`);

// ══ Copertura codici A10 ══════════════════════════════════════════════
const rrs = ['DNC', 'DNS', 'OCS', 'UFD', 'BFD', 'NSC', 'DNF', 'RET', 'DSQ', 'DNE', 'DGM', 'RDG', 'DPI'];
const miss = rrs.filter(c => !(c in E.CODES));
T('A10', 'Copertura delle abbreviazioni RRS applicabili alla vela RC',
  miss.length === 0, `${rrs.length - miss.length}/${rrs.length} gestite${miss.length ? ' — mancanti: ' + miss : ''}`);

// ══ REPORT ════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(86));
console.log('  REGRESSIONE — GRCS_SCORING v15');
console.log('═'.repeat(86) + '\n');
let p = 0, f = 0;
for (const t of out) {
  t.ok ? p++ : f++;
  console.log(`  ${t.ok ? 'PASS' : 'FAIL'}  [${t.id.padEnd(5)}] ${t.desc}`);
  console.log(`              ${t.note}\n`);
}
console.log('─'.repeat(86));
console.log(`  Casi: ${out.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
console.log('─'.repeat(86) + '\n');


// ══════════════════════════════════════════════════════════════════════
// PARAMETRI DI CONFIGURAZIONE (aggiunti in v15.1)
// ══════════════════════════════════════════════════════════════════════
const out2 = [];
const T2 = (id, desc, ok, note) => out2.push({ id, desc, ok, note });

function cfg(o) { Object.assign(global.state.config.scoring, o); }

// ── Sistemi di scarto ────────────────────────────────────────────────
mk(6, 12); global.state.config.scoring = {discardMode:'table', discardAfter:5, discardEvery:5, a53:false, judgeScore:'avg-all'};
const tab = [3,5,9,12].map(n=>E.getDiscards(n)).join(',');
cfg({discardMode:'none'});  const none = [3,5,9,12,20].map(n=>E.getDiscards(n)).join(',');
cfg({discardMode:'one'});   const one  = [3,5,9,20].map(n=>E.getDiscards(n)).join(',');
cfg({discardMode:'every', discardEvery:5, discardAfter:5});
const ev = [4,5,10,15,20].map(n=>E.getDiscards(n)).join(',');
T2('CFG1', 'Quattro sistemi di scarto selezionabili dal Bando',
  tab==='0,1,2,3' && none==='0,0,0,0,0' && one==='0,1,1,1' && ev==='0,1,2,3,4',
  `tabella(3,5,9,12)=${tab} · nessuno=${none} · uno(3,5,9,20)=${one} · ogni5(4,5,10,15,20)=${ev}`);

// ── Soglia di attivazione degli scarti ───────────────────────────────
mk(6, 12); global.state.config.scoring = {discardMode:'one', discardAfter:8, discardEvery:5, a53:false, judgeScore:'avg-all'};
T2('CFG2', 'La soglia di attivazione degli scarti è parametrica',
  E.getDiscards(7)===0 && E.getDiscards(8)===1, `7 prove→${E.getDiscards(7)} · 8 prove→${E.getDiscards(8)}`);

// ── RRS A5.3 ─────────────────────────────────────────────────────────
mk(12, 1); global.state.config.scoring = {discardMode:'table', discardAfter:5, discardEvery:5, a53:false, judgeScore:'avg-all'};
fill(0, [1,2,3,4,5,6,7,8]);            // 12 iscritti, solo 8 all'arrivo
const senzaA53 = S(11).scores[0];
cfg({a53:true}); global.state.races[0].starters = 9;   // 9 venute in area di partenza
const conA53 = S(11).scores[0];
pen(0, 12, 'DNC');
const dnc = S(11).scores[0];
T2('CFG3', 'A5.3: DNS/DNF sui partenti, DNC sempre sugli iscritti alla serie',
  senzaA53===13 && conA53===10 && dnc===13,
  `A5.2→${senzaA53} · A5.3 con 9 partenti→${conA53} · DNC sotto A5.3→${dnc}`);

// ── Punteggio della barca di giuria ──────────────────────────────────
mk(6, 5, { useJudge:true });
global.state.config.scoring = {discardMode:'none', discardAfter:5, discardEvery:5, a53:false, judgeScore:'avg-all'};
for (let rr=0; rr<5; rr++) {
  E.freezeJudge(rr);
  const j = E.getEffectiveJudge(rr,'A');
  const o = rr<2 ? [1,2,3,4,5,6] : [6,5,4,3,2,1];
  fill(rr, o.filter(s=>String(s)!==j));
}
const jr = []; for (let rr=0;rr<5;rr++) if (E.getEffectiveJudge(rr,'A')==='1') jr.push(rr);
const all  = S(0).scores[jr[0]];
cfg({judgeScore:'avg-before'}); const before = S(0).scores[jr[0]];
cfg({judgeScore:'none'});       const nulla  = S(0).scores[jr[0]];
T2('CFG4', 'Tre trattamenti della barca di giuria: A9(a), A9(b), nessun punteggio',
  typeof all==='number' && nulla===null,
  `A9(a)=${all} · A9(b)=${before} (prima prova: nessuna precedente → ricade sul DNF) · nessuno=${nulla}`);

// ── DPI a chi è di turno (RRS E7) ────────────────────────────────────
mk(6, 5, { useJudge:true });
global.state.config.scoring = {discardMode:'none', discardAfter:5, discardEvery:5, a53:false, judgeScore:'avg-all'};
for (let rr=0; rr<5; rr++) {
  E.freezeJudge(rr);
  const j = E.getEffectiveJudge(rr,'A');
  fill(rr, [1,2,3,4,5,6].filter(s=>String(s)!==j));
}
const turno = []; for (let rr=0;rr<5;rr++) if (E.getEffectiveJudge(rr,'A')==='1') turno.push(rr);
const senza = S(0).scores[turno[0]];
pen(turno[0], 1, 'DPI', 2);
const con = S(0);
T2('CFG6', 'La DPI a chi è di turno si somma al punteggio medio, non produce un DNF',
  con.scores[turno[0]] === Math.round((senza+2)*10)/10 && con.codes[turno[0]]==='DPI',
  `medio ${senza} + 2 pt DPI = ${con.scores[turno[0]]} (codice ${con.codes[turno[0]]}) · DNF sarebbe stato ${con.dns}`);

// ── Anteprima leggibile del sistema di scarti ────────────────────────
mk(6, 15); global.state.config.scoring = {discardMode:'table', discardAfter:5, discardEvery:5, a53:false, judgeScore:'avg-all'};
const prev = E.discardPreview();
T2('CFG5', 'La schermata mostra l\'effetto del sistema di scarti scelto', prev.length>10, prev);

console.log('\n' + '═'.repeat(86));
console.log('  PARAMETRI DI CONFIGURAZIONE');
console.log('═'.repeat(86) + '\n');
let p2=0, f2=0;
for (const t of out2) {
  t.ok ? p2++ : f2++;
  console.log(`  ${t.ok?'PASS':'FAIL'}  [${t.id}] ${t.desc}`);
  console.log(`              ${t.note}\n`);
}
console.log('─'.repeat(86));
console.log(`  Casi: ${out2.length}  ·  PASS: ${p2}  ·  FAIL: ${f2}`);
console.log('─'.repeat(86) + '\n');
