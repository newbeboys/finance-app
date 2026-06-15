import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, INCOME_CATEGORIES } from '../data';
import { CategoryField, CUSTOM_ID, CUSTOM_COLORS } from '../category-field';
import { DatePickerPopup } from '../transactions';
import { useScrollLock } from '../hooks/useScrollLock';
import { todayISO, fromISO } from '../lib/recurringHelper';

// Day/month names kept in Indonesian — stored as values in recurring transaction data
const DAY_OPTIONS   = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const MONTH_NAMES   = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES     = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const inputStyle = { width: '100%', padding: '11px 12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const formatLong = (iso) => {
  const d = fromISO(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

// Pemilih tanggal 1–28 berbentuk grid kalender (7 kolom × 4 baris).
// Mengganti dropdown panjang — nilai tetap angka 1–28.
function DateGridField({ value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const wrapRef = React.useRef(null);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      const width = Math.max(r.width, 280);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left, width });
    }
    setOpen((o) => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const pick = (n) => { onChange(n); setOpen(false); };

  return (
    <div ref={wrapRef}>
      <button type="button" onClick={toggle}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: 'var(--ink)' }}>{t('berulang.tanggalN', { n: value })}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: 6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12,
          boxShadow: '0 12px 36px -10px rgba(42,44,32,.35)', zIndex: 9999, padding: 12, boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>{t('berulang.pilihTanggal')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => {
              const sel = n === value;
              return (
                <button key={n} type="button" onClick={() => pick(n)}
                  style={{
                    aspectRatio: '1 / 1', minHeight: 30, borderRadius: 8, border: 0, cursor: 'pointer',
                    fontSize: 13, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                    background: sel ? 'var(--sage)' : 'color-mix(in oklch, var(--ink) 80%, var(--paper))',
                    color: '#fff', fontWeight: sel ? 600 : 400,
                  }}>
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// id kategori bawaan (untuk membedakan dari kategori nama-bebas saat edit)
const BUILTIN_IDS = new Set([...CATEGORIES, ...INCOME_CATEGORIES].map((c) => c.id));

// Modal form untuk menambah / mengubah satu jadwal transaksi berulang.
export default function RecurringTransactionForm({ initial = null, onSave, onCancel }) {
  const { t } = useTranslation();
  useScrollLock(true);
  const isEdit = !!initial;

  const FREKUENSI = [
    { id: 'mingguan', label: t('berulang.mingguan') },
    { id: 'bulanan',  label: t('berulang.bulanan')  },
    { id: 'tahunan',  label: t('berulang.tahunan')  },
  ];

  const [nama, setNama]         = React.useState('');
  const [tipe, setTipe]         = React.useState('pengeluaran');
  const [jumlah, setJumlah]     = React.useState('');
  const [cat, setCat]           = React.useState(CATEGORIES[0].id);
  const [pendingCustom, setPendingCustom] = React.useState(null);
  const [frekuensi, setFrekuensi] = React.useState('bulanan');
  const [hariMinggu, setHariMinggu] = React.useState('Senin');
  const [tanggal, setTanggal]   = React.useState(1);
  const [bulan, setBulan]       = React.useState(1);
  const [mulaiDari, setMulaiDari] = React.useState(todayISO());
  const [catatan, setCatatan]   = React.useState('');
  const [showPicker, setShowPicker] = React.useState(false);

  // Pre-fill saat mode edit
  React.useEffect(() => {
    if (!initial) return;
    setNama(initial.nama || '');
    setTipe(initial.tipe === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
    setJumlah(String(initial.jumlah || ''));
    setFrekuensi(initial.frekuensi || 'bulanan');
    setHariMinggu(initial.hariMinggu || 'Senin');
    setTanggal(initial.tanggal || 1);
    setBulan(initial.bulan || 1);
    setMulaiDari(initial.mulaiDari || todayISO());
    setCatatan(initial.catatan || '');
    // Kategori: id bawaan → pilih langsung; selain itu → mode Kustom (nama bebas)
    if (initial.kategori && BUILTIN_IDS.has(initial.kategori)) {
      setCat(initial.kategori);
    } else if (initial.kategori) {
      setCat(CUSTOM_ID);
      setPendingCustom({ name: initial.kategori, color: CUSTOM_COLORS[0] });
    }
  }, [initial]);

  const activeCats = tipe === 'pemasukan' ? INCOME_CATEGORIES : CATEGORIES;
  const isCustom = cat === CUSTOM_ID;

  const switchTipe = (next) => {
    setTipe(next);
    setPendingCustom(null);
    setCat(next === 'pemasukan' ? INCOME_CATEGORIES[0].id : CATEGORIES[0].id);
  };

  const valid =
    nama.trim().length > 0 &&
    (+jumlah > 0) &&
    (!isCustom || (pendingCustom?.name || '').trim().length > 0);

  const submit = () => {
    if (!valid) return;
    const kategori = isCustom ? pendingCustom.name.trim() : cat;
    onSave?.({
      nama: nama.trim(),
      tipe,
      jumlah: +jumlah,
      kategori,
      frekuensi,
      hariMinggu: frekuensi === 'mingguan' ? hariMinggu : null,
      tanggal: frekuensi === 'mingguan' ? null : Number(tanggal),
      bulan: frekuensi === 'tahunan' ? Number(bulan) : null,
      mulaiDari,
      catatan: catatan.trim(),
      aktif: initial?.aktif ?? true,
    });
  };

  return (
    <div onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(42,44,32,.32)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16, animation: 'rise .25s ease-out' }}>
      <div className="card" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', maxHeight: '92vh', overflowY: 'auto', padding: 24, animation: 'rise .3s ease-out', boxShadow: '0 30px 80px -20px rgba(42,44,32,.4)' }}>

        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{isEdit ? t('berulang.editJadwal') : t('berulang.jadwalBaru')}</div>
          <div className="serif" style={{ fontSize: 26, marginTop: 4, letterSpacing: '-0.01em' }}>{isEdit ? t('berulang.ubahBerulang') : t('berulang.transaksiBerulangForm')}</div>
        </div>

        {/* Tipe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 3, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, marginTop: 18 }}>
          {[{ id: 'pengeluaran', label: t('transaksi.pengeluaran') }, { id: 'pemasukan', label: t('transaksi.pemasukan') }].map((opt) => (
            <button key={opt.id} onClick={() => switchTipe(opt.id)}
              style={{ padding: '10px', fontSize: 13, background: tipe === opt.id ? 'var(--ivory)' : 'transparent', border: tipe === opt.id ? '1px solid var(--line-soft)' : '1px solid transparent', borderRadius: 9, color: tipe === opt.id ? 'var(--ink)' : 'var(--muted)', fontWeight: tipe === opt.id ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <Field label={t('berulang.namaTransaksi')}>
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder={t('berulang.namaTxPlaceholder')} style={inputStyle} />
          </Field>

          <Field label={t('transaksi.jumlah')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, padding: 0, paddingLeft: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>{tipe === 'pengeluaran' ? '−' : '+'}Rp</span>
              <input value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" inputMode="numeric"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit', padding: '11px 12px 11px 0', fontVariantNumeric: 'tabular-nums' }} />
            </div>
          </Field>

          <Field label={t('transaksi.kategori')}>
            <CategoryField
              value={cat}
              onChange={setCat}
              categories={activeCats}
              customCategories={[]}
              allowCustom
              pending={pendingCustom}
              onPendingChange={setPendingCustom}
            />
          </Field>

          {/* Frekuensi */}
          <Field label={t('berulang.frekuensi')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: 3, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
              {FREKUENSI.map((f) => (
                <button key={f.id} onClick={() => setFrekuensi(f.id)}
                  style={{ padding: '10px 6px', fontSize: 13, background: frekuensi === f.id ? 'var(--ivory)' : 'transparent', border: frekuensi === f.id ? '1px solid var(--line-soft)' : '1px solid transparent', borderRadius: 9, color: frekuensi === f.id ? 'var(--ink)' : 'var(--muted)', fontWeight: frekuensi === f.id ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Detail jadwal sesuai frekuensi */}
          {frekuensi === 'mingguan' && (
            <Field label={t('berulang.setiapHari')}>
              <select value={hariMinggu} onChange={(e) => setHariMinggu(e.target.value)} style={inputStyle}>
                {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          )}

          {frekuensi === 'bulanan' && (
            <Field label={t('berulang.setiapTgl')}>
              <DateGridField value={tanggal} onChange={setTanggal} />
            </Field>
          )}

          {frekuensi === 'tahunan' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
              <Field label={t('berulang.tanggal')}>
                <DateGridField value={tanggal} onChange={setTanggal} />
              </Field>
              <Field label={t('berulang.bulan')}>
                <select value={bulan} onChange={(e) => setBulan(+e.target.value)} style={inputStyle}>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* Mulai dari tanggal */}
          <Field label={t('berulang.mulaiDariLabel')}>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowPicker((v) => !v)}
                style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--ink)' }}>{formatLong(mulaiDari)}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              </button>
              {showPicker && (
                <DatePickerPopup
                  valueISO={mulaiDari}
                  onConfirm={(iso) => { setMulaiDari(iso); setShowPicker(false); }}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
          </Field>

          <Field label={t('berulang.catatanOpsional')}>
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder={t('berulang.catatanPlaceholder')} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '13px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('umum.batal')}</button>
          <button onClick={submit} disabled={!valid}
            style={{ flex: 2, padding: '13px', background: valid ? 'var(--ink)' : 'var(--line-soft)', color: valid ? 'var(--cream)' : 'var(--muted-2)', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {t('umum.simpan')}
          </button>
        </div>
      </div>
    </div>
  );
}
