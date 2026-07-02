# Daynest native Android app

This directory contains a native Android starter app using Kotlin + Jetpack Compose.

## Prerequisites
- Android Studio Iguana+ (or latest stable)
- Android SDK 35
- Java 17

## Open in Android Studio (Panda 4)
1. From Android Studio: **File > Open** and select the `android/` directory.
2. Let Gradle sync and install missing SDK packages.
3. Run the `app` configuration on an emulator/device.

> You do **not** import this as a module into another Android project. Open `android/` as its own Gradle project.

## CLI build (if Android SDK is configured)
```bash
cd android
./gradlew assembleDebug
```

## Release variant

The manual **Android Release APK** workflow (`.github/workflows/android-release.yml`)
and repository release workflow require these repository secrets before they build a
signed release APK:

- `KEYSTORE_BASE64`, `KEY_ALIAS`, `KEY_PASSWORD`, `STORE_PASSWORD` - release signing
- `DAYNEST_ANDROID_RELEASE_API_BASE_URL` - e.g. `https://daynest.tjor.im/`
- `DAYNEST_ANDROID_PROD_CERTIFICATE_PIN_HOST` - e.g. `daynest.tjor.im`
- `DAYNEST_ANDROID_PROD_CERTIFICATE_PINS` - comma-separated `sha256/<base64 SPKI hash>` pins,
  used for OkHttp certificate pinning in release builds

Release builds fail fast when these values are missing instead of silently shipping
an APK pointed at a placeholder host or stale certificate pins.

Prefer pinning the current issuing intermediate CA plus a backup such as the root
or documented rollover intermediate. Avoid leaf-only pinning: client-facing TLS is
terminated by the public edge, and routine leaf renewals can rotate the leaf key.

Regenerate pins with:

```bash
# Show the chain so you can identify the intermediate/root you want to pin
openssl s_client -connect daynest.tjor.im:443 -servername daynest.tjor.im \
  -showcerts </dev/null 2>/dev/null | grep -E "^(subject|issuer)="

# Compute the SPKI pin for chain certificate at index N (0=leaf, 1=intermediate, ...)
N=1
openssl s_client -connect daynest.tjor.im:443 -servername daynest.tjor.im \
  -showcerts </dev/null 2>/dev/null \
  | awk -v n="$N" '/BEGIN CERTIFICATE/{c++} c==n+1{print} /END CERTIFICATE/&&c==n+1{exit}' \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

## Current feature parity

The native app now exposes the same authenticated top-level product areas as the web app:

- Today
- Calendar
- Medication
- Templates
- Settings

Today is backed by the shared API read model. The other top-level areas currently provide native destination surfaces that mirror the web modules and will continue gaining editing controls from the shared backend contracts.

## Implementation status

### Foundation
- ✅ Detekt, ktlint, GitHub Actions Android build checks
- ✅ Debug / release build configs with per-environment API URLs
- ⬜ Gradle version catalog (`libs.versions.toml`) — tracked in [#156](https://github.com/tjorim/daynest/issues/156)

### App architecture
- ✅ Data / domain layers and repository contracts
- ✅ Retrofit API client (auth + all feature endpoints)
- ✅ Certificate pinning for production builds
- ✅ 401 auto-retry with transparent token refresh
- ✅ Offline cache via Room + DataStore

### Product flows
- ✅ Login flow and session persistence
- ✅ Today, Calendar, Medication, Templates, Settings screens backed by real API data
- ✅ Instrumented tests (navigation + home screen)
- ✅ Home-screen widgets (Glance): small 2×1 and medium 4×2, refreshed every 15 min via WorkManager
- ✅ Wear OS companion surface in dedicated `:wear` module: Today tile, short-text complication, and quick-action due list activity
