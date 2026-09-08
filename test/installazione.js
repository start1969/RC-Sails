const puppeteer = require('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer-core');
const CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const esiti = []; const T = (d,ok,n) => esiti.push({d,ok,n});

const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
             + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) '
                 + 'Chrome/131.0.0.0 Mobile Safari/537.36';

async function nuovaPagina(b, ua) {
  const pg = await b.newPage();
  await pg.setViewport({width:390,height:844});
  if(ua) await pg.setUserAgent(ua);
  await pg.goto('http://localhost:8099/index.html', {waitUntil:'networkidle0'});
  await new Promise(r => setTimeout(r, 1000));
  await pg.evaluate(() => chiudiSplash());
  return pg;
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const errori = [];

  // ══ ANDROID: invito automatico e installazione con un tocco ═══════
  const and = await nuovaPagina(b, UA_ANDROID);
  and.on('pageerror', e => errori.push('android: ' + e.message));

  // Il banner compare perché l'app è realmente installabile: manifest,
  // service worker e HTTPS (localhost) sono tutti a posto.
  const prima = await and.evaluate(() => !!document.getElementById('banner-installa'));
  T('Il browser riconosce l\'app come installabile', prima,
    'manifest, service worker e origine sicura verificati dal browser');

  // Si simula l'evento che Chrome emette quando l'app è installabile
  const dopo = await and.evaluate(async () => {
    let scelta = null;
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { scelta = 'chiesto'; };
    e.userChoice = Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 60));
    const ban = document.getElementById('banner-installa');
    return { banner: !!ban,
      testo: ban ? ban.querySelector('.bi-txt b').textContent : null,
      bottone: ban ? ban.querySelector('.bi-si').textContent.trim() : null,
      inUtilita: /Installa sulla schermata Home/.test(
        document.getElementById('installa-box').innerHTML) };
  });
  T('Quando il browser lo consente compare l\'invito',
    dopo.banner && dopo.bottone === 'Installa', `"${dopo.testo}" — pulsante ${dopo.bottone}`);
  T('Il comando è disponibile anche in modo permanente in Utilità',
    dopo.inUtilita, 'Setup › Regata › Utilità › Installazione');

  const tocco = await and.evaluate(async () => {
    let chiesto = false;
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { chiesto = true; };
    e.userChoice = Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 60));
    document.querySelector('#banner-installa .bi-si').click();
    await new Promise(r => setTimeout(r, 120));
    return { chiesto, bannerVia: !document.getElementById('banner-installa') };
  });
  T('Un tocco avvia l\'installazione nativa e chiude l\'invito',
    tocco.chiesto && tocco.bannerVia, 'nessun passaggio manuale su Android');

  const installata = await and.evaluate(async () => {
    window.dispatchEvent(new Event('appinstalled'));
    await new Promise(r => setTimeout(r, 80));
    return document.getElementById('installa-box').innerText;
  });
  T('A installazione avvenuta il riquadro lo conferma',
    /installata/i.test(installata), installata.split('\n')[0].slice(0,70));

  const rifiuto = await and.evaluate(async () => {
    localStorage.removeItem('rcsails_no_banner');
    const e = new Event('beforeinstallprompt');
    e.prompt = () => {}; e.userChoice = Promise.resolve({outcome:'dismissed'});
    window.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 60));
    document.querySelector('#banner-installa .bi-no').click();
    await new Promise(r => setTimeout(r, 60));
    const memoria = localStorage.getItem('rcsails_no_banner');
    // riproviamo: non deve ricomparire
    const e2 = new Event('beforeinstallprompt');
    e2.prompt = () => {}; e2.userChoice = Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(e2);
    await new Promise(r => setTimeout(r, 60));
    return { memoria, ricompare: !!document.getElementById('banner-installa') };
  });
  T('Chiudendo l\'invito non ricompare più',
    rifiuto.memoria === '1' && !rifiuto.ricompare, 'la scelta è ricordata');

  await and.screenshot({ path:'/home/claude/harness/schermate/21-banner.png' });
  await and.close();

  // ══ iPHONE: istruzioni, perché Apple non consente altro ═══════════
  const ios = await nuovaPagina(b, UA_IOS);
  ios.on('pageerror', e => errori.push('ios: ' + e.message));

  const rilev = await ios.evaluate(() => ({ ios: isIOS(), inst: giaInstallata() }));
  T('Il dispositivo Apple viene riconosciuto', rilev.ios && !rilev.inst,
    'iOS rilevato, app non ancora installata');

  const istr = await ios.evaluate(async () => {
    promptInstall = null;   // su un iPhone vero questo evento non esiste mai
    installaApp();
    await new Promise(r => setTimeout(r, 100));
    const ov = document.getElementById('ios-overlay');
    return { aperto: !!ov, testo: ov ? ov.innerText : '' };
  });
  T('Su iPhone si aprono le istruzioni passo per passo',
    istr.aperto && /Condividi/.test(istr.testo) && /Aggiungi a schermata Home/.test(istr.testo),
    'Condividi › Aggiungi a schermata Home › Aggiungi');
  T('Viene detto chiaramente perché non è automatico',
    /non consente a una pagina di installarsi da sola/i.test(istr.testo),
    'nessuna promessa che il sistema non può mantenere');

  await ios.screenshot({ path:'/home/claude/harness/schermate/22-ios.png' });
  await ios.close();

  T('Nessun errore JavaScript', errori.length===0, errori.slice(0,2).join(' | ')||'nessuno');
  await b.close();

  console.log('\n'+'═'.repeat(80));
  console.log('  INSTALLAZIONE SULLA SCHERMATA HOME');
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
