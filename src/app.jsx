import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle } from './tweaks-panel';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './topbar';
import { KpiCards, CashflowCard, SpendingCard, InsightsCard, SavingsCard, BudgetsCard } from './widgets';
import { WalletsPage, AddAccountModal } from './wallets';
import { ReportsPage } from './reports';
import { AnalyticsPage } from './analytics';
import { SavingsPage, AddGoalModal, DepositModal } from './savings-page';
import { TransactionsPage } from './transactions-page';
import { TransactionsCard, AddTransactionModal } from './transactions';
import { ScanStrukSheet } from './components/ScanStruk';
import { SettingsPage } from './settings-page';
import { BudgetsPage } from './budgets-page';
import { supabase } from './supabase';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import OnboardingScreen from './components/OnboardingScreen';
import SplashScreen from './components/SplashScreen';
import { GoalCompleteOverlay } from './components/GoalCompleteOverlay';
import { isSoundAnimEnabled } from './lib/sound';
import { checkRecurringTransactions } from './lib/recurringHelper';
import { syncWidget, consumeWidgetLaunchAction } from './lib/widgetSync';
import { fmt } from './data';
import PinLock from './components/PinLock';
import BiometricLock from './components/BiometricLock';
import { isPinActive, isBiometricEnabled, clearPin } from './lib/pin';
import { useAutoLock } from './hooks/useAutoLock';
import { useTransactions } from './hooks/useTransactions';
import { useSavings } from './hooks/useSavings';
import { useWallets } from './hooks/useWallets';
import { useNotifications } from './hooks/useNotifications';
import { useBudgets } from './hooks/useBudgets';
import { useCustomCategories } from './hooks/useCustomCategories';
import { useSubscription } from './hooks/useSubscription';
import { usePaywall } from './components/PaywallModal';
import { isFontThemeAllowed } from './lib/planLimits';

const TWEAK_DEFAULTS = {
  theme: "light",
  palette: "cream",
  showAI: true,
  notifications: true,
  fontTheme: "modern-tech",
};

const FONT_THEMES = {
  'modern-tech':   { body: "'Geist', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif", mono: "'Geist Mono', ui-monospace, monospace",       heading: "'Instrument Serif', 'Times New Roman', serif" },
  'pro-finance':   { body: "'Plus Jakarta Sans', sans-serif",                                          mono: "'JetBrains Mono', monospace",                   heading: "'Playfair Display', serif"                    },
  'elegant':       { body: "'Raleway', sans-serif",                                                    mono: "'Courier Prime', monospace",                    heading: "'Merriweather', serif"                         },
  'luxury':        { body: "'Manrope', sans-serif",                                                    mono: "'Roboto Mono', monospace",                      heading: "'Fraunces', serif"                             },
  'soft-friendly': { body: "'DM Sans', sans-serif",                                                    mono: "'DM Mono', monospace",                          heading: "'Cormorant Garamond', serif"                   },
};

export default function App() {
  const { t } = useTranslation();
  const [session, setSession] = React.useState(undefined); // undefined = loading
  const [authView, setAuthView] = React.useState('login');
  // Onboarding tampil setiap kali user baru register atau login (fresh session).
  // Bukan disimpan di localStorage: di-trigger dari handler auth, di-reset saat logout.
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  // ── Gerbang keamanan → splash → konten ──────────────────────────────
  // Urutan: verifikasi keamanan (PIN/biometrik) DULU, baru splash 3 detik,
  // baru konten. Bila tak ada keamanan aktif → langsung splash.
  const [showPin, setShowPin] = React.useState(false);
  const [showBiometric, setShowBiometric] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(false);

  // Tentukan gerbang saat app pertama dibuka (PIN & biometrik saling eksklusif)
  React.useEffect(() => {
    if (isPinActive()) {
      setShowPin(true);          // PIN dulu, splash menyusul setelah benar
    } else if (isBiometricEnabled()) {
      setShowBiometric(true);    // biometrik dulu, splash menyusul setelah berhasil
    } else {
      setShowSplash(true);       // tanpa keamanan → langsung splash
    }
  }, []);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (!s) setShowOnboarding(false); // logout → bersihkan flag onboarding
    });
    return () => subscription.unsubscribe();
  }, []);

  // Verifikasi berhasil → lepas gerbang, tampilkan splash 3 detik
  const onPinSuccess = React.useCallback(() => {
    setShowPin(false);
    setShowSplash(true);
  }, []);
  const onBiometricSuccess = React.useCallback(() => {
    setShowBiometric(false);
    setShowSplash(true);
  }, []);
  const onSplashFinish = React.useCallback(() => setShowSplash(false), []);

  // Lupa PIN / 5× gagal → reset keamanan, lanjut splash, paksa login ulang Supabase
  const handleForgotPin = React.useCallback(async () => {
    clearPin();
    setShowPin(false);
    setShowSplash(true);
    try { await supabase.auth.signOut(); } catch {}
  }, []);

  // Biometrik gagal total / tak tersedia → reset keamanan, lanjut splash, login ulang
  const handleBiometricEscape = React.useCallback(async () => {
    clearPin();
    setShowBiometric(false);
    setShowSplash(true);
    try { await supabase.auth.signOut(); } catch {}
  }, []);

  // Auto-lock: setelah app lama di background, munculkan kembali gerbang keamanan.
  // No-op bila tak ada metode keamanan aktif (PIN/biometrik mati).
  const lockNow = React.useCallback(() => {
    if (isPinActive()) { setShowSplash(false); setShowPin(true); }
    else if (isBiometricEnabled()) { setShowSplash(false); setShowBiometric(true); }
  }, []);
  useAutoLock(lockNow);

  // 1) Gerbang keamanan: tampil paling depan, SEBELUM splash & konten.
  //    Tidak ada batas waktu — user bebas selama apa pun memasukkan PIN/sidik jari.
  if (showPin) {
    return <PinLock onUnlock={onPinSuccess} onForgot={handleForgotPin} biometricEnabled={false} />;
  }
  if (showBiometric) {
    return <BiometricLock onSuccess={onBiometricSuccess} onEscape={handleBiometricEscape} />;
  }

  // 2) Konten utama (auth/onboarding) — di-mount di belakang splash agar transisi mulus.
  let content;
  if (session === undefined) {
    content = <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--cream)', color: 'var(--muted)', fontSize: 14 }}>{t('umum.memuat')}</div>;
  } else if (!session) {
    content = authView === 'login'
      ? <LoginPage onSwitch={() => setAuthView('register')} onAuthSuccess={() => setShowOnboarding(true)} />
      : <RegisterPage onSwitch={() => setAuthView('login')} onAuthSuccess={() => setShowOnboarding(true)} />;
  } else {
    content = (
      <>
        <AuthenticatedApp session={session} />
        {/* Overlay onboarding di atas halaman utama setelah register/login berhasil */}
        {showOnboarding && <OnboardingScreen onDone={() => setShowOnboarding(false)} />}
      </>
    );
  }

  // 3) Splash screen menumpuk di atas konten (3 detik) setelah keamanan lolos.
  return (
    <>
      {content}
      {showSplash && <SplashScreen onDone={onSplashFinish} />}
    </>
  );
}

const TWEAKS_KEY = 'finance_tweaks';
const NOTIF_PREFS_KEY = 'notif_prefs';
const NOTIF_PREFS_DEFAULTS = { budget: true, income: true, weekly: true, bills: false };

function loadSavedTweaks() {
  try { return JSON.parse(localStorage.getItem(TWEAKS_KEY) || '{}'); } catch { return {}; }
}

function loadNotifPrefs() {
  try { return { ...NOTIF_PREFS_DEFAULTS, ...JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}') }; }
  catch { return { ...NOTIF_PREFS_DEFAULTS }; }
}

function AuthenticatedApp({ session }) {
  // Merge: hardcoded defaults ← localStorage ← window overrides
  const defaults = React.useMemo(() => ({
    ...TWEAK_DEFAULTS,
    ...loadSavedTweaks(),
    ...(window.__TWEAK_DEFAULTS ?? {}),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [t, setTweakRaw] = useTweaks(defaults);

  // Wrap setTweak agar setiap perubahan disimpan ke localStorage
  const setTweak = React.useCallback((key, val) => {
    setTweakRaw(key, val);
    try {
      const saved = loadSavedTweaks();
      const edits = typeof key === 'object' && key !== null ? key : { [key]: val };
      localStorage.setItem(TWEAKS_KEY, JSON.stringify({ ...saved, ...edits }));
    } catch {}
  }, [setTweakRaw]);

  // Theme application
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", t.theme === "dark");
  }, [t.theme]);

  // Font theme — applies CSS vars on documentElement
  React.useEffect(() => {
    const root = document.documentElement;
    const ft = FONT_THEMES[t.fontTheme] || FONT_THEMES['modern-tech'];
    root.style.setProperty('--font-body',    ft.body);
    root.style.setProperty('--font-mono',    ft.mono);
    root.style.setProperty('--font-heading', ft.heading);
  }, [t.fontTheme]);

  // Palette swap — light tweak that retones cream
  React.useEffect(() => {
    const root = document.documentElement;
    if (t.theme === "dark") {
      root.style.removeProperty("--cream");
      root.style.removeProperty("--cream-soft");
      root.style.removeProperty("--ivory");
      root.style.removeProperty("--paper");
      return;
    }
    const palettes = {
      cream: { cream: "#EAE5D5", cream_soft: "#F0EBDC", ivory: "#F5F1E4", paper: "#FBF8EE" },
      sand:  { cream: "#E6DECB", cream_soft: "#ECE5D2", ivory: "#F2ECD9", paper: "#F8F3E2" },
      mist:  { cream: "#E4E7E0", cream_soft: "#ECEFE8", ivory: "#F2F4ED", paper: "#F7F9F2" },
      bone:  { cream: "#EFEBDF", cream_soft: "#F4F0E5", ivory: "#F9F5EB", paper: "#FCF9F1" },
    };
    const p = palettes[t.palette] || palettes.cream;
    root.style.setProperty("--cream", p.cream);
    root.style.setProperty("--cream-soft", p.cream_soft);
    root.style.setProperty("--ivory", p.ivory);
    root.style.setProperty("--paper", p.paper);
  }, [t.palette, t.theme]);

  const [active, setActive] = React.useState("dashboard");

  React.useEffect(() => {
    window.scrollTo(0, 0);
    document.body.style.width = '100%';
    document.body.style.maxWidth = '100%';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
  }, [active]);

  const [balanceVisible, setBalanceVisible] = React.useState(true);
  const [modal, setModal] = React.useState(false);

  // Scan Struk → form transaksi terprefill (lihat ScanStruk.jsx + AddTransactionModal)
  const [scanOpen, setScanOpen] = React.useState(false);
  const [scanPrefill, setScanPrefill] = React.useState(null);
  const [scanNotice, setScanNotice] = React.useState(null);
  const [scanPreview, setScanPreview] = React.useState(null);

  const closeAddModal = React.useCallback(() => {
    setModal(false);
    setScanPrefill(null); setScanNotice(null); setScanPreview(null);
  }, []);

  const handleScanResult = React.useCallback(({ prefill, notice, previewImage }) => {
    setScanPrefill(prefill || null);
    setScanNotice(notice || null);
    setScanPreview(previewImage || null);
    setModal(true);   // buka form transaksi yang sudah terisi otomatis
  }, []);

  // Status langganan (Basic / Pro) + limit fitur — sumber tunggal pembatasan
  const subscription = useSubscription(session.user.id);
  const { limits } = subscription;
  const { openPaywall } = usePaywall();

  // Auto-reset tema font saat downgrade Pro → Basic. Kalau tema aktif tidak
  // diizinkan di Basic, kembalikan ke 'modern-tech' + tampilkan toast.
  const [fontResetToast, setFontResetToast] = React.useState(false);
  const prevIsProRef = React.useRef(undefined);
  React.useEffect(() => {
    if (subscription.loading) return;
    const wasPro = prevIsProRef.current;
    prevIsProRef.current = subscription.isPro;
    if (wasPro === true && subscription.isPro === false) {
      const current = t.fontTheme || 'modern-tech';
      if (!isFontThemeAllowed(current, limits)) {
        setTweak('fontTheme', 'modern-tech');
        setFontResetToast(true);
      }
    }
  }, [subscription.isPro, subscription.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!fontResetToast) return;
    const id = setTimeout(() => setFontResetToast(false), 4500);
    return () => clearTimeout(id);
  }, [fontResetToast]);

  // Multi-wallet state — sinkron dengan Supabase
  const { accounts, createAccount, setPrimary, deleteAccount: _deleteAccount } = useWallets(session.user.id, limits);

  // Tombol "Tambah Wallet" tetap tampil + gemlock saat Basic sudah mencapai limit
  const walletAddLocked = accounts.length >= (limits?.maxWallets ?? Infinity);
  const [selectedAcct, setSelectedAcct] = React.useState("all");
  const [addAcct, setAddAcct] = React.useState(false);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const deleteAccount = (id) => {
    _deleteAccount(id);
    setSelectedAcct(sel => sel === id ? "all" : sel);
  };

  // Notification preferences — lifted so both SettingsPage and useNotifications stay in sync
  const [notifSubs, setNotifSubsRaw] = React.useState(loadNotifPrefs);
  const toggleNotifSub = React.useCallback((k) => {
    setNotifSubsRaw(s => {
      const next = { ...s, [k]: !s[k] };
      try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Transactions — sinkron dengan Supabase per user yang login
  const { transactions, loading: txLoading, createTransaction, deleteTransaction, updateTransaction } = useTransactions(session.user.id);

  // Transaksi berulang — saat app dibuka, eksekusi jadwal yang sudah jatuh tempo.
  // Ref guard memastikan hanya jalan sekali per sesi app.
  const [recurringToasts, setRecurringToasts] = React.useState([]);
  const ranRecurringRef = React.useRef(false);
  React.useEffect(() => {
    if (ranRecurringRef.current) return;
    ranRecurringRef.current = true;
    (async () => {
      try {
        const done = await checkRecurringTransactions(createTransaction);
        if (done.length) {
          setRecurringToasts(done.map((d, i) => ({ ...d, id: `${Date.now()}-${i}` })));
        }
      } catch {}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Budgets — Supabase
  const { budgets, createBudget, updateBudget, deleteBudget } = useBudgets(session.user.id);

  // Sinkronkan ringkasan ke widget home-screen Android (no-op di web/dev).
  React.useEffect(() => {
    syncWidget(transactions, budgets);
  }, [transactions, budgets]);

  // Buka form tambah transaksi bila app diluncurkan dari tombol "Catat Transaksi" pada widget.
  React.useEffect(() => {
    let alive = true;
    const check = async () => {
      const action = await consumeWidgetLaunchAction();
      if (alive && action === 'add_tx') setModal(true);
    };
    check(); // saat app pertama dibuka
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kategori kustom — dipakai bersama menu Anggaran & Transaksi (realtime)
  const { customCategories, addCustomCategory } = useCustomCategories(session.user.id, limits);

  // Notifications
  const { notifications, unreadCount, markAllRead } = useNotifications(transactions, notifSubs, budgets);

  // Savings goals — Supabase
  const { goals, createGoal, deleteGoal, depositToGoal } = useSavings(session.user.id, limits);
  const [addGoal, setAddGoal] = React.useState(false);
  const [depositGoal, setDepositGoal] = React.useState(null);
  const [goalCelebrate, setGoalCelebrate] = React.useState(false);

  // ── Gate fitur (Basic vs Pro) — pre-check di tombol pemicu ─────────
  // Wallet/goal: cek limit SEBELUM membuka form supaya form tak terbuka
  // sia-sia (hook tetap punya guard otoritatif sebagai jaring pengaman).
  const handleAddAcct = React.useCallback(() => {
    if (accounts.length >= (limits?.maxWallets ?? Infinity)) { openPaywall('Wallet / Dompet tambahan'); return; }
    setAddAcct(true);
  }, [accounts.length, limits, openPaywall]);

  const handleAddGoal = React.useCallback(() => {
    if (goals.length >= (limits?.maxSavingsGoals ?? Infinity)) { openPaywall('Goals / Tabungan tambahan'); return; }
    setAddGoal(true);
  }, [goals.length, limits, openPaywall]);

  // Scan nota (OCR): Basic → PaywallModal, scanner tidak terbuka.
  const handleScan = React.useCallback(() => {
    if (!limits?.receiptScanEnabled) { openPaywall('Scan Nota'); return; }
    setScanOpen(true);
  }, [limits, openPaywall]);

  // Deposit + deteksi goal mencapai 100% (dari belum tercapai) → overlay perayaan
  const handleDeposit = React.useCallback(async (id, amount) => {
    const goal = goals.find(g => g.id === id);
    const wasComplete = goal ? goal.current >= goal.target : false;
    const res = await depositToGoal(id, amount);
    if (!res?.error && goal && !wasComplete && goal.target > 0 && (goal.current + amount) >= goal.target && isSoundAnimEnabled()) {
      setGoalCelebrate(true);
    }
    return res;
  }, [goals, depositToGoal]);

  return (
    <div className="app" data-screen-label="Dashboard">
      <BottomNav active={active} onNav={setActive} />

      <main className="main-content">
        <TopBar
          theme={t.theme}
          onTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}
          onAdd={() => setModal(true)}
          accounts={accounts}
          selectedAcct={selectedAcct}
          onSelectAcct={setSelectedAcct}
          onAddAcct={handleAddAcct}
          addAcctLocked={walletAddLocked}
          notifEnabled={t.notifications}
          user={session.user}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
        />

        {active === "dashboard" && (
          <div className="dash-grid">
            <div className="span-4">
              <KpiCards balanceVisible={balanceVisible} onToggleVisible={() => setBalanceVisible(v => !v)} totalBalance={totalBalance} accountCount={accounts.length} transactions={transactions} />
            </div>

            <CashflowCard transactions={transactions} />
            <SpendingCard transactions={transactions} />

            {t.showAI && <InsightsCard transactions={transactions} customCategories={customCategories} limits={limits} />}

            <TransactionsCard onAdd={() => setModal(true)} onScan={handleScan} scanLocked={!limits.receiptScanEnabled} limit={8} onSeeAll={() => setActive("transactions")} transactions={transactions} loading={txLoading} customCategories={customCategories} />
            <SavingsCard goals={goals} onManage={() => setActive("savings")} />
            <BudgetsCard onManage={() => setActive("budgets")} transactions={transactions} budgets={budgets} />
          </div>
        )}

        {active === "budgets" && <BudgetsPage transactions={transactions} budgets={budgets} onAdd={createBudget} onUpdate={updateBudget} onDelete={deleteBudget} customCategories={customCategories} onCreateCustom={addCustomCategory} />}

        {active === "wallets" && (
          <WalletsPage accounts={accounts} onAdd={handleAddAcct} onSetPrimary={setPrimary} onDelete={deleteAccount} transactions={transactions} addLocked={walletAddLocked} />
        )}

        {active === "reports" && <ReportsPage transactions={transactions} customCategories={customCategories} canExport={limits.reportsExportEnabled} />}

        {active === "analytics" && <AnalyticsPage transactions={transactions} customCategories={customCategories} />}

        {active === "savings" && (
          <SavingsPage goals={goals} onAdd={handleAddGoal} onDeposit={setDepositGoal} onDelete={deleteGoal} />
        )}

        {active === "transactions" && (
          <TransactionsPage accounts={accounts} onAdd={() => setModal(true)} onScan={handleScan} scanLocked={!limits.receiptScanEnabled} transactions={transactions} loading={txLoading} onDelete={deleteTransaction} onUpdate={updateTransaction} customCategories={customCategories} onCreateCustom={addCustomCategory} />
        )}

        {active === "settings" && <SettingsPage t={t} setTweak={setTweak} user={session.user} notifSubs={notifSubs} onToggleNotifSub={toggleNotifSub} subscription={subscription} />}

        {active !== "dashboard" && active !== "budgets" && active !== "wallets" && active !== "reports" && active !== "analytics" && active !== "savings" && active !== "transactions" && active !== "settings" && <Placeholder section={active} />}
      </main>

      <AddTransactionModal open={modal} onClose={closeAddModal} onSave={createTransaction} customCategories={customCategories} onCreateCustom={addCustomCategory} prefill={scanPrefill} notice={scanNotice} previewImage={scanPreview} />
      <ScanStrukSheet open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScanResult} />
      <AddAccountModal open={addAcct} onClose={() => setAddAcct(false)} onCreate={createAccount} />
      <AddGoalModal open={addGoal} onClose={() => setAddGoal(false)} onCreate={createGoal} />
      <DepositModal goal={depositGoal} onClose={() => setDepositGoal(null)} onConfirm={handleDeposit} />

      {goalCelebrate && <GoalCompleteOverlay onClose={() => setGoalCelebrate(false)} />}

      {/* Toast: tema font di-reset karena downgrade ke Basic */}
      {fontResetToast && (
        <div role="status" style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)", zIndex: 1150,
          background: "var(--ink)", color: "var(--cream)", borderRadius: 12,
          padding: "12px 16px", fontSize: 12.5, lineHeight: 1.45,
          width: "min(420px, calc(100% - 32px))", boxSizing: "border-box",
          boxShadow: "0 12px 32px -8px rgba(42,44,32,.45)", animation: "rise .25s ease-out",
        }}>
          Tema di-reset ke Modern Tech karena paket Anda sekarang Basic.
        </div>
      )}

      {/* Toast hasil eksekusi transaksi berulang otomatis */}
      {recurringToasts.length > 0 && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)", zIndex: 1150, display: "flex", flexDirection: "column", gap: 8, width: "min(420px, calc(100% - 32px))", pointerEvents: "none" }}>
          {recurringToasts.map(toast => (
            <RecurringToast key={toast.id} data={toast}
              onDone={() => setRecurringToasts(prev => prev.filter(x => x.id !== toast.id))} />
          ))}
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Tampilan">
          <TweakRadio label="Tema" value={t.theme} onChange={v => setTweak("theme", v)} options={[
            { label: "Terang", value: "light" },
            { label: "Gelap",  value: "dark" },
          ]} />
          <TweakSelect label="Warna latar" value={t.palette} onChange={v => setTweak("palette", v)}
            options={[
              { label: "Cream — hangat",  value: "cream" },
              { label: "Sand — tanah",    value: "sand"  },
              { label: "Mist — sejuk",    value: "mist"  },
              { label: "Bone — netral",   value: "bone"  },
            ]} />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakToggle label="Tampilkan wawasan AI" value={t.showAI} onChange={v => setTweak("showAI", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function RecurringToast({ data, onDone }) {
  const { t } = useTranslation();
  React.useEffect(() => {
    const timer = setTimeout(onDone, 4800);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div role="status" style={{
      pointerEvents: "auto", background: "var(--ink)", color: "var(--cream)",
      borderRadius: 12, padding: "12px 16px", fontSize: 12.5, lineHeight: 1.45,
      boxShadow: "0 12px 32px -8px rgba(42,44,32,.45)", animation: "rise .25s ease-out",
    }}>
      ✅ {t('berulang.dicatatOtomatis', { nama: data.nama, jumlah: fmt(data.jumlah) })}
    </div>
  );
}

function Placeholder({ section }) {
  const { t } = useTranslation();
  const titles = {
    transactions: t('nav.transaksi'), analytics: t('nav.analitik'), budgets: t('nav.anggaran'),
    savings: t('nav.tabungan'), reports: t('nav.laporan'), settings: t('nav.pengaturan'),
  };
  return (
    <div style={{ padding: "60px 32px", display: "grid", placeItems: "center" }}>
      <div className="card" style={{ padding: 40, maxWidth: 520, textAlign: "center" }}>
        <div className="serif" style={{ fontSize: 32, letterSpacing: "-0.01em" }}>
          {titles[section] || section}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
          Beranda adalah layar pertama yang sudah saya desain penuh.
          {" "}Bagian ini dicadangkan untuk iterasi berikutnya — beri tahu layar mana
          yang ingin dibuat selanjutnya dan saya akan bangun dengan sistem yang sama.
        </div>
      </div>
    </div>
  );
}

