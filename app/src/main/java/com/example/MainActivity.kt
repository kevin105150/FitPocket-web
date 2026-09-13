package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.example.data.DietRepository
import com.example.data.local.DietDatabase
import com.example.data.local.MealPreferences
import com.example.ui.DietViewModel
import com.example.ui.DietViewModelFactory
import com.example.ui.screens.MainContainerScreen
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  private val database by lazy { DietDatabase.getDatabase(this) }
  private val repository by lazy {
    DietRepository(
      database.foodRecordDao(),
      database.customFoodDao(),
      database.weightRecordDao(),
      database.workoutDao(),
      database.waterRecordDao(),
      database.muscleGroupDao(),
      database.exerciseDao()
    )
  }
  private val mealPreferences by lazy { MealPreferences(this) }
  private val viewModel: DietViewModel by viewModels {
    DietViewModelFactory(repository, mealPreferences)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // 啟動 App 時自動於背景全量同步食品資料庫（含本地衛福部官方庫、各大超商、在地食材與雲端庫）
    viewModel.syncAllFoodsWithCloudSilently()

    setContent {
      MyApplicationTheme {
        MainContainerScreen(viewModel = viewModel)
      }
    }
  }
}
