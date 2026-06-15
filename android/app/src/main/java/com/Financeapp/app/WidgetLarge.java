package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget Large 4x4 — karakter besar, pemasukan/pengeluaran, progress anggaran,
 * 2 transaksi terakhir, dan tombol "Catat Transaksi".
 * READ-ONLY kecuali tombol Catat Transaksi (membuka form tambah transaksi).
 */
public class WidgetLarge extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            // Lindungi tiap widget: kegagalan satu instance tak boleh memicu
            // "Tidak dapat memuat widget" pada seluruh widget.
            try { render(ctx, mgr, id); } catch (Exception ignored) {}
        }
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        try {
            SharedPreferences p = WidgetRenderer.prefs(ctx);
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_large);

            v.setTextViewText(R.id.tv_month,   p.getString(WidgetRenderer.K_MONTH_SHORT, "—"));
            v.setTextViewText(R.id.tv_income,  p.getString(WidgetRenderer.K_MASUK,  "Rp 0"));
            v.setTextViewText(R.id.tv_expense, p.getString(WidgetRenderer.K_KELUAR, "Rp 0"));
            // Nilai murni; label "Bersih" kini statis di layout (dua kolom rapi).
            v.setTextViewText(R.id.tv_net,     p.getString(WidgetRenderer.K_BERSIH, "Rp 0"));

            int percent = p.getInt(WidgetRenderer.K_PERSEN, 0);
            v.setProgressBar(R.id.pb_budget, 100, Math.max(0, Math.min(100, percent)), false);
            v.setTextViewText(R.id.tv_percent, p.getString(WidgetRenderer.K_PERSEN_LBL, ""));

            Bitmap charBmp = WidgetRenderer.charBitmap(ctx, p.getString(WidgetRenderer.K_CHAR, "char_happy"));
            if (charBmp != null) v.setImageViewBitmap(R.id.iv_char, charBmp);

            bindTransactions(ctx, v, p.getString(WidgetRenderer.K_TX, "[]"));

            v.setOnClickPendingIntent(R.id.widget_root, WidgetRenderer.openApp(ctx));
            v.setOnClickPendingIntent(R.id.btn_add,     WidgetRenderer.addTx(ctx));

            mgr.updateAppWidget(id, v);
        } catch (Exception ignored) {
            // Jangan biarkan exception merambat ke AppWidgetHost → cegah error "can't load".
        }
    }

    private static void bindTransactions(Context ctx, RemoteViews v, String json) {
        int incomeColor  = ctx.getColor(R.color.widget_income);
        int expenseColor = ctx.getColor(R.color.widget_expense);
        try {
            JSONArray arr = new JSONArray(json);
            bindRow(v, arr, 0, R.id.row_tx1, R.id.tv_tx1_title, R.id.tv_tx1_amount, incomeColor, expenseColor);
            bindRow(v, arr, 1, R.id.row_tx2, R.id.tv_tx2_title, R.id.tv_tx2_amount, incomeColor, expenseColor);
        } catch (Exception e) {
            v.setViewVisibility(R.id.row_tx1, View.GONE);
            v.setViewVisibility(R.id.row_tx2, View.GONE);
        }
    }

    private static void bindRow(RemoteViews v, JSONArray arr, int idx,
                                int rowId, int titleId, int amountId,
                                int incomeColor, int expenseColor) {
        JSONObject o = arr.optJSONObject(idx);
        if (o == null) {
            v.setViewVisibility(rowId, View.GONE);
            return;
        }
        v.setViewVisibility(rowId, View.VISIBLE);
        v.setTextViewText(titleId, "• " + o.optString("title", "Transaksi"));
        v.setTextViewText(amountId, o.optString("amount", ""));
        v.setTextColor(amountId, o.optBoolean("positive", false) ? incomeColor : expenseColor);
    }

    /** Dipanggil dari {@link WidgetBridge} saat data berubah. */
    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetLarge.class));
        for (int id : ids) render(ctx, mgr, id);
    }
}
