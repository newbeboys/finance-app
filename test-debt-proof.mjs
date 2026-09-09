// test-debt-proof.mjs — SEMENTARA, alat bantu manual. HAPUS file ini
// (dan jangan commit) setelah 4 PDF di bawah sudah dicek dan dikonfirmasi OK.
//
// ⚠️ SUDAH DICOBA & TERBUKTI TIDAK JALAN di Node biasa (`node test-debt-proof.mjs`).
// Empat blocker berbeda, masing-masing sudah diverifikasi lewat percobaan langsung
// (bukan dugaan), tersusun berlapis — betulkan yang satu, langsung ketemu yang berikutnya:
//
//   1) Import relatif tanpa ekstensi ('../i18n', './errorLogger', dst.) valid di
//      Vite tapi TIDAK valid di Node ESM murni → langsung ERR_MODULE_NOT_FOUND
//      pada baris `import ... from './lib/debtProof.js'` paling atas. Ini blocker
//      PERTAMA yang kena, sebelum baris lain sempat jalan sama sekali.
//   2) Kalaupun (1) dibetulkan (mis. resolver custom), src/supabase.js baris 11-12
//      pakai `import.meta.env.VITE_SUPABASE_URL` — fitur Vite, bukan Node. Di Node
//      polos `import.meta.env` = undefined → TypeError. debtProof.js → import
//      logError dari lib/errorLogger.js → import supabase.js, jadi rantai import
//      tetap gagal sebelum generateDebtProof() sempat dipanggil.
//   3) Kalaupun (1)+(2) dibetulkan, `import('jspdf')` sendiri sudah gagal di Node
//      polos: `jspdf.node.min.js` melempar "Cannot read properties of undefined
//      (reading 'bind')" saat di-import — sudah dites langsung (window di-stub
//      manual, tetap gagal).
//   4) Bagian simpan/unduh (pdf.save() di jalur web) memang didesain untuk
//      browser (butuh document/Blob/anchor-click) — bukan sesuatu yang masuk
//      akal dijalankan headless di Node sama sekali.
//
// KESIMPULAN: jangan jalankan file ini via `node`. Cara paling gampang untuk
// benar-benar menghasilkan & membandingkan 4 PDF adalah lewat BROWSER:
//
//   1. `npm run dev`, buka app di browser, login seperti biasa.
//   2. Tombol debug sementara sudah dipasang (lihat src/debug-debt-proof.jsx,
//      di-mount dari src/main.jsx HANYA saat `import.meta.env.DEV` true —
//      tidak pernah muncul di production build). Muncul sebagai panel kecil
//      mengambang di pojok kanan-bawah begitu app terbuka.
//   3. Klik 4 tombolnya satu-satu (a/b/c/d) → browser akan minta simpan/unduh
//      4 file PDF dengan nama beda (lihat debug-debt-proof.jsx untuk detail
//      id dummy tiap varian), buka satu-satu untuk dibandingkan.
//   4. Setelah oke, HAPUS src/debug-debt-proof.jsx, baris import+mount-nya
//      di src/main.jsx, dan file test-debt-proof.mjs ini.
//
// Isi di bawah ini dibiarkan sesuai struktur yang diminta (import + 4 panggilan
// dummy) sebagai dokumentasi rencana pengujian — BUKAN untuk benar-benar
// dieksekusi lewat `node`.

import { generateDebtProof } from './src/lib/debtProof.js';

const today = new Date();
const inAWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function makeDummyDebt({ id, cash_disbursed_at_creation }) {
  return {
    id,
    type: 'receivable',
    person_name: 'Budi',
    note: '',
    amount: 500000,
    paid: 0,
    remaining: 500000,
    wallet_id: null,
    date: iso(today),
    due_date: iso(inAWeek),
    status: 'active',
    is_deleted: false,
    is_locked: false,
    cash_disbursed_at_creation,
    created_at: today.toISOString(),
  };
}

const variants = [
  { label: 'a) Basic, sudah dikasih uang',   opts: { isPro: false }, cash_disbursed_at_creation: true  },
  { label: 'b) Basic, belum ditagih',        opts: { isPro: false }, cash_disbursed_at_creation: false },
  { label: 'c) Pro, sudah dikasih uang',      opts: { isPro: true  }, cash_disbursed_at_creation: true  },
  { label: 'd) Pro, belum ditagih',           opts: { isPro: true  }, cash_disbursed_at_creation: false },
];

for (const [i, v] of variants.entries()) {
  const debt = makeDummyDebt({ id: `debug-${'abcd'[i]}test`, cash_disbursed_at_creation: v.cash_disbursed_at_creation });
  console.log(`\n=== ${v.label} ===`);
  const { error } = await generateDebtProof(debt, [], v.opts);
  console.log(error ? `GAGAL: ${error.message}` : 'OK');
}
