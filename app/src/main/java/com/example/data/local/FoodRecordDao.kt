package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.FoodRecord
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodRecordDao {

    @Query("SELECT * FROM food_records WHERE date = :date ORDER BY createdAt DESC")
    fun getRecordsByDate(date: String): Flow<List<FoodRecord>>

    @Query("SELECT * FROM food_records ORDER BY createdAt DESC")
    fun getAllRecords(): Flow<List<FoodRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecord(record: FoodRecord): Long

    @Update
    suspend fun updateRecord(record: FoodRecord)

    @Delete
    suspend fun deleteRecord(record: FoodRecord)

    @Query("DELETE FROM food_records WHERE id = :id")
    suspend fun deleteRecordById(id: String)

    @Query("DELETE FROM food_records WHERE mealType = :mealType")
    suspend fun deleteRecordsByMealType(mealType: com.example.data.model.MealType)

    @Query("SELECT SUM(calories) FROM food_records WHERE date = :date")
    fun getTotalCaloriesForDate(date: String): Flow<Double?>
}
