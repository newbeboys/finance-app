/**
 * Harness perilaku src/lib/lockStatus.js (bug #4 — "HITUNG, JANGAN SIMPAN").
 *
 *   node tests/lockStatus.harness.mjs
 *
 * BEDA dari harness lain di folder ini: TIDAK menyalakan vite/playwright.
 * lockStatus.js adalah modul murni tanpa import apa pun (tidak menyentuh
 * React maupun Supabase), dan package.json project ini `"type": "module"`,
 * jadi Node bisa meng-import-nya langsung. Booting browser di sini hanya
 * akan memperlambat tanpa menguji apa pun yang tidak bisa diuji di Node.
 */

import { lockedIds, makeIsLocked } from '../src/lib/lockStatus.js';

const results = [];
const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail });

// Helper bikin item: id + created_at (ISO).
const item = (id, iso) => ({ id, created_at: iso });
const idsOf = (set) => [...set].sort().join(',');

// ── 1. Array kosong ──────────────────────────────────────────────────
ok('array kosong → tidak ada yang terkunci',
  lockedIds([], { limit: 1 }).size === 0);
ok('array kosong → penguji selalu false',
  makeIsLocked([], { limit: 1 })(item('a', '2026-01-01T00:00:00Z')) === false);

// ── 2. N = Infinity (Pro) ────────────────────────────────────────────
const proItems = [
  item('a', '2026-01-01T00:00:00Z'),
  item('b', '2026-02-01T00:00:00Z'),
  item('c', '2026-03-01T00:00:00Z'),
];
ok('N=Infinity → tidak ada yang terkunci walau banyak item',
  lockedIds(proItems, { limit: Infinity }).size === 0);
ok('N=null/undefined diperlakukan seperti tanpa batas',
  lockedIds(proItems, { limit: null }).size === 0 &&
  lockedIds(proItems, {}).size === 0);

// ── 3. N < jumlah item ───────────────────────────────────────────────
// Sengaja diberikan dalam urutan ACAK (bukan created_at ASC) untuk
// membuktikan lockStatus menyortir sendiri, tidak menumpang urutan masukan.
const scrambled = [
  item('c', '2026-03-01T00:00:00Z'),
  item('a', '2026-01-01T00:00:00Z'),
  item('d', '2026-04-01T00:00:00Z'),
  item('b', '2026-02-01T00:00:00Z'),
];
const locked2 = lockedIds(scrambled, { limit: 2 });
ok('N=2 dari 4 item → 2 TERBARU terkunci, 2 terlama bebas',
  idsOf(locked2) === 'c,d', idsOf(locked2));
ok('urutan masukan acak tidak memengaruhi hasil (disortir di dalam)',
  idsOf(lockedIds([...scrambled].reverse(), { limit: 2 })) === 'c,d');

const isLocked2 = makeIsLocked(scrambled, { limit: 2 });
ok('penguji menerima objek item', isLocked2(item('d', '2026-04-01T00:00:00Z')) === true &&
  isLocked2(item('a', '2026-01-01T00:00:00Z')) === false);
ok('penguji menerima id mentah', isLocked2('c') === true && isLocked2('b') === false);
ok('penguji aman untuk null/undefined', isLocked2(null) === false && isLocked2(undefined) === false);

// ── 4. N = jumlah item (batas persis) ────────────────────────────────
ok('N sama dengan jumlah item → tidak ada yang terkunci',
  lockedIds(scrambled, { limit: 4 }).size === 0);
ok('N lebih besar dari jumlah item → tidak ada yang terkunci',
  lockedIds(scrambled, { limit: 10 }).size === 0);
ok('N=1 dari 4 → hanya yang PALING LAMA yang bebas',
  idsOf(lockedIds(scrambled, { limit: 1 })) === 'b,c,d');
ok('N=0 → semua terkunci',
  idsOf(lockedIds(scrambled, { limit: 0 })) === 'a,b,c,d');

// ── 5. created_at KEMBAR (tie-break wajib deterministik) ─────────────
const sameTime = '2026-05-05T05:05:05Z';
const twins = [
  item('z', sameTime),
  item('m', sameTime),
  item('a', sameTime),
];
const twinRun1 = idsOf(lockedIds(twins, { limit: 1 }));
const twinRun2 = idsOf(lockedIds([...twins].reverse(), { limit: 1 }));
const twinRun3 = idsOf(lockedIds([twins[1], twins[2], twins[0]], { limit: 1 }));
ok('created_at kembar → id jadi pemecah seri, "a" (terkecil) yang bebas',
  twinRun1 === 'm,z', twinRun1);
ok('created_at kembar → hasil SAMA apa pun urutan masukannya (deterministik)',
  twinRun1 === twinRun2 && twinRun2 === twinRun3,
  JSON.stringify({ twinRun1, twinRun2, twinRun3 }));

// Campuran: sebagian kembar, sebagian beda waktu.
const mixed = [
  item('b2', sameTime),
  item('old', '2026-01-01T00:00:00Z'),
  item('b1', sameTime),
];
ok('kembar dicampur non-kembar: urutan waktu tetap menang atas id',
  idsOf(lockedIds(mixed, { limit: 1 })) === 'b1,b2',
  idsOf(lockedIds(mixed, { limit: 1 })));

// ── 6. created_at hilang / tidak valid → dianggap paling baru ────────
const withMissing = [
  item('has', '2026-01-01T00:00:00Z'),
  { id: 'none' },                       // tanpa created_at
  { id: 'bad', created_at: 'bukan-tanggal' },
];
ok('created_at hilang/invalid → dianggap PALING BARU (kena kunci duluan)',
  idsOf(lockedIds(withMissing, { limit: 1 })) === 'bad,none',
  idsOf(lockedIds(withMissing, { limit: 1 })));

// ── 7. Tidak memodifikasi array masukan ──────────────────────────────
const original = [
  item('c', '2026-03-01T00:00:00Z'),
  item('a', '2026-01-01T00:00:00Z'),
];
const snapshot = original.map(o => o.id).join(',');
lockedIds(original, { limit: 1 });
ok('array masukan TIDAK diacak di tempat (state React aman)',
  original.map(o => o.id).join(',') === snapshot,
  original.map(o => o.id).join(','));

// ── 8. Key non-default (timestampKey / idKey) ────────────────────────
const custom = [
  { uid: 'x', dibuat: '2026-02-01T00:00:00Z' },
  { uid: 'y', dibuat: '2026-01-01T00:00:00Z' },
];
ok('timestampKey & idKey bisa diganti',
  idsOf(lockedIds(custom, { limit: 1, timestampKey: 'dibuat', idKey: 'uid' })) === 'x');

// ── 9. Masukan bukan array → aman ────────────────────────────────────
ok('masukan null/undefined tidak melempar',
  lockedIds(null, { limit: 1 }).size === 0 && lockedIds(undefined, { limit: 1 }).size === 0);

// ── Ringkasan ────────────────────────────────────────────────────────
let fail = 0;
for (const r of results) {
  if (!r.pass) fail++;
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '  -> ' + r.detail : ''));
}
console.log('\n' + (results.length - fail) + '/' + results.length + ' lulus');
process.exit(fail ? 1 : 0);
