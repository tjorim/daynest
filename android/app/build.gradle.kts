import com.android.build.api.dsl.ApplicationExtension
import dev.detekt.gradle.Detekt
import java.net.URI
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

fun isBuildTypeRequested(buildType: String): Boolean {
    if (requestedTaskNames.isEmpty()) {
        return false
    }

    val buildTypeName = buildType.lowercase()
    return requestedTaskNames.any { taskName ->
        taskName.contains(buildTypeName) ||
            taskName in listOf("assemble", "build", "bundle", "check", "lint", "test")
    }
}

fun resolvePins(
    key: String,
    envKey: String,
): List<String> {
    val value =
        localProperties.getProperty(key)
            ?: providers.gradleProperty(key).orNull
            ?: System.getenv(envKey)
    return value?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
}

fun pinsArrayLiteral(pins: List<String>): String =
    if (pins.isEmpty()) {
        "new String[]{}"
    } else {
        "new String[]{${pins.joinToString(",") { "\"$it\"" }}}"
    }

fun extractHost(url: String): String? = runCatching { URI(url).host }.getOrNull()

fun resolveApiUrl(
    key: String,
    envKey: String,
    required: Boolean,
    default: String = "",
): String {
    val value =
        localProperties.getProperty(key)
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
            val url =
                resolveApiUrl(
                    "apiBaseUrlDebug",
                    "API_BASE_URL_DEBUG",
                    required = false,
                    default = "http://10.0.2.2:8000/",
                )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
            buildConfigField("String[]", "PROD_PINS", "new String[]{}")
            buildConfigField("String", "PROD_HOST", "\"\"")
        }
        create("staging") {
            initWith(getByName("debug"))
            matchingFallbacks += listOf("debug")
            val isRequested = isBuildTypeRequested("staging")
            val url =
                resolveApiUrl(
                    "apiBaseUrlStaging",
                    "API_BASE_URL_STAGING",
                    required = isRequested,
                    default = if (isRequested) "" else "https://staging.placeholder.invalid/",
                )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
            buildConfigField("String[]", "PROD_PINS", "new String[]{}")
            buildConfigField("String", "PROD_HOST", "\"\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val isRequested = isBuildTypeRequested("release")
            val url =
                resolveApiUrl(
                    "apiBaseUrlRelease",
                    "API_BASE_URL_RELEASE",
                    required = isRequested,
                    default = if (isRequested) "" else "https://release.placeholder.invalid/",
                )
            buildConfigField("String", "API_BASE_URL", "\"$url\"")
            val pins = resolvePins("apiProdPins", "API_PROD_PINS")
            val invalidPins = pins.filter { !it.startsWith("sha256/") && !it.startsWith("sha1/") }
            if (invalidPins.isNotEmpty()) {
                error(
                    "Invalid pin format(s): $invalidPins. " +
                        "Pins must start with 'sha256/' or 'sha1/'.",
                )
            }
            val prodHost = extractHost(url)
            if (pins.isNotEmpty() && prodHost.isNullOrBlank()) {
                error(
                    "Could not extract host from release URL '$url'. " +
                        "Certificate pinning would be ineffective — fix API_BASE_URL_RELEASE.",
                )
            }
            buildConfigField("String[]", "PROD_PINS", pinsArrayLiteral(pins))
            buildConfigField("String", "PROD_HOST", "\"${prodHost.orEmpty()}\"")
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
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)

    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.material)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.datastore.preferences)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.turbine)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.room.testing)
}
