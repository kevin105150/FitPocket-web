package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "workout_records")
data class WorkoutRecord(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val date: String, // YYYY-MM-DD
    val bodyPart: String,
    val note: String? = null
)
