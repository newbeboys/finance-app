import React from 'react';
import { supabase } from '../supabase';

function toAppGoal(row) {
  return {
    id:       row.id,
    label:    row.name,
    icon:     row.icon            || 'star',
    color:    row.color           || '#5C6B4C',
    target:   Number(row.target)  || 0,
    current:  Number(row.current) || 0,
    deadline: row.deadline_label  || 'Tanpa tenggat',
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
        if (!error && data) setGoals(data.map(toAppGoal));
        setLoading(false);
      });
  }, [userId]);

  async function createGoal(g) {
    const { data, error } = await supabase
      .from('savings')
      .insert({
        user_id:        userId,
        name:           g.label,
        icon:           g.icon            || 'star',
        color:          g.color           || '#5C6B4C',
        target:         g.target          || 0,
        current:        g.current         || 0,
        deadline_label: g.deadline        || 'Tanpa tenggat',
      })
      .select()
      .single();

    if (!error && data) setGoals(prev => [...prev, toAppGoal(data)]);
    return { error };
  }

  async function deleteGoal(id) {
    const { error } = await supabase
      .from('savings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) setGoals(prev => prev.filter(g => g.id !== id));
    return { error };
  }

  async function depositToGoal(id, amount) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return { error: new Error('Goal not found') };
    const newCurrent = goal.current + amount;

    const { error } = await supabase
      .from('savings')
      .update({ current: newCurrent })
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) setGoals(prev => prev.map(g => g.id === id ? { ...g, current: newCurrent } : g));
    return { error };
  }

  return { goals, loading, createGoal, deleteGoal, depositToGoal };
}
