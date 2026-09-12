// Stub Supabase untuk harness regresi hotfix owner-cant-see-member-transactions.
// TIDAK mereplikasi semantik WHERE Supabase/RLS sungguhan (itu sudah dibuktikan
// oleh e2e dua-akun terhadap Supabase asli, lihat commit message hotfix ini) —
// stub ini murni menangkap ARGUMEN yang dikirim ke query builder, supaya bisa
// diverifikasi bahwa fetchOwnedWalletIds() benar-benar ikut digabung ke dalam
// filter sebelum query jalan.
// Data skenario diseed lewat window.__PRESEED__ — WAJIB ditulis via
// page.addInitScript() SEBELUM navigasi, bukan lewat page.evaluate() setelah
// halaman dimuat: efek mount hook (fetchOwnedWalletIds/fetchSharedMemberships
// lalu query transactions) selesai dalam hitungan microtask begitu modul ini
// dievaluasi — jauh lebih cepat daripada roundtrip CDP page.evaluate()
// terpisah, jadi mutasi state PASCA-load nyaris pasti kalah start.
const preseed = window.__PRESEED__ || {};
const state = {
  wallets: preseed.wallets || [],          // baris untuk fetchOwnedWalletIds: [{ id }]
  walletMembers: preseed.walletMembers || [], // baris untuk fetchSharedMemberships: [{ wallet_id, role }]
  transactionRows: preseed.transactionRows || [], // baris yang "dikembalikan" query transactions (server-side filtering tidak disimulasikan)
  lastOrFilter: null,   // string yang dikirim ke .or(...) pada query transactions — null kalau tidak pernah dipanggil
  lastEqUserId: null,   // nilai .eq('user_id', X) TERAKHIR pada query transactions (fallback saat sharedOrFilter null)
  calls: { wallets: 0, wallet_members: 0, transactions: 0 },
};
window.__stub = state;

function builder(table) {
  const b = {};
  ['select', 'order', 'is', 'gte', 'lt'].forEach(m => { b[m] = () => b; });
  b.eq = (col, val) => {
    // Dipakai fetchSharedMemberships/fetchOwnedWalletIds (chain-nya sendiri,
    // tidak overlap) DAN fallback `.eq('user_id', userId)` di query transactions
    // saat sharedOrFilter mengembalikan null. Hanya kolom 'user_id' pada query
    // TABEL 'transactions' yang relevan untuk assert fallback-vs-or di bawah.
    if (table === 'transactions' && col === 'user_id') state.lastEqUserId = val;
    return b;
  };
  b.or = (expr) => {
    if (table === 'transactions') state.lastOrFilter = expr;
    return b;
  };
  b.then = (res, rej) => {
    state.calls[table] = (state.calls[table] || 0) + 1;
    let data;
    if (table === 'wallets') data = state.wallets.slice();
    else if (table === 'wallet_members') data = state.walletMembers.slice();
    else if (table === 'transactions') data = state.transactionRows.slice();
    else data = [];
    return Promise.resolve({ data, error: null }).then(res, rej);
  };
  return b;
}

export const supabase = {
  from: (table) => builder(table),
};
