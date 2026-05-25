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
- ✅ Debug / staging / release build configs with per-environment API URLs
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