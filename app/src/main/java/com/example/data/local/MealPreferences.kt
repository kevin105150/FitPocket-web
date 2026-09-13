package com.example.data.local

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.example.data.model.CarbCycleType
import com.example.data.model.MealConfig
import com.example.data.model.MealType
import com.example.data.model.NutritionGoalPreset
import org.json.JSONArray
import org.json.JSONObject

class MealPreferences(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("diet_tracker_meal_prefs", Context.MODE_PRIVATE)

    private val securePrefs by lazy {
        try {
            val masterKey = MasterKey.Builder(context.applicationContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context.applicationContext,
                "diet_tracker_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e("MealPreferences", "Failed to initialize EncryptedSharedPreferences, falling back to standard prefs", e)
            null
        }
    }

    fun getActiveMeals(): List<MealConfig> {
        val savedJson = prefs.getString("active_meals_json", null)
        if (savedJson.isNullOrBlank()) {
            return defaultMeals()
        }
        return try {
            val array = JSONArray(savedJson)
            val list = mutableListOf<MealConfig>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val typeStr = obj.getString("type")
                val name = obj.getString("name")
                val isCustom = obj.optBoolean("isCustom", false)
                val type = try {
                    MealType.valueOf(typeStr)
                } catch (e: Exception) {
                    null
                }
                if (type != null) {
                    list.add(MealConfig(mealType = type, customName = name, isCustom = isCustom))
                }
            }
            if (list.isEmpty()) defaultMeals() else list
        } catch (e: Exception) {
            defaultMeals()
        }
    }

    fun saveActiveMeals(meals: List<MealConfig>) {
        val array = JSONArray()
        for (meal in meals) {
            val obj = JSONObject().apply {
                put("type", meal.mealType.name)
                put("name", meal.customName)
                put("isCustom", meal.isCustom)
            }
            array.put(obj)
        }
        prefs.edit().putString("active_meals_json", array.toString()).apply()
    }

    fun getTargetWeight(): Double {
        return prefs.getFloat("target_weight_kg", 65.0f).toDouble()
    }

    fun saveTargetWeight(weight: Double) {
        prefs.edit().putFloat("target_weight_kg", weight.toFloat()).apply()
    }

    fun getGoalPreset(type: CarbCycleType): NutritionGoalPreset {
        val defaultPreset = when (type) {
            CarbCycleType.HIGH -> NutritionGoalPreset(
                type = CarbCycleType.HIGH,
                calories = 2300,
                carbs = 350.0,
                fat = 40.0,
                protein = 135.0,
                sodium = 2400.0,
                potassium = 2600.0
            )
            CarbCycleType.MEDIUM -> NutritionGoalPreset(
                type = CarbCycleType.MEDIUM,
                calories = 2000,
                carbs = 240.0,
                fat = 56.0,
                protein = 134.0,
                sodium = 2400.0,
                potassium = 2500.0
            )
            CarbCycleType.LOW -> NutritionGoalPreset(
                type = CarbCycleType.LOW,
                calories = 1700,
                carbs = 100.0,
                fat = 76.0,
                protein = 154.0,
                sodium = 2400.0,
                potassium = 2500.0
            )
            CarbCycleType.CUSTOM -> NutritionGoalPreset(
                type = CarbCycleType.CUSTOM,
                calories = 2000,
                carbs = 225.0,
                fat = 60.0,
                protein = 140.0,
                sodium = 2400.0,
                potassium = 2500.0
            )
        }

        val prefix = "carb_preset_${type.name}_"
        val calories = prefs.getInt("${prefix}calories", defaultPreset.calories)
        val carbs = prefs.getFloat("${prefix}carbs", defaultPreset.carbs.toFloat()).toDouble()
        val fat = prefs.getFloat("${prefix}fat", defaultPreset.fat.toFloat()).toDouble()
        val protein = prefs.getFloat("${prefix}protein", defaultPreset.protein.toFloat()).toDouble()
        val sodium = prefs.getFloat("${prefix}sodium", defaultPreset.sodium.toFloat()).toDouble()
        val potassium = prefs.getFloat("${prefix}potassium", defaultPreset.potassium.toFloat()).toDouble()

        return NutritionGoalPreset(
            type = type,
            calories = calories,
            carbs = carbs,
            fat = fat,
            protein = protein,
            sodium = sodium,
            potassium = potassium
        )
    }

    fun saveGoalPreset(preset: NutritionGoalPreset) {
        val prefix = "carb_preset_${preset.type.name}_"
        prefs.edit()
            .putInt("${prefix}calories", preset.calories)
            .putFloat("${prefix}carbs", preset.carbs.toFloat())
            .putFloat("${prefix}fat", preset.fat.toFloat())
            .putFloat("${prefix}protein", preset.protein.toFloat())
            .putFloat("${prefix}sodium", preset.sodium.toFloat())
            .putFloat("${prefix}potassium", preset.potassium.toFloat())
            .apply()
    }

    fun getCarbCycleForDate(dateStr: String): CarbCycleType {
        val savedName = prefs.getString("date_carb_cycle_$dateStr", null)
            ?: prefs.getString("default_carb_cycle", CarbCycleType.MEDIUM.name)
        return try {
            CarbCycleType.valueOf(savedName ?: CarbCycleType.MEDIUM.name)
        } catch (e: Exception) {
            CarbCycleType.MEDIUM
        }
    }

    fun saveCarbCycleForDate(dateStr: String, type: CarbCycleType) {
        prefs.edit()
            .putString("date_carb_cycle_$dateStr", type.name)
            .putString("default_carb_cycle", type.name)
            .apply()
    }

    fun getWorkoutOrder(date: String): List<Long> {
        val saved = prefs.getString("workout_order_$date", null) ?: return emptyList()
        return saved.split(",").mapNotNull { it.toLongOrNull() }
    }

    fun saveWorkoutOrder(date: String, order: List<Long>) {
        prefs.edit().putString("workout_order_$date", order.joinToString(",")).apply()
    }

    fun getAiCallCount(): Int {
        return prefs.getInt("ai_call_count", 0)
    }

    fun incrementAiCallCount(): Int {
        val current = getAiCallCount()
        val next = current + 1
        prefs.edit().putInt("ai_call_count", next).apply()
        return next
    }

    fun getAiCallLimit(): Int {
        return prefs.getInt("ai_call_limit", 50)
    }

    fun setAiCallLimit(limit: Int) {
        prefs.edit().putInt("ai_call_limit", limit).apply()
    }

    fun resetAiCallCount() {
        prefs.edit().putInt("ai_call_count", 0).apply()
    }

    companion object {
        const val LOCKED_DEV_AI_CALL_LIMIT = 20
        const val LOCKED_DEV_AI_TOKEN_LIMIT = 50000
    }

    // Developer Key Call Statistics (Hard-locked to 20 uses, cannot be adjusted by user)
    fun getDevAiCallCount(): Int {
        return prefs.getInt("dev_ai_call_count", 0)
    }

    fun incrementDevAiCallCount(): Int {
        val current = getDevAiCallCount()
        val next = current + 1
        prefs.edit().putInt("dev_ai_call_count", next).apply()
        return next
    }

    fun getDevAiCallLimit(): Int {
        return LOCKED_DEV_AI_CALL_LIMIT
    }

    fun setDevAiCallLimit(limit: Int) {
        // Locked: Cannot be modified by user
        prefs.edit().putInt("dev_ai_call_limit", LOCKED_DEV_AI_CALL_LIMIT).apply()
    }

    fun resetDevAiCallCount() {
        // Internal only
        prefs.edit().putInt("dev_ai_call_count", 0).apply()
    }

    // Developer Key Token Statistics (Hard-locked to 50,000 Tokens)
    fun getDevAiTokenCount(): Int {
        return prefs.getInt("dev_ai_token_count", 0)
    }

    fun addDevAiTokenCount(tokens: Int): Int {
        val current = getDevAiTokenCount()
        val next = current + tokens
        prefs.edit().putInt("dev_ai_token_count", next).apply()
        return next
    }

    fun getDevAiTokenLimit(): Int {
        return LOCKED_DEV_AI_TOKEN_LIMIT
    }

    fun setDevAiTokenLimit(limit: Int) {
        prefs.edit().putInt("dev_ai_token_limit", LOCKED_DEV_AI_TOKEN_LIMIT).apply()
    }

    fun resetDevAiTokenCount() {
        prefs.edit().putInt("dev_ai_token_count", 0).apply()
    }

    // User Key Call Statistics
    fun getUserAiCallCount(): Int {
        return prefs.getInt("user_ai_call_count", 0)
    }

    fun incrementUserAiCallCount(): Int {
        val current = getUserAiCallCount()
        val next = current + 1
        prefs.edit().putInt("user_ai_call_count", next).apply()
        return next
    }

    fun getUserAiCallLimit(): Int {
        return prefs.getInt("user_ai_call_limit", 100)
    }

    fun setUserAiCallLimit(limit: Int) {
        prefs.edit().putInt("user_ai_call_limit", limit).apply()
    }

    fun resetUserAiCallCount() {
        prefs.edit().putInt("user_ai_call_count", 0).apply()
    }

    // User Key Token Statistics
    fun getUserAiTokenCount(): Int {
        return prefs.getInt("user_ai_token_count", 0)
    }

    fun addUserAiTokenCount(tokens: Int): Int {
        val current = getUserAiTokenCount()
        val next = current + tokens
        prefs.edit().putInt("user_ai_token_count", next).apply()
        return next
    }

    fun getUserAiTokenLimit(): Int {
        return prefs.getInt("user_ai_token_limit", 500000)
    }

    fun setUserAiTokenLimit(limit: Int) {
        prefs.edit().putInt("user_ai_token_limit", limit).apply()
    }

    fun resetUserAiTokenCount() {
        prefs.edit().putInt("user_ai_token_count", 0).apply()
    }

    fun getUserGeminiApiKey(): String {
        val secureKey = securePrefs?.getString("user_gemini_api_key", null)
        if (secureKey != null) {
            Log.d("MealPreferences", "Read key from secure storage")
            return secureKey
        }
        val plainKey = prefs.getString("user_gemini_api_key", "") ?: ""
        if (plainKey.isNotBlank()) {
            Log.d("MealPreferences", "Migrating key to secure storage")
            saveUserGeminiApiKey(plainKey)
            prefs.edit().remove("user_gemini_api_key").apply()
            return plainKey
        }
        Log.d("MealPreferences", "No API key found in secure or plain storage")
        return ""
    }

    fun saveUserGeminiApiKey(key: String) {
        val sp = securePrefs
        if (sp != null) {
            Log.d("MealPreferences", "Saving key to secure storage")
            sp.edit().putString("user_gemini_api_key", key).apply()
            prefs.edit().remove("user_gemini_api_key").apply()
        } else {
            Log.d("MealPreferences", "Saving key to standard storage (securePrefs null)")
            prefs.edit().putString("user_gemini_api_key", key).apply()
        }
    }

    fun getWaterGoal(): Int {
        return prefs.getInt("water_goal_ml", 2000)
    }

    fun saveWaterGoal(goalMl: Int) {
        prefs.edit().putInt("water_goal_ml", goalMl).apply()
    }

    fun getQuickAddWaterAmounts(): List<Int> {
        val saved = prefs.getString("quick_add_water_amounts", null)
        return if (saved.isNullOrBlank()) {
            listOf(150, 300, 500, 750, 1000)
        } else {
            saved.split(",").mapNotNull { it.toIntOrNull() }
        }
    }

    fun saveQuickAddWaterAmounts(amounts: List<Int>) {
        prefs.edit().putString("quick_add_water_amounts", amounts.joinToString(",")).apply()
    }

    fun getLastAiCvsUpdateTime(): Long {
        return prefs.getLong("last_ai_cvs_update_time", 0L)
    }
    fun saveLastAiCvsUpdateTime(time: Long) {
        prefs.edit().putLong("last_ai_cvs_update_time", time).apply()
    }

    fun getLastCvsUpdateTime(): Long {
        return prefs.getLong("last_cvs_update_time", 0L)
    }

    fun saveLastCvsUpdateTime(time: Long) {
        prefs.edit().putLong("last_cvs_update_time", time).apply()
    }

    fun getCvsUpdateCountToday(): Int {
        val todayStr = getTodayDateString()
        val savedDate = prefs.getString("cvs_update_date", "") ?: ""
        return if (savedDate == todayStr) {
            prefs.getInt("cvs_update_count", 0)
        } else {
            0
        }
    }

    fun incrementCvsUpdateCountToday(): Int {
        val todayStr = getTodayDateString()
        val savedDate = prefs.getString("cvs_update_date", "") ?: ""
        val newCount = if (savedDate == todayStr) {
            prefs.getInt("cvs_update_count", 0) + 1
        } else {
            1
        }
        prefs.edit()
            .putString("cvs_update_date", todayStr)
            .putInt("cvs_update_count", newCount)
            .putLong("last_cvs_update_time", System.currentTimeMillis())
            .apply()
        return newCount
    }

    fun getAiCvsUpdateCountToday(): Int {
        val todayStr = getTodayDateString()
        val savedDate = prefs.getString("ai_cvs_update_date", "") ?: ""
        return if (savedDate == todayStr) {
            prefs.getInt("ai_cvs_update_count", 0)
        } else {
            0
        }
    }

    fun incrementAiCvsUpdateCountToday(): Int {
        val todayStr = getTodayDateString()
        val savedDate = prefs.getString("ai_cvs_update_date", "") ?: ""
        val newCount = if (savedDate == todayStr) {
            prefs.getInt("ai_cvs_update_count", 0) + 1
        } else {
            1
        }
        prefs.edit()
            .putString("ai_cvs_update_date", todayStr)
            .putInt("ai_cvs_update_count", newCount)
            .putLong("last_ai_cvs_update_time", System.currentTimeMillis())
            .apply()
        return newCount
    }

    private fun getTodayDateString(): String {
        val cal = java.util.Calendar.getInstance()
        return "${cal.get(java.util.Calendar.YEAR)}-${cal.get(java.util.Calendar.DAY_OF_YEAR)}"
    }

    fun getLastSyncTimestamp(): Long = prefs.getLong("last_cloud_sync_timestamp", 0L)
    fun setLastSyncTimestamp(timestamp: Long) {
        prefs.edit().putLong("last_cloud_sync_timestamp", timestamp).apply()
    }

    private fun defaultMeals(): List<MealConfig> {
        return listOf(
            MealConfig(MealType.BREAKFAST, "早餐", isCustom = false),
            MealConfig(MealType.LUNCH, "午餐", isCustom = false),
            MealConfig(MealType.DINNER, "晚餐", isCustom = false),
            MealConfig(MealType.SNACK, "點心", isCustom = false)
        )
    }
}
