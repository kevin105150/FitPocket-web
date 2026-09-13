package com.example.data.model

data class FoodSearchResult(
    val id: String,
    val name: String,
    val brand: String = "",
    val caloriesPer100g: Double,
    val carbsPer100g: Double,
    val sugarsPer100g: Double = 0.0,
    val fiberPer100g: Double = 0.0,
    val proteinPer100g: Double,
    val fatPer100g: Double,
    val sodiumPer100g: Double = 0.0, // mg
    val potassiumPer100g: Double = 0.0, // mg
    val defaultServingAmount: Double = 100.0,
    val servingUnit: String = "g",
    val servingSizeText: String? = null,
    val imageUrl: String? = null,
    val isLocalPreset: Boolean = false,
    val isUserCustom: Boolean = false,
    val barcode: String? = null
)
