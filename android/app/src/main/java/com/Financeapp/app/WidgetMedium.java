package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Widget Medium 4x2 — karakter + Masuk/Keluar/Bersih bulan ini.
 * READ-ONLY: hanya menampilkan data dari SharedPreferences; tap → buka app.
 */
public class WidgetMedium extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            try { render(ctx, mgr, id); } catch (Exception ignored) {}
        }
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        try {
            SharedPreferences p = WidgetRenderer.prefs(ctx);
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_medium);

            v.setTextViewText(R.id.tv_month,   p.getString(WidgetRenderer.K_MONTH, "—"));
            v.setTextViewText(R.id.tv_income,  p.getString(WidgetRenderer.K_MASUK_SHORT,  "Rp 0"));
            v.setTextViewText(R.id.tv_expense, p.getString(WidgetRenderer.K_KELUAR_SHORT, "Rp 0"));
            // Nilai murni; label "Bersih" kini statis di layout (dua kolom rapi).
            v.setTextViewText(R.id.tv_net,     p.getString(WidgetRenderer.K_BERSIH, "Rp 0"));

            int charId = WidgetRenderer.charDrawable(ctx, p.getString(WidgetRenderer.K_CHAR, "char_happy"));
            if (charId != 0) v.setImageViewResource(R.id.iv_char, charId);

            v.setOnClickPendingIntent(R.id.widget_root, WidgetRenderer.openApp(ctx));

            mgr.updateAppWidget(id, v);
        } catch (Exception ignored) {}
    }

    /** Dipanggil dari {@link WidgetBridge} saat data berubah. */
    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetMedium.class));
        for (int id : ids) render(ctx, mgr, id);
    }
}
