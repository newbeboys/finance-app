import React from 'react';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// Supabase row → format yang dipakai komponen app
function toAppTx(row) {
  const d = new Date(row.date + 'T00:00:00');
  return {
    id:       row.id,
    date:     `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    dateRaw:  row.date,   // ISO: "2026-06-04" — dipakai untuk grouping cashflow
    time:     row.time     || '00:00',
    merchant: row.merchant || '—',
    note:     row.note     || '',
    category: row.category,
    method:   row.method   || 'Tunai',
    amount:   Number(row.amount),
  };
}

export function useTransactions(userId, limits) {
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const { openPaywall } = usePaywall();

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;

    setLoading(true);
    setError(null);

    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          setError(err.message);
        } else {
          setTransactions((data || []).map(toAppTx));
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId]);

  async function createTransaction(tx) {
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    // Tanggal pilihan user (ISO yyyy-mm-dd); fallback ke hari ini
    const isoDate = tx.dateRaw || todayISO;

    // ── Batas plan: maks N transaksi per BULAN KALENDER ────────────────
    // Bulan ditentukan dari tanggal transaksi yang dipilih user (isoDate),
    // bukan created_at. Count via Supabase (head:true) — tidak fetch row.
    const maxPerMonth = limits?.maxTransactionsPerMonth ?? Infinity;
    if (maxPerMonth !== Infinity) {
      const [y, m] = isoDate.split('-').map(Number);
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const monthEndExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

      const { count, error: cErr } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lt('date', monthEndExclusive);

      if (cErr) {
        console.error('[useTransactions] count error:', cErr.code, cErr.message);
      } else if ((count ?? 0) >= maxPerMonth) {
        openPaywall({ message: 'Penggunaan transaksi sudah maksimal bulan ini. Upgrade ke Pro untuk fleksibilitas tanpa batas.' });
        return { error: null, limitReached: true };
      }
    }

    const { data, error: err } = await supabase
      .from('transactions')
      .insert({
        user_id:  userId,
        type:     tx.amount < 0 ? 'expense' : 'income',
        amount:   tx.amount,
        category: tx.category,
        merchant: tx.merchant || '',
        note:     tx.note     || '',
        date:     isoDate,
        time:     tx.time     || '00:00',
        method:   tx.method   || 'Tunai',
      })
      .select()
      .single();

    if (!err && data) {
      setTransactions(prev => [toAppTx(data), ...prev]);
    }
    return { error: err };
  }

  async function deleteTransaction(id) {
    const { error: err } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!err) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
    return { error: err };
  }

  async function updateTransaction(id, updates) {
    const { data, error: err } = await supabase
      .from('transactions')
      .update({
        type:     updates.amount < 0 ? 'expense' : 'income',
        amount:   updates.amount,
        category: updates.category,
        merchant: updates.merchant || '',
        note:     updates.note     || '',
        method:   updates.method   || 'Tunai',
        ...(updates.dateRaw ? { date: updates.dateRaw } : {}),
        ...(updates.time    ? { time: updates.time    } : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (!err && data) {
      setTransactions(prev => prev.map(t => t.id === id ? toAppTx(data) : t));
    }
    return { error: err };
  }

  return { transactions, loading, error, createTransaction, deleteTransaction, updateTransaction };
}
