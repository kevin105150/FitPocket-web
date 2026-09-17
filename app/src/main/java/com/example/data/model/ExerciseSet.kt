package com.example.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "exercise_sets",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutExercise::class,
            parentColumns = ["id"],
            childColumns = ["exerciseId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("exerciseId")]
)
data class ExerciseSet(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val exerciseId: String,
    val setIndex: Int, // 1-based index (1, 2, 3...)
    val reps: Int,
    val weight: Double,
    val durationMinutes: Double? = null,
    val isCompleted: Boolean = false
)
