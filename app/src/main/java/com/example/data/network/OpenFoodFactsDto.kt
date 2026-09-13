package com.example.data.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class OpenFoodFactsResponse(
    val count: Int? = 0,
    val page: Int? = 1,
    @Json(name = "page_size") val pageSize: Int? = 20,
    val products: List<ProductDto>? = emptyList()
)

@JsonClass(generateAdapter = true)
data class ProductBarcodeResponse(
    val status: Int? = 0,
    val code: Any? = null,
    val product: ProductDto? = null
)

@JsonClass(generateAdapter = true)
data class ProductDto(
    val code: Any? = null,
    @Json(name = "product_name") val productName: String? = null,
    @Json(name = "product_name_zh") val productNameZh: String? = null,
    @Json(name = "product_name_en") val productNameEn: String? = null,
    val brands: String? = null,
    @Json(name = "image_front_small_url") val imageFrontSmallUrl: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "serving_size") val servingSize: String? = null,
    @Json(name = "serving_quantity") val servingQuantity: Any? = null,
    val nutriments: Map<String, Any?>? = null
) {
    fun getResolvedCode(): String = code?.toString() ?: ""

    fun getResolvedName(): String {
        return productNameZh?.takeIf { it.isNotBlank() }
            ?: productName?.takeIf { it.isNotBlank() }
            ?: productNameEn?.takeIf { it.isNotBlank() }
            ?: "食品 (${getResolvedCode()})"
    }

    fun getServingQuantityDouble(): Double {
        return when (val sq = servingQuantity) {
            is Number -> sq.toDouble()
            is String -> sq.toDoubleOrNull() ?: 100.0
            else -> 100.0
        }
    }

    private fun extractNutrient(keys: List<String>): Double {
        val n = nutriments ?: return 0.0
        for (k in keys) {
            val v = n[k] ?: continue
            val num = when (v) {
                is Number -> v.toDouble()
                is String -> v.toDoubleOrNull()
                else -> null
            }
            if (num != null) return Math.round(num * 10.0) / 10.0
        }
        return 0.0
    }

    fun getCaloriesPer100g(): Double {
        val directKcal = extractNutrient(listOf("energy-kcal_100g", "energy-kcal", "energy-kcal_value"))
        if (directKcal > 0.0) return directKcal

        // Fallback to energy in kJ (1 kJ ≈ 0.239 kcal)
        val kj = extractNutrient(listOf("energy_100g", "energy-kj_100g", "energy_value"))
        if (kj > 0.0) {
            return Math.round(kj * 0.239 * 10.0) / 10.0
        }
        return 0.0
    }

    fun getProteinPer100g(): Double {
        return extractNutrient(listOf("proteins_100g", "proteins", "proteins_value"))
    }

    fun getCarbsPer100g(): Double {
        return extractNutrient(listOf("carbohydrates_100g", "carbohydrates", "carbohydrates_value"))
    }

    fun getSugarsPer100g(): Double {
        return extractNutrient(listOf("sugars_100g", "sugars", "sugars_value"))
    }

    fun getFiberPer100g(): Double {
        return extractNutrient(listOf("fiber_100g", "fiber", "fiber_value"))
    }

    fun getFatPer100g(): Double {
        return extractNutrient(listOf("fat_100g", "fat", "fat_value"))
    }

    // Return in mg
    fun getSodiumPer100g(): Double {
        val rawSodium = extractNutrient(listOf("sodium_100g", "sodium", "sodium_value"))
        if (rawSodium > 0.0) {
            // If <= 5, it's in grams, convert to mg
            return if (rawSodium <= 5.0) Math.round(rawSodium * 1000.0 * 10.0) / 10.0 else rawSodium
        }
        val salt = extractNutrient(listOf("salt_100g", "salt", "salt_value"))
        if (salt > 0.0) {
            val sodiumGrams = salt / 2.54
            return Math.round(sodiumGrams * 1000.0 * 10.0) / 10.0
        }
        return 0.0
    }

    // Return in mg
    fun getPotassiumPer100g(): Double {
        val rawPotassium = extractNutrient(listOf("potassium_100g", "potassium", "potassium_value"))
        if (rawPotassium > 0.0) {
            return if (rawPotassium <= 5.0) Math.round(rawPotassium * 1000.0 * 10.0) / 10.0 else rawPotassium
        }
        return 0.0
    }
}
