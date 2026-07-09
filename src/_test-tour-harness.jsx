import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import DebtsPage from './debts-page';
import HutangPiutangTour from './components/HutangPiutangTour';

// TEMP harness — bypasses Supabase auth entirely, mounts DebtsPage +
// HutangPiutangTour directly with mock data, just for live browser
// verification (scrollY behavior, body.position, data-tour attrs).
// Not part of the app entry (src/main.jsx untouched); delete after use.

const mockDebts = Array.from({ length: 20 }, (_, i) => ({
  id: `d${i}`,
  type: i % 2 === 0 ? 'receivable' : 'payable',
  status: 'active',
  is_locked: false,
  person_name: `Orang ${i + 1}`,
  amount: 100000 * (i + 1),
  paid: 0,
  remaining: 100000 * (i + 1),
  due_date: null,
  note: '',
}));

function Harness() {
  const [tourActive, setTourActive] = React.useState(false);
  const [log, setLog] = React.useState([]);

  const pushLog = (msg) => setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)} ${msg}`]);

  return (
    <div>
      <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 99999, background: '#fff', border: '1px solid #000', padding: 8, fontSize: 11, maxWidth: 260 }}>
        <button id="start-tour-btn" onClick={() => { setTourActive(true); pushLog('tour started'); }}>Start Tour</button>
        <button id="reset-tour-btn" onClick={() => { setTourActive(false); pushLog('tour reset'); }}>Reset</button>
        <div id="tour-log" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{log.join('\n')}</div>
      </div>
      <DebtsPage
        debts={mockDebts}
        loading={false}
        createDebt={() => {}}
        addPayment={() => {}}
        markPaid={() => {}}
        deleteDebt={() => {}}
        getPayments={() => []}
        wallets={[]}
        isPro={false}
      />
      <HutangPiutangTour
        isActive={tourActive}
        onComplete={() => { setTourActive(false); pushLog('tour completed'); }}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Harness />);
