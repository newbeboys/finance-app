import React from 'react';
import { supabase } from '../supabase';

const FALLBACK_COLORS = ["#2A6FDB","#1FA8A0","#1B8A3F","#9A6BD9","#B26A4A","#B68A3E","#5C6B4C","#C9886D"];
const pickColor = (name) => FALLBACK_COLORS[(name || '').charCodeAt(0) % FALLBACK_COLORS.length];

// Supabase row → app account object
function toAppWallet(row) {
  return {
    id:          row.id,
    name:        row.name,
    // 'bank' di schema = institution di UI
    institution: row.bank  || row.institution || '',
    bank:        row.bank  || '',
    type:        row.type  || 'bank',
    balance:     Number(row.balance) || 0,
    // color: pakai kolom jika ada (setelah migration), fallback hash dari nama
    color:       row.color || pickColor(row.name),
    primary:     row.is_primary || false,
    // last4: pakai kolom jika ada (setelah migration), fallback '—'
    last4:       row.last4 || '—',
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
        if (error) console.error('[useWallets] fetch error:', error.message);
        if (!error && data) setAccounts(data.map(toAppWallet));
        setLoading(false);
      });
  }, [userId]);

  async function createAccount(a) {
    // Base schema columns (selalu ada)
    const payload = {
      user_id:    userId,
      name:       a.name        || '',
      // UI kirim 'institution', schema pakai 'bank'
      bank:       a.institution || a.bank || '',
      type:       a.type        || 'bank',
      balance:    a.balance     || 0,
      is_primary: a.primary     || false,
    };

    // Extended columns (setelah migrations.sql)
    const extended = {
      ...payload,
      color: a.color || pickColor(a.name),
      last4: a.last4 || '—',
    };

    // Coba extended dulu, fallback ke base jika kolom belum ada
    let result = await supabase.from('wallets').insert(extended).select().single();

    if (result.error && result.error.code === '42703') {
      result = await supabase.from('wallets').insert(payload).select().single();
    }

    if (result.error) {
      console.error('[useWallets] createAccount error:', result.error.message);
    } else if (result.data) {
      // Tambahkan color/last4 ke objek lokal meski tidak tersimpan di DB
      const wallet = { ...toAppWallet(result.data), color: extended.color, last4: extended.last4 };
      setAccounts(prev => [...prev, wallet]);
    }
    return { error: result.error };
  }

  async function setPrimary(id) {
    await supabase.from('wallets').update({ is_primary: false }).eq('user_id', userId);
    const { error } = await supabase.from('wallets').update({ is_primary: true }).eq('id', id).eq('user_id', userId);
    if (error) console.error('[useWallets] setPrimary error:', error.message);
    else setAccounts(prev => prev.map(a => ({ ...a, primary: a.id === id })));
    return { error };
  }

  async function deleteAccount(id) {
    const { error } = await supabase
      .from('wallets').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('[useWallets] deleteAccount error:', error.message);
    else setAccounts(prev => prev.filter(a => a.id !== id));
    return { error };
  }

  return { accounts, loading, createAccount, setPrimary, deleteAccount };
}
