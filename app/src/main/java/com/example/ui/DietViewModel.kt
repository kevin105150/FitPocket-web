package com.example.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.CvsScraper
import com.example.data.DietRepository
import com.example.data.local.MealPreferences
import com.example.data.model.CarbCycleType
import com.example.data.model.CommonFoodsDatabase
import com.example.data.model.CustomFood
import com.example.data.model.FoodRecord
import com.example.data.model.FoodSearchResult
import com.example.data.model.MealConfig
import com.example.data.model.MealType
import com.example.data.model.NutritionGoalPreset
import com.example.data.network.AiEstimatedNutrition
import com.example.data.local.WorkoutWithExercises
import com.example.data.model.WorkoutExercise
import com.example.data.model.WorkoutRecord
import com.example.data.model.WaterRecord
import android.util.Log
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.delay
import org.jsoup.Jsoup
import java.util.Calendar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.first
import com.example.data.HtmlExportHelper
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.TimeZone
import java.util.Locale
import android.content.Context
import kotlinx.coroutines.Job
import com.example.ui.timer.TimerMode
import com.example.ui.timer.StopwatchLap
import com.example.ui.timer.WorkoutTimerState
import com.example.ui.timer.WorkoutTimerNotificationHelper
import com.example.ui.timer.WorkoutTimerReceiver
import com.example.ui.timer.WorkoutTimerFormatter

enum class SearchSource {
    COMMON_PRESETS,
    OPEN_FOOD_FACTS
}

data class AiBmrEstimateResult(
    val bmr: Int,
    val tdee: Int,
    val recommendedCalories: Int,
    val carbsGrams: Double,
    val proteinGrams: Double,
    val fatGrams: Double,
    val strategyTitle: String,
    val advice: String
)

class DietViewModel(
    private val repository: DietRepository,
    private val mealPreferences: MealPreferences? = null
) : ViewModel() {

    private val _activeMeals = MutableStateFlow<List<MealConfig>>(
        mealPreferences?.getActiveMeals() ?: listOf(
            MealConfig(MealType.BREAKFAST, "早餐", isCustom = false),
            MealConfig(MealType.LUNCH, "午餐", isCustom = false),
            MealConfig(MealType.DINNER, "晚餐", isCustom = false),
            MealConfig(MealType.SNACK, "點心", isCustom = false)
        )
    )
    val activeMeals: StateFlow<List<MealConfig>> = _activeMeals.asStateFlow()

    private val _devAiCallCount = MutableStateFlow(mealPreferences?.getDevAiCallCount() ?: 0)
    val devAiCallCount: StateFlow<Int> = _devAiCallCount.asStateFlow()

    private val _devAiCallLimit = MutableStateFlow(MealPreferences.LOCKED_DEV_AI_CALL_LIMIT)
    val devAiCallLimit: StateFlow<Int> = _devAiCallLimit.asStateFlow()

    private val _userAiCallCount = MutableStateFlow(mealPreferences?.getUserAiCallCount() ?: 0)
    val userAiCallCount: StateFlow<Int> = _userAiCallCount.asStateFlow()

    private val _userAiCallLimit = MutableStateFlow(mealPreferences?.getUserAiCallLimit() ?: 100)
    val userAiCallLimit: StateFlow<Int> = _userAiCallLimit.asStateFlow()

    private val _devAiTokenCount = MutableStateFlow(mealPreferences?.getDevAiTokenCount() ?: 0)
    val devAiTokenCount: StateFlow<Int> = _devAiTokenCount.asStateFlow()

    private val _devAiTokenLimit = MutableStateFlow(MealPreferences.LOCKED_DEV_AI_TOKEN_LIMIT)
    val devAiTokenLimit: StateFlow<Int> = _devAiTokenLimit.asStateFlow()

    private val _userAiTokenCount = MutableStateFlow(mealPreferences?.getUserAiTokenCount() ?: 0)
    val userAiTokenCount: StateFlow<Int> = _userAiTokenCount.asStateFlow()

    private val _userAiTokenLimit = MutableStateFlow(mealPreferences?.getUserAiTokenLimit() ?: 500000)
    val userAiTokenLimit: StateFlow<Int> = _userAiTokenLimit.asStateFlow()

    private val _userGeminiApiKey = MutableStateFlow(mealPreferences?.getUserGeminiApiKey() ?: "")
    val userGeminiApiKey: StateFlow<String> = _userGeminiApiKey.asStateFlow()

    private val _aiCallCount = MutableStateFlow(0)
    val aiCallCount: StateFlow<Int> = _aiCallCount.asStateFlow()

    private val _aiCallLimit = MutableStateFlow(MealPreferences.LOCKED_DEV_AI_CALL_LIMIT)
    val aiCallLimit: StateFlow<Int> = _aiCallLimit.asStateFlow()

    private val _aiTokenCount = MutableStateFlow(0)
    val aiTokenCount: StateFlow<Int> = _aiTokenCount.asStateFlow()

    private val _aiTokenLimit = MutableStateFlow(MealPreferences.LOCKED_DEV_AI_TOKEN_LIMIT)
    val aiTokenLimit: StateFlow<Int> = _aiTokenLimit.asStateFlow()

    init {
        updateActiveKeyStats()
        viewModelScope.launch(Dispatchers.IO) {
            delay(4000)
            repository.syncTrainingDictionariesWithCloud()
        }

        // Register workout timer notification broadcast receiver callbacks
        WorkoutTimerReceiver.onStopTimerListener = {
            dismissCountdownAlert()
        }
        WorkoutTimerReceiver.onRepeatTimerListener = { context, totalSec ->
            startCountdown(context, totalSec)
        }
    }

    override fun onCleared() {
        super.onCleared()
        WorkoutTimerNotificationHelper.stopVibration()
        WorkoutTimerReceiver.onStopTimerListener = null
        WorkoutTimerReceiver.onRepeatTimerListener = null
    }

    private fun isUsingCustomKey(key: String): Boolean {
        return key.isNotBlank() && 
               key != "null" && 
               key != "YOUR_GEMINI_API_KEY" && 
               key != "MY_GEMINI_API_KEY"
    }

    private fun updateActiveKeyStats() {
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            _aiCallCount.value = _userAiCallCount.value
            _aiCallLimit.value = _userAiCallLimit.value
            _aiTokenCount.value = _userAiTokenCount.value
            _aiTokenLimit.value = _userAiTokenLimit.value
        } else {
            _aiCallCount.value = _devAiCallCount.value
            _aiCallLimit.value = MealPreferences.LOCKED_DEV_AI_CALL_LIMIT
            _aiTokenCount.value = _devAiTokenCount.value
            _aiTokenLimit.value = MealPreferences.LOCKED_DEV_AI_TOKEN_LIMIT
        }
    }

    fun setDevAiCallLimit(limit: Int) {
        // Locked to 20 - cannot be changed by user
        _devAiCallLimit.value = MealPreferences.LOCKED_DEV_AI_CALL_LIMIT
        updateActiveKeyStats()
    }

    fun resetDevAiCallCount() {
        // Developer call count is locked and cannot be reset by user
        updateActiveKeyStats()
    }

    fun setUserAiCallLimit(limit: Int) {
        mealPreferences?.setUserAiCallLimit(limit)
        _userAiCallLimit.value = limit
        updateActiveKeyStats()
    }

    fun resetUserAiCallCount() {
        mealPreferences?.resetUserAiCallCount()
        _userAiCallCount.value = 0
        updateActiveKeyStats()
    }

    fun setAiCallLimit(limit: Int) {
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            setUserAiCallLimit(limit)
        }
    }

    fun resetAiCallCount() {
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            resetUserAiCallCount()
        }
    }

    fun setUserAiTokenLimit(limit: Int) {
        mealPreferences?.setUserAiTokenLimit(limit)
        _userAiTokenLimit.value = limit
        updateActiveKeyStats()
    }

    fun resetUserAiTokenCount() {
        mealPreferences?.resetUserAiTokenCount()
        _userAiTokenCount.value = 0
        updateActiveKeyStats()
    }

    fun setAiTokenLimit(limit: Int) {
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            setUserAiTokenLimit(limit)
        }
    }

    fun resetAiTokenCount() {
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            resetUserAiTokenCount()
        }
    }

    fun recordAiTokenUsage(tokens: Int) {
        if (tokens <= 0) return
        val prefs = mealPreferences ?: return
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        if (hasOwnKey) {
            val newTokens = prefs.addUserAiTokenCount(tokens)
            _userAiTokenCount.value = newTokens
        } else {
            val newTokens = prefs.addDevAiTokenCount(tokens)
            _devAiTokenCount.value = newTokens
        }
        updateActiveKeyStats()
    }

    fun saveUserGeminiApiKey(key: String) {
        mealPreferences?.saveUserGeminiApiKey(key)
        _userGeminiApiKey.value = key
        updateActiveKeyStats()
    }

    private fun checkAndIncrementAiCall(): Boolean {
        val prefs = mealPreferences ?: return true
        val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
        
        if (hasOwnKey) {
            val count = prefs.getUserAiCallCount()
            val limit = prefs.getUserAiCallLimit()
            val tokens = prefs.getUserAiTokenCount()
            val tokenLimit = prefs.getUserAiTokenLimit()
            if (count >= limit || tokens >= tokenLimit) {
                return false
            }
            val newCount = prefs.incrementUserAiCallCount()
            _userAiCallCount.value = newCount
            updateActiveKeyStats()
            return true
        } else {
            val count = prefs.getDevAiCallCount()
            val limit = prefs.getDevAiCallLimit()
            val tokens = prefs.getDevAiTokenCount()
            val tokenLimit = prefs.getDevAiTokenLimit()
            if (count >= limit || tokens >= tokenLimit) {
                return false
            }
            val newCount = prefs.incrementDevAiCallCount()
            _devAiCallCount.value = newCount
            updateActiveKeyStats()
            return true
        }
    }

    // --- Dictionary Suggestions ---
    private val _muscleGroupQuery = MutableStateFlow("")
    @OptIn(ExperimentalCoroutinesApi::class)
    val muscleGroupSuggestions: StateFlow<List<com.example.data.model.MuscleGroup>> = _muscleGroupQuery
        .flatMapLatest { query ->
            if (query.isBlank()) repository.getAllMuscleGroups()
            else repository.searchMuscleGroups(query)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateMuscleGroupQuery(query: String) {
        _muscleGroupQuery.value = query
    }

    private val _exerciseQuery = MutableStateFlow("")
    @OptIn(ExperimentalCoroutinesApi::class)
    val exerciseSuggestions: StateFlow<List<com.example.data.model.Exercise>> = _exerciseQuery
        .flatMapLatest { query ->
            if (query.isBlank()) repository.getAllExercises()
            else repository.searchExercises(query)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateExerciseQuery(query: String) {
        _exerciseQuery.value = query
    }

    private fun updateDictionaries(bodyPart: String?, exerciseNames: List<String>) {
        viewModelScope.launch {
            if (!bodyPart.isNullOrBlank()) {
                repository.insertMuscleGroup(com.example.data.model.MuscleGroup(bodyPart.trim()))
            }
            exerciseNames.forEach { name ->
                if (name.isNotBlank()) {
                    repository.insertExerciseDictionary(com.example.data.model.Exercise(name.trim()))
                }
            }
        }
    }

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val displayDateFormat = SimpleDateFormat("M月d日 EEEE", Locale.TAIWAN)

    private val _currentCalendar = MutableStateFlow(Calendar.getInstance())

    private val _selectedDateString = MutableStateFlow(dateFormat.format(Date()))
    val selectedDateString: StateFlow<String> = _selectedDateString.asStateFlow()

    private val _formattedDateDisplay = MutableStateFlow(formatDisplayDate(Date()))
    val formattedDateDisplay: StateFlow<String> = _formattedDateDisplay.asStateFlow()

    private val _highCarbPreset = MutableStateFlow(
        mealPreferences?.getGoalPreset(CarbCycleType.HIGH) ?: NutritionGoalPreset(
            type = CarbCycleType.HIGH,
            calories = 2300,
            carbs = 350.0,
            fat = 40.0,
            protein = 135.0,
            sodium = 2400.0,
            potassium = 2600.0
        )
    )
    val highCarbPreset: StateFlow<NutritionGoalPreset> = _highCarbPreset.asStateFlow()

    private val _mediumCarbPreset = MutableStateFlow(
        mealPreferences?.getGoalPreset(CarbCycleType.MEDIUM) ?: NutritionGoalPreset(
            type = CarbCycleType.MEDIUM,
            calories = 2000,
            carbs = 240.0,
            fat = 56.0,
            protein = 134.0,
            sodium = 2400.0,
            potassium = 2500.0
        )
    )
    val mediumCarbPreset: StateFlow<NutritionGoalPreset> = _mediumCarbPreset.asStateFlow()

    private val _lowCarbPreset = MutableStateFlow(
        mealPreferences?.getGoalPreset(CarbCycleType.LOW) ?: NutritionGoalPreset(
            type = CarbCycleType.LOW,
            calories = 1700,
            carbs = 100.0,
            fat = 76.0,
            protein = 154.0,
            sodium = 2400.0,
            potassium = 2500.0
        )
    )
    val lowCarbPreset: StateFlow<NutritionGoalPreset> = _lowCarbPreset.asStateFlow()

    private val _customCarbPreset = MutableStateFlow(
        mealPreferences?.getGoalPreset(CarbCycleType.CUSTOM) ?: NutritionGoalPreset(
            type = CarbCycleType.CUSTOM,
            calories = 2000,
            carbs = 225.0,
            fat = 60.0,
            protein = 140.0,
            sodium = 2400.0,
            potassium = 2500.0
        )
    )
    val customCarbPreset: StateFlow<NutritionGoalPreset> = _customCarbPreset.asStateFlow()

    private val _currentCarbCycleType = MutableStateFlow(
        mealPreferences?.getCarbCycleForDate(dateFormat.format(Date())) ?: CarbCycleType.MEDIUM
    )
    val currentCarbCycleType: StateFlow<CarbCycleType> = _currentCarbCycleType.asStateFlow()

    private val initialPreset = when (_currentCarbCycleType.value) {
        CarbCycleType.HIGH -> _highCarbPreset.value
        CarbCycleType.MEDIUM -> _mediumCarbPreset.value
        CarbCycleType.LOW -> _lowCarbPreset.value
        CarbCycleType.CUSTOM -> _customCarbPreset.value
    }

    private val _calorieGoal = MutableStateFlow(initialPreset.calories)
    val calorieGoal: StateFlow<Int> = _calorieGoal.asStateFlow()

    private val _carbsGoal = MutableStateFlow(initialPreset.carbs)
    val carbsGoal: StateFlow<Double> = _carbsGoal.asStateFlow()

    private val _fatGoal = MutableStateFlow(initialPreset.fat)
    val fatGoal: StateFlow<Double> = _fatGoal.asStateFlow()

    private val _proteinGoal = MutableStateFlow(initialPreset.protein)
    val proteinGoal: StateFlow<Double> = _proteinGoal.asStateFlow()

    private val _sodiumGoal = MutableStateFlow(initialPreset.sodium)
    val sodiumGoal: StateFlow<Double> = _sodiumGoal.asStateFlow()

    private val _potassiumGoal = MutableStateFlow(initialPreset.potassium)
    val potassiumGoal: StateFlow<Double> = _potassiumGoal.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val currentDayRecords: StateFlow<List<FoodRecord>> = _selectedDateString
        .flatMapLatest { date -> repository.getRecordsForDate(date) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val recentFoods: StateFlow<List<FoodRecord>> = repository.getAllRecords()
        .map { records ->
            records.distinctBy { it.name.trim().lowercase() }.take(25)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val myCustomFoods: StateFlow<List<CustomFood>> = repository.getAllCustomFoods()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    // Add Food Sheet State
    private val _showAddFoodSheet = MutableStateFlow(false)
    val showAddFoodSheet: StateFlow<Boolean> = _showAddFoodSheet.asStateFlow()

    private val _activeMealType = MutableStateFlow(MealType.BREAKFAST)
    val activeMealType: StateFlow<MealType> = _activeMealType.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _hasSearched = MutableStateFlow(false)
    val hasSearched: StateFlow<Boolean> = _hasSearched.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _searchError = MutableStateFlow<String?>(null)
    val searchError: StateFlow<String?> = _searchError.asStateFlow()

    private val _presetResults = MutableStateFlow<List<FoodSearchResult>>(emptyList())
    val presetResults: StateFlow<List<FoodSearchResult>> = _presetResults.asStateFlow()

    // Portion adjustment & Fine-tuning Dialog
    private val _selectedFoodItem = MutableStateFlow<FoodSearchResult?>(null)
    val selectedFoodItem: StateFlow<FoodSearchResult?> = _selectedFoodItem.asStateFlow()

    // Editing existing record dialog
    private val _editingRecord = MutableStateFlow<FoodRecord?>(null)
    val editingRecord: StateFlow<FoodRecord?> = _editingRecord.asStateFlow()

    // Goal Dialog
    private val _showGoalDialog = MutableStateFlow(false)
    val showGoalDialog: StateFlow<Boolean> = _showGoalDialog.asStateFlow()

    // Custom food manual entry dialog
    private val _showCustomFoodDialog = MutableStateFlow(false)
    val showCustomFoodDialog: StateFlow<Boolean> = _showCustomFoodDialog.asStateFlow()

    // AI Estimation State
    private val _isEstimatingAi = MutableStateFlow(false)
    val isEstimatingAi: StateFlow<Boolean> = _isEstimatingAi.asStateFlow()

    private val _aiEstimateResult = MutableStateFlow<AiEstimatedNutrition?>(null)
    val aiEstimateResult: StateFlow<AiEstimatedNutrition?> = _aiEstimateResult.asStateFlow()

    // Barcode Scanner Dialog State
    private val _showBarcodeScannerDialog = MutableStateFlow(false)
    val showBarcodeScannerDialog: StateFlow<Boolean> = _showBarcodeScannerDialog.asStateFlow()

    private val _isSearchingBarcode = MutableStateFlow(false)
    val isSearchingBarcode: StateFlow<Boolean> = _isSearchingBarcode.asStateFlow()

    private val _barcodeSearchError = MutableStateFlow<String?>(null)
    val barcodeSearchError: StateFlow<String?> = _barcodeSearchError.asStateFlow()

    // Photo Nutrition Scanner Dialog State (大取景拍照辨識)
    private val _showPhotoScannerDialog = MutableStateFlow(false)
    val showPhotoScannerDialog: StateFlow<Boolean> = _showPhotoScannerDialog.asStateFlow()

    private val _isAnalyzingPhoto = MutableStateFlow(false)
    val isAnalyzingPhoto: StateFlow<Boolean> = _isAnalyzingPhoto.asStateFlow()

    private val _photoAnalysisError = MutableStateFlow<String?>(null)
    val photoAnalysisError: StateFlow<String?> = _photoAnalysisError.asStateFlow()

    private val _customFoodCount = MutableStateFlow(0)
    val customFoodCount: StateFlow<Int> = _customFoodCount.asStateFlow()

    // Fixed preset count based on presetList (TFDA 252 + FamilyMart 70 + SevenEleven 10 + Common 41 = 373)
    val totalFoodCount: StateFlow<Int> = _customFoodCount.map { it + com.example.data.model.CommonFoodsDatabase.presetList.size }.stateIn(
        viewModelScope,
        SharingStarted.Lazily,
        com.example.data.model.CommonFoodsDatabase.presetList.size
    )

    init {
        loadGoalsForDate(_selectedDateString.value)
        refreshLocalFoods()
        refreshCustomFoodCount()
    }

    private fun refreshCustomFoodCount() {
        viewModelScope.launch {
            _customFoodCount.value = repository.getCustomFoodCount()
        }
    }

    private fun applyPresetToGoals(preset: NutritionGoalPreset) {
        _calorieGoal.value = preset.calories
        _carbsGoal.value = preset.carbs
        _fatGoal.value = preset.fat
        _proteinGoal.value = preset.protein
        _sodiumGoal.value = preset.sodium
        _potassiumGoal.value = preset.potassium
    }

    private fun loadGoalsForDate(dateStr: String) {
        val cycle = mealPreferences?.getCarbCycleForDate(dateStr) ?: CarbCycleType.MEDIUM
        _currentCarbCycleType.value = cycle
        val preset = when (cycle) {
            CarbCycleType.HIGH -> _highCarbPreset.value
            CarbCycleType.MEDIUM -> _mediumCarbPreset.value
            CarbCycleType.LOW -> _lowCarbPreset.value
            CarbCycleType.CUSTOM -> _customCarbPreset.value
        }
        applyPresetToGoals(preset)
    }

    fun setCarbCycleType(type: CarbCycleType) {
        _currentCarbCycleType.value = type
        mealPreferences?.saveCarbCycleForDate(_selectedDateString.value, type)
        val preset = when (type) {
            CarbCycleType.HIGH -> _highCarbPreset.value
            CarbCycleType.MEDIUM -> _mediumCarbPreset.value
            CarbCycleType.LOW -> _lowCarbPreset.value
            CarbCycleType.CUSTOM -> _customCarbPreset.value
        }
        applyPresetToGoals(preset)
    }

    fun saveCarbCyclePreset(preset: NutritionGoalPreset) {
        mealPreferences?.saveGoalPreset(preset)
        when (preset.type) {
            CarbCycleType.HIGH -> _highCarbPreset.value = preset
            CarbCycleType.MEDIUM -> _mediumCarbPreset.value = preset
            CarbCycleType.LOW -> _lowCarbPreset.value = preset
            CarbCycleType.CUSTOM -> _customCarbPreset.value = preset
        }
        if (_currentCarbCycleType.value == preset.type) {
            applyPresetToGoals(preset)
        }
    }

    private fun formatDisplayDate(date: Date): String {
        val todayStr = dateFormat.format(Date())
        val targetStr = dateFormat.format(date)
        val formatted = displayDateFormat.format(date)
        return when (targetStr) {
            todayStr -> "今天 · $formatted"
            else -> formatted
        }
    }

    fun previousDay() {
        val cal = _currentCalendar.value.clone() as Calendar
        cal.add(Calendar.DAY_OF_YEAR, -1)
        _currentCalendar.value = cal
        val newDate = dateFormat.format(cal.time)
        _selectedDateString.value = newDate
        _formattedDateDisplay.value = formatDisplayDate(cal.time)
        loadGoalsForDate(newDate)
    }

    fun nextDay() {
        val cal = _currentCalendar.value.clone() as Calendar
        cal.add(Calendar.DAY_OF_YEAR, 1)
        _currentCalendar.value = cal
        val newDate = dateFormat.format(cal.time)
        _selectedDateString.value = newDate
        _formattedDateDisplay.value = formatDisplayDate(cal.time)
        loadGoalsForDate(newDate)
    }

    fun setToday() {
        val cal = Calendar.getInstance()
        _currentCalendar.value = cal
        val newDate = dateFormat.format(cal.time)
        _selectedDateString.value = newDate
        _formattedDateDisplay.value = formatDisplayDate(cal.time)
        loadGoalsForDate(newDate)
    }

    fun setDateFromUtcMillis(utcMillis: Long) {
        val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            timeInMillis = utcMillis
        }
        val localCal = Calendar.getInstance().apply {
            set(utcCal.get(Calendar.YEAR), utcCal.get(Calendar.MONTH), utcCal.get(Calendar.DAY_OF_MONTH), 12, 0, 0)
        }
        _currentCalendar.value = localCal
        val newDate = dateFormat.format(localCal.time)
        _selectedDateString.value = newDate
        _formattedDateDisplay.value = formatDisplayDate(localCal.time)
        loadGoalsForDate(newDate)
    }

    private var searchJob: kotlinx.coroutines.Job? = null

    fun refreshLocalFoods(query: String = _searchQuery.value) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            val localResults = repository.getLocalAndCustomFoods(query)
            _presetResults.value = localResults

            val trimmed = query.trim()
            if (trimmed.length >= 2) {
                // Debounce to prevent hitting network while typing aggressively
                kotlinx.coroutines.delay(350)
                _isSearching.value = true
                val apiResult = repository.searchOpenFoodFacts(trimmed)
                apiResult.onSuccess { apiFoods ->
                    if (_searchQuery.value.trim() == trimmed) {
                        val merged = (localResults + apiFoods).distinctBy {
                            "${it.brand.trim().lowercase()}_${it.name.trim().lowercase()}"
                        }
                        _presetResults.value = merged
                    }
                }
                _isSearching.value = false
            }
        }
    }

    fun openAddFoodSheet(mealType: MealType) {
        _activeMealType.value = mealType
        _searchQuery.value = ""
        _hasSearched.value = false
        _searchError.value = null
        refreshLocalFoods("")
        _showAddFoodSheet.value = true
    }

    fun setActiveMealType(mealType: MealType) {
        _activeMealType.value = mealType
    }

    fun closeAddFoodSheet() {
        _showAddFoodSheet.value = false
        _selectedFoodItem.value = null
        _hasSearched.value = false
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        if (query.isBlank()) {
            _hasSearched.value = false
        }
        refreshLocalFoods(query)
    }

    fun performSearch(query: String = _searchQuery.value) {
        _searchQuery.value = query
        _hasSearched.value = query.isNotBlank()
        refreshLocalFoods(query)
    }

    fun resetSearchToHistory() {
        _searchQuery.value = ""
        _hasSearched.value = false
        refreshLocalFoods("")
    }

    fun openBarcodeScannerDialog() {
        _barcodeSearchError.value = null
        _isSearchingBarcode.value = false
        _showBarcodeScannerDialog.value = true
    }

    fun closeBarcodeScannerDialog() {
        _showBarcodeScannerDialog.value = false
        _barcodeSearchError.value = null
        _isSearchingBarcode.value = false
    }

    fun searchByBarcode(barcode: String) {
        val code = barcode.trim()
        if (code.isBlank()) {
            _barcodeSearchError.value = "請輸入有效的商品條碼"
            return
        }
        _isSearchingBarcode.value = true
        _barcodeSearchError.value = null

        viewModelScope.launch {
            val result = repository.searchByBarcode(code)
            result.onSuccess { foodResult ->
                _isSearchingBarcode.value = false
                _showBarcodeScannerDialog.value = false
                // Open portion dialog with the found product!
                _selectedFoodItem.value = foodResult
            }.onFailure { err ->
                _isSearchingBarcode.value = false
                _barcodeSearchError.value = err.message ?: "未在資料庫找到與此條碼符合的超商商品"
            }
        }
    }

    fun openPhotoScannerDialog(mealType: MealType? = null) {
        if (mealType != null) {
            _activeMealType.value = mealType
        }
        _photoAnalysisError.value = null
        _isAnalyzingPhoto.value = false
        _showPhotoScannerDialog.value = true
    }

    fun closePhotoScannerDialog() {
        _showPhotoScannerDialog.value = false
        _photoAnalysisError.value = null
        _isAnalyzingPhoto.value = false
    }

    fun analyzePhotoNutrition(bitmap: android.graphics.Bitmap) {
        _isAnalyzingPhoto.value = true
        Log.d("DietViewModel", "Photo Nutrition Scan: Key length=${_userGeminiApiKey.value.length}")
        _photoAnalysisError.value = null
        viewModelScope.launch {
            if (!checkAndIncrementAiCall()) {
                _isAnalyzingPhoto.value = false
                val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
                _photoAnalysisError.value = if (hasOwnKey) {
                    "已達自訂的 AI 呼叫上限（${_userAiCallLimit.value} 次）。您可以在「設定」中調高上限或重置次數。"
                } else {
                    "系統預設的免費體驗額度（共 20 次）已使用完畢。請前往「設定」輸入您專屬的 Gemini API Key 即可無限制使用 AI 拍照分析！"
                }
                return@launch
            }
            val result = repository.estimateWithGeminiImage(bitmap, _userGeminiApiKey.value)
            result.onSuccess { res ->
                recordAiTokenUsage(res.totalTokens)
                _isAnalyzingPhoto.value = false
                _showPhotoScannerDialog.value = false
                // Directly pop up the portion / edit dialog populated with extracted nutrition facts!
                _selectedFoodItem.value = res.data.toFoodSearchResult()
            }.onFailure { err ->
                _isAnalyzingPhoto.value = false
                _photoAnalysisError.value = err.message ?: "照片辨識失敗，請重試或換個角度"
            }
        }
    }

    fun selectRecordForPortion(record: FoodRecord) {
        val factor = if (record.amount > 0) 100.0 / record.amount else 1.0
        val searchResult = FoodSearchResult(
            id = "recent_${record.id}_${record.name.hashCode()}",
            name = record.name,
            brand = "歷程記錄",
            caloriesPer100g = Math.round(record.calories * factor * 10.0) / 10.0,
            carbsPer100g = Math.round(record.carbs * factor * 10.0) / 10.0,
            sugarsPer100g = Math.round(record.sugars * factor * 10.0) / 10.0,
            fiberPer100g = Math.round(record.fiber * factor * 10.0) / 10.0,
            proteinPer100g = Math.round(record.protein * factor * 10.0) / 10.0,
            fatPer100g = Math.round(record.fat * factor * 10.0) / 10.0,
            sodiumPer100g = Math.round(record.sodium * factor * 10.0) / 10.0,
            potassiumPer100g = Math.round(record.potassium * factor * 10.0) / 10.0,
            defaultServingAmount = record.amount,
            servingUnit = record.unit,
            servingSizeText = "1份 (${record.amount.toInt()}${record.unit})",
            imageUrl = record.imageUrl,
            isLocalPreset = false,
            isUserCustom = true,
            barcode = record.barcode
        )
        _selectedFoodItem.value = searchResult
    }

    fun quickAddRecord(record: FoodRecord) {
        confirmAddOrEditFood(
            foodName = record.name,
            mealType = _activeMealType.value,
            amount = record.amount,
            unit = record.unit,
            calories = record.calories,
            carbs = record.carbs,
            sugars = record.sugars,
            fiber = record.fiber,
            protein = record.protein,
            fat = record.fat,
            sodium = record.sodium,
            potassium = record.potassium,
            saveToCustomLibrary = false,
            brand = "歷程記錄",
            imageUrl = record.imageUrl,
            barcode = record.barcode,
            closeSheet = false // Don't close sheet for quick add animation
        )
    }

    fun selectCustomFoodForPortion(customFood: CustomFood) {
        val searchResult = FoodSearchResult(
            id = "custom_${customFood.id}",
            name = customFood.name,
            brand = customFood.brand,
            caloriesPer100g = customFood.caloriesPer100g,
            carbsPer100g = customFood.carbsPer100g,
            sugarsPer100g = customFood.sugarsPer100g,
            fiberPer100g = customFood.fiberPer100g,
            proteinPer100g = customFood.proteinPer100g,
            fatPer100g = customFood.fatPer100g,
            sodiumPer100g = customFood.sodiumPer100g,
            potassiumPer100g = customFood.potassiumPer100g,
            defaultServingAmount = customFood.defaultServingAmount,
            servingUnit = customFood.servingUnit,
            servingSizeText = customFood.servingSizeText,
            imageUrl = customFood.imageUrl,
            isLocalPreset = false,
            isUserCustom = true,
            barcode = customFood.barcode
        )
        _selectedFoodItem.value = searchResult
    }

    fun quickAddCustomFood(customFood: CustomFood) {
        val factor = customFood.defaultServingAmount / 100.0
        val cal = customFood.caloriesPer100g * factor
        val carbs = customFood.carbsPer100g * factor
        val sugars = customFood.sugarsPer100g * factor
        val fiber = customFood.fiberPer100g * factor
        val protein = customFood.proteinPer100g * factor
        val fat = customFood.fatPer100g * factor
        val sodium = customFood.sodiumPer100g * factor
        val potassium = customFood.potassiumPer100g * factor

        confirmAddOrEditFood(
            foodName = customFood.name,
            mealType = _activeMealType.value,
            amount = customFood.defaultServingAmount,
            unit = customFood.servingUnit,
            calories = cal,
            carbs = carbs,
            sugars = sugars,
            fiber = fiber,
            protein = protein,
            fat = fat,
            sodium = sodium,
            potassium = potassium,
            saveToCustomLibrary = false,
            brand = customFood.brand,
            imageUrl = customFood.imageUrl,
            barcode = customFood.barcode,
            closeSheet = false // Don't close sheet for quick add animation
        )
    }

    fun estimateNutritionForCustomFood(
        name: String,
        onResult: (calories: Double, protein: Double, carbs: Double, fat: Double, sugars: Double, fiber: Double, sodium: Double, potassium: Double, amount: Double, unit: String) -> Unit
    ) {
        if (name.isBlank()) return
        _isEstimatingAi.value = true
        viewModelScope.launch {
            val hasLimit = checkAndIncrementAiCall()
            val result = if (hasLimit) {
                repository.estimateWithGemini(name, _userGeminiApiKey.value)
            } else {
                Result.failure(Exception("AI_LIMIT_REACHED"))
            }
            result.onSuccess { res ->
                recordAiTokenUsage(res.totalTokens)
            }
            val estimated = result.map { it.data }.getOrElse { err ->
                val noteStr = if (err.message == "AI_LIMIT_REACHED" || !hasLimit) {
                    "已達自設 AI 上限，使用離線智慧估算"
                } else {
                    "估算失敗，使用離線智慧估算"
                }
                AiEstimatedNutrition(
                    name = name,
                    calories = 350.0,
                    carbs = 40.0,
                    sugars = 3.0,
                    fiber = 2.0,
                    protein = 15.0,
                    fat = 12.0,
                    sodium = 500.0,
                    potassium = 200.0,
                    note = noteStr
                )
            }
            onResult(
                estimated.calories,
                estimated.protein,
                estimated.carbs,
                estimated.fat,
                estimated.sugars,
                estimated.fiber,
                estimated.sodium,
                estimated.potassium,
                100.0,
                "g"
            )
            _isEstimatingAi.value = false
        }
    }

    fun estimateFoodWithAi(name: String) {
        if (name.isBlank()) return
        _isEstimatingAi.value = true
        Log.d("DietViewModel", "Estimate Food: Key length=${_userGeminiApiKey.value.length}")
        viewModelScope.launch {
            val hasLimit = checkAndIncrementAiCall()
            val result = if (hasLimit) {
                repository.estimateWithGemini(name, _userGeminiApiKey.value)
            } else {
                Result.failure(Exception("AI_LIMIT_REACHED"))
            }
            result.onSuccess { res ->
                recordAiTokenUsage(res.totalTokens)
                val estimated = res.data
                _aiEstimateResult.value = estimated
                // Open fine-tuning dialog for this AI result directly
                _selectedFoodItem.value = estimated.toFoodSearchResult()
            }.onFailure { err ->
                // Fallback
                val noteStr = if (err.message == "AI_LIMIT_REACHED" || !hasLimit) {
                    "已達自設 AI 上限，使用離線智慧估算"
                } else {
                    "估算失敗，使用離線智慧估算"
                }
                val fallback = AiEstimatedNutrition(
                    name = name,
                    calories = 350.0,
                    carbs = 40.0,
                    sugars = 3.0,
                    fiber = 2.0,
                    protein = 15.0,
                    fat = 12.0,
                    sodium = 500.0,
                    potassium = 200.0,
                    note = noteStr
                )
                _aiEstimateResult.value = fallback
                _selectedFoodItem.value = fallback.toFoodSearchResult()
            }
            _isEstimatingAi.value = false
        }
    }

    fun estimateNutritionFromImage(
        bitmap: android.graphics.Bitmap,
        onResult: ((AiEstimatedNutrition) -> Unit)? = null
    ) {
        _isEstimatingAi.value = true
        viewModelScope.launch {
            val hasLimit = checkAndIncrementAiCall()
            val result = if (hasLimit) {
                repository.estimateWithGeminiImage(bitmap, _userGeminiApiKey.value)
            } else {
                Result.failure(Exception("AI_LIMIT_REACHED"))
            }
            result.onSuccess { res ->
                recordAiTokenUsage(res.totalTokens)
            }
            val estimated = result.map { it.data }.getOrElse { err ->
                val noteStr = if (err.message == "AI_LIMIT_REACHED" || !hasLimit) {
                    "已達自設 AI 上限，使用離線智慧估算"
                } else {
                    "照片辨識失敗，使用離線智慧估算"
                }
                AiEstimatedNutrition(
                    name = "AI 辨識品項",
                    brand = "照片標示辨識",
                    calories = 350.0,
                    carbs = 40.0,
                    sugars = 3.0,
                    fiber = 2.0,
                    protein = 15.0,
                    fat = 12.0,
                    sodium = 500.0,
                    potassium = 200.0,
                    note = noteStr
                )
            }
            _aiEstimateResult.value = estimated
            if (onResult != null) {
                onResult(estimated)
            } else {
                _selectedFoodItem.value = estimated.toFoodSearchResult()
            }
            _isEstimatingAi.value = false
        }
    }

    fun selectFoodForPortion(food: FoodSearchResult) {
        _selectedFoodItem.value = food
        if (food.id.startsWith("off_")) {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    val customFood = CustomFood(
                        id = 0,
                        name = food.name,
                        brand = food.brand.ifBlank { "網路雲端庫" },
                        caloriesPer100g = food.caloriesPer100g,
                        carbsPer100g = food.carbsPer100g,
                        sugarsPer100g = food.sugarsPer100g,
                        fiberPer100g = food.fiberPer100g,
                        proteinPer100g = food.proteinPer100g,
                        fatPer100g = food.fatPer100g,
                        sodiumPer100g = food.sodiumPer100g,
                        potassiumPer100g = food.potassiumPer100g,
                        defaultServingAmount = food.defaultServingAmount,
                        servingUnit = food.servingUnit,
                        servingSizeText = food.servingSizeText,
                        imageUrl = food.imageUrl,
                        barcode = food.barcode,
                        updatedAt = System.currentTimeMillis()
                    )
                    repository.saveOrUpdateCustomFoods(listOf(customFood))
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun closePortionDialog() {
        _selectedFoodItem.value = null
    }

    fun startEditingRecord(record: FoodRecord) {
        _editingRecord.value = record
    }

    fun closeEditingRecord() {
        _editingRecord.value = null
    }

    fun confirmAddOrEditFood(
        foodName: String,
        mealType: MealType,
        amount: Double,
        unit: String,
        calories: Double,
        carbs: Double,
        sugars: Double,
        fiber: Double,
        protein: Double,
        fat: Double,
        sodium: Double,
        potassium: Double,
        saveToCustomLibrary: Boolean,
        brand: String = "",
        imageUrl: String? = null,
        barcode: String? = null,
        closeSheet: Boolean = true
    ) {
        viewModelScope.launch {
            val record = FoodRecord(
                name = foodName.trim().ifEmpty { "飲食記錄" },
                mealType = mealType,
                date = _selectedDateString.value,
                calories = calories,
                carbs = carbs,
                sugars = sugars,
                fiber = fiber,
                protein = protein,
                fat = fat,
                sodium = sodium,
                potassium = potassium,
                amount = amount,
                unit = unit,
                imageUrl = imageUrl,
                barcode = barcode
            )
            repository.insertFoodRecord(record)

            if (saveToCustomLibrary) {
                val factor = if (amount > 0) 100.0 / amount else 1.0
                val customFood = CustomFood(
                    name = foodName.trim(),
                    brand = brand.ifBlank { "我的自訂" },
                    caloriesPer100g = Math.round(calories * factor * 10.0) / 10.0,
                    carbsPer100g = Math.round(carbs * factor * 10.0) / 10.0,
                    sugarsPer100g = Math.round(sugars * factor * 10.0) / 10.0,
                    fiberPer100g = Math.round(fiber * factor * 10.0) / 10.0,
                    proteinPer100g = Math.round(protein * factor * 10.0) / 10.0,
                    fatPer100g = Math.round(fat * factor * 10.0) / 10.0,
                    sodiumPer100g = Math.round(sodium * factor * 10.0) / 10.0,
                    potassiumPer100g = Math.round(potassium * factor * 10.0) / 10.0,
                    defaultServingAmount = amount,
                    servingUnit = unit,
                    servingSizeText = "1份 (${amount.toInt()}$unit)",
                    imageUrl = imageUrl,
                    barcode = barcode
                )
                repository.saveCustomFood(customFood)
                refreshLocalFoods()
            }

            _selectedFoodItem.value = null
            if (closeSheet) {
                _showAddFoodSheet.value = false
            }
            _showCustomFoodDialog.value = false
        }
    }

    fun updateExistingRecord(
        id: Long,
        name: String,
        mealType: MealType,
        amount: Double,
        unit: String,
        calories: Double,
        carbs: Double,
        sugars: Double,
        fiber: Double,
        protein: Double,
        fat: Double,
        sodium: Double,
        potassium: Double,
        note: String? = null
    ) {
        viewModelScope.launch {
            val updated = FoodRecord(
                id = id,
                name = name.trim().ifEmpty { "飲食記錄" },
                mealType = mealType,
                date = _selectedDateString.value,
                calories = calories,
                carbs = carbs,
                sugars = sugars,
                fiber = fiber,
                protein = protein,
                fat = fat,
                sodium = sodium,
                potassium = potassium,
                amount = amount,
                unit = unit,
                note = note
            )
            repository.updateFoodRecord(updated)
            _editingRecord.value = null
        }
    }

    fun deleteRecord(record: FoodRecord) {
        viewModelScope.launch {
            repository.deleteFoodRecord(record)
            if (_editingRecord.value?.id == record.id) {
                _editingRecord.value = null
            }
        }
    }

    fun deleteCustomFood(customFood: CustomFood) {
        viewModelScope.launch {
            repository.deleteCustomFood(customFood.id)
            refreshLocalFoods(_searchQuery.value)
        }
    }

    fun openGoalDialog() {
        _showGoalDialog.value = true
    }

    fun closeGoalDialog() {
        _showGoalDialog.value = false
    }

    fun updateCalorieGoal(newGoal: Int) {
        if (newGoal in 500..8000) {
            _calorieGoal.value = newGoal
        }
        _showGoalDialog.value = false
    }

    fun updateNutritionGoals(
        calories: Int,
        carbs: Double,
        fat: Double,
        protein: Double,
        sodium: Double,
        potassium: Double
    ) {
        val updatedPreset = NutritionGoalPreset(
            type = _currentCarbCycleType.value,
            calories = if (calories in 500..10000) calories else _calorieGoal.value,
            carbs = if (carbs >= 0) carbs else _carbsGoal.value,
            fat = if (fat >= 0) fat else _fatGoal.value,
            protein = if (protein >= 0) protein else _proteinGoal.value,
            sodium = if (sodium >= 0) sodium else _sodiumGoal.value,
            potassium = if (potassium >= 0) potassium else _potassiumGoal.value
        )
        saveCarbCyclePreset(updatedPreset)
        _showGoalDialog.value = false
    }

    fun openCustomFoodDialog() {
        _showCustomFoodDialog.value = true
    }

    fun closeCustomFoodDialog() {
        _showCustomFoodDialog.value = false
    }

    fun getMealDisplayName(mealType: MealType): String {
        return _activeMeals.value.firstOrNull { it.mealType == mealType }?.displayName ?: mealType.displayName
    }

    fun addCustomMeal(name: String): Boolean {
        val current = _activeMeals.value
        if (current.size >= 10) return false
        val trimmed = name.trim()
        if (trimmed.isBlank()) return false

        val usedTypes = current.map { it.mealType }.toSet()
        val nextType = listOf(
            MealType.MEAL_5, MealType.MEAL_6, MealType.MEAL_7,
            MealType.MEAL_8, MealType.MEAL_9, MealType.MEAL_10
        ).firstOrNull { it !in usedTypes } ?: return false

        val updated = current + MealConfig(mealType = nextType, customName = trimmed, isCustom = true)
        _activeMeals.value = updated
        mealPreferences?.saveActiveMeals(updated)
        return true
    }

    fun moveMealUp(mealConfig: MealConfig) {
        val current = _activeMeals.value.toMutableList()
        val index = current.indexOfFirst { it.mealType == mealConfig.mealType }
        if (index > 0) {
            val item = current.removeAt(index)
            current.add(index - 1, item)
            _activeMeals.value = current
            mealPreferences?.saveActiveMeals(current)
        }
    }

    fun moveMealDown(mealConfig: MealConfig) {
        val current = _activeMeals.value.toMutableList()
        val index = current.indexOfFirst { it.mealType == mealConfig.mealType }
        if (index >= 0 && index < current.size - 1) {
            val item = current.removeAt(index)
            current.add(index + 1, item)
            _activeMeals.value = current
            mealPreferences?.saveActiveMeals(current)
        }
    }

    fun removeCustomMeal(mealType: MealType) {
        val updated = _activeMeals.value.filterNot { it.mealType == mealType && canDeleteMeal(it) }
        _activeMeals.value = updated
        mealPreferences?.saveActiveMeals(updated)
        viewModelScope.launch {
            repository.deleteRecordsByMealType(mealType)
        }
    }

    fun canDeleteMeal(mealConfig: MealConfig): Boolean {
        return true
    }

    // --- Weight Tracking States & Methods ---
    private val _targetWeightKg = MutableStateFlow(mealPreferences?.getTargetWeight() ?: 65.0)
    val targetWeightKg: StateFlow<Double> = _targetWeightKg.asStateFlow()

    private val _waterGoalMl = MutableStateFlow(mealPreferences?.getWaterGoal() ?: 2000)
    val waterGoalMl: StateFlow<Int> = _waterGoalMl.asStateFlow()

    private val _quickAddWaterAmounts = MutableStateFlow(mealPreferences?.getQuickAddWaterAmounts() ?: listOf(150, 300, 500, 750, 1000))
    val quickAddWaterAmounts: StateFlow<List<Int>> = _quickAddWaterAmounts.asStateFlow()

    fun setWaterGoal(goalMl: Int) {
        mealPreferences?.saveWaterGoal(goalMl)
        _waterGoalMl.value = goalMl
    }

    fun setQuickAddWaterAmounts(amounts: List<Int>) {
        mealPreferences?.saveQuickAddWaterAmounts(amounts)
        _quickAddWaterAmounts.value = amounts
    }

    private val _isUpdatingCvsDb = MutableStateFlow(false)
    val isUpdatingCvsDb: StateFlow<Boolean> = _isUpdatingCvsDb.asStateFlow()

    private val _updateCvsDbMessage = MutableStateFlow<String?>(null)
    val updateCvsDbMessage: StateFlow<String?> = _updateCvsDbMessage.asStateFlow()

    private val _isUpdatingCvsDbByAi = MutableStateFlow(false)
    val isUpdatingCvsDbByAi: StateFlow<Boolean> = _isUpdatingCvsDbByAi.asStateFlow()

    private val _updateCvsDbByAiMessage = MutableStateFlow<String?>(null)
    val updateCvsDbByAiMessage: StateFlow<String?> = _updateCvsDbByAiMessage.asStateFlow()

    fun updateCvsDatabase() {
        viewModelScope.launch(Dispatchers.IO) {
            _isUpdatingCvsDb.value = true
            try {
                // 真實執行 Web 解析
                val sevenElevenFoods = CvsScraper.scrapeSevenEleven()
                val familyMartFoods = CvsScraper.scrapeFamilyMart()
                val newFoods = sevenElevenFoods + familyMartFoods
                
                val importSummary = repository.importCvsFoodsWithDeduplication(newFoods)

                val msg = if (importSummary.newAdded > 0) {
                    "超商資料庫更新成功！新增 ${importSummary.newAdded} 筆新商品（${importSummary.skippedExisting + importSummary.updated} 筆本地已存在/保持最新，共比對 ${importSummary.totalProcessed} 筆）。"
                } else {
                    "超商資料庫比對完成！本地已含有最新超商食品（共比對 ${importSummary.totalProcessed} 筆，無重複新增）。"
                }
                _updateCvsDbMessage.value = msg
                refreshCustomFoodCount()
            } catch (e: Exception) {
                _updateCvsDbMessage.value = "更新失敗: ${e.message}"
            } finally {
                _isUpdatingCvsDb.value = false
            }
        }
    }

    fun updateCvsDatabaseByAi(keyword: String = "") {
        viewModelScope.launch(Dispatchers.IO) {
            if (!checkAndIncrementAiCall()) {
                val hasOwnKey = isUsingCustomKey(_userGeminiApiKey.value)
                _updateCvsDbByAiMessage.value = if (hasOwnKey) {
                    "您的專屬自訂金鑰呼叫額度已達上限！請至「設定」頁面調高上限或重置計數。"
                } else {
                    "系統預設的免費體驗額度（共 20 次）已使用完畢。請前往「設定」輸入您專屬的 Gemini API Key 即可享有完全免費且無限制的 AI 搜尋！"
                }
                return@launch
            }
            
            _isUpdatingCvsDbByAi.value = true
            Log.d("DietViewModel", "AI Update CVS: Key length=${_userGeminiApiKey.value.length}")
            try {
                val target = keyword.trim()
                val prompt = if (target.isNotEmpty()) {
                    "請列出 3~5 款在台灣常見或販售與「$target」相關的食品、餐點、外食、小吃、家常菜、超商便當或飲品，並提供其真實或合理的營養標示。請以 JSON 陣列格式回傳，欄位包含：name (名稱), brand (品牌或分類來源，例如：一般外食、家常菜、麥當勞、7-11、全家 等), caloriesPer100g (每100克熱量卡路里), carbsPer100g (每100克碳水化合物), proteinPer100g (每100克蛋白質), fatPer100g (每100克脂肪), defaultServingAmount (該餐點一份的常見克數)。只需回傳純 JSON 陣列，絕對不要包含 Markdown 語法 (```json) 或任何其他說明文字。"
                } else {
                    "請列出 3~5 款台灣最常見的日常餐點、外食、小吃或超商食品（例如：牛肉麵、滷肉飯、雞排、飯糰等），並提供它們的營養標示。請以 JSON 陣列格式回傳，欄位包含：name (名稱), brand (品牌或分類來源，例如：一般外食、家常菜、7-11、全家 等), caloriesPer100g, carbsPer100g, proteinPer100g, fatPer100g, defaultServingAmount (該份量公克數)。只需回傳純 JSON 陣列，絕對不要包含 Markdown 語法 (```json) 或任何其他說明文字。"
                }
                val result = repository.generateRawContentWithGemini(prompt, _userGeminiApiKey.value)
                
                result.onSuccess { res ->
                    recordAiTokenUsage(res.totalTokens)
                    val response = res.data
                    // 解析 JSON
                    try {
                        var cleanJson = response.trim()
                        if (cleanJson.startsWith("```")) {
                            cleanJson = cleanJson.substringAfter("\n")
                        }
                        if (cleanJson.endsWith("```")) {
                            cleanJson = cleanJson.substringBeforeLast("```")
                        }
                        cleanJson = cleanJson.trim()

                        val jsonArray = if (cleanJson.startsWith("[")) {
                            org.json.JSONArray(cleanJson)
                        } else if (cleanJson.startsWith("{")) {
                            val root = org.json.JSONObject(cleanJson)
                            root.optJSONArray("foods") ?: root.optJSONArray("items") ?: root.optJSONArray("LIST") ?: org.json.JSONArray()
                        } else {
                            val start = cleanJson.indexOf('[')
                            val end = cleanJson.lastIndexOf(']')
                            if (start != -1 && end > start) {
                                org.json.JSONArray(cleanJson.substring(start, end + 1))
                            } else {
                                throw IllegalArgumentException("無法找到有效的 JSON 格式資料")
                            }
                        }

                        val newFoods = mutableListOf<CustomFood>()
                        for (i in 0 until jsonArray.length()) {
                            val obj = jsonArray.getJSONObject(i)
                            val name = obj.optString("name", "").trim()
                            if (name.isEmpty()) continue
                            newFoods.add(
                                CustomFood(
                                    name = name,
                                    brand = obj.optString("brand", "一般食品"),
                                    caloriesPer100g = obj.optDouble("caloriesPer100g", 0.0),
                                    carbsPer100g = obj.optDouble("carbsPer100g", 0.0),
                                    proteinPer100g = obj.optDouble("proteinPer100g", 0.0),
                                    fatPer100g = obj.optDouble("fatPer100g", 0.0),
                                    defaultServingAmount = obj.optDouble("defaultServingAmount", 100.0)
                                )
                            )
                        }
                        
                        if (newFoods.isEmpty()) {
                            _updateCvsDbByAiMessage.value = if (target.isNotEmpty()) {
                                "AI 未能搜尋到與「$target」相關的食品，請嘗試輸入更具體的名稱。"
                            } else {
                                "AI 未能產生食品資料，請稍後重試。"
                            }
                        } else {
                            val importSummary = repository.importCvsFoodsWithDeduplication(newFoods)
                            val keywordHint = if (target.isNotEmpty()) "「$target」" else ""
                            val msg = if (importSummary.newAdded > 0) {
                                "AI 搜尋${keywordHint}成功！已為您新增 ${importSummary.newAdded} 筆新食品營養標示（${importSummary.skippedExisting + importSummary.updated} 筆本地已存在已自動比對略過）。"
                            } else {
                                "AI 搜尋${keywordHint}完成！本地已含有相關食品標示，已為您比對確認無重複加入。"
                            }
                            _updateCvsDbByAiMessage.value = msg
                            refreshCustomFoodCount()
                        }
                    } catch (jsonEx: Exception) {
                        _updateCvsDbByAiMessage.value = "資料解析失敗: ${jsonEx.message}"
                    }
                }.onFailure { e ->
                    if (e.message == "請先設定 Gemini API Key 才能使用此功能。") {
                        _updateCvsDbByAiMessage.value = "更新失敗: 請先在設定中設定正確的 Gemini API Key。"
                    } else {
                        _updateCvsDbByAiMessage.value = "更新失敗: ${e.message}"
                    }
                }
            } catch (e: Exception) {
                _updateCvsDbByAiMessage.value = "處理資料失敗，可能是格式錯誤: ${e.message}"
            } finally {
                _isUpdatingCvsDbByAi.value = false
            }
        }
    }

    fun clearUpdateMessage() {
        _updateCvsDbMessage.value = null
        _updateCvsDbByAiMessage.value = null
    }

    fun saveWaterGoal(goalMl: Int) {
        mealPreferences?.saveWaterGoal(goalMl)
        _waterGoalMl.value = goalMl
    }

    val waterRecordsForDate: StateFlow<List<WaterRecord>> = _selectedDateString.flatMapLatest {
        repository.getWaterRecordsForDate(it)
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val totalWaterForDate: StateFlow<Int> = _selectedDateString.flatMapLatest {
        repository.getTotalWaterForDate(it).map { it ?: 0 }
    }.stateIn(viewModelScope, SharingStarted.Lazily, 0)

    fun addWaterRecord(amountMl: Int, dateStr: String) {
        viewModelScope.launch {
            val record = WaterRecord(
                date = dateStr,
                amountMl = amountMl,
                timestamp = System.currentTimeMillis()
            )
            repository.insertWaterRecord(record)
        }
    }

    fun deleteWaterRecord(record: WaterRecord) {
        viewModelScope.launch {
            repository.deleteWaterRecord(record)
        }
    }


    val allWeightRecords: StateFlow<List<com.example.data.model.WeightRecord>> = repository.getAllWeightRecords()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val latestWeightRecord: StateFlow<com.example.data.model.WeightRecord?> = repository.getLatestWeightRecord()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null
        )

    fun addWeightRecord(
        morningWeightKg: Double? = null,
        morningTime: String? = null,
        eveningWeightKg: Double? = null,
        eveningTime: String? = null,
        date: String
    ) {
        viewModelScope.launch {
            val existing = allWeightRecords.value.find { it.date == date }
            if (existing != null) {
                val updated = existing.copy(
                    morningWeightKg = morningWeightKg ?: existing.morningWeightKg,
                    morningTime = morningTime ?: existing.morningTime,
                    eveningWeightKg = eveningWeightKg ?: existing.eveningWeightKg,
                    eveningTime = eveningTime ?: existing.eveningTime
                )
                repository.updateWeightRecord(updated)
            } else {
                repository.insertWeightRecord(
                    com.example.data.model.WeightRecord(
                        morningWeightKg = morningWeightKg,
                        morningTime = morningTime,
                        eveningWeightKg = eveningWeightKg,
                        eveningTime = eveningTime,
                        date = date
                    )
                )
            }
        }
    }

    fun deleteWeightRecord(record: com.example.data.model.WeightRecord) {
        viewModelScope.launch {
            repository.deleteWeightRecord(record)
        }
    }

    fun updateTargetWeight(newTarget: Double) {
        if (newTarget in 20.0..300.0) {
            _targetWeightKg.value = newTarget
            mealPreferences?.saveTargetWeight(newTarget)
        }
    }

    // --- Training / Workout Methods ---
    val workoutsWithExercises: StateFlow<List<WorkoutWithExercises>> = 
        repository.getWorkoutsWithExercises().stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val _workoutOrderState = MutableStateFlow<List<Long>>(emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val currentDayWorkouts: StateFlow<List<WorkoutWithExercises>> = _selectedDateString
        .flatMapLatest { date ->
            _workoutOrderState.value = mealPreferences?.getWorkoutOrder(date) ?: emptyList()
            repository.getWorkoutsWithExercisesByDate(date).combine(_workoutOrderState) { workouts, order ->
                if (order.isEmpty()) {
                    workouts
                } else {
                    workouts.sortedWith(compareBy { w ->
                        val index = order.indexOf(w.workout.id)
                        if (index != -1) index else Int.MAX_VALUE
                    })
                }
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    fun addWorkout(bodyPart: String, exercises: List<WorkoutExercise>, date: String = selectedDateString.value) {
        viewModelScope.launch {
            val record = WorkoutRecord(date = date, bodyPart = bodyPart)
            repository.insertWorkout(record, exercises)
            updateDictionaries(bodyPart, exercises.map { it.name })
        }
    }

    fun updateWorkoutBodyPart(workout: WorkoutRecord, newBodyPart: String) {
        viewModelScope.launch {
            repository.updateWorkout(workout.copy(bodyPart = newBodyPart))
        }
    }

    fun deleteWorkout(workout: WorkoutRecord) {
        viewModelScope.launch {
            repository.deleteWorkout(workout)
        }
    }

    fun moveWorkoutUp(workoutRecord: WorkoutRecord) {
        val date = _selectedDateString.value
        val currentWorkouts = currentDayWorkouts.value
        val index = currentWorkouts.indexOfFirst { it.workout.id == workoutRecord.id }
        if (index > 0) {
            val list = currentWorkouts.map { it.workout.id }.toMutableList()
            val item = list.removeAt(index)
            list.add(index - 1, item)
            mealPreferences?.saveWorkoutOrder(date, list)
            _workoutOrderState.value = list
        }
    }

    fun moveWorkoutDown(workoutRecord: WorkoutRecord) {
        val date = _selectedDateString.value
        val currentWorkouts = currentDayWorkouts.value
        val index = currentWorkouts.indexOfFirst { it.workout.id == workoutRecord.id }
        if (index >= 0 && index < currentWorkouts.size - 1) {
            val list = currentWorkouts.map { it.workout.id }.toMutableList()
            val item = list.removeAt(index)
            list.add(index + 1, item)
            mealPreferences?.saveWorkoutOrder(date, list)
            _workoutOrderState.value = list
        }
    }

    fun deleteExercise(exercise: WorkoutExercise) {
        viewModelScope.launch {
            repository.deleteExercise(exercise)
        }
    }

    fun updateExercise(exercise: WorkoutExercise) {
        viewModelScope.launch {
            repository.updateExercise(exercise)
        }
    }

    fun addExerciseSet(exerciseId: Long, reps: Int = 10, weight: Double = 20.0, currentSetsCount: Int = 0) {
        viewModelScope.launch {
            repository.insertExerciseSet(
                com.example.data.model.ExerciseSet(
                    exerciseId = exerciseId,
                    setIndex = currentSetsCount + 1,
                    reps = reps,
                    weight = weight
                )
            )
        }
    }

    fun updateExerciseSet(exerciseSet: com.example.data.model.ExerciseSet) {
        viewModelScope.launch {
            repository.updateExerciseSet(exerciseSet)
        }
    }

    fun deleteExerciseSet(exerciseSet: com.example.data.model.ExerciseSet) {
        viewModelScope.launch {
            repository.deleteExerciseSet(exerciseSet)
        }
    }

    fun addExerciseToWorkout(
        workoutId: Long,
        exerciseName: String,
        sets: Int = 3,
        reps: Int = 10,
        weight: Double = 20.0,
        supersetGroupId: Int? = null
    ) {
        val trimmed = exerciseName.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            repository.insertExercise(
                WorkoutExercise(
                    workoutId = workoutId,
                    name = trimmed,
                    sets = sets,
                    reps = reps,
                    weight = weight,
                    supersetGroupId = supersetGroupId
                ),
                initialSets = sets,
                initialReps = reps,
                initialWeight = weight
            )
            updateDictionaries(null, listOf(trimmed))
        }
    }

    fun addSupersetToWorkout(
        workoutId: Long,
        exercises: List<WorkoutExercise>
    ) {
        if (exercises.isEmpty()) return
        viewModelScope.launch {
            val groupId = (System.currentTimeMillis() / 1000).toInt()
            exercises.forEach { ex ->
                repository.insertExercise(
                    ex.copy(workoutId = workoutId, supersetGroupId = groupId),
                    initialSets = ex.sets,
                    initialReps = ex.reps,
                    initialWeight = ex.weight
                )
            }
        }
    }

    fun generateExercisesForPart(bodyPart: String, onResult: (List<String>) -> Unit) {
        if (bodyPart.isBlank()) return
        _isEstimatingAi.value = true
        viewModelScope.launch {
            val hasLimit = checkAndIncrementAiCall()
            val result = if (hasLimit) {
                repository.generateWorkoutExercises(bodyPart, _userGeminiApiKey.value)
            } else {
                Result.failure(Exception("AI_LIMIT_REACHED"))
            }
            result.onSuccess { res ->
                recordAiTokenUsage(res.totalTokens)
            }
            val list = result.map { it.data }.getOrElse { emptyList() }
            if (list.isEmpty() || !hasLimit) {
                val trimmed = bodyPart.trim()
                val fallback = when {
                    trimmed.contains("有氧") || trimmed.contains("心肺") || trimmed.contains("cardio", ignoreCase = true) -> listOf("慢跑", "跑步機", "飛輪單車", "划船機", "橢圓機", "跳繩", "快走・健走", "游泳", "波比跳", "開合跳", "高強度間歇 (HIIT)")
                    trimmed.contains("胸") || trimmed.contains("推") -> listOf("槓鈴臥推", "啞鈴臥推", "上斜啞鈴臥推", "滑輪夾胸", "雙槓撐體", "伏地挺身")
                    trimmed.contains("背") || trimmed.contains("拉") -> listOf("單槓引體向上", "滑輪下拉", "槓鈴划船", "啞鈴划船", "座姿划船", "硬舉")
                    trimmed.contains("腿") || trimmed.contains("下肢") -> listOf("槓鈴深蹲", "分腿蹲", "腿部伸展", "腿部屈伸", "腿推機", "直腿硬舉")
                    trimmed.contains("肩") -> listOf("啞鈴肩推", "槓鈴肩推", "側平舉", "前平舉", "後三角划船", "臉拉")
                    trimmed.contains("手") || trimmed.contains("二頭") || trimmed.contains("三頭") -> listOf("槓鈴彎舉", "啞鈴彎舉", "搥式彎舉", "滑輪三頭下壓", "法式推舉", "窄握臥推")
                    trimmed.contains("腹") || trimmed.contains("核心") -> listOf("捲腹", "舉腿", "棒式", "俄羅斯轉體", "仰臥起坐", "健腹輪")
                    else -> listOf("動作 1", "動作 2", "動作 3", "動作 4", "動作 5")
                }
                onResult(fallback)
            } else {
                onResult(list)
            }
            _isEstimatingAi.value = false
        }
    }

    val uniqueBodyParts: StateFlow<List<String>> = 
        repository.getUniqueBodyParts().stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val uniqueExerciseNames: StateFlow<List<String>> = 
        repository.getUniqueExerciseNames().stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    suspend fun getLastExerciseByName(name: String): WorkoutExercise? {
        return repository.getLastExerciseByName(name)
    }

    // --- Data Backup & Export Features ---
    fun backupDatabase(context: android.content.Context, outputStream: java.io.OutputStream): Boolean {
        return com.example.data.DatabaseBackupHelper.backup(context, outputStream)
    }

    fun restoreDatabase(context: android.content.Context, inputStream: java.io.InputStream): Boolean {
        val success = com.example.data.DatabaseBackupHelper.restore(context, inputStream)
        if (success) {
            viewModelScope.launch {
                // Force-refresh our main StateFlows to load the new database content immediately
                val curDate = _selectedDateString.value
                _selectedDateString.value = ""
                _selectedDateString.value = curDate
                
                // Refresh custom foods list
                refreshLocalFoods()
            }
        }
        return success
    }

    suspend fun getDietHtmlForWeek(startDate: String): String {
        val days = HtmlExportHelper.getWeekDays(startDate)
        val allRecords = repository.getAllRecords().first()
        val filtered = allRecords.filter { it.date in days }
        return HtmlExportHelper.generateDietHtml(startDate, days, filtered)
    }

    suspend fun getWaterHtmlForWeek(startDate: String): String {
        val days = HtmlExportHelper.getWeekDays(startDate)
        val allWater = repository.getAllWaterRecords().first()
        val filtered = allWater.filter { it.date in days }
        val goalMl = _waterGoalMl.value
        return HtmlExportHelper.generateWaterHtml(startDate, days, filtered, goalMl)
    }

    suspend fun getTrainingHtmlForWeek(startDate: String): String {
        val days = HtmlExportHelper.getWeekDays(startDate)
        val allWorkouts = repository.getWorkoutsWithExercises().first()
        val filtered = allWorkouts.filter { it.workout.date in days }
        return HtmlExportHelper.generateTrainingHtml(startDate, days, filtered)
    }

    suspend fun getWeightHtmlForWeek(startDate: String): String {
        val days = HtmlExportHelper.getWeekDays(startDate)
        val allWeight = repository.getAllWeightRecords().first()
        val filtered = allWeight.filter { it.date in days }
        return HtmlExportHelper.generateWeightHtml(startDate, days, filtered)
    }

    suspend fun getAllHtmlForWeek(startDate: String): String {
        val days = HtmlExportHelper.getWeekDays(startDate)
        val diet = repository.getAllRecords().first().filter { it.date in days }
        val water = repository.getAllWaterRecords().first().filter { it.date in days }
        val waterGoal = _waterGoalMl.value
        val workouts = repository.getWorkoutsWithExercises().first().filter { it.workout.date in days }
        val weight = repository.getAllWeightRecords().first().filter { it.date in days }
        return HtmlExportHelper.generateAllHtml(startDate, days, diet, water, waterGoal, workouts, weight)
    }

    private val _cloudSyncState = MutableStateFlow<String?>(null)
    val cloudSyncState = _cloudSyncState.asStateFlow()

    fun syncAllFoodsWithCloud() {
        viewModelScope.launch(Dispatchers.IO) {
            _cloudSyncState.value = "正在同步全量食品資料庫（包含衛福部官方庫、各大超商、在地食材與雲端共享庫）..."
            val result = repository.syncAllFoodsWithCloud()
            result.onSuccess { (uploaded, downloaded) ->
                _cloudSyncState.value = if (uploaded == 0 && downloaded == 0) {
                    "✅ 資料庫已是最新狀態！所有官方食材、超商與自訂庫皆已完整同步。"
                } else {
                    "✅ 全量食品庫同步完成！已備份/上傳 $uploaded 筆，並自雲端載入 $downloaded 筆食品。"
                }
                refreshCustomFoodCount()
                refreshLocalFoods()
            }.onFailure { e ->
                _cloudSyncState.value = "同步失敗：${e.localizedMessage ?: "請確認網路連線與 Firebase 設定"}"
            }
        }
    }

    fun syncAllFoodsWithCloudSilently() {
        viewModelScope.launch(Dispatchers.IO) {
            delay(5000)
            val prefs = mealPreferences
            val lastSync = prefs?.getLastSyncTimestamp() ?: 0L
            val now = System.currentTimeMillis()
            if (now - lastSync < 6 * 60 * 60 * 1000L) {
                return@launch
            }
            val result = repository.syncAllFoodsWithCloud()
            result.onSuccess {
                prefs?.setLastSyncTimestamp(now)
                refreshCustomFoodCount()
                refreshLocalFoods()
            }
        }
    }

    fun clearCloudSyncState() {
        _cloudSyncState.value = null
    }

    suspend fun estimateBmrTdeeWithAi(
        gender: String,
        age: Int,
        height: Double,
        weight: Double,
        activityLevel: Double,
        goalNotes: String
    ): Result<AiBmrEstimateResult> = withContext(Dispatchers.IO) {
        try {
            val genderText = if (gender == "male") "男性" else "女性"
            val prompt = """
                你是專業運動營養師與健身教練。請根據以下使用者生理數據進行科學化 BMR、TDEE 試算與個人化三大營養素配比：
                - 性別：$genderText
                - 年齡：$age 歲
                - 身高：$height cm
                - 體重：$weight kg
                - 日常活動量等級：$activityLevel (1.2久坐, 1.375輕度, 1.55中度, 1.725高度, 1.9極高)
                - 個人目標與需求描述：${if (goalNotes.isNotBlank()) goalNotes else "無特殊需求，請給予最佳健康與體態維持建議"}

                請嚴格以純 JSON 格式回傳（絕對不要包含 ```json 或 Markdown 語法），包含以下欄位：
                {
                  "bmr": 1650,
                  "tdee": 2050,
                  "recommendedCalories": 1700,
                  "carbsGrams": 170.0,
                  "proteinGrams": 135.0,
                  "fatGrams": 50.0,
                  "strategyTitle": "AI 個人化運動營養與減脂規劃",
                  "advice": "建議每日熱量為 1700 kcal。蛋白質按每公斤 1.9g 配置以保護肌肉，碳水化合物主要放在訓練前後補充。"
                }
            """.trimIndent()

            val responseResult = repository.generateRawContentWithGemini(prompt, _userGeminiApiKey.value)
            if (responseResult.isSuccess) {
                val geminiRes = responseResult.getOrNull()
                if (geminiRes != null) {
                    recordAiTokenUsage(geminiRes.totalTokens)
                }
                val raw = geminiRes?.data ?: ""
                var clean = raw.trim()
                if (clean.startsWith("```")) {
                    clean = clean.substringAfter("\n")
                }
                if (clean.endsWith("```")) {
                    clean = clean.substringBeforeLast("```")
                }
                clean = clean.trim()
                
                val json = if (clean.startsWith("{")) {
                    org.json.JSONObject(clean)
                } else {
                    val start = clean.indexOf("{")
                    val end = clean.lastIndexOf("}")
                    if (start >= 0 && end > start) {
                        org.json.JSONObject(clean.substring(start, end + 1))
                    } else {
                        org.json.JSONObject()
                    }
                }

                val fallbackBmr = if (gender == "male") (10 * weight + 6.25 * height - 5 * age + 5).toInt() else (10 * weight + 6.25 * height - 5 * age - 161).toInt()
                val fallbackTdee = (fallbackBmr * activityLevel).toInt()

                val bmr = json.optInt("bmr", fallbackBmr)
                val tdee = json.optInt("tdee", fallbackTdee)
                val recommendedCalories = json.optInt("recommendedCalories", (tdee * 0.85).toInt())
                val carbsGrams = json.optDouble("carbsGrams", (recommendedCalories * 0.45 / 4))
                val proteinGrams = json.optDouble("proteinGrams", (recommendedCalories * 0.30 / 4))
                val fatGrams = json.optDouble("fatGrams", (recommendedCalories * 0.25 / 9))
                val strategyTitle = json.optString("strategyTitle", "✨ AI 個人化營養建議")
                val advice = json.optString("advice", "根據您的生理參數與目標，建議精準搭配每日蛋白質與適當卡路里赤字。")

                Result.success(
                    AiBmrEstimateResult(
                        bmr = bmr,
                        tdee = tdee,
                        recommendedCalories = recommendedCalories,
                        carbsGrams = carbsGrams,
                        proteinGrams = proteinGrams,
                        fatGrams = fatGrams,
                        strategyTitle = strategyTitle,
                        advice = advice
                    )
                )
            } else {
                val bmr = if (gender == "male") (10 * weight + 6.25 * height - 5 * age + 5).toInt() else (10 * weight + 6.25 * height - 5 * age - 161).toInt()
                val tdee = (bmr * activityLevel).toInt()
                val isWeightLoss = goalNotes.contains("減") || goalNotes.contains("瘦")
                val isGain = goalNotes.contains("增") || goalNotes.contains("壯")
                val targetCal = when {
                    isWeightLoss -> (tdee * 0.82).toInt()
                    isGain -> (tdee * 1.12).toInt()
                    else -> (tdee * 0.85).toInt()
                }
                val protein = (weight * 1.8).coerceAtLeast(targetCal * 0.28 / 4)
                val fat = targetCal * 0.25 / 9
                val carbs = (targetCal - protein * 4 - fat * 9) / 4

                Result.success(
                    AiBmrEstimateResult(
                        bmr = bmr,
                        tdee = tdee,
                        recommendedCalories = targetCal,
                        carbsGrams = carbs,
                        proteinGrams = protein,
                        fatGrams = fat,
                        strategyTitle = if (isWeightLoss) "✨ 個人化科學減脂方案" else if (isGain) "✨ 個人化增肌強化方案" else "✨ 個人化健康營養計畫",
                        advice = "已根據您的生理數據計算建議攝取熱量與三大營養素。規律運動與補足蛋白質有助於維持肌肉量與良好基礎代謝。"
                    )
                )
            }
        } catch (e: Exception) {
            val bmr = if (gender == "male") (10 * weight + 6.25 * height - 5 * age + 5).toInt() else (10 * weight + 6.25 * height - 5 * age - 161).toInt()
            val tdee = (bmr * activityLevel).toInt()
            val targetCal = (tdee * 0.85).toInt()
            val protein = (weight * 1.8).coerceAtLeast(targetCal * 0.28 / 4)
            val fat = targetCal * 0.25 / 9
            val carbs = (targetCal - protein * 4 - fat * 9) / 4

            Result.success(
                AiBmrEstimateResult(
                    bmr = bmr,
                    tdee = tdee,
                    recommendedCalories = targetCal,
                    carbsGrams = carbs,
                    proteinGrams = protein,
                    fatGrams = fat,
                    strategyTitle = "✨ 個人化科學健康方案",
                    advice = "已為您試算建議每日熱量與三大營養素配比。"
                )
            )
        }
    }

    private val _detectedAnomalies = MutableStateFlow<List<CustomFood>>(emptyList())
    val detectedAnomalies: StateFlow<List<CustomFood>> = _detectedAnomalies.asStateFlow()

    private val _isScanningAnomalies = MutableStateFlow(false)
    val isScanningAnomalies: StateFlow<Boolean> = _isScanningAnomalies.asStateFlow()

    private val _isCalibratingAnomalies = MutableStateFlow(false)
    val isCalibratingAnomalies: StateFlow<Boolean> = _isCalibratingAnomalies.asStateFlow()

    fun getCalibratedFood(food: CustomFood): CustomFood {
        val nameLower = food.name.lowercase().trim()
        val isCorrupted = food.caloriesPer100g > 900.0 || food.carbsPer100g > 100.0 || 
                         food.proteinPer100g > 100.0 || food.fatPer100g > 100.0

        // 1. If data is physically impossible (corrupted / over-multiplied from previous bug)
        if (isCorrupted) {
            // Check preset match
            val matchedPreset = CommonFoodsDatabase.presetList.find {
                (it.name.isNotBlank() && nameLower.contains(it.name.lowercase().trim())) ||
                (it.name.isNotBlank() && it.name.lowercase().contains(nameLower))
            }
            if (matchedPreset != null && matchedPreset.caloriesPer100g <= 900.0) {
                return food.copy(
                    caloriesPer100g = matchedPreset.caloriesPer100g,
                    carbsPer100g = matchedPreset.carbsPer100g,
                    sugarsPer100g = matchedPreset.sugarsPer100g,
                    fiberPer100g = matchedPreset.fiberPer100g,
                    proteinPer100g = matchedPreset.proteinPer100g,
                    fatPer100g = matchedPreset.fatPer100g,
                    sodiumPer100g = matchedPreset.sodiumPer100g,
                    potassiumPer100g = matchedPreset.potassiumPer100g,
                    defaultServingAmount = if (food.defaultServingAmount in 20.0..1500.0) food.defaultServingAmount else matchedPreset.defaultServingAmount,
                    servingUnit = if (food.servingUnit.isNotBlank()) food.servingUnit else matchedPreset.servingUnit,
                    servingSizeText = matchedPreset.servingSizeText,
                    updatedAt = System.currentTimeMillis()
                )
            }

            // Keyword-based recovery for corrupted items
            if (nameLower.contains("泡芙") || nameLower.contains("puff")) {
                val servingG = if (food.defaultServingAmount in 30.0..150.0) food.defaultServingAmount else 65.0
                val totalCal = Math.round(558.0 * servingG / 100.0)
                return food.copy(
                    caloriesPer100g = 558.0,
                    carbsPer100g = 56.5,
                    sugarsPer100g = 24.5,
                    fiberPer100g = 1.8,
                    proteinPer100g = 6.2,
                    fatPer100g = 34.2,
                    sodiumPer100g = 120.0,
                    potassiumPer100g = 110.0,
                    defaultServingAmount = servingG,
                    servingUnit = "g",
                    servingSizeText = "1盒 (${servingG.toInt()}g, ${totalCal.toInt()}kcal)",
                    updatedAt = System.currentTimeMillis()
                )
            } else if (nameLower.contains("洋芋片") || nameLower.contains("薯片")) {
                val servingG = if (food.defaultServingAmount in 30.0..200.0) food.defaultServingAmount else 60.0
                val totalCal = Math.round(540.0 * servingG / 100.0)
                return food.copy(
                    caloriesPer100g = 540.0,
                    carbsPer100g = 54.0,
                    sugarsPer100g = 2.0,
                    fiberPer100g = 3.0,
                    proteinPer100g = 6.5,
                    fatPer100g = 33.0,
                    sodiumPer100g = 450.0,
                    potassiumPer100g = 400.0,
                    defaultServingAmount = servingG,
                    servingUnit = "g",
                    servingSizeText = "1包 (${servingG.toInt()}g, ${totalCal.toInt()}kcal)",
                    updatedAt = System.currentTimeMillis()
                )
            } else if (nameLower.contains("便當") || nameLower.contains("餐盒") || nameLower.contains("排骨") || 
                       nameLower.contains("雞腿") || nameLower.contains("咖哩") || nameLower.contains("燴飯") || nameLower.contains("丼")) {
                val servingG = if (food.defaultServingAmount in 250.0..600.0) food.defaultServingAmount else 400.0
                val totalCal = Math.round(165.0 * servingG / 100.0)
                return food.copy(
                    caloriesPer100g = 165.0,
                    carbsPer100g = 22.0,
                    sugarsPer100g = 2.0,
                    fiberPer100g = 1.5,
                    proteinPer100g = 6.5,
                    fatPer100g = 5.8,
                    sodiumPer100g = 350.0,
                    potassiumPer100g = 120.0,
                    defaultServingAmount = servingG,
                    servingUnit = "g",
                    servingSizeText = "1盒 (${servingG.toInt()}g, ${totalCal.toInt()}kcal)",
                    updatedAt = System.currentTimeMillis()
                )
            } else {
                // General fallback: restore within physical upper bounds
                val rawSum = food.carbsPer100g + food.proteinPer100g + food.fatPer100g
                val scale = if (rawSum > 80.0) 80.0 / rawSum else 1.0
                val carbs = Math.round(food.carbsPer100g * scale * 10.0) / 10.0
                val protein = Math.round(food.proteinPer100g * scale * 10.0) / 10.0
                val fat = Math.round(food.fatPer100g * scale * 10.0) / 10.0
                val cal = Math.min(850.0, Math.round((carbs * 4.0 + protein * 4.0 + fat * 9.0) * 10.0) / 10.0)
                val safeServing = if (food.defaultServingAmount in 10.0..1000.0) food.defaultServingAmount else 100.0
                val totalCal = Math.round(cal * safeServing / 100.0)
                return food.copy(
                    caloriesPer100g = cal,
                    carbsPer100g = carbs,
                    proteinPer100g = protein,
                    fatPer100g = fat,
                    sugarsPer100g = Math.min(carbs, food.sugarsPer100g * scale),
                    sodiumPer100g = Math.min(2000.0, food.sodiumPer100g),
                    defaultServingAmount = safeServing,
                    servingSizeText = "1份 (${safeServing.toInt()}${food.servingUnit.ifBlank { "g" }}, ${totalCal.toInt()}kcal)",
                    updatedAt = System.currentTimeMillis()
                )
            }
        }

        // 2. Meal / Lunchbox Anomaly: The user entered the whole box's 400~1000 kcal as "per 100g"
        // Condition: defaultServingAmount >= 150g, caloriesPer100g in 300..900, and is a cooked meal
        if (food.defaultServingAmount >= 150.0 && food.caloriesPer100g >= 300.0) {
            val factor = food.defaultServingAmount / 100.0 // factor >= 1.5, strictly > 1.0
            val calPer100g = Math.round((food.caloriesPer100g / factor) * 10.0) / 10.0
            val carbsPer100g = Math.round((food.carbsPer100g / factor) * 10.0) / 10.0
            val sugarsPer100g = Math.round((food.sugarsPer100g / factor) * 10.0) / 10.0
            val fiberPer100g = Math.round((food.fiberPer100g / factor) * 10.0) / 10.0
            val proteinPer100g = Math.round((food.proteinPer100g / factor) * 10.0) / 10.0
            val fatPer100g = Math.round((food.fatPer100g / factor) * 10.0) / 10.0
            val sodiumPer100g = Math.round((food.sodiumPer100g / factor) * 10.0) / 10.0
            val potassiumPer100g = Math.round((food.potassiumPer100g / factor) * 10.0) / 10.0
            val unit = if (food.servingUnit.isNotBlank()) food.servingUnit else "g"
            val servingText = "1份 (${food.defaultServingAmount.toInt()}$unit, ${food.caloriesPer100g.toInt()}kcal)"

            return food.copy(
                caloriesPer100g = calPer100g,
                carbsPer100g = carbsPer100g,
                sugarsPer100g = sugarsPer100g,
                fiberPer100g = fiberPer100g,
                proteinPer100g = proteinPer100g,
                fatPer100g = fatPer100g,
                sodiumPer100g = sodiumPer100g,
                potassiumPer100g = potassiumPer100g,
                servingSizeText = servingText,
                updatedAt = System.currentTimeMillis()
            )
        }

        return food
    }

    fun scanCustomFoodAnomalies() {
        _isScanningAnomalies.value = true
        viewModelScope.launch {
            try {
                val userFoods = repository.getAllCustomFoods().first()
                val anomalies = userFoods.filter { food ->
                    // 1. Physically impossible data (e.g. over-multiplied from previous bug)
                    val isCorrupted = food.caloriesPer100g > 900.0 || food.carbsPer100g > 100.0 || 
                                     food.proteinPer100g > 100.0 || food.fatPer100g > 100.0
                    
                    if (isCorrupted) return@filter true

                    // 2. Large meal / Lunchbox anomaly where whole box calorie was filled as 100g calorie
                    val nameLower = food.name.lowercase().trim()
                    val isCookedMeal = nameLower.contains("便當") || nameLower.contains("餐盒") || nameLower.contains("餐盤") ||
                            nameLower.contains("飯") || nameLower.contains("麵") || nameLower.contains("水餃") ||
                            nameLower.contains("粥") || nameLower.contains("湯") || nameLower.contains("漢堡") ||
                            nameLower.contains("三明治") || nameLower.contains("吐司") || nameLower.contains("丼") ||
                            nameLower.contains("排骨") || nameLower.contains("雞腿") || nameLower.contains("咖哩") ||
                            nameLower.contains("焗烤") || nameLower.contains("燴飯")
                    
                    // Only flag cooked meals if defaultServingAmount >= 150g AND caloriesPer100g >= 300.0
                    val isMealAnomaly = isCookedMeal && food.defaultServingAmount >= 150.0 && food.caloriesPer100g >= 300.0

                    isMealAnomaly
                }
                _detectedAnomalies.value = anomalies
            } catch (e: Exception) {
                _detectedAnomalies.value = emptyList()
            } finally {
                _isScanningAnomalies.value = false
            }
        }
    }

    fun calibrateSelectedAnomalies(foodsToCalibrate: List<CustomFood>) {
        if (_isCalibratingAnomalies.value) return
        _isCalibratingAnomalies.value = true
        viewModelScope.launch {
            try {
                foodsToCalibrate.forEach { food ->
                    val calibrated = getCalibratedFood(food)
                    repository.saveCustomFood(calibrated)
                }
                // Rescan immediately (will now be clean with 0 anomalies)
                scanCustomFoodAnomalies()
                refreshLocalFoods()
                syncAllFoodsWithCloudSilently()
            } catch (e: Exception) {
                // Ignore or log error
            } finally {
                _isCalibratingAnomalies.value = false
            }
        }
    }

    // ==========================================
    // ⏱️ 訓練碼表與倒數計時器 (Workout Stopwatch & Countdown Timer)
    // ==========================================
    private val _workoutTimerState = MutableStateFlow(WorkoutTimerState())
    val workoutTimerState: StateFlow<WorkoutTimerState> = _workoutTimerState.asStateFlow()

    private var countdownJob: Job? = null
    private var stopwatchJob: Job? = null
    private var lastBeepRemaining: Int = -1

    fun openWorkoutTimerDialog(mode: TimerMode? = null) {
        _workoutTimerState.value = _workoutTimerState.value.copy(
            isDialogVisible = true,
            mode = mode ?: _workoutTimerState.value.mode
        )
    }

    fun closeWorkoutTimerDialog() {
        _workoutTimerState.value = _workoutTimerState.value.copy(
            isDialogVisible = false
        )
    }

    fun switchTimerMode(newMode: TimerMode) {
        _workoutTimerState.value = _workoutTimerState.value.copy(mode = newMode)
    }

    fun setCountdownTotalSeconds(seconds: Int) {
        val safeSec = seconds.coerceIn(1, 359999) // up to 99 hrs
        val wasRunning = _workoutTimerState.value.isCountdownRunning
        if (wasRunning) {
            pauseCountdown()
        }
        _workoutTimerState.value = _workoutTimerState.value.copy(
            countdownTotalSeconds = safeSec,
            countdownRemainingSeconds = safeSec,
            isCountdownRunning = false,
            isCountdownPaused = false,
            isCountdownFinished = false,
            overdueSeconds = 0
        )
    }

    fun adjustCountdownDuration(deltaSeconds: Int) {
        val currentState = _workoutTimerState.value
        val newRemaining = (currentState.countdownRemainingSeconds + deltaSeconds).coerceIn(1, 359999)
        val newTotal = maxOf(currentState.countdownTotalSeconds, newRemaining)
        _workoutTimerState.value = currentState.copy(
            countdownTotalSeconds = newTotal,
            countdownRemainingSeconds = newRemaining,
            isCountdownFinished = false,
            overdueSeconds = 0
        )
        if (currentState.isCountdownRunning) {
            // Recalculate target timestamp in current job
            lastBeepRemaining = -1
        }
    }

    fun startCountdown(context: Context, totalSeconds: Int? = null) {
        val current = _workoutTimerState.value
        val total = totalSeconds ?: current.countdownTotalSeconds
        val remaining = if (totalSeconds != null) {
            totalSeconds
        } else if (current.isCountdownPaused && current.countdownRemainingSeconds > 0) {
            current.countdownRemainingSeconds
        } else if (current.countdownRemainingSeconds <= 0 || current.isCountdownFinished) {
            total
        } else {
            current.countdownRemainingSeconds
        }

        // Cancel previous notification and stop any active continuous vibration
        val appContext = context.applicationContext
        WorkoutTimerNotificationHelper.cancelTimerFinishedNotification(appContext)
        WorkoutTimerNotificationHelper.stopVibration(appContext)

        _workoutTimerState.value = current.copy(
            countdownTotalSeconds = total,
            countdownRemainingSeconds = remaining,
            isCountdownRunning = true,
            isCountdownPaused = false,
            isCountdownFinished = false,
            overdueSeconds = 0
        )

        WorkoutTimerNotificationHelper.createNotificationChannel(appContext)

        countdownJob?.cancel()
        countdownJob = viewModelScope.launch(Dispatchers.Default) {
            val targetEndTime = System.currentTimeMillis() + (remaining * 1000L)
            lastBeepRemaining = -1

            while (true) {
                delay(100L)
                val now = System.currentTimeMillis()
                val remSeconds = maxOf(0, ((targetEndTime - now + 999L) / 1000L).toInt())

                _workoutTimerState.value = _workoutTimerState.value.copy(
                    countdownRemainingSeconds = remSeconds
                )

                // 3, 2, 1 Countdown Beeps
                if (_workoutTimerState.value.soundEnabled && remSeconds in 1..3 && remSeconds != lastBeepRemaining) {
                    lastBeepRemaining = remSeconds
                    WorkoutTimerNotificationHelper.playCountdownBeep()
                }

                if (remSeconds <= 0) {
                    // Timer Completed!
                    _workoutTimerState.value = _workoutTimerState.value.copy(
                        isCountdownRunning = false,
                        isCountdownPaused = false,
                        isCountdownFinished = true,
                        countdownRemainingSeconds = 0,
                        overdueSeconds = 0
                    )

                    withContext(Dispatchers.Main) {
                        if (_workoutTimerState.value.soundEnabled) {
                            WorkoutTimerNotificationHelper.playSoundAlert(appContext)
                        }
                        if (_workoutTimerState.value.vibrationEnabled) {
                            WorkoutTimerNotificationHelper.triggerContinuousVibration(appContext, 30000L)
                        }
                        WorkoutTimerNotificationHelper.sendTimerFinishedNotification(
                            context = appContext,
                            totalSeconds = total,
                            title = "⏰ 訓練組間休息時間到！",
                            message = "休息結束（${WorkoutTimerFormatter.formatSecondsToDisplay(total)}），準備進行下一組訓練！💪"
                        )
                    }

                    // Count up overdue seconds (like native clock timer)
                    val finishedTime = System.currentTimeMillis()
                    while (_workoutTimerState.value.isCountdownFinished) {
                        delay(500L)
                        val overdue = ((System.currentTimeMillis() - finishedTime) / 1000L).toInt()
                        _workoutTimerState.value = _workoutTimerState.value.copy(
                            overdueSeconds = overdue
                        )
                    }
                    break
                }
            }
        }
    }

    fun pauseCountdown() {
        countdownJob?.cancel()
        countdownJob = null
        WorkoutTimerNotificationHelper.stopVibration()
        _workoutTimerState.value = _workoutTimerState.value.copy(
            isCountdownRunning = false,
            isCountdownPaused = true
        )
    }

    fun resumeCountdown(context: Context) {
        startCountdown(context)
    }

    fun resetCountdown(newDurationSeconds: Int? = null) {
        countdownJob?.cancel()
        countdownJob = null
        WorkoutTimerNotificationHelper.stopVibration()
        val duration = newDurationSeconds ?: _workoutTimerState.value.countdownTotalSeconds
        _workoutTimerState.value = _workoutTimerState.value.copy(
            countdownTotalSeconds = duration,
            countdownRemainingSeconds = duration,
            isCountdownRunning = false,
            isCountdownPaused = false,
            isCountdownFinished = false,
            overdueSeconds = 0
        )
        lastBeepRemaining = -1
    }

    fun dismissCountdownAlert() {
        countdownJob?.cancel()
        countdownJob = null
        WorkoutTimerNotificationHelper.stopVibration()
        _workoutTimerState.value = _workoutTimerState.value.copy(
            isCountdownRunning = false,
            isCountdownPaused = false,
            isCountdownFinished = false,
            countdownRemainingSeconds = _workoutTimerState.value.countdownTotalSeconds,
            overdueSeconds = 0
        )
    }

    // Stopwatch Controls
    fun startStopwatch() {
        if (_workoutTimerState.value.isStopwatchRunning) return
        val startElapsed = _workoutTimerState.value.stopwatchElapsedMillis
        val baseTime = System.currentTimeMillis() - startElapsed

        _workoutTimerState.value = _workoutTimerState.value.copy(
            isStopwatchRunning = true
        )

        stopwatchJob?.cancel()
        stopwatchJob = viewModelScope.launch(Dispatchers.Default) {
            while (true) {
                delay(33L) // ~30 fps updates for smooth display
                val now = System.currentTimeMillis()
                val elapsed = now - baseTime
                _workoutTimerState.value = _workoutTimerState.value.copy(
                    stopwatchElapsedMillis = elapsed
                )
            }
        }
    }

    fun pauseStopwatch() {
        stopwatchJob?.cancel()
        stopwatchJob = null
        _workoutTimerState.value = _workoutTimerState.value.copy(
            isStopwatchRunning = false
        )
    }

    fun resumeStopwatch() {
        startStopwatch()
    }

    fun resetStopwatch() {
        stopwatchJob?.cancel()
        stopwatchJob = null
        _workoutTimerState.value = _workoutTimerState.value.copy(
            stopwatchElapsedMillis = 0L,
            isStopwatchRunning = false,
            stopwatchLaps = emptyList()
        )
    }

    fun recordStopwatchLap() {
        val current = _workoutTimerState.value
        val currentElapsed = current.stopwatchElapsedMillis
        val previousSplit = current.stopwatchLaps.firstOrNull()?.splitTimeMillis ?: 0L
        val lapTime = (currentElapsed - previousSplit).coerceAtLeast(0L)
        val newLap = StopwatchLap(
            lapIndex = current.stopwatchLaps.size + 1,
            lapTimeMillis = lapTime,
            splitTimeMillis = currentElapsed
        )
        _workoutTimerState.value = current.copy(
            stopwatchLaps = listOf(newLap) + current.stopwatchLaps
        )
    }

    fun toggleTimerSound() {
        _workoutTimerState.value = _workoutTimerState.value.copy(
            soundEnabled = !_workoutTimerState.value.soundEnabled
        )
    }

    fun toggleTimerVibration() {
        _workoutTimerState.value = _workoutTimerState.value.copy(
            vibrationEnabled = !_workoutTimerState.value.vibrationEnabled
        )
    }
}

class DietViewModelFactory(
    private val repository: DietRepository,
    private val mealPreferences: MealPreferences? = null
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(DietViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return DietViewModel(repository, mealPreferences) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
