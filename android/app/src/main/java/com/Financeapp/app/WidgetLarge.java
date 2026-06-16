package com.Financeapp.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;

public class WidgetLarge extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context,
                         AppWidgetManager appWidgetManager,
                         int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            try {
                RemoteViews views = new RemoteViews(
                    context.getPackageName(),
                    R.layout.widget_large);
                views.setTextViewText(R.id.widget_title, "FinanceApp Large");
                views.setTextViewText(R.id.widget_subtitle, "Widget aktif!");
                appWidgetManager.updateAppWidget(appWidgetId, views);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetLarge.class));
        AppWidgetProvider dummy = new WidgetLarge();
        dummy.onUpdate(ctx, mgr, ids);
    }
}
