import React from 'react';
import { supabase } from '../supabase';

// Supabase row → shape used by the app
function toBudget(row) {
  return {
    id:         row.id,
    categoryId: row.category   || null,
    label:      row.label      || '',
    color:      row.color      || 'var(--sage)',
    limit:      Number(row.limit_amount ?? row.limit ?? 0),
    enabled:    row.enabled    !== false,
    periode:    row.period     || 'monthly',
    spent:      0, // computed from transactions, not stored
  };
}

export function useBudgets(userId) {
  const [budgets, setBudgets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setBudgets((data || []).map(toBudget));
        setLoading(false);
      });
  }, [userId]);

  async function createBudget(row) {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id:      userId,
        category:     row.categoryId || null,
        label:        row.label,
        color:        row.color,
        limit_amount: row.limit,
        enabled:      row.enabled ?? true,
        period:       row.periode || 'monthly',
      })
      .select()
      .single();
    if (!error && data) setBudgets(prev => [...prev, toBudget(data)]);
    return { error };
  }

  async function updateBudget(id, updates) {
    // Map app fields → Supabase columns
    const patch = {};
    if ('limit'   in updates) patch.limit_amount = updates.limit;
    if ('enabled' in updates) patch.enabled      = updates.enabled;
    if ('label'   in updates) patch.label        = updates.label;
    if ('color'   in updates) patch.color        = updates.color;
    if ('periode' in updates) patch.period       = updates.periode;

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
