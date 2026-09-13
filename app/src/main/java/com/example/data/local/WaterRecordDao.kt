package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import com.example.data.model.WaterRecord
import kotlinx.coroutines.flow.Flow

@Dao
interface WaterRecordDao {
    @Query("SELECT * FROM water_records WHERE date = :date ORDER BY timestamp DESC")
    fun getWaterRecordsForDate(date: String): Flow<List<WaterRecord>>

    @Insert
    suspend fun insertWaterRecord(record: WaterRecord)

    @Delete
    suspend fun deleteWaterRecord(record: WaterRecord)

    @Query("SELECT SUM(amountMl) FROM water_records WHERE date = :date")
    fun getTotalWaterForDate(date: String): Flow<Int?>
    
    @Query("SELECT * FROM water_records ORDER BY timestamp DESC")
    fun getAllWaterRecords(): Flow<List<WaterRecord>>
}
