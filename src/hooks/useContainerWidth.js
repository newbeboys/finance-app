import { useState, useLayoutEffect } from 'react';

// Ambang "compact": kalau lebar KONTEN yang tersedia (bukan lebar layar) < angka
// ini, keempat komponen responsif (TopBar, tabel Transaksi, tabel Anggaran, grid
// Analitik) memakai tata letak ringkas/mobile-nya. Harus SAMA dengan breakpoint
// `@container main-content` di index.css (max-width: 759px → compact ≤ 759).
//
// Kenapa 760 (dipilih lewat uji visual overflow, bukan tebakan):
//   <750px  → .main-content full-width, konten maks ~749px < 760 → SELALU compact,
//             identik dgn perilaku lama useIsMobile (mobile <750px tak berubah).
//   768px   → konten ~528 (< 760 → compact): tabel desktop 5-kolom TERBUKTI nempel
//             di 528px, jadi pakai baris ringkas.
//   1024px  → konten ~784 (≥ 760 → desktop): overflow 0px, header kolom terpisah
//             jelas — tata letak desktop sudah rapi, tak perlu diringkas.
//   1440px  → konten ~1100 (≥ 760 → desktop penuh).
export const CONTENT_COMPACT_MAX = 760;

// TopBar butuh ambang lebih tinggi: header desktop-nya memuat search 280px +
// switcher + tombol, jadi butuh ruang lebih. Uji visual: di konten 528px header
// overlap (84px), di 784px greeting pecah ~3 baris, baru ≥~900px lega. Maka
// TopBar pakai varian ringkas (mobile) sampai konten ≥ 900px:
//   768px→528 & 1024px→784 : header mobile ringkas (bersih, 1 baris sapaan)
//   1440px→1100            : header desktop penuh (search + switcher + sapaan).
export const TOPBAR_COMPACT_MAX = 900;

// Mengukur lebar CONTENT-BOX .main-content lewat ResizeObserver — yaitu ruang
// nyata yang tersedia untuk konten halaman (sudah dikurangi gutter Sidebar 240px
// di ≥750px). Dipakai KHUSUS oleh 4 komponen responsif; TIDAK menggantikan
// useIsMobile() global yang masih dipakai halaman lain.
export function useContainerWidth(selector = '.main-content') {
  const [width, setWidth] = useState(() => measure(selector));

  // useLayoutEffect (bukan useEffect): pada mount pertama Beranda, .main-content
  // belum ada di DOM saat render TopBar, jadi nilai awal jatuh ke window.innerWidth.
  // Koreksi ke lebar konten asli HARUS terjadi sebelum paint agar tidak ada kedip
  // header desktop→mobile di 1024px. Layout effect jalan setelah DOM ter-commit
  // (main-content sudah ada) & sebelum browser melukis.
  useLayoutEffect(() => {
    const el = document.querySelector(selector);
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const inline = e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect.width;
        if (inline) setWidth(inline);
      }
    });
    ro.observe(el);
    setWidth(measure(selector));   // sinkron sekali sebelum paint
    return () => ro.disconnect();
  }, [selector]);

  return width;
}

// Nilai awal = content-box width (clientWidth memuat padding, jadi kurangi
// padding kiri+kanan) supaya tidak ada flash sebelum ResizeObserver menembak.
function measure(selector) {
  const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
  if (!el) return typeof window !== 'undefined' ? window.innerWidth : 1024;
  const cs = getComputedStyle(el);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return el.clientWidth - pad;
}

// Helper: true kalau ruang konten sempit (harus pakai layout ringkas/mobile).
// maxWidth default 760 (tabel Transaksi/Anggaran/Analitik); TopBar melewatkan
// TOPBAR_COMPACT_MAX (900).
export function useIsCompact(selector = '.main-content', maxWidth = CONTENT_COMPACT_MAX) {
  return useContainerWidth(selector) < maxWidth;
}
