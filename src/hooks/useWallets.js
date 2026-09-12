import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';
import { logError } from '../lib/errorLogger';
import { requireUserId } from '../lib/authIdentity';

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
    is_locked:   row.is_locked || false,
  };
}

export function useWallets(userId, limits) {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const { openPaywall } = usePaywall();
  const { t } = useTranslation();

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

    // Realtime UPDATE: picks up is_locked changes from lockExcessOnDowngrade/unlockAllOnUpgrade
    const channel = supabase
      .channel(`wallets_lock:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!alive) return;
          setAccounts(prev => prev.map(a =>
            a.id === payload.new.id ? toAppWallet(payload.new) : a
          ));
        }
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [userId]);

  async function createAccount(a) {
    // ── Batas plan: tolak insert bila sudah mencapai limit ────────
    const maxWallets = limits?.maxWallets ?? Infinity;
    if (accounts.length >= maxWallets) {
      openPaywall(t('paywall.feature.walletTambahan'));
      return { error: null, limitReached: true };
    }

    // Identitas diambil dari sesi aktif, bukan dari prop `userId` — lihat
    // src/lib/authIdentity.js. Prop bisa berumur beda dari token yang
    // dilampirkan SDK; kalau melenceng, RLS menolak dengan pesan yang tidak
    // menyebut identitas sama sekali.
    const { userId: authUserId, error: authError } = await requireUserId();
    if (authError) return { error: authError };

    // ── Kolom base schema (selalu ada) ────────────────────────────
    // AddAccountModal kirim 'institution', schema pakai 'bank'
    const basePayload = {
      user_id:    authUserId,
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

  // Balance adjustment: baca saldo TERBARU langsung dari DB (bukan dari state React
  // `accounts`), hitung nilai baru, lalu tulis. Membaca dari state bikin race condition
  // saat adjustBalance dipanggil dua kali berturut-turut (mis. reverse tx lama + apply
  // tx baru di handleUpdateTransaction): kedua panggilan membaca closure `accounts` yang
  // sama, jadi panggilan kedua menimpa hasil panggilan pertama dengan angka salah.
  // Pemanggil WAJIB `await` secara berurutan (jangan Promise.all) supaya baca-tulis
  // benar-benar sequential.
  async function adjustBalance(walletId, delta) {
    if (!walletId || !delta) return { error: null };

    const { data: freshWallet, error: fetchErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !freshWallet) {
      console.error('[useWallets] adjustBalance fetch FAILED:', fetchErr?.message);
      if (fetchErr) {
        logError('adjustBalance', fetchErr.message, {
          wallet_id: walletId, delta, phase: 'fetch', code: fetchErr.code,
        }, 'high');
      }
      return { error: fetchErr };
    }

    const newBalance = Number(freshWallet.balance) + delta;
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId)
      .eq('user_id', userId);
    if (!error) {
      setAccounts(prev => prev.map(a =>
        a.id === walletId ? { ...a, balance: newBalance } : a
      ));
    } else {
      // Gagal update saldo = uang/data permanen terdampak → catat (high).
      console.error('[useWallets] adjustBalance FAILED:', error.code, error.message);
      logError('adjustBalance', error.message, {
        wallet_id: walletId, delta, attempted_balance: newBalance, code: error.code,
      }, 'high');
    }
    return { error };
  }

  return { accounts, loading, createAccount, setPrimary, deleteAccount, adjustBalance };
}
