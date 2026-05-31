import React from 'react';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle } from './tweaks-panel';
import { Sidebar } from './sidebar';
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
import { ACCOUNTS, GOALS } from './data';

const TWEAK_DEFAULTS = {
  theme: "light",
  palette: "cream",
  sidebarVariant: "labeled",
  showAI: true,
  notifications: true,
};

export default function App() {
  const defaults = window.__TWEAK_DEFAULTS ?? TWEAK_DEFAULTS;
  const [t, setTweak] = useTweaks(defaults);

  // Theme application
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", t.theme === "dark");
  }, [t.theme]);

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
  const [balanceVisible, setBalanceVisible] = React.useState(true);
  const [modal, setModal] = React.useState(false);

  // Multi-wallet state — accounts live here so creating one updates everywhere.
  const [accounts, setAccounts] = React.useState(ACCOUNTS);
  const [selectedAcct, setSelectedAcct] = React.useState("all");
  const [addAcct, setAddAcct] = React.useState(false);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const createAccount = (a) => setAccounts(list => [...list, a]);
  const setPrimary = (id) => setAccounts(list => list.map(a => ({ ...a, primary: a.id === id })));
  const deleteAccount = (id) => {
    setAccounts(list => list.filter(a => a.id !== id));
    setSelectedAcct(sel => sel === id ? "all" : sel);
  };

  // Savings goals state — create custom goals, deposit, delete.
  const [goals, setGoals] = React.useState(GOALS);
  const [addGoal, setAddGoal] = React.useState(false);
  const [depositGoal, setDepositGoal] = React.useState(null);
  const createGoal = (g) => setGoals(list => [...list, g]);
  const deleteGoal = (id) => setGoals(list => list.filter(g => g.id !== id));
  const depositToGoal = (id, amt) => setGoals(list => list.map(g => g.id === id ? { ...g, current: g.current + amt } : g));

  return (
    <div className="app" data-screen-label="Dashboard">
      <Sidebar active={active} onNav={setActive} variant={t.sidebarVariant} />

      <main style={{ minWidth: 0 }}>
        <TopBar
          theme={t.theme}
          onTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}
          onAdd={() => setModal(true)}
          accounts={accounts}
          selectedAcct={selectedAcct}
          onSelectAcct={setSelectedAcct}
          onAddAcct={() => setAddAcct(true)}
          notifEnabled={t.notifications}
        />

        {active === "dashboard" && (
          <div style={{
            padding: "16px 32px 40px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}>
            <div style={{ gridColumn: "span 4" }}>
              <KpiCards balanceVisible={balanceVisible} onToggleVisible={() => setBalanceVisible(v => !v)} totalBalance={totalBalance} accountCount={accounts.length} />
            </div>

            <CashflowCard />
            <SpendingCard />

            {t.showAI && <InsightsCard />}

            <TransactionsCard onAdd={() => setModal(true)} limit={8} onSeeAll={() => setActive("transactions")} />
            <SavingsCard goals={goals} onManage={() => setActive("savings")} />
            <BudgetsCard onManage={() => setActive("budgets")} />
          </div>
        )}

        {active === "budgets" && <BudgetsPage />}

        {active === "wallets" && (
          <WalletsPage accounts={accounts} onAdd={() => setAddAcct(true)} onSetPrimary={setPrimary} onDelete={deleteAccount} />
        )}

        {active === "reports" && <ReportsPage />}

        {active === "analytics" && <AnalyticsPage />}

        {active === "savings" && (
          <SavingsPage goals={goals} onAdd={() => setAddGoal(true)} onDeposit={setDepositGoal} onDelete={deleteGoal} />
        )}

        {active === "transactions" && (
          <TransactionsPage accounts={accounts} onAdd={() => setModal(true)} />
        )}

        {active === "settings" && <SettingsPage t={t} setTweak={setTweak} />}

        {active !== "dashboard" && active !== "budgets" && active !== "wallets" && active !== "reports" && active !== "analytics" && active !== "savings" && active !== "transactions" && active !== "settings" && <Placeholder section={active} />}
      </main>

      <AddTransactionModal open={modal} onClose={() => setModal(false)} />
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
          <TweakRadio label="Sidebar" value={t.sidebarVariant} onChange={v => setTweak("sidebarVariant", v)}
            options={[
              { label: "Berlabel", value: "labeled" },
              { label: "Ringkas",  value: "compact" },
            ]} />
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

