import com.android.build.api.dsl.ApplicationExtension
import com.daynest.buildlogic.CertPinning
import dev.detekt.gradle.Detekt
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
}

val localProperties =
    Properties().also { props ->
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localPropertiesFile.inputStream().use { props.load(it) }
        }
    }

val requestedTaskNames = gradle.startParameter.taskNames.map { it.substringAfterLast(":").lowercase() }

// Signing credentials only matter for tasks that produce a signed release
// artifact (assemble/bundle/install/package). Lint and unit tests compile and
// analyze the release variant but never sign anything, so lintRelease and
// testReleaseUnitTest must not require a keystore.
fun isReleaseArtifactRequested(): Boolean {
    if (requestedTaskNames.isEmpty()) {
        return false
    }

    val nonArtifactKeywords = listOf("test", "lint", "detekt", "ktlint")
    return requestedTaskNames.any { taskName ->
        (taskName.contains("release") && nonArtifactKeywords.none { taskName.contains(it) }) ||
            taskName in listOf("assemble", "build", "bundle")
    }
}

// Cert-pin helpers (resolvePins, pin-format and host-derivation validation,
// pinsArrayLiteral) live in buildSrc's CertPinning so they have unit tests.
fun resolvePins(
    key: String,
    envKey: String,
): List<String> =
    CertPinning.resolvePins(
        key = key,
        envKey = envKey,
        localProperty = localProperties::getProperty,
        gradleProperty = { providers.gradleProperty(it).orNull },
        env = { providers.environmentVariable(it).orNull },
    )

fun resolveConfigValue(
    key: String,
    envKey: String,
    required: Boolean,
    default: String = "",
): String {
    val value =
        localProperties.getProperty(key)
            ?: providers.gradleProperty(key).orNull
            ?: providers.environmentVariable(envKey).orNull
            ?: default.takeIf { it.isNotBlank() }
    if (required && value.isNullOrBlank()) {
        error(
            "Missing required build property '$key'. " +
                "Set it in local.properties, as a Gradle property, or as the env var '$envKey'.",
        )
    }
    return value.orEmpty()
}

extensions.configure<ApplicationExtension> {
    namespace = "com.daynest.android"
    compileSdk = 37

    val keystorePath =
        localProperties.getProperty("keystorePath") ?: providers.environmentVariable("KEYSTORE_PATH").orNull
    val keystorePassword =
        localProperties.getProperty("keystorePassword")
            ?: providers.environmentVariable("STORE_PASSWORD").orNull
    val keystoreKeyAlias =
        localProperties.getProperty("keyAlias") ?: providers.environmentVariable("KEY_ALIAS").orNull
    val keystoreKeyPassword =
        localProperties.getProperty("keyPassword") ?: providers.environmentVariable("KEY_PASSWORD").orNull
    signingConfigs {
        if (!keystorePath.isNullOrBlank() &&
            !keystorePassword.isNullOrBlank() &&
            !keystoreKeyAlias.isNullOrBlank() &&
            !keystoreKeyPassword.isNullOrBlank()
        ) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = keystorePassword
                keyAlias = keystoreKeyAlias
                keyPassword = keystoreKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "com.daynest.android"
        minSdk = 26
        targetSdk = 37
        // versionCode = MAJOR * 1000000 + MINOR * 1000 + PATCH (e.g. v1.2.3 → 1002003)
        versionCode = 1009
        versionName = "0.1.9"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            val url =
                resolveConfigValue(
                    "apiBaseUrlDebug",
                    "API_BASE_URL_DEBUG",
                    required = false,
                    default = "http://10.0.2.2:8000/",
                )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
            buildConfigField("String[]", "CERTIFICATE_PINS", "new String[]{}")
            buildConfigField("String", "CERTIFICATE_PIN_HOST", "\"\"")
            buildConfigField("String", "OIDC_CLIENT_ID", "\"daynest\"")
            buildConfigField("String", "OIDC_REDIRECT_URI", "\"com.daynest.android:/oauth2redirect\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            val releaseSigningConfig = signingConfigs.findByName("release")
            if (releaseSigningConfig != null) {
                signingConfig = releaseSigningConfig
            } else if (isReleaseArtifactRequested()) {
                error(
                    "Release build requested but signing credentials are not set " +
                        "(KEYSTORE_PATH, KEY_ALIAS, KEY_PASSWORD, STORE_PASSWORD).",
                )
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Same exclusion as the signing config above: lintRelease/testReleaseUnitTest
            // compile and analyze this variant but never ship it, so they must not
            // require the real production URL either.
            val isRequested = isReleaseArtifactRequested()
            val url =
                resolveConfigValue(
                    "apiBaseUrlRelease",
                    "ANDROID_API_BASE_URL",
                    required = isRequested,
                    default = if (isRequested) "" else "https://release.placeholder.invalid/",
                )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
            val releaseCertificatePinHost =
                resolveConfigValue(
                    "releaseCertificatePinHost",
                    "ANDROID_CERTIFICATE_PIN_HOST",
                    required = isRequested,
                    default = if (isRequested) "" else "release.placeholder.invalid",
                )
            val pins =
                resolvePins(
                    "releaseCertificatePins",
                    "ANDROID_CERTIFICATE_PINS",
                )
            if (isRequested) {
                if (pins.isEmpty()) {
                    error(
                        "Missing required build property 'releaseCertificatePins'. " +
                            "Set it in local.properties, as a Gradle property, or as the env var " +
                            "'ANDROID_CERTIFICATE_PINS'.",
                    )
                }
                CertPinning.requireValidPinFormats(pins)
                CertPinning.requireHostConfiguredForPins(releaseCertificatePinHost, pins)
            }
            buildConfigField("String[]", "CERTIFICATE_PINS", CertPinning.pinsArrayLiteral(pins))
            buildConfigField("String", "CERTIFICATE_PIN_HOST", "\"$releaseCertificatePinHost\"")
            buildConfigField("String", "OIDC_CLIENT_ID", "\"daynest\"")
            buildConfigField("String", "OIDC_REDIRECT_URI", "\"com.daynest.android:/oauth2redirect\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

detekt {
    buildUponDefaultConfig = true
    allRules = false
}

tasks.withType<Detekt>().configureEach {
    jvmTarget.set("17")
}

ktlint {
    android.set(true)
    outputToConsole.set(true)
}

dependencies {
    implementation(platform(libs.compose.bom))
    androidTestImplementation(platform(libs.compose.bom))

    implementation(libs.androidx.core.ktx)
    implementation(libs.bundles.androidx.lifecycle)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.hilt.lifecycle.viewmodel.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
    ksp(libs.kotlin.metadata.jvm)

    implementation(libs.bundles.compose)
    implementation(libs.material)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.openid.appauth)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.compiler)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.turbine)
    testImplementation(libs.mockk)
    testImplementation(libs.json)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.room.testing)
}
