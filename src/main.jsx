import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './app';
import { PaywallProvider } from './components/PaywallProvider';
import { MoneyIQChatProvider } from './components/MoneyIQChat';

ReactDOM.createRoot(document.getElementById('root')).render(
  <PaywallProvider>
    <MoneyIQChatProvider>
      <App />
    </MoneyIQChatProvider>
  </PaywallProvider>
);
