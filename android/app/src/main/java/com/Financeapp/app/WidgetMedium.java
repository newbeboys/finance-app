package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;

public class WidgetMedium extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context,
                         AppWidgetManager appWidgetManager,
                         int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            try {
                SharedPreferences prefs = context
                    .getSharedPreferences("FinanceWidget", Context.MODE_PRIVATE);

                // masuk_short / keluar_short sudah diformat pendek oleh JS
                String masuk   = prefs.getString("masuk_short",    "Rp 0");
                String keluar  = prefs.getString("keluar_short",   "Rp 0");
                String bulan   = prefs.getString("bulan_tahun",    "Bulan ini");
                int    persen  = prefs.getInt("persen_anggaran",   0);
                String karakter = prefs.getString("karakter_aktif", "");

                RemoteViews views = new RemoteViews(
                    context.getPackageName(), R.layout.widget_medium);

                views.setTextViewText(R.id.widget_title,  "FinanceApp");
                views.setTextViewText(R.id.widget_bulan,  bulan);
                views.setTextViewText(R.id.widget_masuk,  "↑ " + masuk);
                views.setTextViewText(R.id.widget_keluar, "↓ " + keluar);

                // Gambar karakter — try-catch terpisah agar teks tetap tampil jika gagal
                String charName = resolveCharacter(karakter, persen);
                setCharacterImage(context, views, R.id.widget_character, charName);

                appWidgetManager.updateAppWidget(appWidgetId, views);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private String resolveCharacter(String fromPrefs, int persen) {
        // Prioritaskan nilai dari JS; fallback: hitung dari persentase anggaran
        if (fromPrefs != null && !fromPrefs.isEmpty()) return fromPrefs;
        if (persen >= 90) return "char_panic";
        if (persen >= 70) return "char_worried";
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

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetMedium.class));
        new WidgetMedium().onUpdate(ctx, mgr, ids);
    }
}
