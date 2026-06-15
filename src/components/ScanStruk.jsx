import React from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useScrollLock } from '../hooks/useScrollLock';
import { parseReceipt } from '../lib/strukParser';

// Plugin native ML Kit (OCR offline). Di web tak ada implementasi → selalu
// dijaga oleh Capacitor.isNativePlatform() sebelum dipanggil.
const MlkitOcr = registerPlugin('MlkitOcr');

// Ikon kamera sederhana — selaras dengan gaya ikon SVG aplikasi.
export const IconCamera = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Tombol pemicu — dipakai di header kartu transaksi (beranda), di samping "Tambah".
export function ScanStrukButton({ onClick, isMobile }) {
  return (
    <button onClick={onClick} title="Scan struk belanja"
      style={{
        padding: isMobile ? '8px 12px' : '7px 12px',
        background: 'var(--paper)', color: 'var(--ink-2)',
        border: '1px solid var(--line-soft)', borderRadius: 10,
        fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      }}>
      <IconCamera size={14} /> Scan Struk
    </button>
  );
}

const SUCCESS_TEXT = '✅ Struk berhasil dibaca! Periksa dan sesuaikan data sebelum menyimpan.';
const NO_TOTAL_TEXT = 'Total tidak terdeteksi, silakan isi manual.';
const UNREADABLE_TEXT = 'Struk kurang jelas terbaca. Coba foto ulang dengan pencahayaan lebih baik, atau isi manual.';

// Hasil untuk form transaksi kosong (manual) saat scan gagal.
function manualResult(previewImage, text) {
  return {
    previewImage,
    notice: { type: 'warning', text },
    prefill: { type: 'expense', amount: '', merchant: '', note: '', category: 'shopping' },
  };
}

// Bottom sheet: pilih sumber → ambil foto → OCR → parse → kirim hasil ke parent.
// `onResult({ prefill, notice, previewImage })` membuka AddTransactionModal terprefill.
export function ScanStrukSheet({ open, onClose, onResult }) {
  useScrollLock(open);
  const [phase, setPhase] = React.useState('choose'); // 'choose' | 'loading' | 'error'
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (open) { setPhase('choose'); setErrorMsg(''); }
  }, [open]);

  if (!open) return null;

  const run = async (source) => {
    if (!Capacitor.isNativePlatform()) {
      setPhase('error');
      setErrorMsg('Fitur Scan Struk hanya tersedia di aplikasi Android.');
      return;
    }
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        correctOrientation: true,
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        promptLabelHeader: 'Scan Struk',
      });

      setPhase('loading');
      const path = photo.path || photo.webPath;

      let text = '';
      try {
        const res = await MlkitOcr.recognizeText({ path });
        text = (res && res.text) || '';
      } catch {
        onResult(manualResult(photo.webPath, UNREADABLE_TEXT));
        onClose();
        return;
      }

      const parsed = parseReceipt(text);
      const gotSomething = parsed.found.total || parsed.found.items || parsed.found.store;
      if (!text.trim() || !gotSomething) {
        onResult(manualResult(photo.webPath, UNREADABLE_TEXT));
        onClose();
        return;
      }

      onResult({
        previewImage: photo.webPath,
        notice: parsed.found.total
          ? { type: 'success', text: SUCCESS_TEXT }
          : { type: 'warning', text: NO_TOTAL_TEXT },
        prefill: {
          type: 'expense',
          amount: parsed.found.total ? parsed.total : '',   // tak ketemu → 0/kosong
          merchant: parsed.store || '',
          note: parsed.note || '',
          category: parsed.category,
          dateRaw: parsed.dateRaw || undefined,             // tak ketemu → modal pakai hari ini
        },
      });
      onClose();
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (/cancel/i.test(msg)) { onClose(); return; }       // user batal ambil foto
      setPhase('error');
      setErrorMsg('Tidak bisa membuka kamera/galeri. ' + msg);
    }
  };

  const optBtn = {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
    padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line-soft)',
    background: 'var(--paper)', cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
    boxSizing: 'border-box',
  };
  const iconWrap = (bg) => ({ width: 44, height: 44, borderRadius: 12, background: bg, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 20 });

  return (
    <div onClick={() => phase !== 'loading' && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(42,44,32,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'rise .2s ease-out' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', background: 'var(--ivory)', borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)', boxSizing: 'border-box', boxShadow: '0 -20px 60px -20px rgba(42,44,32,.5)', animation: 'rise .25s ease-out' }}>

        <div style={{ width: 38, height: 4, borderRadius: 4, background: 'var(--line-soft)', margin: '0 auto 16px' }} />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Scan Struk</div>
          <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>
            {phase === 'loading' ? 'Membaca struk…' : phase === 'error' ? 'Ada kendala' : 'Pilih sumber gambar'}
          </div>
        </div>

        {phase === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => run('camera')} style={optBtn}>
              <span style={iconWrap('var(--sage)')}>📷</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>Ambil Foto</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>Buka kamera dan foto struk</span>
              </span>
            </button>
            <button onClick={() => run('gallery')} style={optBtn}>
              <span style={iconWrap('var(--gold)')}>🖼️</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>Pilih dari Galeri</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>Ambil foto struk yang sudah tersimpan</span>
              </span>
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px', color: 'var(--muted)', fontSize: 13.5 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            ML Kit sedang membaca teks struk di perangkat (offline)…
          </div>
        )}

        {phase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div role="alert" style={{ fontSize: 13, color: 'var(--terra)', background: 'color-mix(in oklch, var(--terra) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--terra) 25%, transparent)', borderRadius: 10, padding: '11px 13px', lineHeight: 1.45 }}>
              {errorMsg}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer' }}>Tutup</button>
              <button onClick={() => setPhase('choose')} style={{ flex: 1.4, padding: '12px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Coba lagi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
