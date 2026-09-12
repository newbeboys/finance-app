// Stub Supabase untuk harness useTransactions. Direkatkan lewat alias di
// tests/harness/vite.config.js — TIDAK pernah ikut ke bundle produksi.
const state = { rows: [], members: [], selectCount: 0, rpcCalls: [], pendingRpc: null, holdRpc: false };
window.__stub = state;

function builder(table) {
  const b = {};
  ['select', 'order', 'or', 'eq', 'is', 'gte', 'lt'].forEach(m => { b[m] = () => b; });
  b.then = (res, rej) => {
    const p = table === 'transactions'
      ? (state.selectCount++, Promise.resolve({ data: state.rows.slice(), error: null }))
      : Promise.resolve({ data: state.members.slice(), error: null });
    return p.then(res, rej);
  };
  return b;
}

export const supabase = {
  from: (table) => builder(table),
  // holdRpc = tahan RPC supaya tulisannya "in-flight" selama yang kita mau;
  // lepaskan lewat state.pendingRpc.resolve(...).
  rpc: (name, args) => {
    state.rpcCalls.push({ name, args });
    if (state.holdRpc) return new Promise(resolve => { state.pendingRpc = { name, args, resolve }; });
    return Promise.resolve({ data: 'rpc-id-1', error: null });
  },
};
