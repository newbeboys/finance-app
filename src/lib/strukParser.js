// Parsing teks hasil OCR struk/nota belanja → data transaksi.
//
// MURNI (tanpa dependensi native/React) agar mudah diuji dan dipakai ulang.
// Tidak ada OCR di sini — input `rawText` berasal dari plugin native MlkitOcr.
// Hasil parsing TIDAK pernah final: user selalu memeriksa & mengedit di form
// sebelum menyimpan (lihat ScanStruk.jsx → AddTransactionModal).

// Kata kunci makanan/minuman. Jika salah satu muncul di teks struk, kategori
// → "food" (Makanan & Minuman); selain itu default "shopping" (Belanja).
const FOOD_HINTS = [
  'makan', 'minum', 'food', 'resto', 'restaurant', 'cafe', 'kafe', 'kopi', 'coffee',
  'warung', 'warteg', 'bakso', 'soto', 'ayam', 'nasi', 'mie', 'burger', 'pizza',
  'kfc', 'mcd', 'mcdonald', 'cfc', 'hokben', 'geprek', 'sate', 'martabak', 'roti',
  'bakery', 'donut', 'donat', ' teh', 'jus', 'snack', 'cemilan', 'gorengan',
  'seafood', 'steak', 'ramen', 'sushi', 'dimsum', 'boba', 'milk', 'susu', 'starbucks',
];

// Baris yang BUKAN item belanja (header, pajak, pembayaran, footer struk).
const ITEM_STOPWORDS = [
  'total', 'subtotal', 'sub total', 'tunai', 'cash', 'kembali', 'kembalian', 'change',
  'ppn', 'pajak', 'tax', 'diskon', 'discount', 'potongan', 'npwp', 'kasir', 'cashier',
  'struk', 'receipt', 'nota', 'faktur', 'terima kasih', 'thank',
  'bayar', 'pembayaran', 'payment', 'kartu', 'debit', 'kredit', 'qris',
  'tanggal', 'tgl', 'telp', 'telepon', 'phone', 'alamat', 'www', 'http',
];

// Baris yang jelas BUKAN nama toko (alamat/kontak/tanggal).
const STORE_SKIP = ['jl', 'jalan', 'telp', 'telepon', 'phone', 'npwp', 'www', 'http', 'kasir', 'tanggal', 'tgl'];

const MONTHS_ID = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, aug: 8, agt: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

const pad2 = (n) => String(n).padStart(2, '0');
const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// "Rp 25.000" / "25.000,00" / "12.500" → 25000 / 25000 / 12500
export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!s) return null;
  s = s.replace(/[.,]\d{2}$/, '');   // buang desimal sen ",00"/".00" di akhir
  s = s.replace(/[.,]/g, '');        // sisa titik/koma = pemisah ribuan
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// Semua token angka pada sebuah baris (kiri→kanan), sudah jadi nominal.
function numberTokens(line) {
  const m = line.match(/\d[\d.,]*\d|\d/g) || [];
  return m.map(parseAmount).filter((v) => v != null);
}

function validDate(d, mo, y) {
  return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100;
}

// Cari tanggal pada teks → ISO "YYYY-MM-DD", atau null bila tak ketemu.
export function parseDate(text) {
  // DD/MM/YYYY · DD-MM-YYYY · DD.MM.YYYY · DD/MM/YY
  let m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (m) {
    let d = +m[1], mo = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    if (validDate(d, mo, y)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  // DD Mon YYYY → "13 Jun 2026" / "13 Juni 2026"
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (m) {
    const d = +m[1], y = +m[3];
    const mo = MONTHS_ID[m[2].slice(0, 3).toLowerCase()];
    if (mo && validDate(d, mo, y)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  return null;
}

// Nama toko: baris pertama yang tampak seperti nama (huruf, bukan alamat/angka).
export function parseStore(lines) {
  for (const line of lines) {
    const s = line.trim();
    if (!s || /^\d/.test(s)) continue;
    if ((s.match(/[A-Za-z]/g) || []).length < 3) continue;
    const low = s.toLowerCase();
    if (STORE_SKIP.some((w) => low.startsWith(w + ' ') || low.startsWith(w + '.'))) continue;
    if (parseDate(s)) continue;
    return s.replace(/\s{2,}/g, ' ').slice(0, 40);
  }
  return '';
}

// Total: prioritas kata kunci, dicari dari bawah (total biasanya di akhir struk).
export function parseTotal(lines) {
  const priorities = [
    /grand\s*total/i,
    /total\s*belanja/i,
    /total\s*bayar/i,
    /total\s*harga/i,
    /\btotal\b/i,
  ];
  for (const re of priorities) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/sub\s*total/i.test(line)) continue;   // jangan ambil subtotal
      if (!re.test(line)) continue;
      const toks = numberTokens(line);
      if (toks.length) return toks[toks.length - 1];
      // nominal kadang turun ke baris berikutnya
      if (i + 1 < lines.length) {
        const next = numberTokens(lines[i + 1]);
        if (next.length) return next[next.length - 1];
      }
    }
  }
  return null;
}

// Item belanja: baris "nama … harga" yang bukan baris stopword.
export function parseItems(lines) {
  const items = [];
  for (const raw of lines) {
    const low = raw.toLowerCase();
    if (ITEM_STOPWORDS.some((w) => low.includes(w))) continue;
    const toks = numberTokens(raw);
    if (!toks.length) continue;
    const price = toks[toks.length - 1];
    if (price == null || price < 100) continue;          // harga wajar ≥ 100
    const work = raw.replace(/^\s*\d+\s*[xX*]?\s+/, '');  // buang qty di depan
    const name = work
      .replace(/\s*(?:rp\.?\s*)?[\d][\d.,]*\s*$/i, '')    // buang harga di belakang
      .replace(/[-–:.\s]+$/, '')
      .trim();
    if ((name.match(/[A-Za-z]/g) || []).length < 2) continue;
    items.push({ name: name.slice(0, 32), price });
    if (items.length >= 25) break;
  }
  return items;
}

export function detectCategory(text) {
  const low = ' ' + text.toLowerCase() + ' ';
  return FOOD_HINTS.some((w) => low.includes(w)) ? 'food' : 'shopping';
}

// Parse lengkap → objek siap dipakai untuk prefill form transaksi.
export function parseReceipt(rawText) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const store = parseStore(lines);
  const dateRaw = parseDate(text);
  const items = parseItems(lines);
  const total = parseTotal(lines);
  const category = detectCategory(text);

  const note = items.length
    ? items.map((it) => `${it.name} ${formatRp(it.price)}`).join(' · ')
    : '';

  return {
    store, dateRaw, items, total, category, note,
    found: {
      store: !!store,
      date: !!dateRaw,
      total: total != null,
      items: items.length > 0,
    },
  };
}
