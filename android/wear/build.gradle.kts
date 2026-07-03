import com.android.build.api.dsl.ApplicationExtension
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

fun resolveApiUrl(
    key: String,
    envKey: String,
    default: String,
): String =
    localProperties.getProperty(key)
        ?: providers.gradleProperty(key).orNull
        ?: providers.environmentVariable(envKey).orNull
        ?: default

extensions.configure<ApplicationExtension> {
    namespace = "com.daynest.android"
    compileSdk = 37

    defaultConfig {
        applicationId = "im.tjor.daynest.wear"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            val url = resolveApiUrl("apiBaseUrlDebug", "API_BASE_URL_DEBUG", "http://10.0.2.2:8000/")
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val url =
                resolveApiUrl(
                    "apiBaseUrlRelease",
                    "ANDROID_API_BASE_URL",
                    "https://release.placeholder.invalid/",
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
    jvmTarget.set("17")
}

ktlint {
    android.set(true)
    outputToConsole.set(true)
}

dependencies {
    implementation(platform(libs.compose.bom))

    implementation(libs.androidx.core.ktx)
    implementation(libs.bundles.androidx.lifecycle)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.hilt.lifecycle.viewmodel.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
    ksp(libs.kotlin.metadata.jvm)

    implementation(libs.bundles.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.guava)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.wear.tiles)
    implementation(libs.androidx.wear.compose.foundation)
    implementation(libs.androidx.wear.compose.material)
    implementation(libs.androidx.watchface.complications.data.source.ktx)
    implementation(libs.play.services.wearable)

    testImplementation(libs.junit)
}
