import React from 'react';
import { supabase } from '../supabase';

function toAppWallet(row) {
  return {
    id:      row.id,
    name:    row.name,
    bank:    row.bank           || '',
    type:    row.type           || 'bank',
    balance: Number(row.balance) || 0,
    color:   row.color          || '#5C6B4C',
    primary: row.is_primary     || false,
    last4:   row.last4          || '—',
  };
}

export function useWallets(userId) {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setAccounts(data.map(toAppWallet));
        setLoading(false);
      });
  }, [userId]);

  async function createAccount(a) {
    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id:    userId,
        name:       a.name,
        bank:       a.bank       || '',
        type:       a.type       || 'bank',
        balance:    a.balance    || 0,
        color:      a.color      || '#5C6B4C',
        is_primary: a.primary    || false,
        last4:      a.last4      || '—',
      })
      .select()
      .single();

    if (!error && data) setAccounts(prev => [...prev, toAppWallet(data)]);
    return { error };
  }

  async function setPrimary(id) {
    // Reset semua → set hanya yang dipilih
    await supabase.from('wallets').update({ is_primary: false }).eq('user_id', userId);
    const { error } = await supabase.from('wallets').update({ is_primary: true }).eq('id', id).eq('user_id', userId);
    if (!error) setAccounts(prev => prev.map(a => ({ ...a, primary: a.id === id })));
    return { error };
  }

  async function deleteAccount(id) {
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) setAccounts(prev => prev.filter(a => a.id !== id));
    return { error };
  }

  return { accounts, loading, createAccount, setPrimary, deleteAccount };
}
