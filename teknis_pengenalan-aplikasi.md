# FinanceApp — Pengenalan & Ikhtisar Aplikasi

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-18 | **Versi App:** 2.6.0  
> **Tujuan:** Overview singkat aplikasi, model bisnis, tech stack, dan info dasar infrastruktur.

---

## Apa itu FinanceApp?

Aplikasi keuangan personal yang berjalan sebagai **aplikasi Android native** (via Capacitor) dan **web app**. Target user adalah individu yang ingin mencatat pengeluaran/pemasukan sehari-hari, memantau saldo beberapa dompet/rekening, mengelola anggaran, dan mencapai tujuan tabungan.

---

## Model Bisnis

**Freemium** dengan dua tier:
- **Basic** — gratis, dengan batasan jumlah data dan fitur
- **Pro** — berbayar (bulanan, 6 bulan, atau tahunan), tanpa batasan, fitur penuh

Pembayaran/upgrade dikelola melalui **Google Play Billing** via SDK **RevenueCat** (`@revenuecat/purchases-capacitor@13.2.0`). 

**Flow pembayaran:** 
1. User pilih plan → SDK RevenueCat memanggil Google Play Billing
2. Event webhook dari RevenueCat diterima Supabase Edge Function `revenuecat-webhook`
3. Field `plan` di tabel `user_subscriptions` diupdate
4. Realtime subscription di `useSubscription.js` mendeteksi perubahan
5. UI langsung berubah ke Pro

---

## Tech Stack Lengkap (dari `package.json` v2.6.0)

| Teknologi | Versi | Fungsi |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 6.0.0 | Build tool & dev server |
| @capacitor/core | 8.4.0 | Native Android bridge |
| @capacitor/android | 8.4.0 | Android platform layer |
| @capacitor/camera | 8.2.0 | Kamera untuk scan struk |
| @capacitor/filesystem | 8.1.2 | Simpan file PDF ke storage Android |
| @capacitor/share | 8.0.1 | Share dialog native Android |
| @capacitor/status-bar | 8.0.2 | Warna status bar Android |
| @aparajita/capacitor-biometric-auth | 10.0.0 | Autentikasi sidik jari/wajah |
| @revenuecat/purchases-capacitor | 13.2.0 | In-App Purchase & subscription management (Google Play Billing) |
| @supabase/supabase-js | 2.107.0 | Backend-as-a-Service (DB + Auth) |
| i18next | 26.3.1 | Internasionalisasi |
| react-i18next | 17.0.8 | React binding i18next |
| jspdf | 4.2.1 | Generate PDF di sisi client |
| jspdf-autotable | 5.0.8 | Tabel otomatis di PDF |
| exceljs | 4.4.0 | Generate file Excel (.xlsx) |
| html2canvas | 1.4.1 | Screenshot komponen HTML → jsPDF |
| lottie-react | 2.4.1 | Animasi Lottie |

**Dev dependencies:**
- `playwright` 1.60.0 (testing browser — ada tapi jarang dipakai dari kode)
- `md-to-pdf` 5.2.5 (konversi Markdown ke PDF)
- `cross-env` 10.1.0 (environment variable lintas OS saat build)

---

## Bahasa yang Didukung

- **Bahasa Indonesia** (`id`) — default
- **English** (`en`)

Preferensi bahasa disimpan di `localStorage` key `bahasa`. Managed oleh `i18next` + `react-i18next`.

---

## URL & Informasi Infrastruktur Dasar

- **Project URL Supabase:** `https://ykyzgaztfbvwsjdcdpwk.supabase.co`
  - URL ini hardcoded sebagai fallback di `src/supabase.js` selain dari env variable `VITE_SUPABASE_URL`
  - **Region:** `ap-south-1` — South Asia (Mumbai, India)

- **App ID Android (Capacitor):** `com.Financeapp.app`

- **Domain:** `finance-app.pro` — digunakan untuk email infrastruktur (Resend)

---

## Commands

```bash
npm run dev        # Vite dev server
npm run build       # Production build (bumps Node heap via cross-env NODE_OPTIONS — large app)
npm run preview     # Preview the production build
```

### Android / Capacitor
```bash
npx cap sync android          # setelah npm run build, sync web assets + plugins
cd android && ./gradlew bundleRelease   # produce signed AAB
```

### Supabase (backend)
```bash
supabase login
supabase link --project-ref ykyzgaztfbvwsjdcdpwk
supabase db push                              # apply migrations
supabase functions deploy <function-name>     # e.g. financial-chat
supabase secrets set KEY=value
```

### Environment Variables
Copy `.env.example` to `.env`. 

**Required:** 
- `VITE_SUPABASE_URL` 
- `VITE_SUPABASE_ANON_KEY` (anon key — safe for client, protected by RLS; never put the `service_role` key in client code)

**Optional:** 
- `VITE_REVENUECAT_API_KEY_ANDROID`

---

*Dokumen ini adalah bagian 1 dari 4 — lihat `teknis_arsitektur-database.md` untuk struktur teknis & database schema.*
