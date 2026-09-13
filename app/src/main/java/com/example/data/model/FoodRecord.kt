package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class MealType(val displayName: String) {
    BREAKFAST("早餐"),
    LUNCH("午餐"),
    DINNER("晚餐"),
    SNACK("點心"),
    MEAL_5("餐點 5"),
    MEAL_6("餐點 6"),
    MEAL_7("餐點 7"),
    MEAL_8("餐點 8"),
    MEAL_9("餐點 9"),
    MEAL_10("餐點 10")
}

data class MealConfig(
    val mealType: MealType,
    val customName: String = mealType.displayName,
    val isCustom: Boolean = mealType.ordinal >= 4
) {
    val displayName: String get() = customName.ifBlank { mealType.displayName }
}

@Entity(tableName = "food_records")
data class FoodRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val mealType: MealType,
    val date: String, // YYYY-MM-DD
    val calories: Double, // kcal
    val carbs: Double, // g
    val sugars: Double = 0.0, // g
    val fiber: Double = 0.0, // g
    val protein: Double, // g
    val fat: Double, // g
    val sodium: Double = 0.0, // mg
    val potassium: Double = 0.0, // mg
    val amount: Double = 100.0,
    val unit: String = "g",
    val barcode: String? = null,
    val imageUrl: String? = null,
    val note: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "custom_foods")
data class CustomFood(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val brand: String = "",
    val caloriesPer100g: Double,
    val carbsPer100g: Double,
    val sugarsPer100g: Double = 0.0,
    val fiberPer100g: Double = 0.0,
    val proteinPer100g: Double,
    val fatPer100g: Double,
    val sodiumPer100g: Double = 0.0,
    val potassiumPer100g: Double = 0.0,
    val defaultServingAmount: Double = 100.0,
    val servingUnit: String = "g",
    val servingSizeText: String? = null,
    val imageUrl: String? = null,
    val barcode: String? = null,
    val updatedAt: Long = System.currentTimeMillis()
)
