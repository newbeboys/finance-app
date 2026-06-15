---
name: android-build-jdk
description: How to run gradlew for this Capacitor Android project — JAVA_HOME is not set in the shell.
metadata:
  type: reference
---

`JAVA_HOME` is **not** set in this machine's shell and `java` isn't on PATH, so `gradlew` fails with "JAVA_HOME is not set". Use Android Studio's bundled JDK (JBR):

```
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& ".\android\gradlew.bat" -p ".\android" :app:processDebugMainManifest :app:compileDebugJavaWithJavac --console=plain
```

`processDebugMainManifest` validates AndroidManifest merges (e.g. FileProvider/permissions); `compileDebugJavaWithJavac` validates native plugin Java + that Gradle deps resolve. For a full APK: `:app:assembleDebug`.
