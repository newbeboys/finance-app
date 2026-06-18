import React from 'react';
import { supabase } from '../supabase';
import { CATEGORIES, INCOME_CATEGORIES } from '../data';
import { usePaywall } from '../components/PaywallModal';

// Supabase row → bentuk kategori yang dipakai komponen (sama seperti CATEGORIES)
function toCustomCat(row) {
  return {
    id:         row.id,                    // uuid — disimpan sebagai `category` di transaksi/budget
    label:      row.name,
    color:      row.color || 'var(--sage)',
    type:       row.type || 'expense',     // 'income' | 'expense' — dipakai filter tampilan
    custom:     true,
    is_locked:  row.is_locked  || false,
    is_deleted: row.is_deleted || false,   // soft delete — tetap ada di state untuk resolve transaksi lama
  };
}

const norm = (s) => (s || '').trim().toLowerCase();

// Nama yang sudah dipakai kategori bawaan — tidak boleh diduplikasi
const BUILTIN_NAMES = new Set(
  [...CATEGORIES, ...INCOME_CATEGORIES].map(c => norm(c.label))
);

export function useCustomCategories(userId, limits) {
  const [customCategories, setCustomCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const { openPaywall } = usePaywall();

  // Load awal + subscribe realtime
  React.useEffect(() => {
    if (!userId) { setCustomCategories([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);

    supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error) setCustomCategories((data || []).map(toCustomCat));
        setLoading(false);
      });

    // Realtime: kategori yang ditambah di device/menu lain langsung masuk
    const channel = supabase
      .channel(`custom_categories:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'custom_categories', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!alive) return;
          if (payload.eventType === 'INSERT') {
            const cat = toCustomCat(payload.new);
            setCustomCategories(prev => prev.some(c => c.id === cat.id) ? prev : [...prev, cat]);
          } else if (payload.eventType === 'DELETE') {
            setCustomCategories(prev => prev.filter(c => c.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const cat = toCustomCat(payload.new);
            setCustomCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
          }
        }
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [userId]);

  // Tambah kategori kustom. Mengembalikan objek kategori siap pakai
  // ({ id, label, color }). Anti-duplikat: kalau nama sudah ada
  // (bawaan ATAU kustom), kembalikan yang sudah ada tanpa insert baru.
  async function addCustomCategory({ name, color, type = 'expense' }) {
    const clean = (name || '').trim();
    if (!clean) return { error: 'Nama kategori kosong', category: null };

    const key = norm(clean);

    // Bentrok dengan kategori bawaan → pakai yang bawaan
    if (BUILTIN_NAMES.has(key)) {
      const builtin = [...CATEGORIES, ...INCOME_CATEGORIES].find(c => norm(c.label) === key);
      return { error: null, category: builtin, duplicate: true };
    }

    // Sudah ada di kustom → pakai yang ada (tak hitung sebagai kategori baru)
    const existing = customCategories.find(c => norm(c.label) === key);
    if (existing) return { error: null, category: existing, duplicate: true };

    // ── Batas plan: tolak kategori kustom baru bila sudah mencapai limit ──
    // Hitung hanya yang aktif (belum dihapus) — yang sudah soft-deleted tidak pakai kuota.
    const maxCustom = limits?.maxCustomCategories ?? Infinity;
    if (customCategories.filter(c => !c.is_deleted).length >= maxCustom) {
      openPaywall('Kategori kustom tambahan');
      return { error: null, category: null, limitReached: true };
    }

    const { data, error } = await supabase
      .from('custom_categories')
      .insert({ user_id: userId, name: clean, color: color || 'var(--sage)', type })
      .select()
      .single();

    // Unique index bisa menolak balapan (kode 23505) → ambil yang sudah ada
    if (error) {
      if (error.code === '23505') {
        const { data: found } = await supabase
          .from('custom_categories')
          .select('*')
          .eq('user_id', userId)
          .ilike('name', clean)
          .limit(1);
        const cat = found && found[0] ? toCustomCat(found[0]) : null;
        if (cat) {
          setCustomCategories(prev => prev.some(c => c.id === cat.id) ? prev : [...prev, cat]);
          return { error: null, category: cat, duplicate: true };
        }
      }
      return { error: error.message, category: null };
    }

    const cat = toCustomCat(data);
    setCustomCategories(prev => prev.some(c => c.id === cat.id) ? prev : [...prev, cat]);
    return { error: null, category: cat };
  }

  async function updateCustomCategory(categoryId, updates) {
    const { error } = await supabase
      .from('custom_categories')
      .update(updates)
      .eq('id', categoryId)
      .eq('user_id', userId);
    if (!error) {
      setCustomCategories(prev => prev.map(c =>
        c.id === categoryId
          ? { ...c, ...(updates.name ? { label: updates.name } : {}), ...(updates.color ? { color: updates.color } : {}), ...(updates.type ? { type: updates.type } : {}) }
          : c
      ));
    }
    return { error };
  }

  async function deleteCustomCategory(id, isPro) {
    if (!isPro) return { error: { message: 'NOT_ALLOWED' } };
    // Soft delete: kategori tetap di DB agar transaksi lama masih bisa resolve nama/warna-nya.
    const { error } = await supabase
      .from('custom_categories')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', userId);
    if (!error) setCustomCategories(prev => prev.map(c => c.id === id ? { ...c, is_deleted: true } : c));
    return { error };
  }

  return { customCategories, loading, addCustomCategory, updateCustomCategory, deleteCustomCategory };
}
