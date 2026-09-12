// Config khusus harness. Root = cwd (dijalankan dari root repo), jadi
// halamannya ada di /tests/harness/index.html.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // src/hooks/useTransactions.js dan src/lib/walletAccess.js sama-sama
      // mengimpor '../supabase'; keduanya dialihkan ke stub.
      { find: /^\.\.\/supabase$/, replacement: path.resolve('tests/harness/supabase-stub.js') },
    ],
  },
});
