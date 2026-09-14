import { supabase } from '../supabase';
import { logError } from './errorLogger';

// ════════════════════════════════════════════════════════════════════
//  subscribe() + pemantau kesehatan channel realtime (hotfix 14 Sep 2026)
// ════════════════════════════════════════════════════════════════════
//  Sebelum helper ini, semua channel dompet memanggil `.subscribe()` tanpa
//  callback — dan channel `wallets_lock` mati diam-diam di produksi selama
//  tiga hari tanpa satu baris log pun. Kegagalan realtime datang lewat TIGA
//  jalur, dan semuanya dicatat ke console DAN ke error_logs (source 'realtime'):
//
//   1. Pesan `system` berstatus 'error' — binding postgres_changes DITOLAK
//      server (mis. "Unable to subscribe to changes with given parameters"
//      untuk tabel di luar publication `supabase_realtime`). Ini datang
//      SETELAH callback status sudah menerima 'SUBSCRIBED', jadi callback
//      status saja TIDAK PERNAH melihatnya. Persis kasus wallet_members.
//      Severity 'high': ini salah konfigurasi permanen, bukan gangguan sinyal.
//
//   2. Callback status 'CHANNEL_ERROR' / 'TIMED_OUT' — gagal join, token
//      ditolak, socket putus. realtime-js mencoba join ulang sendiri; event
//      yang terjadi selama putus TIDAK dikirim ulang. Severity 'medium'.
//
//   3. 'CLOSED' yang TIDAK disengaja. 'CLOSED' juga menyala di setiap
//      removeChannel() normal (unmount, reloadKey naik) — karena itu cleanup
//      WAJIB memakai closeChannel() di bawah, yang menandai penutupan sebagai
//      disengaja. removeChannel() langsung = satu baris error_logs palsu.
//
//  `onRecovered` dipanggil HANYA saat 'SUBSCRIBED' datang lagi setelah jalur
//  2 — itu satu-satunya saat state lokal pasti ketinggalan dan perlu dimuat
//  ulang. SENGAJA tidak dipicu oleh jalur 1: penolakan binding bersifat
//  permanen (tidak sembuh dengan join ulang), jadi memuat ulang di sana
//  hanya akan membuat channel baru yang ditolak lagi — loop.
// ════════════════════════════════════════════════════════════════════

// ── Rem error_logs ─────────────────────────────────────────────────────
// error_logs khusus error uang/data permanen, bukan noise. Selama sebuah tabel
// di luar publication, penolakannya terjadi untuk SETIAP user di SETIAP mount
// (dan setiap reloadKey naik) — tanpa rem, baris identik menenggelamkan error
// yang kritis. Server tidak punya rate limit untuk log_error, jadi rem ini
// satu-satunya.
//
// Kunci = JENIS channel + status (mis. `wallet_members_watch|system`), BUKAN
// topic: topic membawa uuid (user, dompet), dan `wallet_members_sheet:<id>`
// akan menghasilkan satu baris per dompet yang dibuka.
//
// Disimpan di sessionStorage, bukan hanya variabel modul: variabel modul
// reset setiap reload halaman / cold start, sedangkan sessionStorage bertahan
// selama tab (web) atau proses WebView (Capacitor) hidup. Set modul tetap ada
// sebagai cadangan kalau storage tidak tersedia/melempar (mode privat, dll).
//
// Konsekuensi yang diterima: kunci diklaim SEBELUM logError selesai. Kalau
// penulisan gagal (offline), jenis kegagalan itu tidak dicoba lagi di sesi
// yang sama — console.error tetap mencatatnya.
const DEDUP_STORAGE_KEY = 'realtime_errors_logged';
const loggedThisPageLoad = new Set();
const intentionallyClosed = new WeakSet();

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Pesan penolakan server memuat parameter filter mentah (user_id, daftar id
// dompet di `in.(...)`). Uuid dibuang sebelum apa pun masuk error_logs.
const scrub = (text) => String(text ?? '').replace(UUID_RE, '<uuid>').slice(0, 1000);

// 'realtime:wallets_lock:<uid>:<n>' → 'wallets_lock'
const channelKind = (topic) => String(topic || '').replace(/^realtime:/, '').split(':')[0] || 'unknown';

function claimOnce(key) {
  if (loggedThisPageLoad.has(key)) return false;
  loggedThisPageLoad.add(key);
  try {
    const seen = JSON.parse(sessionStorage.getItem(DEDUP_STORAGE_KEY) || '[]');
    const list = Array.isArray(seen) ? seen : [];
    if (list.includes(key)) return false;
    sessionStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify([...list, key]));
  } catch {
    // Storage tidak tersedia → cukup Set modul di atas.
  }
  return true;
}

// Tabel + jumlah id per binding. JUMLAH saja, tidak pernah id-nya.
function describeBindings(channel) {
  try {
    const bindings = (channel.bindings?.postgres_changes || []).map(({ filter = {} }) => {
      const f = String(filter.filter || '');
      const inList = f.match(/=in\.\(([^)]*)\)/);
      return {
        table:    filter.table || null,
        event:    filter.event || null,
        id_count: inList ? inList[1].split(',').filter(Boolean).length : (f ? 1 : 0),
      };
    });
    return { tables: [...new Set(bindings.map(b => b.table).filter(Boolean))], bindings };
  } catch {
    return { tables: [], bindings: [] };
  }
}

function report(channel, status, rawMessage, severity) {
  const kind = channelKind(channel.topic);
  if (!claimOnce(`${kind}|${status}`)) return;
  const message = scrub(rawMessage);
  // Tidak di-await: logError tidak pernah melempar dan tidak boleh menahan
  // callback realtime.
  logError('realtime', `${kind} ${status}: ${message}`, {
    channel: kind,
    status,
    message,
    ...describeBindings(channel),
  }, severity);
}

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
    report(channel, 'system', payload.message || JSON.stringify(payload), 'high');
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
      report(channel, status, err?.message || String(err || ''), 'medium');
      return;
    }
    if (status === 'CLOSED' && !intentionallyClosed.has(channel)) {
      console.warn(`[realtime] ${name} CLOSED tanpa closeChannel()`);
      report(channel, 'CLOSED', 'channel ditutup tanpa closeChannel()', 'medium');
    }
  });
}

/**
 * Pengganti supabase.removeChannel() untuk channel dari subscribeWithHealth.
 * Menandai penutupan sebagai disengaja SEBELUM 'CLOSED' menyala, supaya tidak
 * tercatat sebagai kegagalan. Aman dipanggil dengan null.
 */
export function closeChannel(channel) {
  if (!channel) return;
  intentionallyClosed.add(channel);
  supabase.removeChannel(channel);
}
