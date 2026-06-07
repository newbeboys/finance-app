import React from 'react';
import { supabase } from '../supabase';

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTH_MAP = {
  jan:0, feb:1, mar:2, apr:3, mei:4, jun:5,
  jul:6, agu:7, ags:7, sep:8, okt:9, nov:10, des:11, dec:11,
};

function deadlineToISO(text) {
  if (!text || text === 'Tanpa tenggat') return null;
  const parts = text.trim().split(/\s+/);
  if (parts.length === 2) {
    const mo = MONTH_MAP[parts[0].toLowerCase()];
    const yr = parseInt(parts[1]);
    if (mo !== undefined && !isNaN(yr))
      return `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
  }
  return null;
}

function isoToDeadline(iso) {
  if (!iso) return 'Tanpa tenggat';
  const d = new Date(iso + 'T00:00:00');
  return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function toAppGoal(row) {
  return {
    id:       row.id,
    label:    row.name,
    icon:     row.icon    || 'star',
    color:    row.color   || '#5C6B4C',
    target:   Number(row.target)  || 0,
    current:  Number(row.current) || 0,
    deadline: row.deadline_label || isoToDeadline(row.deadline),
  };
}

export function useSavings(userId) {
  const [goals, setGoals]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase
      .from('savings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error('[useSavings] fetch error:', error.code, error.message);
        } else {
          setGoals((data || []).map(toAppGoal));
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId]);

  async function createGoal(g) {
    // ── Kolom base schema (selalu ada) ────────────────────────────
    const basePayload = {
      user_id:  userId,
      name:     g.label   || '',
      icon:     g.icon    || 'star',
      color:    g.color   || '#5C6B4C',
      target:   g.target  || 0,
      current:  g.current || 0,
      deadline: deadlineToISO(g.deadline),
    };

    const { data, error } = await supabase
      .from('savings')
      .insert(basePayload)
      .select()
      .single();

    if (error) {
      console.error('[useSavings] createGoal FAILED:', error.code, error.message, error.details);
      return { error };
    }

    const newGoal = { ...toAppGoal(data), deadline: g.deadline || 'Tanpa tenggat' };
    setGoals(prev => [...prev, newGoal]);

    // ── Coba update deadline_label jika kolom ada (setelah migrations.sql) ──
    supabase
      .from('savings')
      .update({ deadline_label: g.deadline || 'Tanpa tenggat' })
      .eq('id', data.id)
      .then(({ error: ue }) => {
        if (ue && !ue.message?.includes('column')) {
          console.warn('[useSavings] deadline_label update skipped:', ue.message);
        }
      });

    return { error: null };
  }

  async function deleteGoal(id) {
    const { error } = await supabase
      .from('savings').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('[useSavings] deleteGoal FAILED:', error.message);
    } else {
      setGoals(prev => prev.filter(g => g.id !== id));
    }
    return { error };
  }

  async function depositToGoal(id, amount) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return { error: new Error('Goal not found') };
    const newCurrent = goal.current + amount;
    const { error } = await supabase
      .from('savings').update({ current: newCurrent }).eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('[useSavings] deposit FAILED:', error.message);
    } else {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, current: newCurrent } : g));
    }
    return { error };
  }

  return { goals, loading, createGoal, deleteGoal, depositToGoal };
}
