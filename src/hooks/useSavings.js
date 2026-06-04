import React from 'react';
import { supabase } from '../supabase';

const MONTHS_ID  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTH_MAP  = { jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,ags:7,sep:8,okt:9,nov:10,des:11,dec:11 };

// "Des 2026" → "2026-12-01" | "Tanpa tenggat" → null
function deadlineToISO(text) {
  if (!text || text === 'Tanpa tenggat') return null;
  const parts = text.trim().split(/\s+/);
  if (parts.length === 2) {
    const mo = MONTH_MAP[parts[0].toLowerCase()];
    const yr = parseInt(parts[1]);
    if (mo !== undefined && !isNaN(yr)) return `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
  }
  return null;
}

// "2026-12-01" → "Des 2026" | null → "Tanpa tenggat"
function isoToDeadline(iso) {
  if (!iso) return 'Tanpa tenggat';
  const d = new Date(iso + 'T00:00:00');
  return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// Supabase row → app goal object
function toAppGoal(row) {
  return {
    id:       row.id,
    label:    row.name,
    icon:     row.icon    || 'star',
    color:    row.color   || '#5C6B4C',
    target:   Number(row.target)  || 0,
    current:  Number(row.current) || 0,
    // deadline_label ada jika migration sudah dijalankan, fallback ke kolom date
    deadline: row.deadline_label || isoToDeadline(row.deadline),
  };
}

export function useSavings(userId) {
  const [goals, setGoals]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('savings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[useSavings] fetch error:', error.message);
        if (!error && data) setGoals(data.map(toAppGoal));
        setLoading(false);
      });
  }, [userId]);

  async function createGoal(g) {
    // Kolom yang SELALU ada di base schema
    const payload = {
      user_id:  userId,
      name:     g.label    || '',
      icon:     g.icon     || 'star',
      color:    g.color    || '#5C6B4C',
      target:   g.target   || 0,
      current:  g.current  || 0,
      deadline: deadlineToISO(g.deadline),
    };

    // Kolom ekstra setelah migrations.sql dijalankan
    // Supabase mengabaikan kolom yang tidak ada, tetapi kalau kolom ADA, kita isi
    const extended = { ...payload, deadline_label: g.deadline || 'Tanpa tenggat' };

    // Coba dengan extended dulu, fallback ke base jika gagal karena kolom belum ada
    let result = await supabase.from('savings').insert(extended).select().single();

    if (result.error && result.error.code === '42703') {
      // Column tidak ada → coba tanpa deadline_label
      result = await supabase.from('savings').insert(payload).select().single();
    }

    if (result.error) {
      console.error('[useSavings] createGoal error:', result.error.message);
    } else if (result.data) {
      setGoals(prev => [...prev, toAppGoal(result.data)]);
    }
    return { error: result.error };
  }

  async function deleteGoal(id) {
    const { error } = await supabase
      .from('savings').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('[useSavings] deleteGoal error:', error.message);
    else setGoals(prev => prev.filter(g => g.id !== id));
    return { error };
  }

  async function depositToGoal(id, amount) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return { error: new Error('Goal not found') };
    const newCurrent = goal.current + amount;
    const { error } = await supabase
      .from('savings').update({ current: newCurrent }).eq('id', id).eq('user_id', userId);
    if (error) console.error('[useSavings] deposit error:', error.message);
    else setGoals(prev => prev.map(g => g.id === id ? { ...g, current: newCurrent } : g));
    return { error };
  }

  return { goals, loading, createGoal, deleteGoal, depositToGoal };
}
