package com.example.data.local

import androidx.room.*
import com.example.data.model.WorkoutRecord
import com.example.data.model.WorkoutExercise
import com.example.data.model.ExerciseSet
import kotlinx.coroutines.flow.Flow

@Dao
interface WorkoutDao {
    @Insert
    suspend fun insertWorkout(workout: WorkoutRecord): Long

    @Insert
    suspend fun insertExercise(exercise: WorkoutExercise): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExerciseSet(exerciseSet: ExerciseSet): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExerciseSets(sets: List<ExerciseSet>)

    @Query("SELECT * FROM workout_records ORDER BY date DESC, id DESC")
    fun getAllWorkouts(): Flow<List<WorkoutRecord>>

    @Query("SELECT * FROM workout_exercises WHERE workoutId = :workoutId")
    fun getExercisesForWorkout(workoutId: String): Flow<List<WorkoutExercise>>

    @Query("SELECT * FROM exercise_sets WHERE exerciseId = :exerciseId ORDER BY setIndex ASC")
    fun getSetsForExercise(exerciseId: String): Flow<List<ExerciseSet>>

    @Query("SELECT * FROM exercise_sets WHERE exerciseId = :exerciseId ORDER BY setIndex ASC")
    suspend fun getSetsForExerciseSync(exerciseId: String): List<ExerciseSet>

    @Transaction
    @Query("SELECT * FROM workout_records ORDER BY date DESC, id DESC")
    fun getWorkoutsWithExercises(): Flow<List<WorkoutWithExercises>>

    @Transaction
    @Query("SELECT * FROM workout_records WHERE date = :date ORDER BY id DESC")
    fun getWorkoutsWithExercisesByDate(date: String): Flow<List<WorkoutWithExercises>>

    @Query("SELECT * FROM workout_records WHERE date = :date LIMIT 1")
    suspend fun getWorkoutByDate(date: String): WorkoutRecord?

    @Update
    suspend fun updateWorkout(workout: WorkoutRecord)

    @Update
    suspend fun updateExercise(exercise: WorkoutExercise)

    @Update
    suspend fun updateExerciseSet(exerciseSet: ExerciseSet)

    @Delete
    suspend fun deleteWorkout(workout: WorkoutRecord)

    @Delete
    suspend fun deleteExercise(exercise: WorkoutExercise)

    @Delete
    suspend fun deleteExerciseSet(exerciseSet: ExerciseSet)

    @Query("DELETE FROM exercise_sets WHERE exerciseId = :exerciseId")
    suspend fun deleteSetsForExercise(exerciseId: String)

    @Query("SELECT DISTINCT bodyPart FROM workout_records WHERE bodyPart != ''")
    fun getUniqueBodyParts(): Flow<List<String>>

    @Query("SELECT DISTINCT name FROM workout_exercises WHERE name != ''")
    fun getUniqueExerciseNames(): Flow<List<String>>

    @Query("SELECT * FROM workout_exercises WHERE name = :name ORDER BY id DESC LIMIT 1")
    suspend fun getLastExerciseByName(name: String): WorkoutExercise?
}

data class ExerciseWithSets(
    @Embedded val exercise: WorkoutExercise,
    @Relation(
        parentColumn = "id",
        entityColumn = "exerciseId"
    )
    val sets: List<ExerciseSet>
)

data class WorkoutWithExercises(
    @Embedded val workout: WorkoutRecord,
    @Relation(
        parentColumn = "id",
        entityColumn = "workoutId",
        entity = WorkoutExercise::class
    )
    val exercises: List<ExerciseWithSets>
)

