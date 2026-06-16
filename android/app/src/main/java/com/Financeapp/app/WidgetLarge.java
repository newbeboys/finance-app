package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;

public class WidgetLarge extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context,
                         AppWidgetManager appWidgetManager,
                         int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            try {
                SharedPreferences prefs = context
                    .getSharedPreferences("FinanceWidget", Context.MODE_PRIVATE);

                // Baca nilai mentah lalu format ulang agar ringkas
                String masukRaw  = prefs.getString("total_masuk_bulan_ini",  "0");
                String keluarRaw = prefs.getString("total_keluar_bulan_ini", "0");
                String bersihRaw = prefs.getString("saldo_bersih",           "0");
                String bulan     = prefs.getString("bulan_tahun",            "Bulan ini");
                int    persen    = prefs.getInt("persen_anggaran",           0);
                String karakter  = prefs.getString("karakter_aktif",         "");

                long masukVal  = parseAmount(masukRaw);
                long keluarVal = parseAmount(keluarRaw);
                long bersihVal = parseAmount(bersihRaw);
                boolean bersihNegatif = bersihRaw != null && bersihRaw.trim().startsWith("-");

                RemoteViews views = new RemoteViews(
                    context.getPackageName(), R.layout.widget_large);

                views.setTextViewText(R.id.widget_title,  "FinanceApp");
                views.setTextViewText(R.id.widget_bulan,  bulan);
                views.setTextViewText(R.id.widget_masuk,  "↑ " + formatNominal(masukVal));
                views.setTextViewText(R.id.widget_keluar, "↓ " + formatNominal(keluarVal));
                views.setTextViewText(R.id.widget_bersih,
                    (bersihNegatif ? "= -" : "= ") + formatNominal(bersihVal));

                // Gambar karakter — try-catch terpisah agar teks tetap tampil jika gagal
                String charName = resolveCharacter(karakter, persen, masukVal, keluarVal);
                setCharacterImage(context, views, R.id.widget_character, charName);

                appWidgetManager.updateAppWidget(appWidgetId, views);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private String resolveCharacter(String fromPrefs, int persen,
                                    long masuk, long keluar) {
        // Prioritaskan nilai dari JS
        if (fromPrefs != null && !fromPrefs.isEmpty()) return fromPrefs;
        // Hitung rasio pengeluaran terhadap pemasukan
        if (masuk > 0) {
            double ratio = (double) keluar / masuk * 100;
            if (ratio >= 90) return "char_panic";
            if (ratio >= 70) return "char_worried";
        } else {
            if (persen >= 90) return "char_panic";
            if (persen >= 70) return "char_worried";
        }
        return "char_happy";
    }

    private void setCharacterImage(Context context, RemoteViews views,
                                   int imageViewId, String karakterName) {
        try {
            int resId;
            switch (karakterName) {
                case "char_panic":     resId = R.drawable.char_panic;     break;
                case "char_worried":   resId = R.drawable.char_worried;   break;
                case "char_celebrate": resId = R.drawable.char_celebrate; break;
                default:               resId = R.drawable.char_happy;
            }

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = 4;
            opts.inScaled = false;

            Bitmap bmp = BitmapFactory.decodeResource(
                context.getResources(), resId, opts);
            if (bmp != null) {
                views.setImageViewBitmap(imageViewId, bmp);
            }
        } catch (Exception e) {
            e.printStackTrace();
            // Widget tetap tampil dengan teks meski gambar gagal
        }
    }

    private String formatNominal(long amount) {
        if (amount >= 1_000_000_000) {
            double val = amount / 1_000_000_000.0;
            if (val == Math.floor(val)) return "Rp " + (long) val + " M";
            return String.format("Rp %.2f M", val).replace(".", ",");
        } else if (amount >= 1_000_000) {
            double val = amount / 1_000_000.0;
            if (val == Math.floor(val)) return "Rp " + (long) val + " jt";
            return String.format("Rp %.1f jt", val).replace(".", ",");
        } else if (amount >= 1_000) {
            double val = amount / 1_000.0;
            if (val == Math.floor(val)) return "Rp " + (long) val + " rb";
            return String.format("Rp %.0f rb", val);
        }
        return "Rp " + amount;
    }

    /** Parse string rupiah Indonesia ("Rp 248.447.247.567") → angka mentah. */
    private long parseAmount(String s) {
        if (s == null || s.isEmpty()) return 0;
        // Hapus "Rp", spasi, titik (pemisah ribuan format ID)
        String clean = s.replace("Rp", "").replace(" ", "").replace(".", "");
        StringBuilder digits = new StringBuilder();
        for (char c : clean.toCharArray()) {
            if (Character.isDigit(c)) digits.append(c);
        }
        if (digits.length() == 0) return 0;
        try {
            return Long.parseLong(digits.toString());
        } catch (Exception e) {
            return 0;
        }
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetLarge.class));
        new WidgetLarge().onUpdate(ctx, mgr, ids);
    }
}
