import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { useScrollLock } from '../hooks/useScrollLock';

// ════════════════════════════════════════════════════════════════════
//  Money IQ Chat — halaman chat full-screen + provider global
//
//  Pola sengaja meniru PaywallProvider (context global) + RecurringTransaction
//  Page (overlay position:fixed), karena project ini TIDAK pakai react-router;
//  navigasi antar layar berbasis state. Dengan provider global, kartu Money IQ
//  (InsightsCard) yang dipakai di 2 halaman (Beranda & Analitik) bisa membuka
//  chat tanpa prop-drilling.
//
//  Pakai:
//    const { openMoneyIQ } = useMoneyIQ();
//    openMoneyIQ({ starter: 'Pertanyaan awal...', kind: 'top_expense' });
//
//  Data user TIDAK dikirim dari sini — Edge Function `financial-chat`
//  mengambilnya sendiri via RLS memakai JWT user (otomatis diselipkan
//  supabase.functions.invoke).
// ════════════════════════════════════════════════════════════════════

const MoneyIQContext = React.createContext({
  openMoneyIQ: () => {},
  closeMoneyIQ: () => {},
});

export function useMoneyIQ() {
  return React.useContext(MoneyIQContext);
}

export function MoneyIQChatProvider({ children }) {
  // ctx null = tertutup. { starter?, kind? } = terbuka dengan konteks kartu.
  const [ctx, setCtx] = React.useState(null);

  const openMoneyIQ = React.useCallback((arg) => setCtx(arg || {}), []);
  const closeMoneyIQ = React.useCallback(() => setCtx(null), []);

  const value = React.useMemo(() => ({ openMoneyIQ, closeMoneyIQ }), [openMoneyIQ, closeMoneyIQ]);

  return (
    <MoneyIQContext.Provider value={value}>
      {children}
      <MoneyIQChatPage open={ctx !== null} context={ctx} onClose={closeMoneyIQ} />
    </MoneyIQContext.Provider>
  );
}

// ── Halaman chat (presentational + logika kirim) ─────────────────────
function MoneyIQChatPage({ open, context, onClose }) {
  const { t: tr } = useTranslation();
  useScrollLock(open);

  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef(null);
  const seededRef = React.useRef(false);

  // Kirim satu pertanyaan ke Edge Function `financial-chat`.
  const send = React.useCallback(async (raw) => {
    const question = (raw ?? '').trim();
    if (!question || sending) return;

    setMessages((m) => [...m, { role: 'user', content: question }]);
    setInput('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-chat', {
        body: { question },
      });
      if (error) throw error;
      const answer = data?.answer || tr('moneyIqChat.emptyAnswer');
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      console.error('[MoneyIQChat] invoke error:', e);
      setMessages((m) => [...m, { role: 'assistant', content: tr('moneyIqChat.error'), error: true }]);
    } finally {
      setSending(false);
    }
  }, [sending, tr]);

  // Saat halaman dibuka: reset, lalu seed sesuai konteks kartu.
  //  - ada starter → tampilkan sbg pesan user + auto-kirim ke backend.
  //  - tanpa starter (mis. dibuka tanpa dari kartu) → greeting generik.
  React.useEffect(() => {
    if (!open) {
      seededRef.current = false;
      setMessages([]);
      setInput('');
      setSending(false);
      return;
    }
    if (seededRef.current) return;
    seededRef.current = true;

    if (context?.starter) {
      send(context.starter);
    } else {
      setMessages([{ role: 'assistant', content: tr('moneyIqChat.greeting') }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll ke bawah tiap ada pesan / status ketik berubah.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--cream)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', borderBottom: '1px solid var(--line-soft)', background: 'var(--ivory)' }}>
        <button onClick={onClose} aria-label={tr('umum.kembali', { defaultValue: 'Kembali' })}
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{tr('moneyIqChat.judul')}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{tr('moneyIqChat.subtitle')}</div>
        </div>
        <span style={{ fontSize: 22 }} aria-hidden>✨</span>
      </div>

      {/* Riwayat pesan */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, width: '100%', margin: '0 auto' }}>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} error={m.error}>{m.content}</Bubble>
          ))}
          {sending && (
            <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 4px' }}>
              {tr('moneyIqChat.typing')}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line-soft)', background: 'var(--ivory)', padding: '12px 18px calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 640, margin: '0 auto' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={tr('moneyIqChat.placeholder')}
            style={{ flex: 1, resize: 'none', maxHeight: 120, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line-soft)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            aria-label={tr('moneyIqChat.kirim')}
            style={{ width: 44, height: 44, borderRadius: 12, border: 0, background: (sending || !input.trim()) ? 'var(--line)' : 'var(--ink)', color: 'var(--cream)', display: 'grid', placeItems: 'center', cursor: (sending || !input.trim()) ? 'default' : 'pointer', flexShrink: 0, transition: 'background .2s ease' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gelembung pesan ──────────────────────────────────────────────────
function Bubble({ role, error, children }) {
  const isUser = role === 'user';
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      <div
        className={isUser ? '' : 'card'}
        style={{
          padding: '11px 14px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: isUser ? 'var(--ink)' : error ? 'color-mix(in oklch, var(--terra) 12%, var(--paper))' : undefined,
          color: isUser ? 'var(--cream)' : error ? 'var(--terra)' : 'var(--ink)',
          border: isUser ? 0 : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default MoneyIQChatProvider;
