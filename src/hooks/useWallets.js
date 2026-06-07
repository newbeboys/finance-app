import React from 'react';
import { supabase } from '../supabase';

const FALLBACK_COLORS = ["#2A6FDB","#1FA8A0","#1B8A3F","#9A6BD9","#B26A4A","#B68A3E","#5C6B4C","#C9886D"];
const pickColor = (name) => FALLBACK_COLORS[(name || '').charCodeAt(0) % FALLBACK_COLORS.length];

function toAppWallet(row) {
  return {
    id:          row.id,
    name:        row.name,
    institution: row.bank  || '',
    bank:        row.bank  || '',
    type:        row.type  || 'bank',
    balance:     Number(row.balance) || 0,
    color:       row.color || pickColor(row.name),
    primary:     row.is_primary || false,
    last4:       row.last4 || '—',
  };
}

export function useWallets(userId) {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error('[useWallets] fetch error:', error.code, error.message);
        } else {
          setAccounts((data || []).map(toAppWallet));
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId]);

  async function createAccount(a) {
    // ── Kolom base schema (selalu ada) ────────────────────────────
    // AddAccountModal kirim 'institution', schema pakai 'bank'
    const basePayload = {
      user_id:    userId,
      name:       a.name        || '',
      bank:       a.institution || a.bank || '',
      type:       a.type        || 'bank',
      balance:    a.balance     || 0,
      is_primary: a.primary     || false,
    };

    const { data, error } = await supabase
      .from('wallets')
      .insert(basePayload)
      .select()
      .single();

    if (error) {
      console.error('[useWallets] createAccount FAILED:', error.code, error.message, error.details);
      return { error };
    }

    // Simpan color & last4 di local state
    const wallet = {
      ...toAppWallet(data),
      color: a.color || pickColor(a.name),
      last4: a.last4 || '—',
    };
    setAccounts(prev => [...prev, wallet]);

    // ── Coba update color + last4 jika kolom ada (setelah migrations.sql) ──
    supabase
      .from('wallets')
      .update({ color: a.color || pickColor(a.name), last4: a.last4 || '—' })
      .eq('id', data.id)
      .then(({ error: ue }) => {
        if (ue && !ue.message?.includes('column')) {
          console.warn('[useWallets] color/last4 update skipped:', ue.message);
        }
      });

    return { error: null };
  }

  async function setPrimary(id) {
    await supabase.from('wallets').update({ is_primary: false }).eq('user_id', userId);
    const { error } = await supabase
      .from('wallets').update({ is_primary: true }).eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('[useWallets] setPrimary FAILED:', error.message);
    } else {
      setAccounts(prev => prev.map(a => ({ ...a, primary: a.id === id })));
    }
    return { error };
  }

  async function deleteAccount(id) {
    const { error } = await supabase
      .from('wallets').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('[useWallets] deleteAccount FAILED:', error.message);
    } else {
      setAccounts(prev => prev.filter(a => a.id !== id));
    }
    return { error };
  }

  return { accounts, loading, createAccount, setPrimary, deleteAccount };
}
