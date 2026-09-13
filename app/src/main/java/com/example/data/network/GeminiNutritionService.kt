package com.example.data.network

import com.example.BuildConfig
import com.example.data.model.FoodSearchResult
import android.graphics.Bitmap
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

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
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

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

    private fun callGeminiTextRaw(prompt: String, apiKey: String): GeminiRawResult {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=$apiKey"
        val jsonBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
            put("generationConfig", JSONObject().apply { put("temperature", 0.2) })
        }
        
        val request = Request.Builder()
            .url(url)
            .post(jsonBody.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            val errorBody = response.body?.string() ?: "Unknown error"
            throw Exception("API Error ${response.code}: $errorBody")
        }
        val responseBody = response.body?.string() ?: throw Exception("API 回傳結果為空")
        return try {
            val jsonObject = JSONObject(responseBody)
            var textResult: String? = null
            val candidates = jsonObject.optJSONArray("candidates")
            if (candidates != null && candidates.length() > 0) {
                val firstCandidate = candidates.getJSONObject(0)
                val content = firstCandidate.optJSONObject("content")
                val parts = content?.optJSONArray("parts")
                if (parts != null && parts.length() > 0) {
                    textResult = parts.getJSONObject(0).optString("text", "")
                }
            }
            val usageMetadata = jsonObject.optJSONObject("usageMetadata")
            val tokens = if (usageMetadata != null && usageMetadata.has("totalTokenCount")) {
                usageMetadata.optInt("totalTokenCount", 0)
            } else {
                (prompt.length / 3) + ((textResult?.length ?: 0) / 3) + 30
            }
            GeminiRawResult(textResult, if (tokens > 0) tokens else (prompt.length / 3 + 30))
        } catch (e: Exception) {
            GeminiRawResult(null, 0)
        }
    }

    private fun callGeminiImageRaw(prompt: String, bitmap: Bitmap, apiKey: String): GeminiRawResult {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=$apiKey"
        
        val base64Image = try {
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
            Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            throw Exception("圖片處理失敗: ${e.message}")
        }

        val jsonBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                        put(JSONObject().apply {
                            put("inlineData", JSONObject().apply {
                                put("mimeType", "image/jpeg")
                                put("data", base64Image)
                            })
                        })
                    })
                })
            })
            put("generationConfig", JSONObject().apply { put("temperature", 0.2) })
        }
        
        val request = Request.Builder()
            .url(url)
            .post(jsonBody.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            val errorBody = response.body?.string() ?: "Unknown error"
            throw Exception("API Error ${response.code}: $errorBody")
        }
        val responseBody = response.body?.string() ?: throw Exception("API 回傳結果為空")
        return try {
            val jsonObject = JSONObject(responseBody)
            var textResult: String? = null
            val candidates = jsonObject.optJSONArray("candidates")
            if (candidates != null && candidates.length() > 0) {
                val firstCandidate = candidates.getJSONObject(0)
                val content = firstCandidate.optJSONObject("content")
                val parts = content?.optJSONArray("parts")
                if (parts != null && parts.length() > 0) {
                    textResult = parts.getJSONObject(0).optString("text", "")
                }
            }
            val usageMetadata = jsonObject.optJSONObject("usageMetadata")
            val tokens = if (usageMetadata != null && usageMetadata.has("totalTokenCount")) {
                usageMetadata.optInt("totalTokenCount", 0)
            } else {
                (prompt.length / 3) + ((textResult?.length ?: 0) / 3) + 260
            }
            GeminiRawResult(textResult, if (tokens > 0) tokens else 260)
        } catch (e: Exception) {
            GeminiRawResult(null, 0)
        }
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

    suspend fun estimateNutrition(foodDescription: String, userApiKey: String? = null): Result<GeminiResponse<AiEstimatedNutrition>> = withContext(Dispatchers.IO) {
        val apiKey = resolveApiKey(userApiKey)
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("請先設定 Gemini API Key"))
        }

        val prompt = """
        請分析「$foodDescription」的熱量與營養成分標示。
        請以純 JSON 格式回傳，欄位必須包含以下內容（請注意都是數值，且以該食物一份的常見公克數為基準，並標示明確的份量）：
        - name: 食物或餐點名稱（例如：滷肉飯）
        - brand: 品牌或分類來源（例如：一般外食、家常菜、超商便當 等，如果是外食請填「一般外食」）
        - calories: 該份量之熱量卡路里（單位：kcal，數值）
        - carbs: 碳水化合物公克數（數值）
        - sugars: 糖公克數（數值，若無請填0）
        - fiber: 膳食纖維公克數（數值，若無請填0）
        - protein: 蛋白質公克數（數值）
        - fat: 脂肪公克數（數值）
        - sodium: 鈉毫克數（單位：mg，數值）
        - potassium: 鉀毫克數（單位：mg，數值）
        - servingAmount: 此估算餐點一份的常見重量或液體量（單位：g 或 ml，數值）
        - servingUnit: 份量單位（字串，例如 "g" 或 "ml"）
        - note: 營養分析簡要說明或小提示

        只需回傳純 JSON 格式，不要包含 ```json 或 Markdown 格式。
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
        請辨識這張圖片中的食物、飲料或餐點，並分析其估計的熱量與營養成分標示。
        請以純 JSON 格式回傳，欄位必須包含以下內容（請注意都是數值，且以該食物一份的常見公克數為基準，並標示明確的份量）：
        - name: 辨識出的食物或餐點名稱（例如：起司蛋餅）
        - brand: 品牌或分類來源（例如：一般外食、家常菜、超商便當 等，如果是外食請填「一般外食」）
        - calories: 該份量之熱量卡路里（單位：kcal，數值）
        - carbs: 碳水化合物公克數（數值）
        - sugars: 糖公克數（數值，若無請填0）
        - fiber: 膳食纖維公克數（數值，若無請填0）
        - protein: 蛋白質公克數（數值）
        - fat: 脂肪公克數（數值）
        - sodium: 鈉毫克數（單位：mg，數值）
        - potassium: 鉀毫克數（單位：mg，數值）
        - servingAmount: 此估算餐點一份的常見重量或液體量（單位：g 或 ml，數值）
        - servingUnit: 份量單位（字串，例如 "g" 或 "ml"）
        - note: 營養分析簡要說明或辨識提示

        只需回傳純 JSON 格式，不要包含 ```json 或 Markdown 格式。
        """.trimIndent()

        try {
            val rawResult = callGeminiImageRaw(prompt, bitmap, apiKey)
            if (rawResult.text != null) {
                val parsed = parseEstimatedNutrition(rawResult.text)
                Result.success(GeminiResponse(parsed, rawResult.totalTokens))
            } else {
                Result.failure(Exception("API 圖片辨識回傳結果為空"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
