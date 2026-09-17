package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

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
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val date: String, // YYYY-MM-DD
    val mealType: MealType,
    val sourceFoodId: String? = null,
    val barcode: String? = null,
    val brand: String? = null,
    val loggedAmount: Double, // actual amount consumed
    val loggedUnit: String,   // actual unit used (e.g. "份", "g", "ml")
    val name: String,
    val calories: Double, // kcal
    val carbs: Double, // g
    val sugars: Double = 0.0, // g
    val fiber: Double = 0.0, // g
    val protein: Double, // g
    val fat: Double, // g
    val sodium: Double = 0.0, // mg
    val potassium: Double = 0.0, // mg
    val note: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val aiSource: String? = null // "vision" | "estimation"
)

@Entity(tableName = "custom_foods")
data class CustomFood(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val brand: String = "",
    val calories: Double,
    val carbs: Double,
    val sugars: Double = 0.0,
    val fiber: Double = 0.0,
    val protein: Double,
    val fat: Double,
    val sodium: Double = 0.0,
    val potassium: Double = 0.0,
    val servingAmount: Double = 100.0,
    val servingUnit: String = "g",
    val imageUrl: String? = null,
    val barcode: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val aiSource: String? = null,
    val isSharedToCloud: Boolean = false
)
