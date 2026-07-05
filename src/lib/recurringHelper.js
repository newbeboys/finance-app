// ── Recurring Transaction helper ───────────────────────────────────
// Semua jadwal transaksi berulang disimpan di localStorage (key di bawah).
// Eksekusi otomatis (membuat transaksi ke Supabase) dilakukan oleh
// checkRecurringTransactions() yang dipanggil App.jsx saat aplikasi dibuka.

const KEY = 'recurringTransactions';

// Index = Date.getDay() → 0=Minggu … 6=Sabtu
const DAY_NAMES   = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n) => String(n).padStart(2, '0');
export const toISO    = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO  = (iso) => new Date(iso + 'T00:00:00');
export const todayISO = () => toISO(new Date());

// ── Penyimpanan ────────────────────────────────────────────────────
export function loadRecurring() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveRecurring(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

function uid() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// ── Perhitungan tanggal jatuh tempo ────────────────────────────────
// Kejadian pertama pada/atau setelah `mulaiDari` yang cocok pola frekuensi.
export function computeFirstDueDate({ frekuensi, hariMinggu, tanggal, bulan, mulaiDari }) {
  const start = fromISO(mulaiDari || todayISO());

  if (frekuensi === 'mingguan') {
    const target = DAY_NAMES.indexOf(hariMinggu);
    const d = new Date(start);
    if (target >= 0) d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
    return toISO(d);
  }

  if (frekuensi === 'tahunan') {
    const day = clampDay(tanggal);
    const mon = Math.min(Math.max(Number(bulan) || 1, 1), 12) - 1;
    let d = new Date(start.getFullYear(), mon, day);
    if (d < start) d = new Date(start.getFullYear() + 1, mon, day);
    return toISO(d);
  }

  // bulanan (default)
  const day = clampDay(tanggal);
  let d = new Date(start.getFullYear(), start.getMonth(), day);
  if (d < start) d = new Date(start.getFullYear(), start.getMonth() + 1, day);
  return toISO(d);
}

// Maju ke jatuh tempo berikutnya (dipakai setelah sebuah transaksi dieksekusi).
export function advanceDueDate(iso, frekuensi) {
  const d = fromISO(iso);
  if (frekuensi === 'mingguan')      d.setDate(d.getDate() + 7);
  else if (frekuensi === 'tahunan')  d.setFullYear(d.getFullYear() + 1);
  else                               d.setMonth(d.getMonth() + 1); // bulanan
  return toISO(d);
}

const clampDay = (n) => Math.min(Math.max(Number(n) || 1, 1), 28); // 1–28 → aman di semua bulan

// ── Normalisasi & CRUD ─────────────────────────────────────────────
function normalize(data, id) {
  const frekuensi = ['mingguan', 'bulanan', 'tahunan'].includes(data.frekuensi) ? data.frekuensi : 'bulanan';
  const item = {
    id: id || uid(),
    nama: (data.nama || '').trim(),
    tipe: data.tipe === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
    jumlah: Math.abs(Number(data.jumlah) || 0),
    kategori: data.kategori || '',
    frekuensi,
    hariMinggu: frekuensi === 'mingguan' ? (data.hariMinggu || 'Senin') : null,
    tanggal: frekuensi === 'mingguan' ? null : clampDay(data.tanggal),
    bulan: frekuensi === 'tahunan' ? Math.min(Math.max(Number(data.bulan) || 1, 1), 12) : null,
    mulaiDari: data.mulaiDari || todayISO(),
    catatan: (data.catatan || '').trim(),
    wallet_id: data.wallet_id || null,
    aktif: data.aktif !== false,
  };
  item.nextDueDate = computeFirstDueDate(item);
  return item;
}

export function addRecurring(data) {
  const item = normalize(data);
  const list = loadRecurring();
  list.push(item);
  saveRecurring(list);
  return item;
}

export function updateRecurring(id, data) {
  const list = loadRecurring();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  const prev = list[idx];
  const item = normalize(data, id);
  // Pertahankan nextDueDate bila jadwal tak berubah (mis. user cuma ganti nama)
  const scheduleChanged = ['frekuensi', 'hariMinggu', 'tanggal', 'bulan', 'mulaiDari']
    .some((k) => String(prev[k]) !== String(item[k]));
  item.nextDueDate = scheduleChanged ? item.nextDueDate : prev.nextDueDate;
  list[idx] = item;
  saveRecurring(list);
  return item;
}

export function deleteRecurring(id) {
  saveRecurring(loadRecurring().filter((x) => x.id !== id));
}

export function toggleRecurring(id) {
  const list = loadRecurring();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], aktif: !list[idx].aktif };
  saveRecurring(list);
  return list[idx];
}

// Pilih wallet_id untuk transaksi otomatis. Kolom transactions.wallet_id kini
// NOT NULL, sedangkan jadwal berulang (terutama data lama) tak menyimpan wallet.
// Urutan fallback: wallet_id jadwal (bila valid) → wallet primary → wallet
// pertama. Kembalikan null hanya bila user benar-benar tak punya wallet.
function resolveWalletId(item, wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return null;
  if (item.wallet_id && wallets.some((w) => w.id === item.wallet_id)) return item.wallet_id;
  const primary = wallets.find((w) => w.is_primary || w.primary);
  if (primary) return primary.id;
  return wallets[0].id;   // tak ada yang ditandai primary → pakai wallet pertama
}

// ── Eksekusi otomatis ──────────────────────────────────────────────
// Untuk setiap jadwal aktif yang sudah jatuh tempo (≤ hari ini), buat
// transaksi ke Supabase via createTransaction lalu majukan nextDueDate.
// While-loop mengejar periode yang terlewat bila app lama tak dibuka.
// `wallets` = daftar dompet user (dari useWallets) untuk mengisi wallet_id.
export async function checkRecurringTransactions(createTransaction, wallets = []) {
  const list = loadRecurring();
  if (!list.length || typeof createTransaction !== 'function') return [];

  const today = todayISO();      // ISO yyyy-mm-dd → aman dibandingkan secara leksikografis
  const MAX = 60;                // batas catch-up per item agar tak runaway
  const executed = [];
  let changed = false;

  for (const item of list) {
    if (!item.aktif) continue;

    // Tiap jadwal dibungkus try-catch sendiri: satu jadwal gagal tidak boleh
    // menghentikan pemrosesan jadwal lain dalam array.
    try {
      const walletId = resolveWalletId(item, wallets);
      if (!walletId) {
        // User tak punya wallet sama sekali → tak mungkin insert (wallet_id NOT NULL).
        // Skip jadwal ini untuk sesi ini tanpa menghentikan proses.
        console.warn('[recurring] dilewati — user belum punya wallet:', item.nama);
        continue;
      }

      let guard = 0;
      while (item.nextDueDate && item.nextDueDate <= today && guard < MAX) {
        const dueISO = item.nextDueDate;
        const d = fromISO(dueISO);
        const dateLabel = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
        const amount = item.tipe === 'pemasukan' ? Math.abs(item.jumlah) : -Math.abs(item.jumlah);

        const tx = {
          id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          date: dateLabel,
          dateRaw: dueISO,
          time: '00:00',
          merchant: item.nama || '—',
          note: ('[Otomatis] ' + (item.catatan || '')).trim(),
          category: item.kategori || '',
          method: 'Tunai',
          amount,
          wallet_id: walletId,
        };

        const res = await createTransaction(tx);
        // Gagal insert (mis. offline) atau limit transaksi bulanan tercapai →
        // hentikan item ini TANPA memajukan nextDueDate, coba lagi nanti.
        if (res && (res.error || res.limitReached)) break;

        executed.push({ nama: item.nama, jumlah: item.jumlah, tipe: item.tipe });
        item.nextDueDate = advanceDueDate(item.nextDueDate, item.frekuensi);
        changed = true;
        guard++;
      }
    } catch (err) {
      console.warn('[recurring] jadwal gagal diproses, dilewati:', item.nama, err?.message || err);
    }
  }

  if (changed) saveRecurring(list);
  return executed;
}
