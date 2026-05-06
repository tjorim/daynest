import com.android.build.api.dsl.ApplicationExtension
import io.gitlab.arturbosch.detekt.Detekt
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
    id("io.gitlab.arturbosch.detekt")
    id("org.jlleitschuh.gradle.ktlint")
}

val localProperties = Properties().also { props ->
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { props.load(it) }
    }
}

fun resolveApiUrl(key: String, envKey: String, required: Boolean, default: String = ""): String {
    val value = localProperties.getProperty(key)
        ?: providers.gradleProperty(key).orNull
        ?: System.getenv(envKey)
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

    defaultConfig {
        applicationId = "com.daynest.android"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            val url = resolveApiUrl(
                "apiBaseUrlDebug",
                "API_BASE_URL_DEBUG",
                required = false,
                default = "http://10.0.2.2:8000/",
            )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
        }
        create("staging") {
            initWith(getByName("debug"))
            matchingFallbacks += listOf("debug")
            val url = resolveApiUrl(
                "apiBaseUrlStaging",
                "API_BASE_URL_STAGING",
                required = true,
            )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val url = resolveApiUrl(
                "apiBaseUrlRelease",
                "API_BASE_URL_RELEASE",
                required = true,
            )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
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
    jvmTarget = "17"
}

ktlint {
    android.set(true)
    outputToConsole.set(true)
}

dependencies {
    val bom = platform("androidx.compose:compose-bom:2026.04.01")

    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.navigation:navigation-compose:2.9.8")
    implementation("androidx.hilt:hilt-navigation-compose:1.3.0")
    implementation("com.google.dagger:hilt-android:2.59.2")
    ksp("com.google.dagger:hilt-android-compiler:2.59.2")
    implementation(bom)
    androidTestImplementation(bom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("com.google.android.material:material:1.13.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    implementation("com.squareup.retrofit2:retrofit:3.0.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:3.0.0")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("com.squareup.okhttp3:logging-interceptor:5.3.2")
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("androidx.room:room-runtime:2.7.1")
    implementation("androidx.room:room-ktx:2.7.1")
    ksp("androidx.room:room-compiler:2.7.1")
    implementation("androidx.datastore:datastore-preferences:1.1.4")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:5.3.2")
    testImplementation("app.cash.turbine:turbine:1.2.1")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.room:room-testing:2.7.1")
}
