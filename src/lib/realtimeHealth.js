// ════════════════════════════════════════════════════════════════════
//  subscribe() + pemantau kesehatan channel realtime (hotfix 14 Sep 2026)
// ════════════════════════════════════════════════════════════════════
//  Sebelum helper ini, semua channel dompet memanggil `.subscribe()` tanpa
//  callback — dan channel `wallets_lock` mati diam-diam di produksi tanpa
//  satu baris log pun. Kegagalan realtime datang lewat DUA jalur yang
//  berbeda, dan keduanya harus didengar:
//
//   1. Pesan `system` berstatus 'error' — binding postgres_changes DITOLAK
//      server (mis. "Unable to subscribe to changes with given parameters"
//      untuk tabel di luar publication `supabase_realtime`). Ini datang
//      SETELAH callback status sudah menerima 'SUBSCRIBED', jadi callback
//      status saja TIDAK PERNAH melihatnya. Persis kasus wallet_members.
//
//   2. Callback status 'CHANNEL_ERROR' / 'TIMED_OUT' — gagal join, token
//      ditolak, socket putus. realtime-js mencoba join ulang sendiri; event
//      yang terjadi selama putus TIDAK dikirim ulang.
//
//  `onRecovered` dipanggil HANYA saat 'SUBSCRIBED' datang lagi setelah jalur
//  2 — itu satu-satunya saat state lokal pasti ketinggalan dan perlu dimuat
//  ulang. SENGAJA tidak dipicu oleh jalur 1: penolakan binding bersifat
//  permanen (tidak sembuh dengan join ulang), jadi memuat ulang di sana
//  hanya akan membuat channel baru yang ditolak lagi — loop.
//
//  'CLOSED' sengaja diam: itu status normal saat removeChannel() di cleanup.
// ════════════════════════════════════════════════════════════════════

/**
 * @param {import('@supabase/supabase-js').RealtimeChannel} channel
 *   channel yang binding postgres_changes-nya SUDAH dipasang, belum subscribe.
 * @param {{ onRecovered?: () => void }} [opts]
 * @returns channel yang sama (sudah subscribe)
 */
export function subscribeWithHealth(channel, { onRecovered } = {}) {
  const name = channel.topic;
  let missedEvents = false;

  channel.on('system', {}, (payload) => {
    if (payload?.status !== 'error') return;
    console.error(`[realtime] ${name} DITOLAK server:`, payload.message || payload);
  });

  return channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      if (missedEvents) {
        missedEvents = false;
        console.warn(`[realtime] ${name} tersambung lagi — memuat ulang untuk event yang terlewat`);
        onRecovered?.();
      }
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      missedEvents = true;
      console.error(`[realtime] ${name} ${status}:`, err?.message || err || '');
    }
  });
}
