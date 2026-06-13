package com.Financeapp.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Helper bersama untuk widget Medium & Large.
 * Menyimpan nama key SharedPreferences, resolve drawable karakter,
 * dan membangun PendingIntent (buka app / buka form tambah transaksi).
 *
 * Data ditulis oleh layer JS lewat plugin {@link WidgetBridge}. Widget ini READ-ONLY.
 */
public final class WidgetRenderer {

    public static final String PREFS = "FinanceWidget";

    // Key SharedPreferences (selaras dengan src/lib/widgetSync.js)
    public static final String K_MONTH        = "bulan_tahun";
    public static final String K_MONTH_SHORT  = "bulan_tahun_pendek";
    public static final String K_MASUK        = "total_masuk_bulan_ini";
    public static final String K_KELUAR       = "total_keluar_bulan_ini";
    public static final String K_BERSIH       = "saldo_bersih";
    public static final String K_MASUK_SHORT  = "masuk_short";
    public static final String K_KELUAR_SHORT = "keluar_short";
    public static final String K_PERSEN       = "persen_anggaran";
    public static final String K_PERSEN_LBL   = "persen_label";
    public static final String K_TX           = "transaksi_terakhir";
    public static final String K_CHAR         = "karakter_aktif";
    public static final String K_LAUNCH       = "launch_action";

    public static final String ACTION_ADD_TX  = "com.Financeapp.app.WIDGET_ADD_TX";
    public static final String EXTRA_ACTION   = "widget_action";
    public static final String VALUE_ADD_TX   = "add_tx";

    private WidgetRenderer() {}

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Resolve nama drawable karakter ("char_happy", dst). Fallback ke char_happy. */
    public static int charDrawable(Context ctx, String name) {
        if (name == null || name.isEmpty()) name = "char_happy";
        int id = ctx.getResources().getIdentifier(name, "drawable", ctx.getPackageName());
        if (id == 0) {
            id = ctx.getResources().getIdentifier("char_happy", "drawable", ctx.getPackageName());
        }
        return id;
    }

    private static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    /** Tap body widget → buka aplikasi. */
    public static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 100, i, piFlags());
    }

    /** Tombol "Catat Transaksi" → buka aplikasi + buka form tambah transaksi. */
    public static PendingIntent addTx(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(ACTION_ADD_TX);
        i.putExtra(EXTRA_ACTION, VALUE_ADD_TX);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 101, i, piFlags());
    }
}
