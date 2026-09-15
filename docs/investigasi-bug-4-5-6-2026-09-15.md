# Investigasi Desain — Keluarga Bug #4/#5/#6 (siapa yang berhak memutuskan "user ini Basic")

> Investigasi murni. Tidak ada kode/migration yang diubah. Semua nomor baris di bawah diverifikasi dengan Read/Grep langsung ke file per 15 Sep 2026 — bukan dari dokumentasi lama.

## Ringkas mekanisme (konteks yang sudah terverifikasi, dikutip ulang untuk sambungan)

Satu-satunya pemicu `lockExcessOnDowngrade`/`unlockAllOnUpgrade` adalah `useSubscription.js:79-83`, di dalam efek yang membandingkan `prevIsProRef.current` dengan `isPro` baru. Ini HANYA jalan kalau: (a) ada tab yang terbuka, (b) tab itu sempat punya `prevIsProRef` ter-set non-null (bukan cold start), (c) transisi Pro→Basic terjadi selagi tab itu hidup. Tidak ada cron/webhook/trigger DB yang memanggil ini dari sisi lain. Ini akar kenapa #4 "tidak pernah jalan" dalam praktik — bukan hanya soal fail-open, tapi bahwa titik pemicunya sendiri sangat sempit.

---

## BAGIAN A — Pemetaan `is_locked` (bug #4)

### A1. Semua titik baca `is_locked` di `src/`

**Tabel `debts`** (sumber: `useDebts` state, di-set dari kolom DB apa adanya):
| File:Baris | Apa yang dilakukan |
|---|---|
| `src/hooks/useDebts.js:83` | `toAppDebt()` — memetakan `row.is_locked` ke field app-shape `is_locked` |
| `src/hooks/useDebts.js:206` | `checkCreateAllowed()` — `activeCount` MENGECUALIKAN baris `is_locked` dari hitungan kuota 5 aktif |
| `src/hooks/useDebts.js:361` | `addPayment()` — tolak (`error`) kalau `debt.is_locked` |
| `src/hooks/useDebts.js:470` | `markPaid()` — tolak kalau `debt.is_locked` |
| `src/hooks/useDebts.js:487` | `deleteDebt()` — tolak kalau `debt.is_locked` |
| `src/debts-page.jsx:62` | `manageable` — total piutang/hutang header MENGECUALIKAN baris terkunci |
| `src/debts-page.jsx:77` | Banner telat bayar MENGECUALIKAN baris terkunci |
| `src/debts-page.jsx:189` | Badge jatuh-tempo disembunyikan bila terkunci |
| `src/debts-page.jsx:192,196` | Opacity 0.6 + badge "Terkunci" di kartu list |
| `src/components/debts/DebtDetailSheet.jsx:52` | `const locked = debt.is_locked` — dipakai baris 143,151,161,247 untuk sembunyikan tombol bayar/lunas/hapus |
| `src/widgets.jsx:566` | `DebtsCard` (kartu Beranda) — filter yang sama, total & item-terdekat-jatuh-tempo MENGECUALIKAN terkunci |
| `src/hooks/useNotifications.js:172` | `debtsNotifs()` — skip generate notifikasi H-3/telat-tempo untuk baris terkunci |

**Tabel `wallets`** (`useWallets` state):
| File:Baris | Apa yang dilakukan |
|---|---|
| `src/hooks/useWallets.js:48` | `toAppWallet()` — memetakan `row.is_locked` |
| `src/wallets.jsx:99,104` | Opacity + suffix 🔒 di wallet switcher dropdown |
| `src/wallets.jsx:267,268` | Opacity kartu + badge overlay "Terkunci" |
| `src/wallets.jsx:281-282` | Badge "Soft Lock" (menggantikan badge dibagikan/utama) |

**Tabel `savings`** (`useSavings` state):
| File:Baris | Apa yang dilakukan |
|---|---|
| `src/hooks/useSavings.js:41` | `toAppGoal()` — memetakan `row.is_locked` |
| `src/hooks/useSavings.js:155` | `addDeposit()` (nama fungsi persis — cek baris ini) — tolak setor kalau `goal.is_locked` |
| `src/savings-page.jsx:111,112` | Opacity kartu + badge overlay "Terkunci" |
| `src/savings-page.jsx:149,150,152` | Tombol "Tambah Dana": `is_locked` ? `openPaywall()` : `onDeposit()`; styling + ikon 🔒 |

**Tabel `custom_categories`** (`useCustomCategories` state):
| File:Baris | Apa yang dilakukan |
|---|---|
| `src/hooks/useCustomCategories.js:18` | `toCustomCat()` — memetakan `row.is_locked` |
| `src/category-field.jsx:188-191,195,201-203,208` | `locked` menolak `pick(id)` (memilih kategori terkunci saat catat transaksi baru), plus menentukan `canDelete`/`canEdit`/`showLock` dan styling dropdown |

**Tidak relevan:** `src/_test-tour-harness.jsx:17` — fixture data palsu untuk test product-tour, bukan logic produksi.

### A2. Bisa diganti perhitungan dari array yang sudah ada di state hook yang sama?

**`debts` — YA, langsung bisa, tanpa syarat tambahan.**
`toAppDebt()` (`useDebts.js:69-91`) sudah menyimpan `created_at` (baris 88) ke app-shape. Fetch (`useDebts.js:130-135`) sudah `.eq('is_deleted', false)` — state tidak pernah berisi baris soft-deleted. Semua 12 titik baca di atas bisa dihitung dari `debts` state: filter `status==='active'`, urutkan `created_at` ASC, N pertama (N = `limits.maxActiveDebts`) = tidak terkunci, sisanya terkunci. Tidak ada wallet bersama untuk `debts` — CLAUDE.md sudah menegaskan "Debt-linked transactions... never shared" — jadi tidak ada masalah kepemilikan lintas-user seperti di `wallets`.

**`savings` dan `custom_categories` — YA, tapi perlu satu tambahan kecil.**
`toAppGoal()` (`useSavings.js:31-43`) dan `toCustomCat()` (`useCustomCategories.js:10-21`) **TIDAK menyimpan `created_at`** ke app-shape, walau fetch-nya sudah `.order('created_at', {ascending:true})` (`useSavings.js:59`, `useCustomCategories.js:46`) dan insert baru selalu di-append ke akhir array (`useSavings.js:125`: `setGoals(prev => [...prev, newGoal])`; pola sama di `useCustomCategories.js:136`). Jadi urutan array SUDAH konsisten dengan created_at ASC — perhitungan berbasis indeks-di-array (bukan field created_at mentah) sudah cukup TANPA perlu menambah field baru, asal urutan itu tidak pernah diacak di tempat lain (sudah dicek: tidak ada `.sort()` lain pada `goals`/`customCategories` state). Untuk `custom_categories` kuota hanya dihitung dari baris `!is_deleted` (meniru `reconcileTable(..., true)` di `planReconciliation.js:75`), jadi hitungannya harus filter dulu baru slice.

**`wallets` — TIDAK bisa penuh, ada komplikasi nyata.**
`toAppWallet()` (`useWallets.js:31-55`) juga tidak menyimpan `created_at`, tapi masalah lebih dalam: state `allAccounts` (`useWallets.js:61`) berisi GABUNGAN dompet MILIK SENDIRI dan dompet BERSAMA milik orang lain, diambil dalam SATU query `created_at ASC` lintas-owner (`useWallets.js:145-160`). Untuk dompet milik sendiri, menghitung locked dari subset `ownerId===userId` (setelah difilter, urutan ASC) itu valid. **Tapi untuk dompet bersama (dimiliki user lain, `isShared:true`), status terkunci mencerminkan kuota PEMILIK LAIN itu** — sesuatu yang klien user ini tidak pernah query (tidak ada visibilitas ke jumlah dompet lain milik owner tsb atau ke plan owner tsb, dan RLS `wallets: read own or member` (`20260912000000_add_wallet_members_and_shared_rls.sql:159-161`) hanya mengizinkan baca dompet yang user ini jadi anggota/pemiliknya, bukan seluruh dompet owner lain). Jadi untuk `wallets`, "HITUNG" murni di klien HANYA bisa menggantikan is_locked untuk baris MILIK SENDIRI. Untuk baris dompet bersama, pilihannya:
  - (a) terima regresi — member tidak pernah melihat badge 🔒 pada dompet owner yang sudah over-kuota (secara fungsional dompetnya tetap ada, cuma indikator visualnya hilang untuk viewer/editor), atau
  - (b) tetap percaya kolom DB `is_locked` KHUSUS untuk baris `isShared===true` (campuran: dihitung untuk baris sendiri, dibaca dari DB untuk baris bersama), atau
  - (c) tambah RPC yang mengembalikan status kunci per-baris yang dihitung SERVER-SIDE dari milik masing-masing owner (natural pasangan dengan gerbang server di Bagian C).

### A3. Penulis `is_locked` selain `planReconciliation.js`?

Grep `is_locked` ke seluruh `src/` (bukan cuma yang membaca) — hasil lengkap ada di A1 plus file berikut yang MENULIS:
- `src/lib/planReconciliation.js:29,33` — `reconcileTable()`, update per-id (`toUnlock`/`toLock`)
- `src/lib/planReconciliation.js:61,65` — `reconcileDebts()`, sama pola khusus tabel `debts`
- `src/lib/planReconciliation.js:84,87,90,93` — `unlockAllOnUpgrade()`, blanket update per tabel

**Tidak ada penulis lain.** Semua titik lain di A1 hanya membaca (`row.is_locked`, `d.is_locked`, dst.) atau menolak aksi bila true — tidak ada `.update({is_locked: ...})` di file manapun selain `planReconciliation.js`. Ini juga cocok dengan yang sudah diverifikasi di konteks: satu-satunya pemanggil `reconcileTable`/`reconcileDebts` adalah `lockExcessOnDowngrade`/`unlockAllOnUpgrade`, yang satu-satunya pemanggilnya adalah `useSubscription.js:79-83`.

### A4. Kalau `is_locked` dihapus dari perhitungan `activeCount` — bagaimana formula `useDebts.js:206` harus berubah?

Formula sekarang:
```
const activeCount = debts.filter(d => d.status === 'active' && !d.is_locked).length;
```
Ini secara implisit mengandalkan bahwa reconciliation SUDAH BERHASIL menandai baris kelebihan sebagai `is_locked=true` — kalau reconciliation gagal (persis bug #4: tidak pernah jalan, atau SELECT/UPDATE-nya error), semua baris aktif tetap `is_locked=false`, dan formula ini balik menjadi `debts.filter(d => d.status==='active').length` — HITUNGAN PENUH tanpa pengecualian. Itu justru MEMBUAT limit lebih ketat (early-block), bukan bocor — tapi kalau reconciliation berhasil SEBAGIAN (unlock jalan, lock gagal), sebaliknya: baris yang seharusnya terkunci ikut tak terhitung → limit 5 aktif bisa dilewati.

Pengganti yang tidak bergantung pada apakah reconciliation pernah jalan:
```
const activeSorted = debts.filter(d => d.status === 'active')
                           .sort((a,b) => a.created_at < b.created_at ? -1 : 1);
const activeCount  = Math.min(activeSorted.length, maxActive);
```
`Math.min(total, maxActive)` mereplikasi persis efek numerik lama (begitu jumlah aktif riil ≥ maxActive, activeCount lama JUGA mentok di maxActive — karena kelebihannya terkunci) TANPA butuh kolom is_locked sama sekali. Ini lebih robust dari formula lama karena tidak bisa "salah" akibat efek samping async (reconciliation) yang belum/gagal jalan — ini murni fungsi sinkron dari data yang sudah di tangan. Ini juga argumen kuat untuk arah HITUNG: formula lama diam-diam BERGANTUNG pada suatu tulisan async lain sukses duluan, yang justru salah satu akar bug #4.

---

## BAGIAN B — Pemetaan `checkCreateAllowed` (bug #5)

### B5. Semua pemanggil

Grep `checkCreateAllowed` ke seluruh `src/` — **hanya SATU pemanggil di seluruh codebase**: `src/hooks/useDebts.js:270`, di dalam `createDebt()`. Fungsinya sendiri didefinisikan lokal (tidak di-export dari modul) di `useDebts.js:198-253` — tidak dipakai hook lain (`useWallets`, `useSavings`, `useCustomCategories` masing-masing punya pola gating limit sendiri-sendiri yang berbeda, bukan lewat helper bersama ini).

Resource yang digerbangi: **hanya `debts`** (catatan hutang/piutang) — bukan wallet/savings/category.

### B6. Query yang bisa gagal & jalur gagal-terbuka

Ada dua query Supabase di dalam `checkCreateAllowed()`:

1. **`useDebts.js:219-223`** — `COUNT` rolling-window:
   ```
   supabase.from('debts').select('id', {count:'exact', head:true})
     .eq('user_id', userId).gte('created_at', windowStartISO)
   ```
   Ini SATU-SATUNYA yang punya jalur gagal-terbuka eksplisit: `if (cErr) { console.error(...); return {ok:true}; }` (baris 225-228). Penyebab realistis kegagalan: jaringan putus/timeout, outage Supabase. **Bukan RLS** — query ini membaca baris `user_id = userId` milik sendiri, dan policy `debts_select_own` (`20260704000000_add_debts.sql:117-120`) mengizinkan `auth.uid() = user_id` tanpa syarat lain, jadi RLS seharusnya tidak pernah jadi penyebab penolakan di sini kecuali sesi memang sudah tidak valid (401) — skenario itu sudah digerbangi lebih dulu oleh `requireUserId()` di `createDebt()` (`useDebts.js:267-268`), sebelum `checkCreateAllowed()` dipanggil.

2. **`useDebts.js:233-239`** — `SELECT created_at ORDER BY ... LIMIT 1` (cari baris tertua di jendela, HANYA jalan kalau count sudah ≥ maxActive). Ini TIDAK punya percabangan error eksplisit — kalau gagal, `oldestRows` jadi `undefined`, `oldest` jadi `undefined`, `cooldownUntilDate` tetap `null`, dan fungsi tetap `return { ok:false, reason:'cooldown', cooldownUntilDate:null }`. Ini sebenarnya **sudah fail-CLOSED** (user tetap diblokir), cuma pesan UI-nya kehilangan tanggal "bisa lagi kapan". Bukan bagian dari "gagal-terbuka" yang ditanyakan, tapi relevan dicatat: dua query di fungsi yang sama punya perilaku gagal yang BERBEDA (satu terbuka, satu tertutup-tanpa-info) — inkonsistensi kecil yang juga layak diperbaiki sekalian kalau #5 disentuh.

### B7. Risiko fail-closed & pemisahan "query error" vs "kuota beneran habis"

**Koreksi penting atas premis pertanyaan:** skenario "user Pro dengan koneksi buruk terblokir" **tidak bisa terjadi** — `checkCreateAllowed()` baris 199-200 (`if (maxActive === Infinity) return {ok:true}`) membuat Pro user (`PLAN_LIMITS.pro.maxActiveDebts = Infinity`, `planLimits.js:39`) **kembali sebelum query manapun dijalankan**. Query cooldown HANYA pernah berjalan untuk user Basic.

Risiko real dari fail-closed: **user Basic yang MASIH PUNYA sisa kuota** (belum sampai 5 aktif / belum sampai 5 pembuatan dalam 50 hari) tapi kebetulan mengalami error transien saat query cooldown — akan diblokir membuat catatan baru padahal berhak. Ini kelompok yang jauh lebih luas (semua user Basic) dibanding kelompok yang diuntungkan fail-open (hanya yang kebetulan error DAN kebetulan sudah di batas cooldown).

Pemisahan "query error" vs "kuota beneran habis" **sudah bersih secara struktural di kode saat ini** — dua cabang berbeda (`if (cErr) {...}` vs `if (count >= maxActive) {...}`), jadi mengubah keputusan (fail-open → fail-closed, atau tambah retry, atau fail-open-tapi-log) adalah perubahan LOKAL di satu cabang `if`, tidak perlu merombak struktur fungsi.

---

## BAGIAN C — Gerbang server (bug #6)

### C8. Semua RLS/trigger/RPC untuk INSERT ke `wallets`, `savings`, `custom_categories`, `debts`

**`wallets`** — policy INSERT (`supabase/migrations/20260912000000_add_wallet_members_and_shared_rls.sql:163-166`):
```sql
CREATE POLICY "wallets: insert own"
  ON public.wallets FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));
```

**`savings`** — masih policy asli dari `supabase/schema.sql:44-48` (tidak pernah di-migrate ulang, dikonfirmasi grep migrations/*.sql untuk "savings" hanya menyentuh kolom `deadline_date`/`is_locked`, bukan policy):
```sql
CREATE POLICY "savings: own data only"
  ON public.savings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**`custom_categories`** — `supabase/custom_categories.sql:30-33`:
```sql
create policy "custom_categories_insert_own"
  on public.custom_categories for insert
  with check (auth.uid() = user_id);
```

**`debts`** — `supabase/migrations/20260704000000_add_debts.sql:122-125`:
```sql
CREATE POLICY "debts_insert_own"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Trigger:** hanya 3 trigger ada di seluruh `supabase/migrations/`: `trigger_debts_updated_at` (maintain `updated_at`), `trigger_user_subscriptions_updated_at` (sama, tabel lain), dan `trigger_wallets_block_delete_with_members` (`20260918000000`, BEFORE DELETE — bukan INSERT, dan bukan soal kuota, ini guard "jangan hapus dompet yang masih ada anggota"). **Tidak ada trigger BEFORE/AFTER INSERT di keempat tabel ini sama sekali.**

**RPC:** grep semua `CREATE OR REPLACE FUNCTION public.` di `supabase/migrations/` — tidak ada satupun bernama `create_wallet`/`create_savings_goal`/`create_custom_category`/`create_debt` atau sejenisnya. RPC yang ada untuk empat tabel ini nol; RPC yang menyentuh `wallets`/`transactions` (`record_transaction`, `adjust_wallet_balance`, dst.) semuanya soal SALDO, bukan soal membuat baris `wallets` baru.

**Kesimpulan C8: dikonfirmasi — tidak ada satupun policy/trigger/RPC yang mengecek limit tier untuk INSERT ke keempat tabel ini.** Semua penegakan limit murni terjadi di JavaScript sebelum `.insert()` dipanggil (`useWallets.createAccount`, `useSavings.createGoal`, `useCustomCategories.addCustomCategory`, `useDebts.createDebt` via `checkCreateAllowed()`).

### C9. RLS subquery COUNT vs RPC SECURITY DEFINER — mana yang cocok untuk gerbang "HITUNG di server"

**Secara sintaks**, RLS `WITH CHECK` BISA berisi subquery `COUNT(*)` ke tabel yang sama (bukan siklus dua-tabel seperti kasus `wallets`/`wallet_members` yang didokumentasikan CLAUDE.md — itu recursion lintas-policy; subquery count ke tabel sendiri secara sintaks valid). Tapi ada tiga masalah substansial:

1. **Race condition tidak bisa ditutup di level RLS.** PostgreSQL TIDAK MENGIZINKAN klausa locking (`FOR UPDATE`/`FOR SHARE`) di dalam subquery policy RLS — ini batasan Postgres, bukan pilihan desain. Artinya dua `INSERT` konkuren dari device yang sama (retry ganda) atau dua tab bisa sama-sama membaca `COUNT < limit` sebelum salah satu commit, dan sama-sama lolos → limit bisa lewat 1. Pola yang SUDAH dipakai project ini untuk masalah race yang sama persis (`check_chat_rate_limit`, `generate_wallet_invite`'s `wallet_invite_attempts`) selalu pakai `SELECT ... FOR UPDATE` eksplisit di dalam RPC — sesuatu yang RLS policy tidak bisa lakukan.

2. **Limit angkanya (1/2/3/5) harus hidup di suatu tempat di SQL kalau mau dicek di RLS** — entah dihardcode di ekspresi policy (duplikasi murni dari `planLimits.js`, rawan drift kalau limit berubah suatu saat) atau di-join ke tabel config baru. Ini BUKAN teoretis — project ini SUDAH punya preseden persis: `generate_wallet_invite` (`20260913000000_add_wallet_invite_flow.sql:136-144`) meng-copy-paste logika `isPro` (`plan='pro' AND (expires_at IS NULL OR expires_at > now())`) langsung ke SQL, mendupilkasi `useSubscription.js:55-58`. Jadi dua-sumber-kebenaran untuk isPro SUDAH ada dan diterima di codebase ini — menambah limit numerik sebagai duplikat kedua adalah kategori tradeoff yang sama, bukan yang baru.

3. **RLS tidak bisa mengembalikan pesan yang berbeda-beda.** Penolakan RLS selalu muncul sebagai error generik (`new row violates row-level security policy`, kode 42501) — tidak bisa membedakan "kamu di limit aktif" vs "kamu kena cooldown 50 hari, boleh lagi tanggal X" seperti yang UI Hutang/Piutang butuhkan sekarang (`gate.reason`, `gate.cooldownUntilDate`). Jadi APAPUN gerbang server yang dipilih, precheck di klien (`checkCreateAllowed()` atau sejenisnya di 3 hook lain) TETAP harus ada untuk UX — gerbang server hanya jadi BACKSTOP, bukan pengganti.

**Kesimpulan:** RPC `SECURITY DEFINER` (pola yang sama dengan `generate_wallet_invite`/`check_chat_rate_limit`) lebih cocok — bisa mengunci baris (`FOR UPDATE`) untuk menutup race, bisa mengembalikan alasan penolakan yang granular, dan konsisten dengan pola yang sudah mapan di codebase ini untuk "gerbang yang harus benar di server, bukan cuma di klien". RLS subquery COUNT murni lebih sederhana untuk ditulis tapi mewarisi race condition yang tidak bisa ditutup dan tetap butuh precheck klien terpisah untuk UX — jadi tidak benar-benar lebih murah dalam total pekerjaan, hanya lebih murah di migration SQL-nya saja.

---

## BAGIAN D — Ukuran pekerjaan

### D10. Perkiraan besar perubahan (arah HITUNG, ketiga bug sekaligus)

**Bug #4 (compute, don't store, sisi klien) — kalau nama field `is_locked` di app-shape DIPERTAHANKAN** (hanya sumber nilainya diganti dari `row.is_locked` ke hasil hitungan), maka SEMUA file consumer murni-UI di Bagian A1 (`wallets.jsx`, `savings-page.jsx`, `debts-page.jsx`, `DebtDetailSheet.jsx`, `category-field.jsx`, `widgets.jsx`, `useNotifications.js` — 7 file) **tidak perlu diubah sama sekali**. Yang perlu disentuh hanya 4 hook:
- `src/hooks/useDebts.js` — ganti sumber `is_locked` di `toAppDebt` + formula `activeCount` (lihat A4). ~15-25 baris.
- `src/hooks/useSavings.js` — tambah `created_at` (atau pakai urutan array) + hitung locked. ~15-20 baris.
- `src/hooks/useCustomCategories.js` — sama, plus filter `!is_deleted` sebelum slice. ~15-20 baris.
- `src/hooks/useWallets.js` — paling rumit karena masalah dompet bersama di A2; perlu keputusan produk dulu (regresi diterima / tetap baca DB utk baris shared / RPC baru) sebelum ukurannya bisa dipastikan. ~20-40 baris KALAU cukup filter ke baris sendiri (opsi a/b di A2); jauh lebih besar kalau opsi (c) RPC dipilih.
- Kemungkinan tambahan: satu helper kecil dipakai bersama (mis. `src/lib/lockStatus.js`), ~20-30 baris.
- `src/lib/planReconciliation.js` — bisa dibiarkan (masih menulis kolom yang sekarang tak dibaca klien manapun, tidak berbahaya) atau dipensiunkan; ini keputusan produk, bukan kebutuhan teknis.

**Migration:** nol untuk bug #4 (kolom tetap ada, tidak diapa-apakan) — sesuai batasan yang diminta.

**Bug #5 (checkCreateAllowed gagal-terbuka)** — perubahan paling kecil dari ketiganya: satu cabang `if (cErr)` di `useDebts.js:225-228`, tambah panggilan `logError(...)` (infra & konvensi panggilan SUDAH ada persis di file yang sama, `useDebts.js:520-522`) dan opsional ganti `return {ok:true}` → `{ok:false}` kalau keputusan produknya fail-closed. **~5-15 baris, 1 file, 0 migration.**

**Bug #6 (gerbang server)** — kalau arah RPC `SECURITY DEFINER` dipilih (lihat C9): 4 RPC baru (`create_wallet`/`create_savings_goal`/`create_custom_category`, dan pembungkus `createDebt` yang gabung count+cooldown+insert jadi satu RPC atomik) + REVOKE/GRANT execute mengikuti pola `20260723010000` + `COMMENT ON FUNCTION` per konvensi repo. Berdasar ukuran RPC serupa yang sudah ada (`check_chat_rate_limit` ~65 baris, `generate_wallet_invite` ~80 baris termasuk komentar) — perkiraan **1 migration file, ~250-400 baris total untuk 4 fungsi**, plus perubahan di 4 hook client (`useWallets.createAccount`, `useSavings.createGoal`, `useCustomCategories.addCustomCategory`, `useDebts.createDebt`) untuk memanggil `.rpc(...)` alih-alih `.from(table).insert(...)` langsung — masing-masing perubahan kecil (~10-20 baris) karena bentuk balikannya bisa dibuat mirip. **Precheck klien (checkCreateAllowed dkk.) TETAP dipertahankan untuk UX (lihat C9 poin 3) — bukan dihapus, jadi bukan pengurangan kerja, murni tambahan lapisan.**

**Total kasar ketiga bug (arah HITUNG + RPC untuk #6):** kira-kira 8-9 file JS/TS disentuh, 1 file migration baru, tidak ada perubahan skema/kolom. Bug #4 dan #5 bisa dikerjakan dan diverifikasi independen dari #6 (tidak saling blocking) — #6 adalah pekerjaan paling besar dan satu-satunya yang menyentuh database.

### D11. Apa yang rusak kalau `is_locked` tetap ada di DB tapi tak dibaca siapa pun di klien?

**Tidak ada yang rusak secara fungsional.** Kolom `NOT NULL DEFAULT false` (dikonfirmasi `20260920000000_document_is_locked_columns.sql:31,46,62` — juga kolom lama `debts.is_locked` dari `20260705000000`) berarti:
- Baris lama yang kebetulan `is_locked = true` (sisa dari downgrade yang pernah berhasil ter-reconcile sebelum perubahan ini) akan **diam-diam diabaikan** oleh klien baru — item itu akan tampil TIDAK terkunci di UI meski dulu pernah dikunci server. Ini secara efektif "membuka" kembali item yang dulu terkunci is_locked=true, TAPI hanya kalau perhitungan ulang klien (created_at ASC + limit saat ini) juga menghasilkan status berbeda. Kalau user itu masih Basic dan masih over-kuota, perhitungan ulang akan MENGUNCI ULANG item yang sama (walau mungkin item yang BEDA jika urutan created_at berubah relatif terhadap limit) — jadi secara agregat hasilnya konvergen ke keadaan yang sama, cuma sumber kebenarannya pindah dari kolom-tersimpan ke hasil-hitung.
- `planReconciliation.js` (kalau dibiarkan tetap jalan) akan terus menulis `is_locked` ke DB tanpa efek yang terlihat di klien manapun — kerja sia-sia tapi tidak merusak apa pun, murni ongkos query tak berguna.
- **Tidak ada resiko keamanan/kebocoran baru** dari kolom yang jadi "yatim" ini — dia tidak dibaca policy/trigger/RPC manapun (dikonfirmasi C8), jadi statusnya di DB tidak memengaruhi apapun di luar klien yang (setelah perubahan) tidak lagi membacanya.
- Satu-satunya downside nyata: kebingungan developer masa depan yang melihat kolom `is_locked` terisi `true`/`false` di database dan mengira itu masih sumber kebenaran aktif — perlu dicatat di `teknis_arsitektur-database.md` (setelah keputusan final, bukan sekarang) bahwa kolom ini legacy/tidak lagi dibaca klien, kalau arah HITUNG jadi dipilih.

---

## BAGIAN E — Susulan: wallets (kutipan verbatim + pencarian penolakan fungsional) & gating 3 resource

### E1. `src/hooks/useWallets.js` baris 140-165 (verbatim)

```js
140	      const memberships = await fetchSharedMemberships(userId);
141	      if (!alive) return;
142	      const sharedIds = memberships.map(m => m.walletId);
143	      const roleById  = new Map(memberships.map(m => [m.walletId, m.role]));
144	
145	      let query = supabase
146	        .from('wallets')
147	        .select('*')
148	        .order('created_at', { ascending: true });
149	
150	      const orFilter = sharedOrFilter(userId, sharedIds, 'id');
151	      // Tanpa dompet bersama, tetap pakai .eq() seperti dulu: lebih murah dan
152	      // perilakunya identik dengan sebelum Fitur B ada.
153	      query = orFilter ? query.or(orFilter) : query.eq('user_id', userId);
154	
155	      const { data, error } = await query;
156	      if (!alive) return;
157	      if (error) {
158	        console.error('[useWallets] fetch error:', error.code, error.message);
159	      } else {
160	        setAccounts((data || []).map(row => toAppWallet(row, userId, roleById)));
161	      }
162	      setLoading(false);
163	
164	      // ── Jumlah anggota aktif per dompet MILIK SENDIRI ────────────────
165	      // Dipakai dua tempat di UI: lencana "3 anggota" di kartu dompet, dan
```

Konfirmasi atas A2: `sharedIds` (baris 142, dari `fetchSharedMemberships`) menentukan `orFilter`, dan **satu query yang sama** (baris 145-155) mengambil dompet milik sendiri DAN dompet bersama sekaligus, di-`order('created_at', {ascending:true})` **lintas-owner** — tidak ada `ORDER BY user_id, created_at` atau pemisahan per-owner di query maupun di `.map()` sesudahnya (baris 160). Array `allAccounts` hasilnya betul-betul satu urutan created_at gabungan semua owner yang datanya kebetulan terlihat oleh user ini.

### E2. `supabase/migrations/20260913000000_add_wallet_invite_flow.sql` baris 125-150 (verbatim)

```sql
125	  -- Hanya OWNER dompet ini yang boleh mengundang. wallet_access_role()
126	  -- melewati RLS by design (SECURITY DEFINER) — lihat catatan di
127	  -- 20260912000000 soal kenapa helper ini wajib dipakai, bukan EXISTS() inline.
128	  IF public.wallet_access_role(p_wallet_id) <> 'owner' THEN
129	    RAISE EXCEPTION 'generate_wallet_invite: dompet tidak ditemukan atau bukan milikmu' USING ERRCODE = '42501';
130	  END IF;
131	
132	  -- Keputusan produk #1: FITUR PRO-ONLY. Dicek DI DALAM RPC (bukan cuma
133	  -- client), karena ini gerbang fitur — kalau dilewati lewat panggilan RPC
134	  -- langsung, akun ketiga permanen mendapat akses, bukan sekadar kuota
135	  -- transient seperti limit transaksi/bulan Basic.
136	  IF NOT EXISTS (
137	    SELECT 1 FROM public.user_subscriptions s
138	    WHERE s.user_id = v_user_id
139	      AND s.plan = 'pro'
140	      AND (s.expires_at IS NULL OR s.expires_at > now())
141	  ) THEN
142	    RAISE EXCEPTION 'generate_wallet_invite: berbagi dompet khusus pengguna Pro' USING ERRCODE = '42501';
143	  END IF;
144	
145	  -- Keputusan produk #2: satu kode aktif per dompet. Revoke yang lama dulu
146	  -- supaya "generate ulang karena kode hilang" tidak menyisakan dua kode
147	  -- valid sekaligus (kode lama yang "hilang" itu tetap bisa dipakai orang
148	  -- yang kebetulan melihatnya kalau tidak di-revoke).
149	  UPDATE public.wallet_invites
150	  SET    status = 'revoked'
```

Baris 136-141 adalah klausul yang dimaksud di C9: `EXISTS(SELECT 1 FROM user_subscriptions WHERE plan='pro' AND (expires_at IS NULL OR expires_at > now()))` — secara harfiah kondisi yang sama dengan `isPro` di `useSubscription.js:55-58` (`plan==='pro' && notExpired`, dengan `notExpired = !expiresAt || new Date(expiresAt) > new Date()`), ditulis ulang dalam SQL. Ini bukan gerbang tier-limit numerik (bukan soal "berapa"), tapi gerbang boolean Pro/bukan — preseden yang relevan untuk C9 adalah polanya (cek tier di dalam RPC SECURITY DEFINER), bukan isi keputusannya.

### E3. WALLETS — pencarian penolakan tulis fungsional berbasis `wallet.is_locked`

Grep `is_locked` di seluruh titik yang berpotensi menggerbangi tulisan ke dompet:

- **`src/hooks/useWallets.js`** — HANYA 3 kemunculan `is_locked` di seluruh file: baris 48 (`toAppWallet()`, pemetaan `row.is_locked` ke app-shape — bukan gate), baris 195 (komentar dokumentasi realtime), baris 230 (komentar dokumentasi realtime, di dalam blok penjelasan kenapa channel dipisah). `createAccount` (327-374), `setPrimary` (403-430), `deleteAccount` (443-465) — TIDAK SATU PUN mengecek `is_locked` sebelum menulis.
- **`src/hooks/useTransactions.js`** — nol kemunculan `is_locked`. Gate tulis transaksi yang ADA di sana adalah `canWrite`/role (`owner`/`editor` vs `viewer`), sama sekali independen dari status kunci dompet.
- **`src/transactions.jsx`** (modal catat/edit transaksi) — nol kemunculan `is_locked`/`isLocked`.
- **`src/components/`** — grep `is_locked`/`isLocked` di seluruh folder hanya menemukan `DebtDetailSheet.jsx` (soal `debt.is_locked`, sudah dipetakan A1). Tidak ada di `AccountTxSheet`, `AddAccountModal`, atau komponen wallet manapun.
- **SQL** (`supabase/**/*.sql`) — grep `is_locked` di seluruh folder `supabase/` hanya menemukan komentar di dua file migration yang MENAMBAHKAN kolomnya (`20260705000000_add_is_locked_to_debts.sql`, `20260920000000_document_is_locked_columns.sql`). Tidak ada RPC (`record_transaction`, `adjust_wallet_balance`, `update_transaction`, `delete_transaction`, atau lainnya) yang membaca `is_locked` di badan fungsinya.

**Kesimpulan E3: TIDAK DITEMUKAN.** Tidak ada satu baris kode pun — RPC SQL, hook JS, atau komponen — yang menolak aksi tulis (catat transaksi, adjustBalance, ubah/hapus transaksi, dst.) karena `wallet.is_locked === true`. Efek `is_locked` pada `wallets` murni visual (opacity, badge 🔒, badge "Soft Lock" — sudah dipetakan A1: `wallets.jsx:99,104,267,268,281-282`). Dompet yang "terkunci" tetap 100% bisa dipakai mencatat transaksi seperti biasa — berbeda dari `debts` dan `savings`, yang masing-masing punya gate tulis eksplisit (`useDebts.js:361,470,487`; `useSavings.js:155`).

### E4. Mekanisme gating create untuk wallets, savings, custom_categories (bukan `checkCreateAllowed`)

Ketiganya punya pola yang SAMA satu sama lain tapi BEDA dari `debts`: perbandingan `array.length` murni terhadap state yang sudah ada di memori, dieksekusi SEBELUM ada panggilan jaringan apapun — tidak ada query tambahan di titik gating-nya sendiri.

**Wallets** — `src/hooks/useWallets.js:333-337`, di dalam `createAccount(a)`:
```js
333    const maxWallets = limits?.maxWallets ?? Infinity;
334    if (accounts.length >= maxWallets) {
335      openPaywall(t('paywall.feature.walletTambahan'));
336      return { error: null, limitReached: true };
337    }
```
(baris 338-344 baru menyusul `requireUserId()` — panggilan jaringan pertama di fungsi ini terjadi SETELAH gate ini lolos, bukan sebelum/di dalamnya)

**Savings** — `src/hooks/useSavings.js:92-96`, di dalam `createGoal(g)`:
```js
92    const maxGoals = limits?.maxSavingsGoals ?? Infinity;
93    if (goals.length >= maxGoals) {
94      openPaywall(t('paywall.feature.goalsTambahan'));
95      return { error: null, limitReached: true };
96    }
```

**Custom categories** — `src/hooks/useCustomCategories.js:98-102`, di dalam `addCustomCategory(...)`:
```js
98    const maxCustom = limits?.maxCustomCategories ?? Infinity;
99    if (customCategories.filter(c => !c.is_deleted).length >= maxCustom) {
100     openPaywall(t('paywall.feature.kategoriKustomTambahan'));
101     return { error: null, category: null, limitReached: true };
102   }
```
(satu-satunya bedanya dari dua yang lain: filter `!c.is_deleted` dulu sebelum `.length` — tapi tetap operasi array sinkron di state yang sudah ada, bukan query baru)

**Apakah ada query async yang bisa gagal di sini juga?** **Tidak.** Ketiga gate ini murni `limits?.maxX ?? Infinity` (dari `useSubscription().limits`, sudah di-resolve lebih dulu sebagai prop/state, bukan di-fetch ulang di titik ini) dibandingkan ke `.length` array React state yang sudah di tangan (`accounts`/`goals`/`customCategories`, hasil fetch awal hook + update lokal tiap create/delete). Tidak ada `await supabase.from(...)` di dalam ketiga blok gate ini — jadi tidak ada mode-gagal jaringan/RLS yang setara dengan bug #5. Ini konsisten dengan kenapa bug #5 secara spesifik hanya ada di `debts`: hanya `debts` yang punya konsep tambahan "rolling window `debtCooldownDays`" (`planLimits.js:19`, `checkCreateAllowed()` baris 211-250) yang PERLU data agregat dari DB (termasuk baris yang sudah di-soft-delete, sengaja tidak ada di state lokal — lihat komentar `useDebts.js:195-197`) sehingga tidak bisa dihitung dari state yang sudah di tangan. `wallets`/`savings`/`custom_categories` tidak punya cooldown sama sekali di `PLAN_LIMITS` — limitnya murni "maks N item aktif", dan N item itu sudah selalu ada lengkap di state lokal (tidak ada bagian datanya yang sengaja dibuang dari state seperti soft-deleted debts). Jadi ketiga resource ini secara struktural TIDAK BISA punya bug fail-open yang sama seperti #5, karena tidak ada query di titik gating-nya untuk gagal.
