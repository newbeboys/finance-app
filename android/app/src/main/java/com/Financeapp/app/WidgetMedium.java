package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
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

                // Keys sesuai WidgetBridge / widgetSync.js
                String masuk  = prefs.getString("masuk_short",      "Rp 0");
                String keluar = prefs.getString("keluar_short",     "Rp 0");
                String bulan  = prefs.getString("bulan_tahun",      "Bulan ini");

                RemoteViews views = new RemoteViews(
                    context.getPackageName(),
                    R.layout.widget_medium);

                views.setTextViewText(R.id.widget_title,  "FinanceApp");
                views.setTextViewText(R.id.widget_bulan,  bulan);
                views.setTextViewText(R.id.widget_masuk,  "↑ " + masuk);
                views.setTextViewText(R.id.widget_keluar, "↓ " + keluar);

                appWidgetManager.updateAppWidget(appWidgetId, views);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetMedium.class));
        new WidgetMedium().onUpdate(ctx, mgr, ids);
    }
}
