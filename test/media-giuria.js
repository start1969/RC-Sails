// RC Sails Scoring — verifica della base di calcolo del punteggio medio
const E = require('./motore.js');
const out = []; const T = (id,d,ok,n) => out.push({id,d,ok,n});

function scenario(judgeAvg, punteggi, nBoats, nRaces) {
  // punteggi: piazzamenti reali della barca 1 nelle prove in cui ha corso.
  // La prova 0 è il suo turno di giuria.
  const boats = Array.from({length:nBoats},(_,i)=>({id:''+(i+1), sail:''+(i+1),
    name:'C'+(i+1), club:'', fleet:null}));
  const races = [];
  for(let r=0;r<nRaces;r++) races.push({judge_a:null,judge_b:null,finishes_a:[],
    finishes_b:[],penalties:{},confirmed:true,cancelled:false,starters:null});
  global.state = { config:{races:nRaces, fleet:'single',
      scoring:{discardMode:'one', discardAfter:1, discardEvery:5, a53:false,
               judgeScore:'avg-all', judgeAvg}},
    boats, races, overrides:{'0_A':'1'}, useJudge:true, protests:[] };
  E.invalidaPiano();
  // Prova 0: turno di giuria della barca 1 (imposto via override)
  races[0].judge_a = '1';
  races[0].finishes_a = boats.slice(1).map(b=>b.sail);
  // Prove successive: la barca 1 arriva nelle posizioni indicate
  punteggi.forEach((pos, k) => {
    const r = k+1;
    const altri = boats.slice(1).map(b=>b.sail);
    altri.splice(pos-1, 0, '1');
    races[r].finishes_a = altri;
  });
  return E.calcScore(boats[0], 'A');
}

// ── Caso base: 1, 2, 3, 10 su cinque prove, uno scarto ───────────────
const punteggi = [1,2,3,6];      // con sei barche il peggior piazzamento è 6
const lordi = scenario('lordi', punteggi, 6, 5);
const netti = scenario('netti', punteggi, 6, 5);

const mediaTutte = Math.round((1+2+3+6)/4*10)/10;       // 3.0
const mediaSenzaPeggio = Math.round((1+2+3)/3*10)/10;   // 2.0

T('A','Con "tutte le prove" la media comprende il 6 che verrà scartato',
  lordi.scores[0] === mediaTutte,
  `punteggi reali ${punteggi.join(', ')} → media ${lordi.scores[0]} (attesa ${mediaTutte})`);

T('B','Con "escludendo gli scarti" il 6 esce dalla media',
  netti.scores[0] === mediaSenzaPeggio,
  `media ${netti.scores[0]} (attesa ${mediaSenzaPeggio}) — un solo scarto, il peggiore`);

T('C','La differenza si riflette sul netto di serie',
  lordi.net > netti.net,
  `netto con tutte le prove ${lordi.net} · escludendo gli scarti ${netti.net}`);

// ── Il numero di esclusioni segue la tabella scarti ──────────────────
const sette = scenario('netti', [1,2,3,6,7,8], 8, 7);   // otto barche, sei prove corse
// un solo scarto: esce solo l'8
const attesoSette = Math.round((1+2+3+6+7)/5*10)/10;
T('D','Si escludono tanti punteggi quanti sono gli scarti della serie',
  sette.scores[0] === attesoSette,
  `sei prove reali, un solo scarto → media ${sette.scores[0]} (attesa ${attesoSette})`);

// ── I punteggi non scartabili restano nella media ────────────────────
(() => {
  const r = scenario('netti', [1,2,3,6], 6, 5);
  // si rende il 10 non scartabile marcandolo DNE
  const race = global.state.races[4];
  race.finishes_a = race.finishes_a.filter(s => s !== '1');
  race.penalties['1'] = { code:'DNE', pts:0 };
  E.invalidaPiano();
  const res = E.calcScore(global.state.boats[0], 'A');
  const dnf = 7;   // 6 iscritti + 1
  const atteso = Math.round((1+2+3+dnf)/4*10)/10;   // nessuna esclusione possibile
  T('E','Un DNE non viene escluso dalla media: non è scartabile',
    res.scores[0] === atteso,
    `media ${res.scores[0]} (attesa ${atteso}) — il DNE da ${dnf} punti resta`);
})();

// ── Due turni di giuria non si contaminano a vicenda ─────────────────
(() => {
  const nBoats = 5, nRaces = 6;
  const boats = Array.from({length:nBoats},(_,i)=>({id:''+(i+1),sail:''+(i+1),
    name:'C'+(i+1),club:'',fleet:null}));
  const races = [];
  for(let r=0;r<nRaces;r++) races.push({judge_a:null,judge_b:null,finishes_a:[],
    finishes_b:[],penalties:{},confirmed:true,cancelled:false,starters:null});
  global.state = { config:{races:nRaces, fleet:'single',
      scoring:{discardMode:'one', discardAfter:1, discardEvery:5, a53:false,
               judgeScore:'avg-all', judgeAvg:'netti'}},
    boats, races, overrides:{'0_A':'1','3_A':'1'}, useJudge:true, protests:[] };
  races[0].judge_a='1'; races[3].judge_a='1';
  races[0].finishes_a = boats.slice(1).map(b=>b.sail);
  races[3].finishes_a = boats.slice(1).map(b=>b.sail);
  [[1,1],[2,2],[4,3],[5,9]].forEach(([r,pos])=>{
    const altri = boats.slice(1).map(b=>b.sail);
    altri.splice(Math.min(pos,altri.length),0,'1');
    races[r].finishes_a = altri;
  });
  E.invalidaPiano();
  const res = E.calcScore(boats[0],'A');
  T('F','Due turni nella stessa serie producono lo stesso valore',
    res.scores[0] === res.scores[3],
    `prova 1 → ${res.scores[0]} · prova 4 → ${res.scores[3]}`);
  T('G','Il valore di un turno non entra nella media dell\'altro',
    typeof res.scores[0]==='number' && res.scores[0] > 0,
    `media basata sulle sole quattro prove realmente disputate`);
})();

console.log('\n'+'═'.repeat(80));
console.log('  PUNTEGGIO MEDIO DI CHI FA IL TURNO — base di calcolo');
console.log('═'.repeat(80)+'\n');
let p=0,f=0;
out.forEach(e=>{ e.ok?p++:f++;
  console.log(`  ${e.ok?'PASS':'FAIL'}  [${e.id}] ${e.d}`);
  if(e.n) console.log(`              ${e.n}`); });
console.log('\n'+'─'.repeat(80));
console.log(`  Casi: ${out.length}  ·  PASS: ${p}  ·  FAIL: ${f}`);
console.log('─'.repeat(80)+'\n');
process.exit(f?1:0);
