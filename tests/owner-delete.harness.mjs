/**
 * Harness gerbang izin hapus/ubah transaksi — fitur owner-delete (13 Sep 2026).
 *
 * Menjalankan fungsi ASLI dari src/lib/walletAccess.js di browser sungguhan
 * (lewat vite, dengan '../supabase' dialihkan ke stub), jadi yang diuji kode
 * produksi — bukan salinannya. Tidak menyentuh jaringan/Supabase.
 *
 *   node tests/owner-delete.harness.mjs
 *
 * ══════════════════════════════════════════════════════════════════════
 * BATAS UJI — BACA SEBELUM MENYIMPULKAN "FITURNYA AMAN"
 *
 * Yang DIVERIFIKASI di sini: keputusan izin di SISI KLIEN, yaitu tombol mana
 * yang muncul dan pre-flight mana yang menolak.
 *
 * Yang TIDAK diverifikasi di sini, sama sekali:
 *   • policy RLS DELETE dan RPC delete_transaction (migrasi 20260919000000);
 *   • kebenaran pembalikan SALDO saat owner menghapus baris anggota;
 *   • penolakan baris ber-debt_id di cabang owner — itu HANYA ada di server
 *     (gerbang klien sengaja tidak mengeceknya, lihat T7/T8 di bawah).
 * Semua itu butuh Postgres sungguhan. Belum dijalankan; lihat laporan.
 * ══════════════════════════════════════════════════════════════════════
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.HARNESS_PORT || 5399);
const URL = `http://localhost:${PORT}/tests/harness/gates.html`;

const results = [];
const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail });

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--config', 'tests/harness/vite.config.js', '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );
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
await page.waitForFunction(() => !!window.__gates);

// ── Dunia uji ────────────────────────────────────────────────────────
// Satu dompet bersama `w-shared` yang DIMILIKI owner-1, dengan editor-1 &
// editor-2 sebagai editor aktif, viewer-1 sebagai viewer, dan ex-1 yang sudah
// keluar (status='left'). Bentuk objek dompet mengikuti toAppWallet() di
// useWallets.js: dompet yang aksesnya hilang TIDAK ADA di array sama sekali.
const WORLD = {
  // Sudut pandang masing-masing user atas w-shared + dompet pribadinya.
  accountsOwner:  [{ id: 'w-shared', isShared: false, role: 'owner',  canWrite: true }],
  accountsEditor: [{ id: 'w-shared', isShared: true,  role: 'editor', canWrite: true }],
  accountsViewer: [{ id: 'w-shared', isShared: true,  role: 'viewer', canWrite: false }],
  accountsExMember: [],   // ex-1 sudah left → dompet tidak pernah muncul di daftarnya

  txByEditor1:     { id: 't1', user_id: 'editor-1', wallet_id: 'w-shared', debt_id: null },
  txByEditor2:     { id: 't2', user_id: 'editor-2', wallet_id: 'w-shared', debt_id: null },
  txByOwner:       { id: 't3', user_id: 'owner-1',  wallet_id: 'w-shared', debt_id: null },
  txByExMember:    { id: 't4', user_id: 'ex-1',     wallet_id: 'w-shared', debt_id: null },
  txDebtByOwner:   { id: 't5', user_id: 'owner-1',  wallet_id: 'w-shared', debt_id: 'd-1' },
  txDebtByEditor1: { id: 't6', user_id: 'editor-1', wallet_id: 'w-shared', debt_id: 'd-1' },
};

const run = (fn, tx, userId, accounts) =>
  page.evaluate(([fn, tx, userId, accounts]) => window.__gates[fn](tx, userId, accounts),
    [fn, tx, userId, accounts]);

// ── (a) owner menghapus transaksi milik editor ───────────────────────
ok('T1 owner BOLEH hapus transaksi milik editor di dompetnya',
  await run('canDeleteTransaction', WORLD.txByEditor1, 'owner-1', WORLD.accountsOwner) === true);

ok('T2 owner TIDAK boleh EDIT transaksi milik editor (tetap ketat)',
  await run('canEditTransaction', WORLD.txByEditor1, 'owner-1', WORLD.accountsOwner) === false);

// Kasus pendorong utama fitur: pencatatnya sudah keluar dari dompet.
ok('T3 owner BOLEH hapus transaksi milik BEKAS anggota (status=left)',
  await run('canDeleteTransaction', WORLD.txByExMember, 'owner-1', WORLD.accountsOwner) === true);

ok('T4 bekas anggota sendiri tetap TIDAK boleh hapus transaksinya (dompet hilang dari daftarnya)',
  await run('canDeleteTransaction', WORLD.txByExMember, 'ex-1', WORLD.accountsExMember) === false);

// ── (b) editor TIDAK mewarisi hak owner ──────────────────────────────
ok('T5 editor TIDAK boleh hapus transaksi editor LAIN di dompet yang sama',
  await run('canDeleteTransaction', WORLD.txByEditor2, 'editor-1', WORLD.accountsEditor) === false);

ok('T6 viewer TIDAK boleh hapus transaksi orang lain',
  await run('canDeleteTransaction', WORLD.txByEditor1, 'viewer-1', WORLD.accountsViewer) === false);

// ── (c) baris ber-debt_id ────────────────────────────────────────────
// JUJUR: gerbang klien SENGAJA tidak mengecek debt_id (keputusan desain 13 Sep
// 2026). T7 mengunci perilaku yang SEBENARNYA — true — supaya tidak ada yang
// mengira klien ikut menjaganya. Penjaga sesungguhnya ada dua, keduanya di
// luar fungsi ini: (1) baris hutang orang lain tidak pernah masuk state klien
// (T8), (2) cabang owner di RPC mensyaratkan debt_id IS NULL (server, tidak
// diuji di sini).
ok('T7 [terdokumentasi, BUKAN penjaga] gerbang klien meloloskan owner atas baris debt_id milik editor',
  await run('canDeleteTransaction', WORLD.txDebtByEditor1, 'owner-1', WORLD.accountsOwner) === true,
  'penjaga sebenarnya: filter fetch (T8) + RPC server');

// Penjaga #1 yang benar-benar bisa diuji di klien: filter fetch mengecualikan
// baris hutang dari cabang dompet bersama, jadi baris T7 tidak pernah sampai.
const orFilter = await page.evaluate(() =>
  window.__gates.sharedOrFilter('owner-1', ['w-shared'], 'wallet_id', { excludeDebt: true }));
ok('T8 filter fetch mengecualikan baris hutang dari cabang dompet (debt_id.is.null)',
  typeof orFilter === 'string' && orFilter.includes('debt_id.is.null'), orFilter);

// ── (d) regresi: perilaku self-delete TIDAK berubah ──────────────────
ok('T9 REGRESI pencatat tetap boleh hapus transaksi biasa miliknya sendiri',
  await run('canDeleteTransaction', WORLD.txByOwner, 'owner-1', WORLD.accountsOwner) === true);

ok('T10 REGRESI pencatat tetap boleh hapus transaksi ber-debt_id miliknya sendiri',
  await run('canDeleteTransaction', WORLD.txDebtByOwner, 'owner-1', WORLD.accountsOwner) === true);

ok('T11 REGRESI editor tetap boleh hapus transaksi biasa miliknya sendiri',
  await run('canDeleteTransaction', WORLD.txByEditor1, 'editor-1', WORLD.accountsEditor) === true);

ok('T12 REGRESI editor tetap boleh EDIT transaksi miliknya sendiri',
  await run('canEditTransaction', WORLD.txByEditor1, 'editor-1', WORLD.accountsEditor) === true);

ok('T13 REGRESI viewer tetap TIDAK boleh hapus transaksi miliknya sendiri (keputusan 12 Sep 2026)',
  await run('canDeleteTransaction', { id: 't7', user_id: 'viewer-1', wallet_id: 'w-shared', debt_id: null },
    'viewer-1', WORLD.accountsViewer) === false);

// ── canDeleteOwnTransaction = logika lama, TIDAK berubah ─────────────
// Gerbang ketat yang dipakai useDebts.deleteDebt. Harus menolak semua yang
// bukan milik pemanggil, termasuk untuk owner.
ok('T14 canDeleteOwnTransaction MENOLAK owner atas baris editor (tidak ikut dilonggarkan)',
  await run('canDeleteOwnTransaction', WORLD.txByEditor1, 'owner-1', WORLD.accountsOwner) === false);

ok('T15 canDeleteOwnTransaction meloloskan baris milik sendiri',
  await run('canDeleteOwnTransaction', WORLD.txByOwner, 'owner-1', WORLD.accountsOwner) === true);

ok('T16 canDeleteOwnTransaction menolak baris sendiri di dompet read-only (viewer)',
  await run('canDeleteOwnTransaction', { id: 't8', user_id: 'viewer-1', wallet_id: 'w-shared', debt_id: null },
    'viewer-1', WORLD.accountsViewer) === false);

// ── Gagal-tertutup ───────────────────────────────────────────────────
ok('T17 accounts kosong → owner-override tidak bisa dipakai (gagal tertutup)',
  await run('canDeleteTransaction', WORLD.txByEditor1, 'owner-1', []) === false);

ok('T18 tx tanpa userId → ditolak',
  await run('canDeleteTransaction', WORLD.txByEditor1, '', WORLD.accountsOwner) === false);

ok('T19 tanpa error console/runtime', consoleErrors.length === 0, consoleErrors.join(' | '));

// ── Lapor ────────────────────────────────────────────────────────────
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  -> ' + JSON.stringify(r.detail) : ''}`);
}
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} lulus`);

await browser.close();
vite.kill();
process.exit(passed === results.length ? 0 : 1);
