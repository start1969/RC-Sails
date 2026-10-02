// RC Sails Scoring — Copyright © 2026 Stefano Ragusa. Tutti i diritti riservati.
// Estratto automaticamente dal blocco applicativo di index.html.
function saveState(){ invalidaPiano(); }
function renderStandings(){}
function renderRotation(){}
function renderBoatList(){}
function showToast(){}
let cachePiano = {};

const SCHEMA_VERSION = 15;

const round1 = v => Math.round(v * 10) / 10;

const CODES = {
  DNC: {dnf:true,  moveUp:true,  exclud:true,  desc:"Non venuta in area di partenza"},
  DNS: {dnf:true,  moveUp:true,  exclud:true,  desc:"Non partita"},
  OCS: {dnf:true,  moveUp:true,  exclud:true,  desc:"Sul lato percorso alla partenza (RRS 30.1)"},
  UFD: {dnf:true,  moveUp:true,  exclud:true,  desc:"Squalifica bandiera U (RRS 30.3)"},
  BFD: {dnf:true,  moveUp:true,  exclud:true,  desc:"Squalifica bandiera nera (RRS 30.4)"},
  NSC: {dnf:true,  moveUp:true,  exclud:true,  desc:"Non ha percorso il percorso"},
  DNF: {dnf:true,  moveUp:true,  exclud:true,  desc:"Non ha terminato"},
  RET: {dnf:true,  moveUp:true,  exclud:true,  desc:"Ritirata dopo l'arrivo"},
  DSQ: {dnf:true,  moveUp:true,  exclud:true,  desc:"Squalificata"},
  DNE: {dnf:true,  moveUp:true,  exclud:false, desc:"Squalifica non scartabile (RRS 90.3(b))"},
  DGM: {dnf:true,  moveUp:true,  exclud:false, desc:"Squalifica per grave cattiva condotta"},
  DPI: {dnf:false, moveUp:false, exclud:true,  desc:"Penalità discrezionale a punti (RRS E7)"},
  RDG: {dnf:false, moveUp:false, exclud:true,  desc:"Riparazione concessa (RRS A6.2)"}
};

const DISCARD_TABLE = [
  [1,0],[2,0],[3,0],[4,0],[5,1],[6,1],[7,1],[8,1],
  [9,2],[10,2],[11,2],[12,3],[13,3],[14,3],[15,4],
  [16,4],[17,5],[18,5],[19,6],[20,6]
];

function fleetOf(boat) { return (boat && boat.fleet) || "A"; }

function getBoatsByFleet(fleet) {
  if(state.config.fleet!=="multi") return state.boats;
  return state.boats.filter(b=>fleetOf(b)===fleet);
}

function getPenalty(raceIdx, sail) {
  const race = state.races[raceIdx];
  const p = race && race.penalties && race.penalties[sail];
  return (p && CODES[p.code]) ? p : null;
}

function disponibileGiuria(b) { return !b.noGiuria; }

function invalidaPiano() { cachePiano = {}; }

function pianoGiuria(fleet) {
  if(cachePiano[fleet]) return cachePiano[fleet];

  const tutte = getBoatsByFleet(fleet);
  const liberi = tutte.filter(disponibileGiuria);
  const turni = new Map(tutte.map(b => [b.sail, 0]));
  const piano = [];

  for(let r = 0; r < state.config.races; r++) {
    const race = state.races[r];
    const ov     = state.overrides && state.overrides[r + "_" + fleet];
    const cong   = race && race["judge_" + String(fleet).toLowerCase()];
    let sail = null, fonte = "auto";

    if(ov)        { sail = ov;   fonte = "imposto"; }
    else if(cong) { sail = cong; fonte = "congelato"; }
    else if(liberi.length) {
      // Il meno caricato; a parità vince l'ordine di iscrizione
      let min = Infinity;
      for(const b of liberi) {
        const t = turni.get(b.sail) || 0;
        if(t < min) { min = t; sail = b.sail; }
      }
    }
    piano.push({ sail, fonte });
    if(sail != null) turni.set(sail, (turni.get(sail) || 0) + 1);
  }
  cachePiano[fleet] = piano;
  return piano;
}

function getAutoJudge(raceIdx, fleet) {
  const p = pianoGiuria(fleet)[raceIdx];
  return p ? p.sail : null;
}

function contaTurni(fleet) {
  const c = new Map();
  pianoGiuria(fleet).forEach(p => {
    if(p.sail != null) c.set(p.sail, (c.get(p.sail) || 0) + 1);
  });
  return c;
}

function freezeJudge(raceIdx) {
  const race = state.races[raceIdx];
  if(!race || !state.useJudge) return;
  if(!race.judge_a) race.judge_a = getAutoJudge(raceIdx, "A");
  if(state.config.fleet==="multi" && !race.judge_b) race.judge_b = getAutoJudge(raceIdx, "B");
}

function getEffectiveJudge(raceIdx, fleet) {
  if(!state.useJudge) return null;
  const ov = state.overrides && state.overrides[raceIdx+"_"+fleet];
  if(ov) return ov;
  const race = state.races[raceIdx];
  const frozen = race && race["judge_"+String(fleet).toLowerCase()];
  return frozen || getAutoJudge(raceIdx, fleet);
}

function scoringCfg() {
  return (state.config && state.config.scoring) || {
    discardMode:"table", discardAfter:5, discardEvery:5, a53:false, judgeScore:"avg-all"
  };
}

function getDiscards(n_races) {
  const sc = scoringCfg();
  if(sc.discardMode==="none") return 0;
  if(n_races < (sc.discardAfter||1)) return 0;
  switch(sc.discardMode) {
    case "one":   return 1;
    case "every": return Math.floor(n_races / Math.max(2, sc.discardEvery||5));
    case "table":
    default: {
      const row = DISCARD_TABLE.find(r=>r[0]===n_races);
      if(row) return row[1];
      if(n_races>20) return 6 + Math.ceil((n_races-20)/2);
      return 0;
    }
  }
}

function discardPreview() {
  const sc = scoringCfg(), n = state.config.races||15, out = [];
  let prev = -1;
  for(let i=1;i<=n;i++) {
    const d = getDiscards(i);
    if(d!==prev) { out.push(`${i}${i===n?"":"+"} prove → ${d} scart${d===1?"o":"i"}`); prev=d; }
  }
  return out.slice(0,6).join(" · ");
}

function findDiscardIndices(scores, noDiscard) {
  const played = scores
    .map((s,i)=> s!==null ? {v:s, i:i, fixed: noDiscard ? !!noDiscard[i] : false} : null)
    .filter(Boolean);
  const n = getDiscards(played.length);
  if(!n) return new Set();
  const sortable = played.filter(x=>!x.fixed).sort((a,b)=> b.v-a.v || a.i-b.i);
  return new Set(sortable.slice(0,n).map(x=>x.i));
}

function rankedOrder(raceIdx, fleet) {
  const race = state.races[raceIdx];
  if(!race) return [];
  const isMulti = state.config.fleet==="multi";
  const raw = isMulti ? (fleet==="B" ? race.finishes_b : race.finishes_a) : race.finishes_a;
  return (raw||[]).filter(s=>{
    const p = getPenalty(raceIdx, s);
    return !(p && CODES[p.code].moveUp);
  });
}

function rawFinishes(raceIdx, fleet) {
  const race = state.races[raceIdx];
  if(!race) return [];
  const isMulti = state.config.fleet==="multi";
  return (isMulti ? (fleet==="B" ? race.finishes_b : race.finishes_a) : race.finishes_a) || [];
}

function countPlayed(fleet) {
  return state.races.filter((r,i)=>{
    if(!r || r.cancelled) return false;
    return rawFinishes(i, fleet).length>0;
  }).length;
}

function calcScore(boat, fleet) {
  const sc       = scoringCfg();
  const isMulti  = state.config.fleet==="multi";
  const fl       = isMulti ? (fleet || fleetOf(boat)) : "A";
  const entered  = isMulti ? getBoatsByFleet(fl).length : state.boats.length;
  const dns      = entered + 1;              // RRS A5.2 — iscritti alla serie + 1

  // RRS A5.3 (solo se invocata dal Bando): DNS/DNF/DSQ sui partenti,
  // DNC sempre sugli iscritti alla serie.
  function dnsPoints(race, code) {
    if(!sc.a53 || code==="DNC") return dns;
    const st = (race && race.starters>0) ? race.starters : entered;
    return st + 1;
  }

  const scores = [], codes = [], noDiscard = [];

  for(let r=0; r<state.config.races; r++) {
    const race = state.races[r];
    if(!race || race.cancelled) { scores.push(null); codes.push(null); noDiscard.push(false); continue; }

    const judge   = getEffectiveJudge(r, fl);
    const started = rawFinishes(r, fl).length>0;
    const pen     = getPenalty(r, boat.sail);

    // Barca di turno — trattamento secondo il Bando (RRS A9).
    // La DPI non la esclude: un osservatore può infrangere una regola
    // (es. RRS E2.2) e il comitato può aggiungere punti (RRS E7).
    if(state.useJudge && boat.sail===judge && (!pen || pen.code==="DPI")) {
      if(sc.judgeScore==="none") { scores.push(null); codes.push(null); noDiscard.push(false); }
      else { scores.push("AVG"); codes.push("AVG"); noDiscard.push(false); }
      continue;
    }

    if(pen) {
      const c = CODES[pen.code];
      if(c.dnf) { scores.push(dnsPoints(race, pen.code)); codes.push(pen.code); noDiscard.push(!c.exclud); continue; }
      if(pen.code==="RDG") { scores.push(round1(pen.pts)); codes.push("RDG"); noDiscard.push(false); continue; }
    }

    const pos = rankedOrder(r, fl).indexOf(boat.sail);
    if(pos===-1) {
      // Prova non ancora confermata → nessun punteggio (evita falsi DNF in diretta)
      if(!started || !race.confirmed) { scores.push(null); codes.push(null); noDiscard.push(false); }
      else { scores.push(dnsPoints(race,"DNF")); codes.push("DNF"); noDiscard.push(false); }
    } else {
      // RRS E7 — la DPI aggiunge punti al piazzamento, le altre barche non cambiano
      const add = (pen && pen.code==="DPI") ? (pen.pts||0) : 0;
      scores.push(round1(pos+1+add));
      codes.push(add ? "DPI" : null);
      noDiscard.push(false);
    }
  }

  // RRS A9 — punteggio medio, al decimo di punto con 0,05 per eccesso.
  // Si usano solo le prove realmente disputate: il filtro su codes esclude
  // gli altri turni di giuria, anche quelli già risolti in un numero.
  const proveGiocate = scores.filter(s => s !== null).length;
  for(let i=0;i<scores.length;i++) {
    if(scores[i]!=="AVG") continue;

    const reali = scores.map((s,k)=>({s,k}))
      .filter(o => typeof o.s === "number" && codes[o.k] !== "AVG");

    let base = reali.filter(o => sc.judgeScore !== "avg-before" || o.k < i);
    // A9(b) alla prima prova non ha precedenti: si ricade sulla media di tutte
    // le altre prove (A9(a)) anziché sul punteggio DNF, che sarebbe punitivo.
    if(!base.length) base = reali;

    // Base della media: tutte le prove, oppure solo quelle che contano per la
    // serie. Escludere gli scarti evita che la barca di turno sia valutata su
    // risultati che per tutti gli altri vengono eliminati.
    if(sc.judgeAvg === "netti" && base.length > 1) {
      const d = Math.min(getDiscards(proveGiocate), base.length - 1);
      if(d > 0) {
        // si tolgono i d peggiori fra gli scartabili: DNE e DGM restano
        const fuori = new Set(base
          .filter(o => !noDiscard[o.k])
          .sort((a,b) => b.s - a.s || a.k - b.k)
          .slice(0, d).map(o => o.k));
        base = base.filter(o => !fuori.has(o.k));
      }
    }

    const v = base.map(o => o.s);
    scores[i] = v.length ? round1(v.reduce((a,b)=>a+b,0)/v.length) : dns;
  }

  // RRS E7 — punti aggiunti a chi era di turno: si sommano al punteggio medio
  for(let i=0;i<scores.length;i++) {
    if(codes[i]!=="AVG") continue;
    const p = getPenalty(i, boat.sail);
    if(p && p.code==="DPI") { scores[i] = round1(scores[i] + (p.pts||0)); codes[i] = "DPI"; }
  }

  const played = scores.filter(s=>s!==null);
  if(!played.length)
    return {scores, codes, noDiscard, dneFlags:noDiscard, gross:0, disc:0, net:0, n_played:0, dns, discIndices:new Set()};

  const gross       = round1(played.reduce((a,b)=>a+b,0));
  const discIndices = findDiscardIndices(scores, noDiscard);
  const disc        = round1([...discIndices].reduce((s,i)=>s+scores[i],0));

  return {
    scores, codes, noDiscard, dneFlags:noDiscard,
    gross, disc, net: round1(gross-disc),
    n_played: played.length, dns, discIndices
  };
}

function compareSeries(a, b) {
  if(a.n_played===0 && b.n_played===0) return 0;
  if(a.n_played===0) return 1;
  if(b.n_played===0) return -1;
  if(a.net!==b.net) return a.net-b.net;

  // A8.1 — punteggi NON scartati, dal migliore al peggiore
  const listNonScartati = x => x.scores
    .map((v,i)=>({v,i}))
    .filter(o=>o.v!==null && !x.discIndices.has(o.i))
    .map(o=>o.v).sort((p,q)=>p-q);
  const sA = listNonScartati(a), sB = listNonScartati(b);
  for(let k=0; k<Math.min(sA.length,sB.length); k++)
    if(sA[k]!==sB[k]) return sA[k]-sB[k];

  // A8.2 — ultima prova a ritroso, gli scarti CONTANO
  for(let r=state.config.races-1; r>=0; r--) {
    const x=a.scores[r], y=b.scores[r];
    if(x===null && y===null) continue;
    if(x===null) return 1;
    if(y===null) return -1;
    if(x!==y) return x-y;
  }
  return 0;
}

module.exports={CODES,getBoatsByFleet,getAutoJudge,pianoGiuria,contaTurni,disponibileGiuria,invalidaPiano,freezeJudge,getEffectiveJudge,scoringCfg,getDiscards,discardPreview,calcScore,findDiscardIndices,compareSeries,countPlayed,getPenalty,rankedOrder};
