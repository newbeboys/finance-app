/**
 * Regresi hotfix/owner-cant-see-member-transactions.
 *
 * Menguji hook useTransactions ASLI dengan Supabase di-stub. Sejak merge Task 5
 * (14 Sep 2026) hook itu sudah berbentuk fetchTransactions() terpisah + auto/
 * manual refetch — uji ini TIDAK menyentuh jalur refetch-nya, cukup load awal,
 * dan tetap relevan karena filter query-nya dibangun di tempat yang sama.
 * Fokusnya sempit dan sengaja BUKAN mereplikasi
 * semantik RLS/WHERE sungguhan (itu sudah dibuktikan e2e dua-akun terhadap
 * Supabase asli — lihat pesan commit hotfix ini): yang diverifikasi di sini
 * murni ARGUMEN yang dikirim ke query builder, yaitu apakah dompet yang
 * DIMILIKI user (fetchOwnedWalletIds) benar-benar ikut tergabung ke filter
 * `wallet_id.in.(…)` sebelum query transactions berangkat.
 *
 * Skenario yang dicek persis bug aslinya: user adalah OWNER sebuah dompet
 * (bukan member-nya sendiri di wallet_members — owner memang tidak pernah
 * punya baris di sana), dan tidak share dompet APA PUN dengan orang lain.
 * SEBELUM fix: fetchSharedWalletIds() sendirian → [] → sharedOrFilter
 * mengembalikan null → query jatuh ke `.eq('user_id', owner)` polos, yang
 * TIDAK PERNAH memuat dompet milik owner sendiri di cabang wallet_id.
 * SESUDAH fix: fetchOwnedWalletIds() menyumbang id dompet owner sendiri →
 * walletIds tidak kosong → sharedOrFilter mengembalikan string → `.or(...)`
 * dipakai, BUKAN `.eq('user_id', ...)` — dan string itu memuat dompet owner.
 *
 *   node tests/owner-visibility.harness.mjs
 *
 * Server vite-nya dinyalakan & dimatikan sendiri oleh skrip ini.
 */

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';

const PORT = Number(process.env.HARNESS_PORT || 5299);
const URL = `http://localhost:${PORT}/tests/harness/visibility.html`;

const results = [];
const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail });

// Bunuh vite BESERTA anak-anaknya, bukan cuma prosesnya sendiri.
// Di Windows `shell: true` membuat kita memegang pid cmd.exe, bukan pid
// node/vite-nya — `child.kill()` hanya membunuh shell dan meninggalkan vite
// YATIM yang tetap memegang port. Efeknya berbahaya dan senyap: run berikutnya
// gagal start (--strictPort) tapi probe fetch-nya SUKSES ke server lama, jadi
// yang diuji kode basi dengan config lama. Terverifikasi 14 Sep 2026 — justru
// di harness INI (uji lulus/gagal palsu saat stub-nya baru dipisah).
function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    // detached: true di spawn membuat anak jadi pemimpin grup; pid negatif
    // menyasar seluruh grup itu.
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--config', 'tests/harness/vite.visibility.config.js', '--port', String(PORT), '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',   // lihat killTree()
    }
  );
  // Kesiapan dideteksi dengan menembak URL-nya, bukan mencocokkan teks stdout
  // (format banner vite berubah antar-versi, dan di Windows dengan shell:true
  // stdout anak kadang tidak ter-pipe utuh).
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
    killTree(child);
    reject(new Error('vite tidak siap dalam 60 dtk'));
  });
}

const vite = await startVite();
// Jaring pengaman: kalau skrip ini mati di tengah (assert melempar, Ctrl+C),
// killTree(vite) di bawah tidak pernah tercapai dan port-nya bocor ke run berikutnya.
process.on('exit', () => killTree(vite));
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

// ── Skenario: owner PUNYA satu dompet sendiri, TIDAK share apa pun ───────
// Diseed SEBELUM navigasi (lihat komentar di stub-visibility.js) — bukan
// setelah page.goto — supaya sudah tersedia saat mount-effect hook jalan.
await page.addInitScript((scenario) => { window.__PRESEED__ = scenario; }, {
  wallets: [{ id: 'wallet-owned-by-owner-1' }],   // fetchOwnedWalletIds akan menemukan ini
  walletMembers: [],                              // owner bukan member di manapun (selalu begitu untuk dompet sendiri)
  // Transaksi ini "dicatat MEMBER LAIN" (user_id beda) di dompet owner —
  // persis baris yang sebelum fix tidak akan pernah owner lihat.
  transactionRows: [{
    id: 'tx-from-member', date: '2026-09-13', time: '10:00',
    merchant: 'Belanja Member', note: '', category: 'food', method: 'Tunai',
    amount: -25000, wallet_id: 'wallet-owned-by-owner-1', debt_id: null,
    user_id: 'member-x-not-owner',
  }],
});

await page.goto(URL);
await page.waitForFunction(() => window.__stub && window.__api && !window.__api.loading);

const out = await page.evaluate(async () => {
  const S = window.__stub;
  return {
    calls: { ...S.calls },
    lastOrFilter: S.lastOrFilter,
    lastEqUserId: S.lastEqUserId,
    txLen: window.__api.transactions.length,
    txIds: window.__api.transactions.map(t => t.id),
    loading: window.__api.loading,
  };
});

await browser.close();
killTree(vite);

ok('fetchOwnedWalletIds benar-benar di-query (tabel wallets ke-panggil)', out.calls.wallets >= 1, JSON.stringify(out.calls));
ok('fetchSharedMemberships tetap di-query (tabel wallet_members ke-panggil)', out.calls.wallet_members >= 1, JSON.stringify(out.calls));
ok('query transactions memakai .or(...), BUKAN fallback .eq("user_id",...)',
  out.lastOrFilter !== null && out.lastEqUserId === null,
  JSON.stringify({ or: out.lastOrFilter, eq: out.lastEqUserId }));
ok('filter .or(...) memuat dompet milik OWNER SENDIRI (wallet-owned-by-owner-1)',
  typeof out.lastOrFilter === 'string' && out.lastOrFilter.includes('wallet-owned-by-owner-1'),
  out.lastOrFilter);
ok('hook mengembalikan transaksi yang dicatat MEMBER LAIN di dompet owner',
  out.txLen === 1 && out.txIds[0] === 'tx-from-member', JSON.stringify({ len: out.txLen, ids: out.txIds }));
ok('loading selesai (tidak macet)', out.loading === false);
ok('tidak ada error console/runtime', consoleErrors.length === 0, consoleErrors.join(' | '));

let fail = 0;
for (const r of results) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '  -> ' + r.detail : '')); }
console.log('\n' + (results.length - fail) + '/' + results.length + ' lulus');
if (fail) console.log('RAW: ' + JSON.stringify(out));
process.exit(fail ? 1 : 0);
