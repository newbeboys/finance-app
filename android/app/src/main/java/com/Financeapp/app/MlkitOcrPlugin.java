package com.Financeapp.app;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;

/**
 * OCR struk via Google ML Kit Text Recognition (model Latin, bundled & offline).
 *
 * recognizeText({ path }) → { text }
 *   path = file path / file:// / content:// gambar hasil @capacitor/camera.
 * Tidak butuh internet. Layer JS (ScanStruk.jsx) yang mem-parsing teks-nya.
 */
@CapacitorPlugin(name = "MlkitOcr")
public class MlkitOcrPlugin extends Plugin {

    @PluginMethod
    public void recognizeText(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Path gambar kosong");
            return;
        }

        Uri uri;
        if (path.startsWith("content://") || path.startsWith("file://")) {
            uri = Uri.parse(path);
        } else {
            uri = Uri.fromFile(new File(path));
        }

        try {
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            recognizer.process(image)
                .addOnSuccessListener(result -> {
                    JSObject ret = new JSObject();
                    ret.put("text", result.getText());
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject("OCR gagal: " + e.getMessage(), e));
        } catch (Exception e) {
            call.reject("Gagal memproses gambar: " + e.getMessage(), e);
        }
    }
}
