package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.example.data.model.CustomFood
import com.example.data.model.Exercise
import com.example.data.model.FoodRecord
import com.example.data.model.MealType
import com.example.data.model.MuscleGroup
import com.example.data.model.WaterRecord
import com.example.data.model.WeightRecord
import com.example.data.model.WorkoutExercise
import com.example.data.model.WorkoutRecord

class Converters {
    @TypeConverter
    fun fromMealType(value: MealType): String = value.name

    @TypeConverter
    fun toMealType(value: String): MealType = try {
        MealType.valueOf(value)
    } catch (e: Exception) {
        MealType.BREAKFAST
    }
}

@Database(
    entities = [
        FoodRecord::class,
        CustomFood::class,
        WeightRecord::class,
        WorkoutRecord::class,
        WorkoutExercise::class,
        com.example.data.model.ExerciseSet::class,
        WaterRecord::class,
        MuscleGroup::class,
        Exercise::class
    ],
    version = 10,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class DietDatabase : RoomDatabase() {

    abstract fun foodRecordDao(): FoodRecordDao
    abstract fun customFoodDao(): CustomFoodDao
    abstract fun weightRecordDao(): WeightRecordDao
    abstract fun workoutDao(): WorkoutDao
    abstract fun waterRecordDao(): WaterRecordDao
    abstract fun muscleGroupDao(): MuscleGroupDao
    abstract fun exerciseDao(): ExerciseDao

    companion object {
        @Volatile
        private var INSTANCE: DietDatabase? = null

        fun getDatabase(context: Context): DietDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    DietDatabase::class.java,
                    "diet_tracker_database"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }

        fun resetDatabaseInstance() {
            synchronized(this) {
                INSTANCE?.close()
                INSTANCE = null
            }
        }
    }
}
