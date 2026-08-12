# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# ============================================
# RevenueCat — reflection untuk parse response Google Play Billing
# ============================================
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# ============================================
# Capacitor core & plugin bridge — WebView-to-Native pakai reflection
# ============================================
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
-keep class com.capacitorjs.** { *; }
-dontwarn com.capacitorjs.**

# ============================================
# Google ML Kit Text Recognition — model native, class stripping merusak inferensi OCR
# ============================================
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }

# ============================================
# Biometric Auth plugin — reflection untuk akses BiometricPrompt API native
# ============================================
-keep class com.aparajita.capacitor.biometricauth.** { *; }
-dontwarn com.aparajita.capacitor.biometricauth.**

# ============================================
# Umum: pertahankan info baris untuk baca stack trace crash report
# ============================================
-keepattributes SourceFile,LineNumberTable