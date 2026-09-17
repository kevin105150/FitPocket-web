package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.CustomFood
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomFoodDao {

    @Query("SELECT COUNT(DISTINCT LOWER(TRIM(name)) || '_' || LOWER(TRIM(brand))) FROM custom_foods")
    suspend fun getDistinctCustomFoodCount(): Int

    @Query("DELETE FROM custom_foods WHERE id NOT IN (SELECT MIN(id) FROM custom_foods GROUP BY LOWER(TRIM(name)), LOWER(TRIM(brand)))")
    suspend fun removeDuplicateCustomFoods()

    @Query("SELECT * FROM custom_foods ORDER BY updatedAt DESC")
    fun getAllCustomFoods(): Flow<List<CustomFood>>

    @Query("SELECT * FROM custom_foods WHERE name LIKE '%' || :query || '%' OR brand LIKE '%' || :query || '%' ORDER BY updatedAt DESC")
    fun searchCustomFoods(query: String): Flow<List<CustomFood>>

    @Query("SELECT * FROM custom_foods WHERE name = :name AND brand = :brand LIMIT 1")
    suspend fun getCustomFoodByNameAndBrand(name: String, brand: String): CustomFood?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomFood(food: CustomFood): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertCustomFoods(foods: List<CustomFood>): List<Long>

    @Update
    suspend fun updateCustomFood(food: CustomFood)

    @Delete
    suspend fun deleteCustomFood(food: CustomFood)

    @Query("DELETE FROM custom_foods WHERE id = :id")
    suspend fun deleteCustomFoodById(id: String)
}
