import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './app';
import { PaywallProvider } from './components/PaywallProvider';
import { MoneyIQChatProvider } from './components/MoneyIQChat';
// TEMPORARY — debug tool for generateDebtProof(), see src/debug-debt-proof.jsx.
// REMOVE this import + the <DebugDebtProof /> line below once testing is confirmed OK.
import DebugDebtProof from './debug-debt-proof';

ReactDOM.createRoot(document.getElementById('root')).render(
  <PaywallProvider>
    <MoneyIQChatProvider>
      <App />
    </MoneyIQChatProvider>
    {import.meta.env.DEV && <DebugDebtProof />}
  </PaywallProvider>
);
