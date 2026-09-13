package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.WeightRecord
import kotlinx.coroutines.flow.Flow

@Dao
interface WeightRecordDao {
    @Query("SELECT * FROM weight_records ORDER BY date DESC, createdAt DESC")
    fun getAllWeightRecords(): Flow<List<WeightRecord>>

    @Query("SELECT * FROM weight_records ORDER BY date DESC, createdAt DESC LIMIT 1")
    fun getLatestWeightRecord(): Flow<WeightRecord?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeightRecord(record: WeightRecord): Long

    @Update
    suspend fun updateWeightRecord(record: WeightRecord)

    @Delete
    suspend fun deleteWeightRecord(record: WeightRecord)

    @Query("DELETE FROM weight_records WHERE id = :id")
    suspend fun deleteWeightRecordById(id: Long)
}
