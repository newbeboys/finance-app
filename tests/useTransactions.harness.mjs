/**
 * Harness perilaku useTransactions (Fase 1 sinkronisasi dompet bersama).
 *
 * Menjalankan hook ASLI di browser sungguhan dengan klien Supabase di-stub,
 * jadi yang diuji adalah kode produksi — bukan salinannya. Tidak menyentuh
 * jaringan/Supabase sama sekali.
 *
 *   node tests/useTransactions.harness.mjs
 *
 * Server vite-nya dinyalakan & dimatikan sendiri oleh skrip ini.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.HARNESS_PORT || 5199);
const URL = `http://localhost:${PORT}/tests/harness/index.html`;

const results = [];
const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail });

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--config', 'tests/harness/vite.config.js', '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );
  // Kesiapan dideteksi dengan menembak URL-nya, bukan dengan mencocokkan
  // teks di stdout: format banner vite berubah antar-versi dan di Windows
  // (shell: true) stdout anak kadang tidak ter-pipe utuh.
  return new Promise(async (resolve, reject) => {
    let dead = null;
    child.on('exit', (code) => { dead = code; });
    const until = Date.now() + 60_000;
    while (Date.now() < until) {
      if (dead !== null) return reject(new Error('vite keluar, code ' + dead));
      try {
        const r = await fetch(URL);
        if (r.ok) return resolve(child);
      } catch {}
      await new Promise(r => setTimeout(r, 400));
    }
    child.kill();
    reject(new Error('vite tidak siap dalam 60 dtk'));
  });
}

const vite = await startVite();
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(URL);
await page.waitForFunction(() => window.__stub && window.__api);

const out = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const S = window.__stub;
  const A = () => window.__api;
  const L = window.__lock;
  const log = {};
  const row = (id, amount, merchant) => ({
    id, date: '2026-09-12', time: '10:00', merchant: merchant || ('M' + id), note: '',
    category: 'food', method: 'Tunai', amount, wallet_id: 'w1', debt_id: null, user_id: 'user-1',
  });

  S.rows = [row('a', -1000), row('b', -2000)];
  await A().refreshTransactions();
  await sleep(30);
  log.t0_len = A().transactions.length;

  // ── debounce ────────────────────────────────────────────────────────
  const sel2 = S.selectCount;
  log.t2_skip = (await A().autoRefetchTransactions()).skipped;
  await sleep(30);
  log.t2_noNewSelect = (S.selectCount === sel2);

  const realNow = Date.now;
  let offset = 61000;
  Date.now = () => realNow.call(Date) + offset;
  const sel3 = S.selectCount;
  log.t3_skip = (await A().autoRefetchTransactions()).skipped;
  await sleep(40);
  log.t3_newSelect = (S.selectCount === sel3 + 1);

  // ── gerbang keamanan ────────────────────────────────────────────────
  offset += 61000;
  L.setAppLocked(true);
  const sel5 = S.selectCount;
  log.t5_skip = (await A().autoRefetchTransactions()).skipped;
  await sleep(40);
  log.t5_noNewSelect = (S.selectCount === sel5);

  let unlockFired = 0;
  const unsub = L.subscribeAppLock(locked => { if (!locked) unlockFired++; });
  L.setAppLocked(false);
  unsub();
  log.t5b_unlockFired = unlockFired;
  const sel5b = S.selectCount;
  log.t5b_skip = (await A().autoRefetchTransactions()).skipped;
  await sleep(40);
  log.t5b_newSelect = (S.selectCount === sel5b + 1);

  // ── create transaksi normal ─────────────────────────────────────────
  offset += 61000;
  const lenBefore = A().transactions.length;
  await A().createTransaction({ amount: -5000, category: 'food', dateRaw: '2026-09-12', wallet_id: 'w1', merchant: 'Baru' });
  await sleep(30);
  log.t7_rpc = S.rpcCalls[S.rpcCalls.length - 1] && S.rpcCalls[S.rpcCalls.length - 1].name;
  log.t7_lenDelta = A().transactions.length - lenBefore;
  log.t7_firstMerchant = A().transactions[0] && A().transactions[0].merchant;
  log.t7_firstAmount = A().transactions[0] && A().transactions[0].amount;

  // ══ JALUR OTOMATIS: MENGANTRE di belakang tulisan, bukan skip ════════
  // (sebelumnya `{skipped:'pending-write'}` — asimetri itu sudah ditutup)
  S.rows = [row('a', -1000), row('b', -2000)];
  await A().refreshTransactions();
  await sleep(20);
  offset += 61000;
  S.holdRpc = true;
  const wAuto = A().createTransaction({ amount: -3000, category: 'food', dateRaw: '2026-09-12', wallet_id: 'w1', merchant: 'AutoAntre' });
  await sleep(10);
  const selAuto = S.selectCount;
  const autoP = A().autoRefetchTransactions();        // dipicu selagi write terbang
  await sleep(60);
  log.a_noSelectWhileWaiting = (S.selectCount === selAuto);
  S.rows = [row('n3', -3000, 'AutoAntre'), row('a', -1000), row('b', -2000)];
  S.pendingRpc.resolve({ data: 'rpc-3', error: null });
  S.holdRpc = false;
  const autoRes = await autoP;
  await wAuto;
  await sleep(40);
  log.a_skipped = autoRes.skipped;
  log.a_selectAfter = (S.selectCount === selAuto + 1);
  log.a_rowSurvives = A().transactions.some(t => t.merchant === 'AutoAntre');

  // ── re-cek SETELAH antre: app keburu terkunci selagi menunggu ────────
  offset += 61000;
  S.holdRpc = true;
  const wLock = A().deleteTransaction('b');
  await sleep(10);
  const selLock = S.selectCount;
  const autoLockP = A().autoRefetchTransactions();
  await sleep(30);
  L.setAppLocked(true);                                // terkunci DI TENGAH antrean
  S.pendingRpc.resolve({ data: null, error: null });
  S.holdRpc = false;
  const lockRes = await autoLockP;
  await wLock;
  await sleep(40);
  log.b_skipAfterDrain = lockRes.skipped;
  log.b_noSelect = (S.selectCount === selLock);
  L.setAppLocked(false);

  // ── re-cek SETELAH antre: fetch lain sudah sukses selagi menunggu ────
  // lastFetchAtRef tidak diekspos, jadi "fetch lain barusan sukses"
  // disimulasikan lewat jam: `offAtFetch` dicatat tepat setelah sebuah fetch
  // SUKSES, sehingga jaraknya ke lastFetchAtRef diketahui persis. Pemeriksaan
  // pertama dibuat lolos (+61 dtk), lalu selagi antre jam dikembalikan ke
  // dalam jendela debounce — nilai yang sama yang dibaca pemeriksaan kedua.
  await A().refreshTransactions();
  await sleep(20);
  const offAtFetch = offset;
  offset = offAtFetch + 61000;                          // cek PERTAMA: lolos
  S.holdRpc = true;
  const wDeb = A().deleteTransaction('a');
  await sleep(10);
  const selDeb = S.selectCount;
  const autoDebP = A().autoRefetchTransactions();
  await sleep(30);
  offset = offAtFetch + 1000;                           // cek KEDUA: masih < 60 dtk
  S.pendingRpc.resolve({ data: null, error: null });
  S.holdRpc = false;
  const debRes = await autoDebP;
  await wDeb;
  await sleep(40);
  log.c_skipAfterDrain = debRes.skipped;
  log.c_noSelect = (S.selectCount === selDeb);
  offset = offAtFetch + 61000;

  // ── refresh MANUAL: mengabaikan debounce, tetap mengantre ───────────
  const sel6 = S.selectCount;
  await A().refreshTransactions();
  await sleep(30);
  log.t6_newSelect = (S.selectCount === sel6 + 1);     // padahal baru saja fetch

  S.rows = [row('a', -1000), row('b', -2000)];
  await A().refreshTransactions();
  await sleep(20);
  S.holdRpc = true;
  const wMan = A().createTransaction({ amount: -9000, category: 'food', dateRaw: '2026-09-12', wallet_id: 'w1', merchant: 'ManAntre' });
  await sleep(10);
  const selMan = S.selectCount;
  const manP = A().refreshTransactions();
  await sleep(60);
  log.m_noSelectWhileWaiting = (S.selectCount === selMan);
  log.m_refreshingTrue = A().refreshing === true;
  S.rows = [row('n9', -9000, 'ManAntre'), row('a', -1000), row('b', -2000)];
  S.pendingRpc.resolve({ data: 'rpc-9', error: null });
  S.holdRpc = false;
  const manRes = await manP;
  await wMan;
  await sleep(40);
  log.m_selectAfter = (S.selectCount === selMan + 1);
  log.m_skipped = manRes && manRes.skipped;
  log.m_rowSurvives = A().transactions.some(t => t.merchant === 'ManAntre');
  log.m_refreshingFalse = A().refreshing === false;

  // ── tulisan GAGAL tidak boleh menggantung antrean (allSettled) ───────
  S.holdRpc = true;
  const wFail = A().deleteTransaction('zzz');
  await sleep(10);
  const selFail = S.selectCount;
  const failP = A().refreshTransactions();
  await sleep(50);
  log.f_noSelectWhileWaiting = (S.selectCount === selFail);
  S.pendingRpc.resolve({ data: null, error: { code: '42501', message: 'ditolak' } });
  S.holdRpc = false;
  await failP;
  await wFail;
  await sleep(30);
  log.f_selectAfter = (S.selectCount === selFail + 1);

  // ── REPLACE penuh ───────────────────────────────────────────────────
  S.rows = [row('b', -2000)];
  await A().refreshTransactions();
  await sleep(30);
  log.t8_len = A().transactions.length;
  log.t8_ids = A().transactions.map(t => t.id).join(',');

  Date.now = realNow;
  return log;
});

// Urutan listener DOM — dasar dari setTimeout(0) di app.jsx
const domOrder = await page.evaluate(() => new Promise(resolve => {
  let flagSetByLater = false;
  const first = () => { setTimeout(() => resolve({ seenByEarlier: flagSetByLater }), 0); };
  const second = () => { flagSetByLater = true; };
  window.addEventListener('focus', first);   // dipasang DULU (analog: effect di AuthenticatedApp)
  window.addEventListener('focus', second);  // dipasang BELAKANGAN (analog: useAutoLock di App)
  window.dispatchEvent(new Event('focus'));
}));

await browser.close();
vite.kill();

const L = out;
ok('create transaksi normal: RPC record_transaction, 1 baris di posisi teratas',
  L.t7_rpc === 'record_transaction' && L.t7_lenDelta === 1 && L.t7_firstMerchant === 'Baru' && L.t7_firstAmount === -5000,
  JSON.stringify({ rpc: L.t7_rpc, d: L.t7_lenDelta }));
ok('debounce: refetch otomatis beruntun di-skip', L.t2_skip === 'debounced' && L.t2_noNewSelect, JSON.stringify({ s: L.t2_skip }));
ok('debounce: lewat 61 dtk -> jalan', L.t3_skip === null && L.t3_newSelect);
ok('gerbang keamanan: refetch otomatis di-skip saat terkunci', L.t5_skip === 'locked' && L.t5_noNewSelect);
ok('subscribeAppLock memberi sinyal saat unlock', L.t5b_unlockFired === 1, String(L.t5b_unlockFired));
ok('setelah unlock refetch otomatis jalan', L.t5b_skip === null && L.t5b_newSelect);
// ── simetri guard tulisan: jalur OTOMATIS ────────────────────────────
ok('OTOMATIS mengantre (bukan skip) selagi tulisan in-flight: nol fetch saat menunggu',
  L.a_noSelectWhileWaiting === true, JSON.stringify({ noSel: L.a_noSelectWhileWaiting }));
ok('OTOMATIS: setelah tulisan kelar fetch jalan tepat 1x, bukan skipped',
  L.a_selectAfter === true && L.a_skipped === null, JSON.stringify({ sel: L.a_selectAfter, skipped: L.a_skipped }));
ok('OTOMATIS: baris hasil tulisan tidak ter-rollback', L.a_rowSurvives === true);
ok('OTOMATIS: gerbang lock diperiksa ULANG setelah antre', L.b_skipAfterDrain === 'locked' && L.b_noSelect,
  JSON.stringify({ s: L.b_skipAfterDrain, noSel: L.b_noSelect }));
ok('OTOMATIS: debounce diperiksa ULANG setelah antre', L.c_skipAfterDrain === 'debounced' && L.c_noSelect,
  JSON.stringify({ s: L.c_skipAfterDrain, noSel: L.c_noSelect }));
// ── simetri guard tulisan: jalur MANUAL ──────────────────────────────
ok('MANUAL mengabaikan debounce', L.t6_newSelect === true);
ok('MANUAL mengantre selagi tulisan in-flight, spinner tetap jalan',
  L.m_noSelectWhileWaiting === true && L.m_refreshingTrue === true);
ok('MANUAL: fetch jalan tepat 1x setelah write kelar, tidak di-skip',
  L.m_selectAfter === true && L.m_skipped === null, JSON.stringify({ skipped: L.m_skipped }));
ok('MANUAL: baris hasil tulisan tidak ter-rollback', L.m_rowSurvives === true);
ok('MANUAL: spinner mati lagi setelah selesai', L.m_refreshingFalse === true);
ok('tulisan GAGAL tidak menggantung antrean (allSettled)', L.f_noSelectWhileWaiting === true && L.f_selectAfter === true);
ok('REPLACE penuh: baris yang hilang di server ikut hilang', L.t8_len === 1 && L.t8_ids === 'b', JSON.stringify({ n: L.t8_len, ids: L.t8_ids }));
ok('load awal + refresh mengisi daftar', L.t0_len === 2, String(L.t0_len));
ok('urutan DOM: setTimeout(0) melihat flag dari listener yang dipasang BELAKANGAN', domOrder.seenByEarlier === true);
// delete_transaction FAILED sengaja dipicu di uji "tulisan GAGAL" — log itu perilaku benar.
const unexpected = consoleErrors.filter(e => !e.includes('delete_transaction FAILED'));
ok('tidak ada error console/runtime tak terduga', unexpected.length === 0, unexpected.join(' | '));

let fail = 0;
for (const r of results) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '  -> ' + r.detail : '')); }
console.log('\n' + (results.length - fail) + '/' + results.length + ' lulus');
if (fail) console.log('RAW: ' + JSON.stringify(out));
process.exit(fail ? 1 : 0);
