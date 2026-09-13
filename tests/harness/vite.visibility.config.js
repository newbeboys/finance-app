// Config harness KHUSUS owner-visibility.harness.mjs. Root = cwd (dijalankan
// dari root repo), halamannya /tests/harness/visibility.html.
//
// Kenapa config terpisah dari vite.config.js: stub disuntik lewat ALIAS, dan
// alias itu berlaku untuk seluruh server — jadi satu config hanya bisa memakai
// satu stub. Dua harness butuh dua stub yang berbeda (lihat komentar di
// stub-visibility.js), jadi masing-masing punya config sendiri.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // src/hooks/useTransactions.js dan src/lib/walletAccess.js sama-sama
      // mengimpor '../supabase'; keduanya dialihkan ke stub visibility.
      { find: /^\.\.\/supabase$/, replacement: path.resolve('tests/harness/stub-visibility.js') },
    ],
  },
});
