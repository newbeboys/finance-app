package com.Financeapp.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
// import android.graphics.Bitmap;        // DISABLED for test
// import android.graphics.BitmapFactory; // DISABLED for test

public final class WidgetRenderer {

    public static final String PREFS = "FinanceWidget";

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

    // charDrawable() and charBitmap() DISABLED for test — no image loading
    /*
    public static int charDrawable(Context ctx, String name) { ... }
    public static Bitmap charBitmap(Context ctx, String name) { ... }
    */

    private static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    public static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 100, i, piFlags());
    }

    public static PendingIntent addTx(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(ACTION_ADD_TX);
        i.putExtra(EXTRA_ACTION, VALUE_ADD_TX);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 101, i, piFlags());
    }
}
