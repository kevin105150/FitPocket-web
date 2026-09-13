package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.data.model.MuscleGroup
import kotlinx.coroutines.flow.Flow

@Dao
interface MuscleGroupDao {
    @Query("SELECT * FROM muscle_groups WHERE name LIKE :query || '%'")
    fun searchMuscleGroups(query: String): Flow<List<MuscleGroup>>

    @Query("SELECT * FROM muscle_groups")
    fun getAllMuscleGroups(): Flow<List<MuscleGroup>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(muscleGroup: MuscleGroup)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(muscleGroups: List<MuscleGroup>)
}
