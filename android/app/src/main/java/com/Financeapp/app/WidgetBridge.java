package com.Financeapp.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jembatan JS → SharedPreferences("FinanceWidget") yang dibaca widget.
 *
 *  - update(): tulis seluruh data ringkasan lalu refresh widget Medium & Large.
 *  - consumeLaunchAction(): ambil + hapus aksi peluncuran (mis. "add_tx" dari tombol widget),
 *    dipakai React untuk membuka form tambah transaksi.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = WidgetRenderer.prefs(ctx).edit();

        copyStr(e, call, WidgetRenderer.K_MONTH);
        copyStr(e, call, WidgetRenderer.K_MONTH_SHORT);
        copyStr(e, call, WidgetRenderer.K_MASUK);
        copyStr(e, call, WidgetRenderer.K_KELUAR);
        copyStr(e, call, WidgetRenderer.K_BERSIH);
        copyStr(e, call, WidgetRenderer.K_MASUK_SHORT);
        copyStr(e, call, WidgetRenderer.K_KELUAR_SHORT);
        copyStr(e, call, WidgetRenderer.K_PERSEN_LBL);
        copyStr(e, call, WidgetRenderer.K_TX);
        copyStr(e, call, WidgetRenderer.K_CHAR);
        e.putInt(WidgetRenderer.K_PERSEN, call.getInt(WidgetRenderer.K_PERSEN, 0));

        e.apply();

        WidgetMedium.updateAll(ctx);
        WidgetLarge.updateAll(ctx);

        call.resolve();
    }

    @PluginMethod
    public void consumeLaunchAction(PluginCall call) {
        SharedPreferences p = WidgetRenderer.prefs(getContext());
        String action = p.getString(WidgetRenderer.K_LAUNCH, "");
        if (action != null && !action.isEmpty()) {
            p.edit().remove(WidgetRenderer.K_LAUNCH).apply();
        }
        JSObject ret = new JSObject();
        ret.put("action", action == null ? "" : action);
        call.resolve(ret);
    }

    private static void copyStr(SharedPreferences.Editor e, PluginCall call, String key) {
        String val = call.getString(key, null);
        if (val != null) e.putString(key, val);
    }
}
