package com.example.data.network

import com.example.BuildConfig
import com.example.data.model.FoodSearchResult
import android.graphics.Bitmap
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content

data class AiEstimatedNutrition(
    val name: String,
    val brand: String = "AI 搜尋",
    val calories: Double,
    val carbs: Double,
    val sugars: Double,
    val fiber: Double,
    val protein: Double,
    val fat: Double,
    val sodium: Double, // mg
    val potassium: Double, // mg
    val servingAmount: Double = 100.0,
    val servingUnit: String = "g",
    val isExactSearch: Boolean = false,
    val note: String = "AI 搜尋標示"
) {
    fun toFoodSearchResult(): FoodSearchResult {
        val factor = if (servingAmount > 0) 100.0 / servingAmount else 1.0
        return FoodSearchResult(
            id = "ai_${System.currentTimeMillis()}",
            name = name,
            brand = brand,
            caloriesPer100g = Math.round(calories * factor * 10.0) / 10.0,
            carbsPer100g = Math.round(carbs * factor * 10.0) / 10.0,
            sugarsPer100g = Math.round(sugars * factor * 10.0) / 10.0,
            fiberPer100g = Math.round(fiber * factor * 10.0) / 10.0,
            proteinPer100g = Math.round(protein * factor * 10.0) / 10.0,
            fatPer100g = Math.round(fat * factor * 10.0) / 10.0,
            sodiumPer100g = Math.round(sodium * factor * 10.0) / 10.0,
            potassiumPer100g = Math.round(potassium * factor * 10.0) / 10.0,
            defaultServingAmount = servingAmount,
            servingUnit = servingUnit,
            servingSizeText = "1份 (約${servingAmount.toInt()}${servingUnit})",
            isUserCustom = true
        )
    }
}

data class GeminiRawResult(
    val text: String?,
    val totalTokens: Int
)

data class GeminiResponse<T>(
    val data: T,
    val totalTokens: Int
)

object GeminiNutritionEstimator {

    private fun getDecryptedDeveloperKey(): String {
        return try {
            val encoded = "QVEuQWI4Uk42S2UzVWkyd2NVRWRCUU1EUFBuN05MWWR5R2YyU3ZZd0MwZFZxX1BEa2hDSGc="
            val decodedBytes = Base64.decode(encoded, Base64.DEFAULT)
            String(decodedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            ""
        }
    }

    private fun resolveApiKey(userApiKey: String?): String {
        if (!userApiKey.isNullOrBlank() && 
            userApiKey != "null" && 
            userApiKey != "YOUR_GEMINI_API_KEY" && 
            userApiKey != "MY_GEMINI_API_KEY") {
            return userApiKey
        }
        val configKey = BuildConfig.GEMINI_API_KEY
        if (!configKey.isNullOrBlank() && configKey != "MY_GEMINI_API_KEY" && configKey != "YOUR_GEMINI_API_KEY") {
            return configKey
        }
        return getDecryptedDeveloperKey()
    }

    suspend fun generateRawContent(prompt: String, userApiKey: String? = null): Result<GeminiResponse<String>> = withContext(Dispatchers.IO) {
        val apiKey = resolveApiKey(userApiKey)
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("請先設定 Gemini API Key 才能使用此功能。"))
        }
        
        var lastException: Exception? = null
        val maxAttempts = 3
        for (attempt in 1..maxAttempts) {
            try {
                val rawResult = callGeminiTextRaw(prompt, apiKey)
                if (rawResult.text != null) {
                    return@withContext Result.success(GeminiResponse(rawResult.text, rawResult.totalTokens))
                } else {
                    lastException = Exception("API 回傳結果為空或解析失敗")
                }
            } catch (e: Exception) {
                lastException = e
                val message = e.message ?: ""
                if (message.contains("503") || message.contains("429") || message.contains("UNAVAILABLE") || message.contains("high demand")) {
                    if (attempt < maxAttempts) {
                        kotlinx.coroutines.delay(1500L * attempt)
                        continue
                    }
                } else {
                    break
                }
            }
        }
        Result.failure(lastException ?: Exception("API 請求失敗"))
    }

    private suspend fun callGeminiTextRaw(prompt: String, apiKey: String): GeminiRawResult {
        val model = GenerativeModel(
            modelName = "gemini-3.5-flash",
            apiKey = apiKey
        )
        val response = model.generateContent(prompt)
        val tokens = response.usageMetadata?.totalTokenCount ?: ((prompt.length / 3) + (response.text?.length ?: 0) / 3 + 30)
        return GeminiRawResult(response.text, tokens)
    }

    private suspend fun callGeminiImageRaw(prompt: String, bitmap: Bitmap, apiKey: String): GeminiRawResult {
        val model = GenerativeModel(
            modelName = "gemini-3.5-flash",
            apiKey = apiKey
        )
        val input = content {
            image(bitmap)
            text(prompt)
        }
        val response = model.generateContent(input)
        val tokens = response.usageMetadata?.totalTokenCount ?: 260
        return GeminiRawResult(response.text, tokens)
    }

    private fun parseEstimatedNutrition(jsonStr: String): AiEstimatedNutrition {
        var cleanJson = jsonStr.trim()
        if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.substringAfter("\n")
        }
        if (cleanJson.endsWith("```")) {
            cleanJson = cleanJson.substringBeforeLast("```")
        }
        cleanJson = cleanJson.trim()
        if (cleanJson.startsWith("json")) {
            cleanJson = cleanJson.substring(4).trim()
        }

        val json = JSONObject(cleanJson)
        return AiEstimatedNutrition(
            name = json.optString("name", "未知名稱"),
            brand = json.optString("brand", "AI 搜尋"),
            calories = json.optDouble("calories", 0.0),
            carbs = json.optDouble("carbs", 0.0),
            sugars = json.optDouble("sugars", 0.0),
            fiber = json.optDouble("fiber", 0.0),
            protein = json.optDouble("protein", 0.0),
            fat = json.optDouble("fat", 0.0),
            sodium = json.optDouble("sodium", 0.0),
            potassium = json.optDouble("potassium", 0.0),
            servingAmount = json.optDouble("servingAmount", 100.0),
            servingUnit = json.optString("servingUnit", "g"),
            note = json.optString("note", "AI 搜尋標示")
        )
    }

    suspend fun generateWorkoutExercises(bodyPart: String, userApiKey: String? = null): Result<GeminiResponse<List<String>>> = withContext(Dispatchers.IO) {
        val apiKey = resolveApiKey(userApiKey)
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("請先設定 Gemini API Key"))
        }

        val prompt = "針對 $bodyPart 訓練，提供 5 個適合的專業健身動作名稱。請直接以 JSON 陣列格式回傳，例如 [\"深蹲\", \"硬舉\"]，不要包含 Markdown 或額外文字。"
        try {
            val rawResult = callGeminiTextRaw(prompt, apiKey)
            if (rawResult.text != null) {
                var cleanJson = rawResult.text.trim()
                if (cleanJson.startsWith("```")) {
                    cleanJson = cleanJson.substringAfter("\n")
                }
                if (cleanJson.endsWith("```")) {
                    cleanJson = cleanJson.substringBeforeLast("```")
                }
                cleanJson = cleanJson.trim()
                if (cleanJson.startsWith("json")) {
                    cleanJson = cleanJson.substring(4).trim()
                }
                val arr = JSONArray(cleanJson)
                val list = mutableListOf<String>()
                for (i in 0 until arr.length()) {
                    list.add(arr.getString(i))
                }
                Result.success(GeminiResponse(list, rawResult.totalTokens))
            } else {
                Result.failure(Exception("API 回傳結果為空"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun estimateNutrition(query: String, userApiKey: String? = null): Result<GeminiResponse<AiEstimatedNutrition>> = withContext(Dispatchers.IO) {
        val apiKey = resolveApiKey(userApiKey)
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("請先設定 Gemini API Key"))
        }

        val prompt = """
            請分析以下食物的營養成分：「$query」。
            如果這是一個完整的餐點或多項食物組合，請預估合理的總份量與總熱量。
            請以 JSON 格式回傳，必須包含以下欄位，且不要有額外的 Markdown (如 ```json)：
            {
                "name": "食物名稱(精煉後的官方名稱)",
                "brand": "品牌或來源(例如：自製、麥當勞、統一)",
                "calories": 總熱量(數值, kcal),
                "carbs": 總碳水化合物(數值, g),
                "sugars": 總糖分(數值, g),
                "fiber": 總膳食纖維(數值, g),
                "protein": 總蛋白質(數值, g),
                "fat": 總脂肪(數值, g),
                "sodium": 總鈉含量(數值, mg),
                "potassium": 總鉀含量(數值, mg),
                "servingAmount": 食物總重量(數值, 例如 100, 350 等),
                "servingUnit": "g 或 ml 等",
                "note": "簡短的備註，例如 '依據標準便當預估' 或 '1份'"
            }
        """.trimIndent()

        try {
            val rawResult = callGeminiTextRaw(prompt, apiKey)
            if (rawResult.text != null) {
                val parsed = parseEstimatedNutrition(rawResult.text)
                Result.success(GeminiResponse(parsed, rawResult.totalTokens))
            } else {
                Result.failure(Exception("API 回傳結果為空"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun analyzeImageNutrition(bitmap: Bitmap, userApiKey: String? = null): Result<GeminiResponse<AiEstimatedNutrition>> = withContext(Dispatchers.IO) {
        val apiKey = resolveApiKey(userApiKey)
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("請先設定 Gemini API Key"))
        }

        val prompt = """
            請分析圖片中的食物，並估算其營養成分與份量。
            如果這是一個完整的餐點或多項食物組合，請預估合理的總份量與總熱量。
            請以 JSON 格式回傳，必須包含以下欄位，且不要有額外的 Markdown (如 ```json)：
            {
                "name": "畫面中主要食物名稱的組合(簡潔明瞭)",
                "brand": "品牌或來源(若無法辨識請填寫 '視覺預估')",
                "calories": 總熱量(數值, kcal),
                "carbs": 總碳水化合物(數值, g),
                "sugars": 總糖分(數值, g),
                "fiber": 總膳食纖維(數值, g),
                "protein": 總蛋白質(數值, g),
                "fat": 總脂肪(數值, g),
                "sodium": 總鈉含量(數值, mg),
                "potassium": 總鉀含量(數值, mg),
                "servingAmount": 食物總重量(數值, 例如 100, 350 等),
                "servingUnit": "g 或 ml 等",
                "note": "簡短的備註，說明判斷依據或份量假設"
            }
        """.trimIndent()

        try {
            val rawResult = callGeminiImageRaw(prompt, bitmap, apiKey)
            if (rawResult.text != null) {
                val parsed = parseEstimatedNutrition(rawResult.text)
                Result.success(GeminiResponse(parsed, rawResult.totalTokens))
            } else {
                Result.failure(Exception("API 回傳結果為空"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
