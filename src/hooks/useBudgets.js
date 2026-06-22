import React from 'react';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';

// Actual Supabase columns: id, user_id, category, label, color, limit, enabled, spent, created_at
// Note: no "period" column in DB — periode is UI-only, defaults to "monthly"
function toBudget(row) {
  return {
    id:         row.id,
    categoryId: row.category || null,
    label:      row.label    || '',
    color:      row.color    || 'var(--sage)',
    limit:      Number(row.limit ?? 0),
    enabled:    row.enabled  !== false,
    periode:    'monthly',   // DB has no period column; treat all as monthly
    spent:      0,           // always computed from transactions
  };
}

// Migrate old localStorage budgets to Supabase (runs once, then clears localStorage key)
async function migrateFromLocalStorage(userId) {
  const LS_KEY = 'finance_budgets';
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || old.length === 0) return [];

    const rows = old.map(b => ({
      user_id:  userId,
      category: b.categoryId || null,
      label:    b.label      || 'Anggaran',
      color:    b.color      || 'var(--sage)',
      limit:    Number(b.limit ?? 0),
      enabled:  b.enabled    !== false,
      spent:    0,
    }));

    const { data, error } = await supabase.from('budgets').insert(rows).select();
    if (!error) {
      localStorage.removeItem(LS_KEY);
      return (data || []).map(toBudget);
    }
  } catch {}
  return [];
}

export function useBudgets(userId, limits) {
  const [budgets, setBudgets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const { openPaywall } = usePaywall();

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);

    supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) { setLoading(false); return; }

        const existing = (data || []).map(toBudget);

        // If Supabase is empty but localStorage has data → migrate once
        if (existing.length === 0 && localStorage.getItem('finance_budgets')) {
          const migrated = await migrateFromLocalStorage(userId);
          if (!alive) return;
          setBudgets(migrated);
        } else {
          setBudgets(existing);
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId]);

  async function createBudget(row) {
    // ── Batas plan: tolak anggaran baru bila sudah mencapai limit ──
    // Hitung semua budget (semua tampil di UI; kolom enabled tak lagi
    // memengaruhi tampilan setelah toggle dihapus).
    const maxBudgets = limits?.maxBudgets ?? Infinity;
    if (budgets.length >= maxBudgets) {
      openPaywall({ message: 'Penggunaan anggaran sudah maksimal. Upgrade ke Pro untuk fleksibilitas tanpa batas.' });
      return { error: null, limitReached: true };
    }

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id:  userId,
        category: row.categoryId || null,
        label:    row.label,
        color:    row.color,
        limit:    row.limit,
        enabled:  row.enabled ?? true,
        spent:    0,
      })
      .select()
      .single();
    if (!error && data) setBudgets(prev => [...prev, toBudget(data)]);
    return { error };
  }

  async function updateBudget(id, updates) {
    const patch = {};
    if ('limit'   in updates) patch.limit   = updates.limit;
    if ('enabled' in updates) patch.enabled = updates.enabled;
    if ('label'   in updates) patch.label   = updates.label;
    if ('color'   in updates) patch.color   = updates.color;

    const { data, error } = await supabase
      .from('budgets')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (!error && data) {
      setBudgets(prev => prev.map(b => b.id === id ? toBudget(data) : b));
    }
    return { error };
  }

  async function deleteBudget(id) {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (!error) setBudgets(prev => prev.filter(b => b.id !== id));
    return { error };
  }

  return { budgets, loading, createBudget, updateBudget, deleteBudget };
}
