package com.example.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "workout_exercises",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutRecord::class,
            parentColumns = ["id"],
            childColumns = ["workoutId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("workoutId")]
)
data class WorkoutExercise(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val workoutId: String,
    val name: String,
    val bodyPart: String? = null,
    val sets: Int,
    val reps: Int,
    val weight: Double,
    val supersetGroupId: Int? = null,
    val isCardio: Boolean = false
)
