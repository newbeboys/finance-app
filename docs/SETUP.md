# Setup Guide — FinanceApp

## 1. Environment Variables

Salin `.env.example` menjadi `.env` lalu isi nilainya:

```bash
cp .env.example .env
```

### Supabase
Ambil dari **Supabase Dashboard → Project Settings → API**:
- `VITE_SUPABASE_URL` — Project URL
- `VITE_SUPABASE_ANON_KEY` — anon/public key (aman di client, dilindungi RLS)

### RevenueCat (Android)
1. Buka **RevenueCat Dashboard → [Project] → API Keys**
2. Di bagian **Public app-specific keys**, klik **+ New** untuk platform **Android**
3. Salin key tersebut ke `.env`:
   ```
   VITE_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxxx
   ```

---

## 2. GitHub Actions Build

Untuk build CI/CD (APK/AAB), tambahkan secret di **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name                    | Nilai                                     |
|--------------------------------|-------------------------------------------|
| `REVENUECAT_API_KEY_ANDROID`   | Public Android API key dari RevenueCat    |

Pastikan workflow `build-apk.yml` inject secret ini sebagai env var saat build:

```yaml
- name: Build AAB
  env:
    VITE_REVENUECAT_API_KEY_ANDROID: ${{ secrets.REVENUECAT_API_KEY_ANDROID }}
  run: npm run build
```

---

## 3. Supabase Edge Functions

### Deploy Edge Function (revenuecat-webhook)

```bash
# Install Supabase CLI jika belum ada
npm install -g supabase

# Login
supabase login

# Link ke project
supabase link --project-ref ykyzgaztfbvwsjdcdpwk

# Set secret untuk webhook auth
supabase secrets set REVENUECAT_WEBHOOK_AUTH=your_shared_secret_here

# Deploy function
supabase functions deploy revenuecat-webhook
```

URL Edge Function setelah deploy:
```
https://ykyzgaztfbvwsjdcdpwk.supabase.co/functions/v1/revenuecat-webhook
```

### Setup Webhook di RevenueCat Dashboard

1. Buka **RevenueCat Dashboard → [Project] → Integrations → Webhooks**
2. Klik **+ New webhook**
3. Isi:
   - **URL**: `https://ykyzgaztfbvwsjdcdpwk.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header**: `Bearer your_shared_secret_here`
   - **Events**: centang semua (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE)
4. Klik **Save** lalu **Test webhook** untuk verifikasi koneksi

---

## 4. Database Migration

Jalankan migration di **Supabase Dashboard → SQL Editor**:

```bash
# Via Supabase CLI
supabase db push

# Atau copy-paste isi file ini ke SQL Editor:
# supabase/migrations/20260629000000_add_revenuecat_fields.sql
```

---

## 5. Checklist Testing Sebelum Build Production

- [ ] **Purchase test**: Buka app di device dengan akun Internal Testing track, lakukan purchase paket apapun
- [ ] **Verify webhook**: Cek **Supabase Dashboard → Edge Functions → revenuecat-webhook → Logs** — pastikan ada log event yang diterima
- [ ] **Verify DB update**: Cek tabel `user_subscriptions` di Supabase — pastikan kolom `plan` berubah ke `'pro'` dan `expires_at` ter-set
- [ ] **Verify UI**: App harus menampilkan status Pro setelah purchase berhasil
- [ ] **Test restore**: Di device kedua (atau setelah reinstall), buka Settings → tap "Pulihkan Pembelian" → status harus kembali Pro
- [ ] **Test DEV guard**: Build production APK lalu buka DevTools — panggil `useSubscription().setPlanForTesting('pro')` dari console → harus muncul warning dan TIDAK mengubah plan

---

## 6. RevenueCat Dashboard Reference

- **Entitlement identifier**: `pro`
- **Offering identifier**: `default`
- **Package mapping**:
  | RC Package ID  | Produk Android                  | Harga      |
  |----------------|---------------------------------|------------|
  | `$rc_weekly`   | `pro_subscription:monthly`      | Rp 30.000  |
  | `$rc_monthly`  | `pro_subscription:semi-annual`  | Rp 140.000 |
  | `$rc_annual`   | `pro_subscription:annual`       | Rp 270.000 |

  > **Catatan**: Nama package RC secara semantik tidak cocok dengan produknya. Kode selalu menggunakan identifier RC (`$rc_weekly` dst.), bukan nama produk Android.
