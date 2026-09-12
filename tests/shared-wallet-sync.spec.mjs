/**
 * E2E dompet bersama — WEB ONLY (localhost), bukan Android/Capacitor asli.
 *
 * Alur yang diuji, dua akun di dua browser context terpisah:
 *   owner  : buat dompet bersama → buat kode undangan (peran editor)
 *   member : masukkan kode → gabung → catat 1 transaksi di dompet itu
 *   owner  : tekan "Segarkan" di halaman Transaksi → transaksi & saldo benar
 *
 * JALANKAN MANUAL:
 *   1. isi tests/../.env.test.local (4 baris, tidak di-commit — lihat .gitignore)
 *   2. npm run dev          (dev server harus sudah hidup di BASE_URL)
 *   3. node tests/shared-wallet-sync.spec.mjs
 *
 * PRASYARAT AKUN (bukan sesuatu yang bisa dibuat skrip ini sendiri):
 *   • TEST_ACCOUNT_OWNER_*  WAJIB akun Pro. planLimits.js: paket basic punya
 *     maxWallets: 1 dan sharedWalletInviteEnabled: false, jadi akun Basic tidak
 *     bisa membuat dompet kedua MAUPUN membuat kode undangan.
 *   • TEST_ACCOUNT_MEMBER_* boleh Basic — menerima undangan sengaja tidak
 *     digerbangi Pro.
 *   • Keduanya harus akun yang sudah terverifikasi dan bisa login password.
 *
 * CATATAN DATA: skrip ini MENULIS ke Supabase sungguhan (dompet + transaksi
 * baru di akun asli). Tidak ada auto-cleanup — menghapus dompet bersama
 * diblokir trigger selama masih ada anggota aktif, dan hapus otomatis di akun
 * asli terlalu berisiko. Nama dompet yang dibuat dicetak di akhir supaya bisa
 * dibereskan manual.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.E2E_HEADED !== '1';
const SLOWMO = Number(process.env.E2E_SLOWMO || 0);

// ── Env ───────────────────────────────────────────────────────────────
// Dibaca dari process.env. .env.test.local hanya dimuat sebagai pengisi
// untuk key yang BELUM ada di process.env, jadi `TEST_ACCOUNT_OWNER_EMAIL=x
// node tests/...` tetap menang atas isi file.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (val && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.test.local'));

const ENV_KEYS = [
  'TEST_ACCOUNT_OWNER_EMAIL',
  'TEST_ACCOUNT_OWNER_PASSWORD',
  'TEST_ACCOUNT_MEMBER_EMAIL',
  'TEST_ACCOUNT_MEMBER_PASSWORD',
];
const missing = ENV_KEYS.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Env belum lengkap: ' + missing.join(', '));
  console.error('Isi dulu .env.test.local di root repo (file itu di-gitignore).');
  process.exit(2);
}

const OWNER = { email: process.env.TEST_ACCOUNT_OWNER_EMAIL, password: process.env.TEST_ACCOUNT_OWNER_PASSWORD, label: 'owner' };
const MEMBER = { email: process.env.TEST_ACCOUNT_MEMBER_EMAIL, password: process.env.TEST_ACCOUNT_MEMBER_PASSWORD, label: 'member' };

// ── Data uji ──────────────────────────────────────────────────────────
const STAMP = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const WALLET_NAME = `E2E Bersama ${STAMP}`;
const SALDO_AWAL = 1_000_000;
const TX_AMOUNT = 25_000;              // pengeluaran
const TX_MERCHANT = `E2E Tx ${STAMP}`;
const TX_CATEGORY = 'Makanan & Minuman';   // kategori.food, locale id
const SALDO_HARAPAN = SALDO_AWAL - TX_AMOUNT;

// Semua tour di-tandai selesai sebelum app jalan. Tour di-gate localStorage,
// dan context Playwright selalu kosong → tanpa ini setiap halaman baru
// memunculkan overlay tour yang menutupi tombol yang mau diklik.
const TOUR_KEYS = [
  'productTourDone_v1', 'productTourTransaksiDone_v1', 'productTourTabunganDone_v1',
  'productTourAnggaranDone_v1', 'productTourAnalitikDone_v1', 'productTourHutangPiutangDone_v1',
  'productTourLaporanDone_v1', 'productTourDompetDone_v1', 'productTourPengaturanDone_v1',
];

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  -> ' + detail : ''));
};
const step = (msg) => console.log('\n▶ ' + msg);

// Rupiah di UI selalu id-ID (single-currency by design) → "Rp 975.000".
const digitsOf = (s) => Number(String(s).replace(/[^\d-]/g, '')) || 0;

async function newSession(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript((keys) => {
    try { keys.forEach(k => localStorage.setItem(k, 'true')); } catch {}
  }, TOUR_KEYS);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`  [${who.label}] pageerror: ${e.message}`));
  return { ctx, page };
}

async function login(page, who) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();

  // Supabase Auth menolak → LoginPage menampilkan pesan errornya sendiri,
  // TIDAK ADA navigasi/gerbang berikutnya yang muncul. Dideteksi eksplisit
  // di sini supaya kegagalan kredensial gagal cepat dengan pesan yang jelas
  // (bukan menunggu 30 detik lalu melempar "sidebar tidak pernah muncul",
  // yang menyesatkan — seolah masalahnya di UI, bukan di kredensial).
  const authError = page.getByText(/Invalid login credentials/i);
  const skip = page.getByRole('button', { name: 'Lewati' });
  const raced = await Promise.race([
    skip.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'skip'),
    authError.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'authError'),
  ]).catch(() => 'timeout');

  if (raced === 'authError') {
    throw new Error(
      `Login akun ${who.label} ditolak Supabase Auth ("Invalid login credentials"). ` +
      `Cek ulang TEST_ACCOUNT_${who.label.toUpperCase()}_EMAIL/PASSWORD di .env.test.local ` +
      `(nilainya sendiri TIDAK dicetak di sini).`
    );
  }
  if (await skip.isVisible().catch(() => false)) await skip.click();

  // SplashScreen 3 detik menumpuk di atas konten; tunggu sidebar bisa diklik.
  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Dompet', exact: true }).first()
    .waitFor({ state: 'visible', timeout: 30_000 });
}

const goTab = (page, label) =>
  page.locator('.sidebar').getByText(label, { exact: true }).click();

// Field "Kategori"/"Dompet" di modal transaksi sama-sama tombol pemicu yang
// menampilkan LABEL PILIHAN SAAT INI (bukan placeholder tetap), dan daftar
// pilihan muncul di bawahnya saat trigger diklik. Kalau nilai default modal
// KEBETULAN sudah sama dengan yang kita mau — kategori default modal ini
// "food"/"Makanan & Minuman", dan dompet default member bisa saja SATU-
// SATUNYA writableAccounts (dompet bersama itu sendiri) — trigger-nya sudah
// menampilkan teks itu SEBELUM dropdown dibuka sama sekali. Meng-klik teks
// label field dalam keadaan itu (mis. getByText('Dompet').click(), atau
// getByRole('button',{name}) yang kebetulan cocok dengan trigger tertutup)
// hanya MEMBUKA dropdown, bukan memilih apa pun — dan kalau tidak ditutup
// lagi, backdrop-nya menutupi tombol Simpan di bawahnya (persis begini cara
// test ini pernah macet: dompet bersama adalah satu-satunya writableAccounts
// member, triggernya sudah default menunjuk ke situ, klik "pemilihan" kita
// malah membuka dropdown dan meninggalkannya terbuka).
//
// Helper ini memeriksa teks trigger LEBIH DULU: kalau sudah cocok, tidak ada
// yang diklik sama sekali. Trigger dicari sebagai tombol PERTAMA di dalam
// field (urutan JSX/DOM menjamin trigger selalu dirender sebelum daftar
// pilihan), dan baris daftar dipilih dengan `.last()` — bukan `.first()` —
// karena baris itu SELALU muncul setelah trigger dalam urutan DOM, sedangkan
// trigger boleh saja ikut cocok dengan teks yang sama.
async function selectFromFieldPicker(scope, fieldLabelExact, optionText) {
  const field = scope.locator(`xpath=//span[normalize-space()="${fieldLabelExact}"]/following-sibling::div[1]`);
  const trigger = field.locator('button').first();
  const already = ((await trigger.textContent()) || '').includes(optionText);
  if (already) return;
  await trigger.click();
  await field.locator('button').filter({ hasText: optionText }).last().click();
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOWMO });
  const owner = await newSession(browser, OWNER);
  const member = await newSession(browser, MEMBER);
  let inviteCode = null;
  let walletCreated = false;   // dipakai finally: jangan minta bersihkan sesuatu yang belum tercipta

  try {
    step('Login kedua akun');
    await login(owner.page, OWNER);
    await login(member.page, MEMBER);
    check('owner & member berhasil login', true);

    // ── 1. Owner membuat dompet bersama ──────────────────────────────
    step(`Owner membuat dompet "${WALLET_NAME}"`);
    await goTab(owner.page, 'Dompet');
    await owner.page.getByRole('button', { name: /Tambah dompet/i }).first().click();

    const addModal = owner.page.locator('.modal-sheet');
    await addModal.waitFor({ state: 'visible', timeout: 10_000 });
    await addModal.locator('input[placeholder="contoh: BCA Tabungan"]').fill(WALLET_NAME);
    await addModal.locator('input[placeholder="0"]').fill(String(SALDO_AWAL));
    await addModal.getByRole('button', { name: 'Buat dompet' }).click();
    await addModal.waitFor({ state: 'hidden', timeout: 20_000 });

    const walletCard = owner.page.locator('.card').filter({ hasText: WALLET_NAME }).first();
    await walletCard.waitFor({ state: 'visible', timeout: 20_000 });
    walletCreated = true;   // dari titik ini dompetnya nyata di Supabase → perlu dibereskan manual
    check('dompet baru muncul di daftar dompet owner', true, WALLET_NAME);

    // ── 2. Owner membuat kode undangan (peran editor) ────────────────
    step('Owner membuat kode undangan');
    await walletCard.getByRole('button', { name: /Anggota/ }).click();

    const memberSheet = owner.page.locator('[role="dialog"]');
    await memberSheet.waitFor({ state: 'visible', timeout: 10_000 });

    // Peran menempel pada kode dan tidak bisa diubah setelah dipakai →
    // dipilih SEBELUM tombol buat ditekan.
    await memberSheet.getByRole('button', { name: /Editor/ }).click();
    await memberSheet.getByRole('button', { name: 'Buat Kode Undangan' }).click();

    // Gagal paling mungkin di sini: owner ternyata bukan Pro → paywall, bukan kode.
    const paywall = owner.page.getByText(/khusus pengguna Pro/i);
    const codeEl = memberSheet.locator('div.tnum.serif').filter({ hasText: /^\d{6}$/ }).first();
    await Promise.race([
      codeEl.waitFor({ state: 'visible', timeout: 25_000 }),
      paywall.waitFor({ state: 'visible', timeout: 25_000 }),
    ]).catch(() => {});

    if (await paywall.isVisible().catch(() => false)) {
      throw new Error('Kode undangan ditolak: akun OWNER bukan Pro (sharedWalletInviteEnabled=false untuk basic).');
    }
    inviteCode = (await codeEl.textContent() || '').trim();
    check('kode undangan 6 digit terbit', /^\d{6}$/.test(inviteCode), inviteCode);
    await memberSheet.getByRole('button', { name: 'Tutup' }).click().catch(() => {});
    await owner.page.keyboard.press('Escape').catch(() => {});

    // ── 3. Member menerima undangan ──────────────────────────────────
    step('Member memasukkan kode undangan');
    await goTab(member.page, 'Dompet');
    await member.page.getByRole('button', { name: /Gabung Dompet/ }).click();

    const joinSheet = member.page.locator('[role="dialog"]');
    await joinSheet.waitFor({ state: 'visible', timeout: 10_000 });
    await joinSheet.locator('input[inputmode="numeric"]').fill(inviteCode);
    await joinSheet.getByRole('button', { name: 'Gabung', exact: true }).click();

    const joinedToast = member.page.getByRole('status').filter({ hasText: /Berhasil bergabung/i });
    await joinedToast.waitFor({ state: 'visible', timeout: 25_000 });
    check('member berhasil bergabung ke dompet bersama', true);

    // Keanggotaan adalah SNAPSHOT saat useWallets mount (tidak ada realtime
    // untuk wallet_members) — dompet baru terlihat setelah mount ulang.
    await member.page.reload({ waitUntil: 'domcontentloaded' });
    await member.page.locator('.sidebar').waitFor({ state: 'visible', timeout: 30_000 });
    await goTab(member.page, 'Dompet');
    const sharedOnMember = member.page.locator('.card').filter({ hasText: WALLET_NAME }).first();
    await sharedOnMember.waitFor({ state: 'visible', timeout: 20_000 });
    check('dompet bersama terlihat di akun member', true);

    // ── 4. Member mencatat 1 transaksi di dompet itu ─────────────────
    step(`Member mencatat pengeluaran ${TX_AMOUNT} di dompet bersama`);
    await goTab(member.page, 'Transaksi');
    await member.page.getByRole('button', { name: 'Tambah Transaksi' }).first().click();

    const txModal = member.page.locator('.modal-sheet');
    await txModal.waitFor({ state: 'visible', timeout: 10_000 });
    await txModal.getByRole('button', { name: 'Pengeluaran', exact: true }).click();
    await txModal.locator('input[inputmode="numeric"]').first().fill(String(TX_AMOUNT));
    await txModal.locator('input[placeholder="nama merchant"]').fill(TX_MERCHANT);

    // Kategori & Dompet lewat helper (lihat komentarnya) — bukan klik teks
    // label + klik-berdasar-nama biasa, supaya tidak salah kena trigger yang
    // kebetulan sudah menampilkan nilai default yang sama.
    // Dompet: picker hanya memuat dompet yang BISA DITULIS (writableAccounts),
    // jadi munculnya dompet bersama di sini sekaligus membuktikan peran editor.
    await selectFromFieldPicker(txModal, 'Kategori', TX_CATEGORY);
    await selectFromFieldPicker(txModal, 'Dompet', WALLET_NAME);

    await txModal.getByRole('button', { name: 'Simpan transaksi' }).click();
    await txModal.waitFor({ state: 'hidden', timeout: 25_000 });
    check('member berhasil menyimpan transaksi di dompet bersama', true);

    // ── 5. Owner menekan "Segarkan" — TANPA reload ───────────────────
    // Ini inti Fase 1: transaksi anggota lain masuk lewat refetch manual,
    // bukan lewat realtime dan bukan karena halaman dimuat ulang.
    step('Owner menekan Segarkan di halaman Transaksi (tanpa reload)');
    await goTab(owner.page, 'Transaksi');
    // .tx-row-desktop SECARA EKSPLISIT, bukan getByText(...).first(): tiap
    // transaksi dirender DUA KALI (.tx-row-mobile lalu .tx-row-desktop,
    // ditoggle CSS per lebar layar) — di DOM, baris mobile selalu lebih dulu
    // meski disembunyikan di viewport desktop kita (1440px), jadi `.first()`
    // polos akan menangkap elemen yang HIDDEN dan waitFor({state:'visible'})
    // tidak akan pernah lolos walau datanya sudah benar.
    const txRow = owner.page.locator('.tx-row-desktop').filter({ hasText: TX_MERCHANT }).first();

    const seenBefore = await txRow.isVisible().catch(() => false);
    await owner.page.getByRole('button', { name: 'Segarkan' }).click();
    await txRow.waitFor({ state: 'visible', timeout: 30_000 });
    check('transaksi member muncul di akun owner setelah Segarkan', true,
      seenBefore ? 'catatan: baris sudah terlihat sebelum tombol ditekan' : 'baru muncul setelah refetch');

    // ── 6. Saldo dompet di sisi owner ────────────────────────────────
    // Saldo datang lewat realtime useWallets, bukan lewat refetch transaksi.
    // Kalau channel-nya telat, reload dipakai sebagai fallback dan hasilnya
    // dilaporkan apa adanya (jalur mana yang menang) — bukan disamarkan.
    step('Owner memeriksa saldo dompet bersama');
    await goTab(owner.page, 'Dompet');
    const ownerCard = owner.page.locator('.card').filter({ hasText: WALLET_NAME }).first();
    await ownerCard.waitFor({ state: 'visible', timeout: 20_000 });

    const readBalance = async () => {
      const txt = await ownerCard.innerText();
      const m = txt.match(/Rp\s?[\d.]+/g) || [];
      return m.map(digitsOf);
    };

    let jalur = 'realtime';
    let saldoOk = await owner.page.waitForFunction(
      ([name, target]) => {
        const card = [...document.querySelectorAll('.card')].find(c => c.innerText.includes(name));
        if (!card) return false;
        return (card.innerText.match(/Rp\s?[\d.]+/g) || [])
          .some(s => Number(s.replace(/[^\d]/g, '')) === target);
      },
      [WALLET_NAME, SALDO_HARAPAN],
      { timeout: 20_000 }
    ).then(() => true).catch(() => false);

    if (!saldoOk) {
      jalur = 'setelah reload';
      await owner.page.reload({ waitUntil: 'domcontentloaded' });
      await owner.page.locator('.sidebar').waitFor({ state: 'visible', timeout: 30_000 });
      await goTab(owner.page, 'Dompet');
      await ownerCard.waitFor({ state: 'visible', timeout: 20_000 });
      saldoOk = (await readBalance()).includes(SALDO_HARAPAN);
    }
    check(`saldo dompet owner = ${SALDO_HARAPAN.toLocaleString('id-ID')} (${jalur})`,
      saldoOk, saldoOk ? '' : 'terbaca: ' + JSON.stringify(await readBalance()));

  } finally {
    const failed = results.filter(r => !r.pass).length;
    console.log('\n' + (results.length - failed) + '/' + results.length + ' lulus');
    // Dicetak HANYA kalau dompetnya benar-benar tercipta di Supabase — gagal
    // sebelum titik itu (mis. login ditolak) tidak meninggalkan apa pun untuk
    // dibereskan, dan menyuruh mencari dompet yang tidak pernah ada hanya
    // membingungkan.
    if (walletCreated) {
      console.log('\nBERSIHKAN MANUAL (skrip ini sengaja tidak menghapus apa pun):');
      console.log(`  • dompet "${WALLET_NAME}" di akun owner (keluarkan anggotanya dulu — hapus diblokir trigger selama masih ada anggota aktif)`);
      console.log(`  • transaksi "${TX_MERCHANT}"`);
      if (inviteCode) console.log(`  • kode undangan ${inviteCode} kedaluwarsa sendiri dalam 24 jam`);
    }

    await owner.ctx.close().catch(() => {});
    await member.ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(err => {
  console.error('\nGAGAL: ' + err.message);
  process.exitCode = 1;
});
