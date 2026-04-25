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

## Suggested split for next tasks

### Phase 1 — Foundation
- Add Detekt/ktlint and GitHub Actions Android build checks.
- Add `buildSrc`/version catalog and dependency centralization.
- Add debug/release environment configs.

### Phase 2 — App architecture
- Add data/domain layers and repository contracts.
- Add Retrofit API client for auth + today endpoints.
- Add error mapping and offline cache (Room + DataStore).

### Phase 3 — Product flows
- Build login flow and session persistence.
- Build Today screen backed by real API data.
- Add basic instrumentation tests for startup + today happy path.
### Phase 4 — Polish
- Add CI checks for code formatting and linting.