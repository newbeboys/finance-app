import React from 'react';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';

// ════════════════════════════════════════════════════════════════════
//  useDebts — logic layer fitur Catatan Hutang & Piutang
//  (lihat docs/superpowers/specs/2026-07-04-hutang-piutang-design.md)
//
//  type = 'receivable' → PIUTANG (kamu meminjamkan; orang berhutang padamu)
//  type = 'payable'    → HUTANG  (kamu meminjam dari orang lain)
//
//  Hook ini TERINTEGRASI PENUH dengan dompet & transaksi: setiap kejadian
//  (buat catatan / bayar cicilan) otomatis membuat baris transaksi tertaut
//  (punya debt_id) dan menyesuaikan saldo dompet. Karena orkestrasi lintas
//  tabel + rollback harus terjadi di satu tempat, hook menerima "ledger"
//  (alat dari useTransactions & useWallets) sebagai argumen ke-3:
//
//    const { createTransaction, deleteTransaction } = useTransactions(...);
//    const { adjustBalance } = useWallets(...);
//    const debts = useDebts(userId, limits, {
//      transactions, createTransaction, deleteTransaction, adjustBalance,
//    });
//
//  PENTING: createTransaction yang di-pass HARUS versi MENTAH dari
//  useTransactions (yang TIDAK ikut menyesuaikan saldo). Penyesuaian saldo
//  dilakukan hook ini sendiri via adjustBalance — supaya saldo tidak dobel.
// ════════════════════════════════════════════════════════════════════

// Kategori bawaan untuk transaksi hutang/piutang. Dipakai sebagai id kategori
// pada baris transactions. (Registrasi label/warna di data.jsx = pekerjaan
// layer UI / Phase berikutnya; di sini cukup id string yang stabil.)
// Pesan saat mencoba mengelola catatan yang terkunci (sisa downgrade Pro→Basic).
const LOCKED_MSG = 'Catatan ini terkunci. Upgrade ke Pro untuk mengelolanya kembali.';

export const DEBT_CATEGORIES = {
  receivablePrincipal: 'piutang',        // meminjamkan uang  → expense
  receivablePayment:   'piutang_bayar',  // terima cicilan    → income
  payablePrincipal:    'hutang',         // menerima pinjaman → income
  payablePayment:      'hutang_bayar',   // bayar cicilan     → expense
};

// Supabase row → bentuk yang dipakai komponen app.
// lastPaymentDate = tanggal cicilan terakhir (ISO) — dipakai banner telat bayar
// (§7): banner hilang permanen bila ada cicilan pada/setelah due_date.
function toAppDebt(row, lastPaymentDate = null) {
  return {
    id:          row.id,
    type:        row.type,                      // 'receivable' | 'payable'
    person_name: row.person_name || '',
    note:        row.note || '',
    amount:      Number(row.amount) || 0,       // pokok (selalu positif)
    paid:        Number(row.paid)   || 0,       // akumulasi terbayar
    remaining:   Math.max(0, (Number(row.amount) || 0) - (Number(row.paid) || 0)),
    wallet_id:   row.wallet_id || null,
    date:        row.date,                      // ISO yyyy-mm-dd (lokal)
    due_date:    row.due_date || null,          // ISO yyyy-mm-dd | null
    status:      row.status || 'active',        // 'active' | 'paid'
    is_deleted:  row.is_deleted || false,
    is_locked:   row.is_locked || false,        // dikunci saat downgrade Pro→Basic (lihat planReconciliation)
    created_at:  row.created_at,
    lastPaymentDate,                            // ISO yyyy-mm-dd | null
  };
}

// Konfigurasi transaksi yang dibuat per kejadian. delta saldo = amount transaksi.
// createTransaction menyimpulkan type dari tanda amount (amount < 0 → expense).
function txForEvent(debtType, kind, absAmount) {
  const isReceivable = debtType === 'receivable';
  if (kind === 'principal') {
    // Piutang: uang keluar (−). Hutang: uang masuk (+).
    return isReceivable
      ? { amount: -absAmount, category: DEBT_CATEGORIES.receivablePrincipal }
      : { amount: +absAmount, category: DEBT_CATEGORIES.payablePrincipal };
  }
  // kind === 'payment' — arahnya kebalikan principal
  return isReceivable
    ? { amount: +absAmount, category: DEBT_CATEGORIES.receivablePayment }
    : { amount: -absAmount, category: DEBT_CATEGORIES.payablePayment };
}

export function useDebts(userId, limits, ledger = {}) {
  const {
    transactions = [],
    createTransaction,
    deleteTransaction,
    adjustBalance,
  } = ledger;

  const [debts, setDebts]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState(null);
  const { openPaywall } = usePaywall();

  // ── Fetch awal + realtime ─────────────────────────────────────────
  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: err } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)   // catatan aktif/lunas; soft-deleted disembunyikan
        .order('created_at', { ascending: false });

      if (!alive) return;
      if (err) {
        console.error('[useDebts] fetch error:', err.code, err.message);
        setError(err.message);
        setLoading(false);
        return;
      }

      // Tanggal cicilan terakhir per catatan (volume kecil — Basic maks 5 catatan).
      // Dipakai untuk kondisi banner telat bayar yang persisten lintas reload.
      const lastPayMap = {};
      const { data: pays } = await supabase
        .from('debt_payments')
        .select('debt_id, date')
        .eq('user_id', userId);
      (pays || []).forEach(p => {
        if (!lastPayMap[p.debt_id] || p.date > lastPayMap[p.debt_id]) lastPayMap[p.debt_id] = p.date;
      });

      if (!alive) return;
      setDebts((data || []).map(row => toAppDebt(row, lastPayMap[row.id] || null)));
      setLoading(false);
    })();

    // Realtime: tangkap perubahan dari device lain / proses server.
    // UPDATE → sinkronkan atau buang bila jadi soft-deleted. DELETE → buang.
    const channel = supabase
      .channel(`debts:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'debts', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!alive) return;
          const row = payload.new;
          setDebts(prev => {
            if (row.is_deleted) return prev.filter(d => d.id !== row.id);
            return prev.some(d => d.id === row.id)
              // pertahankan lastPaymentDate lokal (tak ikut di payload debts)
              ? prev.map(d => d.id === row.id ? toAppDebt(row, d.lastPaymentDate) : d)
              : [toAppDebt(row), ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'debts', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!alive) return;
          setDebts(prev => prev.filter(d => d.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [userId]);

  // ── Cek limit Basic: (1) maks aktif, (2) cooldown rolling 50 hari ───
  // Mengembalikan { ok } bila boleh membuat, atau alasan blokir.
  // Cooldown WAJIB dihitung dari DB (bukan state lokal) karena state lokal
  // sudah membuang baris soft-deleted — sedangkan pembuatan yang dihapus TETAP
  // menghabiskan slot cooldown (mencegah akal-akalan hapus-buat-ulang).
  async function checkCreateAllowed() {
    const maxActive = limits?.maxActiveDebts ?? Infinity;
    if (maxActive === Infinity) return { ok: true };   // Pro → bebas

    // (1) Maks catatan aktif sekaligus (state lokal sudah exclude is_deleted).
    //     Catatan terkunci (is_locked, sisa downgrade lama) TIDAK dihitung: kalau
    //     ikut dihitung, user yang pernah didowngrade tak akan pernah bisa membuat
    //     catatan baru lagi meski slot aktif sebenarnya masih tersedia.
    const activeCount = debts.filter(d => d.status === 'active' && !d.is_locked).length;
    if (activeCount >= maxActive) {
      return { ok: false, reason: 'active' };
    }

    // (2) Rolling window: maks `maxActive` pembuatan dalam `cooldownDays` hari,
    //     termasuk yang sudah lunas maupun soft-deleted.
    const cooldownDays = limits?.debtCooldownDays ?? 0;
    if (cooldownDays > 0) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - cooldownDays);
      const windowStartISO = windowStart.toISOString();   // created_at = timestamptz (instant), bandingkan penuh

      const { count, error: cErr } = await supabase
        .from('debts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', windowStartISO);

      if (cErr) {
        // Fail-open: jangan kunci user karena error transien; cap aktif tetap menjaga.
        console.error('[useDebts] cooldown count error:', cErr.code, cErr.message);
        return { ok: true };
      }

      if ((count ?? 0) >= maxActive) {
        // Cari pembuatan tertua dalam jendela → +cooldownDays = tanggal bisa lagi.
        const { data: oldestRows } = await supabase
          .from('debts')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', windowStartISO)
          .order('created_at', { ascending: true })
          .limit(1);

        let cooldownUntilDate = null;
        const oldest = oldestRows?.[0]?.created_at;
        if (oldest) {
          const d = new Date(oldest);
          d.setDate(d.getDate() + cooldownDays);
          cooldownUntilDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return { ok: false, reason: 'cooldown', cooldownUntilDate };
      }
    }

    return { ok: true };
  }

  // ── Buat catatan hutang/piutang ────────────────────────────────────
  // Input: { type, person_name, amount, wallet_id, date, due_date, note }
  // Output: { error, debtId, limitReached, cooldownUntilDate }
  async function createDebt(input) {
    const gate = await checkCreateAllowed();
    if (!gate.ok) {
      if (gate.reason === 'active') {
        openPaywall('Catatan Hutang / Piutang tambahan');
        return { error: null, limitReached: true };
      }
      // cooldown: bukan paywall murni — UI menampilkan tanggal + opsi upgrade
      return { error: null, cooldownBlocked: true, cooldownUntilDate: gate.cooldownUntilDate };
    }

    const absAmount = Math.abs(Number(input.amount) || 0);
    if (absAmount <= 0) return { error: new Error('Jumlah harus lebih dari 0') };
    if (!input.person_name?.trim()) return { error: new Error('Nama orang wajib diisi') };

    // 1) Insert baris debts
    const { data: debtRow, error: dErr } = await supabase
      .from('debts')
      .insert({
        user_id:     userId,
        type:        input.type,
        person_name: input.person_name.trim(),
        note:        input.note || null,
        amount:      absAmount,
        paid:        0,
        wallet_id:   input.wallet_id || null,
        date:        input.date || undefined,       // biarkan DB pakai default CURRENT_DATE bila kosong
        due_date:    input.due_date || null,
        status:      'active',
      })
      .select()
      .single();

    if (dErr || !debtRow) {
      console.error('[useDebts] createDebt insert FAILED:', dErr?.code, dErr?.message);
      return { error: dErr || new Error('Gagal membuat catatan') };
    }

    // 2) Transaksi pokok tertaut
    const tx = txForEvent(input.type, 'principal', absAmount);
    const { error: tErr } = await createTransaction({
      amount:    tx.amount,
      category:  tx.category,
      merchant:  input.person_name.trim(),
      note:      input.note || '',
      dateRaw:   input.date || debtRow.date,
      wallet_id: input.wallet_id || null,
      debt_id:   debtRow.id,
    });

    // 3) Rollback bila transaksi gagal — catatan tak boleh setengah jadi
    if (tErr) {
      console.error('[useDebts] principal tx FAILED, rolling back debt:', tErr.message);
      await supabase.from('debts').delete().eq('id', debtRow.id).eq('user_id', userId);
      return { error: tErr };
    }

    // 4) Sesuaikan saldo dompet (best-effort; kegagalan tidak membatalkan catatan)
    await adjustBalance?.(input.wallet_id, tx.amount);

    // 5) State lokal
    setDebts(prev => [toAppDebt(debtRow), ...prev]);
    return { error: null, debtId: debtRow.id };
  }

  // ── Tambah cicilan ────────────────────────────────────────────────
  // Input: { amount, date, note }
  // Output: { error, paymentId, isPaidOff }
  async function addPayment(debtId, payment) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return { error: new Error('Catatan tidak ditemukan') };
    if (debt.is_locked) return { error: new Error(LOCKED_MSG) };

    const absAmount = Math.abs(Number(payment.amount) || 0);
    if (absAmount <= 0) return { error: new Error('Jumlah cicilan harus lebih dari 0') };
    const remaining = debt.amount - debt.paid;
    if (absAmount > remaining + 1e-6) {
      return { error: new Error('Cicilan melebihi sisa hutang') };
    }

    // 1) Transaksi cicilan tertaut
    const tx = txForEvent(debt.type, 'payment', absAmount);
    const { error: tErr, id: txId } = await createTransaction({
      amount:    tx.amount,
      category:  tx.category,
      merchant:  debt.person_name,
      note:      payment.note || '',
      dateRaw:   payment.date || undefined,
      wallet_id: debt.wallet_id || null,
      debt_id:   debtId,
    });
    if (tErr) {
      console.error('[useDebts] payment tx FAILED:', tErr.message);
      return { error: tErr };
    }

    // 2) Baris riwayat cicilan (tertaut ke transaksi)
    const { data: payRow, error: pErr } = await supabase
      .from('debt_payments')
      .insert({
        debt_id:        debtId,
        user_id:        userId,
        amount:         absAmount,
        date:           payment.date || undefined,
        note:           payment.note || null,
        transaction_id: txId,
      })
      .select()
      .single();

    if (pErr || !payRow) {
      // Rollback transaksi (state + DB) agar tak ada transaksi menggantung
      console.error('[useDebts] insert payment FAILED, rolling back tx:', pErr?.message);
      if (txId) await deleteTransaction?.(txId);
      return { error: pErr || new Error('Gagal menyimpan cicilan') };
    }

    // 3) Update paid + status di DB
    const newPaid = debt.paid + absAmount;
    const isPaidOff = newPaid >= debt.amount - 1e-6;
    const { error: uErr } = await supabase
      .from('debts')
      .update({ paid: newPaid, status: isPaidOff ? 'paid' : 'active' })
      .eq('id', debtId)
      .eq('user_id', userId);

    if (uErr) {
      // Rollback penuh: hapus cicilan + transaksi
      console.error('[useDebts] update debt FAILED, rolling back payment+tx:', uErr.message);
      await supabase.from('debt_payments').delete().eq('id', payRow.id).eq('user_id', userId);
      if (txId) await deleteTransaction?.(txId);
      return { error: uErr };
    }

    // 4) Saldo dompet (best-effort)
    await adjustBalance?.(debt.wallet_id, tx.amount);

    // 5) State lokal — termasuk lastPaymentDate (untuk banner telat bayar §7)
    const payDate = payRow.date || null;
    setDebts(prev => prev.map(d => d.id === debtId
      ? {
          ...d,
          paid: newPaid,
          remaining: Math.max(0, d.amount - newPaid),
          status: isPaidOff ? 'paid' : 'active',
          lastPaymentDate: (payDate && (!d.lastPaymentDate || payDate > d.lastPaymentDate)) ? payDate : d.lastPaymentDate,
        }
      : d
    ));

    return { error: null, paymentId: payRow.id, isPaidOff };
  }

  // ── Ambil riwayat cicilan satu catatan (untuk DebtDetailSheet) ────
  async function getPayments(debtId) {
    const { data, error: err } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('debt_id', debtId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) console.error('[useDebts] getPayments error:', err.message);
    return { data: data || [], error: err };
  }

  // ── Tandai Lunas: buat satu cicilan sebesar sisa ──────────────────
  async function markPaid(debtId) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return { error: new Error('Catatan tidak ditemukan') };
    if (debt.is_locked) return { error: new Error(LOCKED_MSG) };
    const remaining = debt.amount - debt.paid;
    if (remaining <= 1e-6) {
      // Sudah lunas secara nilai — cukup pastikan status paid.
      await supabase.from('debts').update({ status: 'paid' }).eq('id', debtId).eq('user_id', userId);
      setDebts(prev => prev.map(d => d.id === debtId ? { ...d, status: 'paid', remaining: 0 } : d));
      return { error: null, isPaidOff: true };
    }
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return addPayment(debtId, { amount: remaining, date: todayISO, note: 'Pelunasan' });
  }

  // ── Hapus (soft delete) + balik semua efek transaksi & saldo ──────
  async function deleteDebt(debtId) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return { error: new Error('Catatan tidak ditemukan') };
    if (debt.is_locked) return { error: new Error(LOCKED_MSG) };

    // Balikkan tiap transaksi tertaut: koreksi saldo lalu hapus transaksinya.
    // Menghapus transaksi otomatis meng-cascade debt_payments (FK transaction_id).
    const linked = transactions.filter(t => t.debt_id === debtId);
    for (const t of linked) {
      await adjustBalance?.(t.wallet_id, -t.amount);   // balik efek ke saldo
      await deleteTransaction?.(t.id);
    }

    // Soft delete baris debts (jejak created_at tetap untuk hitungan cooldown)
    const { error: dErr } = await supabase
      .from('debts')
      .update({ is_deleted: true })
      .eq('id', debtId)
      .eq('user_id', userId);

    if (dErr) {
      console.error('[useDebts] deleteDebt FAILED:', dErr.message);
      return { error: dErr };
    }

    setDebts(prev => prev.filter(d => d.id !== debtId));
    return { error: null };
  }

  return { debts, loading, error, createDebt, addPayment, markPaid, deleteDebt, getPayments };
}
