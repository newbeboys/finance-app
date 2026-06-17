// Re-export tipis supaya struktur sesuai spec (main.jsx import dari sini).
// Implementasi sebenarnya ada di PaywallModal.jsx (context + provider + modal
// dikolokasi). Keduanya menunjuk instance context yang sama.
export { PaywallProvider, usePaywall, PaywallModal, LockBadge } from './PaywallModal';
