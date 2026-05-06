# Intentionally empty for MVP.

# ---------------------------------------------------------------------------
# kotlinx.serialization
# ---------------------------------------------------------------------------
# Keep serializer companion objects and generated $$serializer classes.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep all classes annotated with @Serializable and their generated companions.
-keep,includedescriptorclasses class com.daynest.**$$serializer { *; }
-keepclassmembers @kotlinx.serialization.Serializable class com.daynest.** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-keepclasseswithmembers class com.daynest.** {
    @kotlinx.serialization.Serializable <fields>;
}

# ---------------------------------------------------------------------------
# Retrofit 3
# ---------------------------------------------------------------------------
-keepattributes Signature, Exceptions
# Retain service interfaces so Retrofit can create proxies.
-keep,allowobfuscation interface * {
    @retrofit3.http.* <methods>;
}
# Keep Kotlin suspend-function continuation types used by Retrofit's coroutine adapter.
-keep class kotlin.coroutines.Continuation

# ---------------------------------------------------------------------------
# OkHttp / Okio
# ---------------------------------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement

# ---------------------------------------------------------------------------
# Room
# ---------------------------------------------------------------------------
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keepclassmembers @androidx.room.Entity class * { *; }
-keep @androidx.room.Dao class *
-keepclassmembers @androidx.room.Dao class * { *; }
