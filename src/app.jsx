import React from 'react';
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
import { SettingsPage } from './settings-page';
import { BudgetsPage } from './budgets-page';
import { supabase } from './supabase';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { useTransactions } from './hooks/useTransactions';
import { useSavings } from './hooks/useSavings';
import { useWallets } from './hooks/useWallets';
import { useNotifications } from './hooks/useNotifications';
import { useBudgets } from './hooks/useBudgets';
import { useCustomCategories } from './hooks/useCustomCategories';

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
  const [session, setSession] = React.useState(undefined); // undefined = loading
  const [authView, setAuthView] = React.useState('login');

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--cream)', color: 'var(--muted)', fontSize: 14 }}>Memuat…</div>;
  }

  if (!session) {
    return authView === 'login'
      ? <LoginPage onSwitch={() => setAuthView('register')} />
      : <RegisterPage onSwitch={() => setAuthView('login')} />;
  }

  return <AuthenticatedApp session={session} />;
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

  // Multi-wallet state — sinkron dengan Supabase
  const { accounts, createAccount, setPrimary, deleteAccount: _deleteAccount } = useWallets(session.user.id);
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

  // Budgets — Supabase
  const { budgets, createBudget, updateBudget, deleteBudget } = useBudgets(session.user.id);

  // Kategori kustom — dipakai bersama menu Anggaran & Transaksi (realtime)
  const { customCategories, addCustomCategory } = useCustomCategories(session.user.id);

  // Notifications
  const { notifications, unreadCount, markAllRead } = useNotifications(transactions, notifSubs, budgets);

  // Savings goals — Supabase
  const { goals, createGoal, deleteGoal, depositToGoal } = useSavings(session.user.id);
  const [addGoal, setAddGoal] = React.useState(false);
  const [depositGoal, setDepositGoal] = React.useState(null);

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
          onAddAcct={() => setAddAcct(true)}
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

            {t.showAI && <InsightsCard transactions={transactions} />}

            <TransactionsCard onAdd={() => setModal(true)} limit={8} onSeeAll={() => setActive("transactions")} transactions={transactions} loading={txLoading} customCategories={customCategories} />
            <SavingsCard goals={goals} onManage={() => setActive("savings")} />
            <BudgetsCard onManage={() => setActive("budgets")} transactions={transactions} budgets={budgets} />
          </div>
        )}

        {active === "budgets" && <BudgetsPage transactions={transactions} budgets={budgets} onAdd={createBudget} onUpdate={updateBudget} onDelete={deleteBudget} customCategories={customCategories} onCreateCustom={addCustomCategory} />}

        {active === "wallets" && (
          <WalletsPage accounts={accounts} onAdd={() => setAddAcct(true)} onSetPrimary={setPrimary} onDelete={deleteAccount} transactions={transactions} />
        )}

        {active === "reports" && <ReportsPage transactions={transactions} customCategories={customCategories} />}

        {active === "analytics" && <AnalyticsPage transactions={transactions} />}

        {active === "savings" && (
          <SavingsPage goals={goals} onAdd={() => setAddGoal(true)} onDeposit={setDepositGoal} onDelete={deleteGoal} />
        )}

        {active === "transactions" && (
          <TransactionsPage accounts={accounts} onAdd={() => setModal(true)} transactions={transactions} loading={txLoading} onDelete={deleteTransaction} onUpdate={updateTransaction} customCategories={customCategories} onCreateCustom={addCustomCategory} />
        )}

        {active === "settings" && <SettingsPage t={t} setTweak={setTweak} user={session.user} notifSubs={notifSubs} onToggleNotifSub={toggleNotifSub} />}

        {active !== "dashboard" && active !== "budgets" && active !== "wallets" && active !== "reports" && active !== "analytics" && active !== "savings" && active !== "transactions" && active !== "settings" && <Placeholder section={active} />}
      </main>

      <AddTransactionModal open={modal} onClose={() => setModal(false)} onSave={createTransaction} customCategories={customCategories} onCreateCustom={addCustomCategory} />
      <AddAccountModal open={addAcct} onClose={() => setAddAcct(false)} onCreate={createAccount} />
      <AddGoalModal open={addGoal} onClose={() => setAddGoal(false)} onCreate={createGoal} />
      <DepositModal goal={depositGoal} onClose={() => setDepositGoal(null)} onConfirm={depositToGoal} />

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

function Placeholder({ section }) {
  const titles = {
    transactions: "Transaksi", analytics: "Analitik", budgets: "Anggaran",
    savings: "Tabungan", reports: "Laporan", settings: "Pengaturan",
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

