package com.Financeapp.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Daftarkan plugin native sebelum bridge diinisialisasi.
        registerPlugin(WidgetBridge.class);
        registerPlugin(MlkitOcrPlugin.class);
        super.onCreate(savedInstanceState);
        captureWidgetAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureWidgetAction(intent);
    }

    /**
     * Jika app dibuka lewat tombol widget ("Catat Transaksi"), simpan aksinya
     * ke SharedPreferences agar React bisa membuka form yang sesuai.
     */
    private void captureWidgetAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(WidgetRenderer.EXTRA_ACTION);
        if (action != null && !action.isEmpty()) {
            WidgetRenderer.prefs(this).edit()
                .putString(WidgetRenderer.K_LAUNCH, action)
                .apply();
        }
    }
}
