package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddCircleOutline
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.BrunchDining
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Cookie
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LocalCafe
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WbTwilight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.CarbCycleType
import com.example.data.model.CustomFood
import com.example.data.model.FoodRecord
import com.example.data.model.MealConfig
import com.example.data.model.MealType
import com.example.ui.DietViewModel
import androidx.compose.ui.unit.sp
import com.example.ui.theme.CarbsColor
import com.example.ui.theme.FatColor
import com.example.ui.theme.ProteinColor

private data class DailyNutrients(
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val sugars: Double,
    val fiber: Double,
    val sodium: Double,
    val potassium: Double
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DietTrackerScreen(
    viewModel: DietViewModel
) {
    val records by viewModel.currentDayRecords.collectAsStateWithLifecycle()
    val formattedDate by viewModel.formattedDateDisplay.collectAsStateWithLifecycle()
    val currentCarbCycle by viewModel.currentCarbCycleType.collectAsStateWithLifecycle()
    val highPreset by viewModel.highCarbPreset.collectAsStateWithLifecycle()
    val mediumPreset by viewModel.mediumCarbPreset.collectAsStateWithLifecycle()
    val lowPreset by viewModel.lowCarbPreset.collectAsStateWithLifecycle()
    val customPreset by viewModel.customCarbPreset.collectAsStateWithLifecycle()
    val calorieGoal by viewModel.calorieGoal.collectAsStateWithLifecycle()
    val carbsGoal by viewModel.carbsGoal.collectAsStateWithLifecycle()
    val fatGoal by viewModel.fatGoal.collectAsStateWithLifecycle()
    val proteinGoal by viewModel.proteinGoal.collectAsStateWithLifecycle()
    val sodiumGoal by viewModel.sodiumGoal.collectAsStateWithLifecycle()
    val potassiumGoal by viewModel.potassiumGoal.collectAsStateWithLifecycle()

    val showAddSheet by viewModel.showAddFoodSheet.collectAsStateWithLifecycle()
    val editingRecord by viewModel.editingRecord.collectAsStateWithLifecycle()
    val showGoalDialog by viewModel.showGoalDialog.collectAsStateWithLifecycle()
    val activeMeals by viewModel.activeMeals.collectAsStateWithLifecycle()
    val activeMealType by viewModel.activeMealType.collectAsStateWithLifecycle()
    val selectedFoodForPortion by viewModel.selectedFoodItem.collectAsStateWithLifecycle()
    val myCustomFoods by viewModel.myCustomFoods.collectAsStateWithLifecycle()

    var showSelectMealPicker by remember { mutableStateOf(false) }
    var showAddCustomMealDialog by remember { mutableStateOf(false) }
    var mealToDelete by remember { mutableStateOf<MealConfig?>(null) }

    // Aggregate statistics for the 7 requested nutrients (cached with remember to prevent scrolling recomputation):
    val recordsByMeal = remember(records) {
        records.groupBy { it.mealType }
    }

    val dailyNutrients = remember(records) {
        var cal = 0.0
        var pro = 0.0
        var carb = 0.0
        var fat = 0.0
        var sug = 0.0
        var fib = 0.0
        var sod = 0.0
        var pot = 0.0
        for (i in records.indices) {
            val r = records[i]
            cal += r.calories
            pro += r.protein
            carb += r.carbs
            fat += r.fat
            sug += r.sugars
            fib += r.fiber
            sod += r.sodium
            pot += r.potassium
        }
        DailyNutrients(
            calories = Math.round(cal * 10.0) / 10.0,
            protein = Math.round(pro * 10.0) / 10.0,
            carbs = Math.round(carb * 10.0) / 10.0,
            fat = Math.round(fat * 10.0) / 10.0,
            sugars = Math.round(sug * 10.0) / 10.0,
            fiber = Math.round(fib * 10.0) / 10.0,
            sodium = Math.round(sod * 10.0) / 10.0,
            potassium = Math.round(pot * 10.0) / 10.0
        )
    }
    val totalCalories = dailyNutrients.calories
    val totalProtein = dailyNutrients.protein
    val totalCarbs = dailyNutrients.carbs
    val totalFat = dailyNutrients.fat
    val totalSugars = dailyNutrients.sugars
    val totalFiber = dailyNutrients.fiber
    val totalSodium = dailyNutrients.sodium
    val totalPotassium = dailyNutrients.potassium

    if (showAddSheet) {
        AddFoodSheetHost(viewModel = viewModel)
    } else {
        Scaffold(
            contentWindowInsets = WindowInsets.statusBars,
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "飲食記錄",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    actions = {
                        IconButton(
                            onClick = {
                                viewModel.openAddFoodSheet(viewModel.activeMealType.value)
                            },
                            modifier = Modifier.testTag("diet_screen_search_action_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "搜尋食物庫與我的飲食"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    windowInsets = WindowInsets.statusBars
                )
            },
            floatingActionButton = {
                ExtendedFloatingActionButton(
                    onClick = { showSelectMealPicker = true },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    shape = RoundedCornerShape(28.dp),
                    modifier = Modifier.testTag("main_add_food_fab")
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "記錄飲食",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        ) { innerPadding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(top = 12.dp, bottom = 88.dp)
            ) {
                // 1. Date Navigator Card
                item(key = "date_navigator_card", contentType = "header") {
                    DateNavigatorCard(
                        dateText = formattedDate,
                        onPrevious = { viewModel.previousDay() },
                        onNext = { viewModel.nextDay() },
                        onToday = { viewModel.setToday() },
                        onSelectDate = { viewModel.setDateFromUtcMillis(it) }
                    )
                }

                // 1.5 Quick Food Search Entry Bar
                item(key = "diet_screen_quick_search_bar", contentType = "search") {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .clickable {
                                viewModel.openAddFoodSheet(viewModel.activeMealType.value)
                            }
                            .testTag("diet_screen_quick_search_box"),
                        shape = RoundedCornerShape(24.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "搜尋",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "搜尋超商、官方資料庫或我的飲食...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                            )
                        }
                    }
                }

                // 2. Calorie and 7 Nutrients Summary Dashboard
                item(key = "calorie_overview_dashboard", contentType = "dashboard") {
                    CalorieOverviewCard(
                        consumed = totalCalories,
                        calorieGoal = calorieGoal,
                        protein = totalProtein,
                        proteinGoal = proteinGoal,
                        carbs = totalCarbs,
                        carbsGoal = carbsGoal,
                        fat = totalFat,
                        fatGoal = fatGoal,
                        sugars = totalSugars,
                        fiber = totalFiber,
                        sodium = totalSodium,
                        sodiumGoal = sodiumGoal,
                        potassium = totalPotassium,
                        potassiumGoal = potassiumGoal,
                        currentCarbCycle = currentCarbCycle,
                        onSelectCarbCycle = { viewModel.setCarbCycleType(it) },
                        onEditGoal = { viewModel.openGoalDialog() }
                    )
                }

                // 3. Meal Sections
                itemsIndexed(
                    items = activeMeals,
                    key = { _, mealConfig -> "meal_section_${mealConfig.mealType.name}" },
                    contentType = { _, _ -> "meal_section" }
                ) { index, mealConfig ->
                    val mealRecords = recordsByMeal[mealConfig.mealType] ?: emptyList()
                    val mealCalories = remember(mealRecords) { mealRecords.sumOf { it.calories }.toInt() }
                    MealSectionCard(
                        mealConfig = mealConfig,
                        calories = mealCalories,
                        records = mealRecords,
                        myCustomFoods = myCustomFoods,
                        onAddFood = { viewModel.openAddFoodSheet(mealConfig.mealType) },
                        onEditFood = { viewModel.startEditingRecord(it) },
                        onDeleteFood = { viewModel.deleteRecord(it) },
                        onDeleteMeal = if (viewModel.canDeleteMeal(mealConfig)) {
                            { mealToDelete = mealConfig }
                        } else null,
                        onMoveUp = if (index > 0) {
                            { viewModel.moveMealUp(mealConfig) }
                        } else null,
                        onMoveDown = if (index < activeMeals.size - 1) {
                            { viewModel.moveMealDown(mealConfig) }
                        } else null
                    )
                }

                // 4. Add more meals button (Requirement 3: 主頁新增一個按鈕 可以新增更多餐 例如練後餐 最多可新增10餐)
                item(key = "add_more_meals_action", contentType = "action_button") {
                    if (activeMeals.size < 10) {
                        OutlinedButton(
                            onClick = { showAddCustomMealDialog = true },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .testTag("add_more_meals_button"),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.2.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.04f),
                                contentColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.AddCircleOutline,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "新增更多餐別 (例如練後餐、早午餐)",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                            ) {
                                Text(
                                    text = "${activeMeals.size}/10",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    } else {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp, horizontal = 16.dp),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "已達上限 10 餐設定",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Edit Existing Record Dialog
    editingRecord?.let { record ->
        EditFoodRecordDialog(
            record = record,
            onDismiss = { viewModel.closeEditingRecord() },
            onSave = { id, name, meal, amount, unit, cal, carbs, sug, fib, p, f, sod, pot ->
                viewModel.updateExistingRecord(
                    id = id,
                    name = name,
                    mealType = meal,
                    amount = amount,
                    unit = unit,
                    calories = cal,
                    carbs = carbs,
                    sugars = sug,
                    fiber = fib,
                    protein = p,
                    fat = f,
                    sodium = sod,
                    potassium = pot
                )
            },
            onDelete = { viewModel.deleteRecord(it) }
        )
    }

    // Goal Setting Dialog
    if (showGoalDialog) {
        GoalSettingDialog(
            initialCycleType = currentCarbCycle,
            highPreset = highPreset,
            mediumPreset = mediumPreset,
            lowPreset = lowPreset,
            customPreset = customPreset,
            onDismiss = { viewModel.closeGoalDialog() },
            onSaveAll = { finalHigh, finalMed, finalLow, finalCustom, activeType ->
                viewModel.saveCarbCyclePreset(finalHigh)
                viewModel.saveCarbCyclePreset(finalMed)
                viewModel.saveCarbCyclePreset(finalLow)
                viewModel.saveCarbCyclePreset(finalCustom)
                viewModel.setCarbCycleType(activeType)
                viewModel.closeGoalDialog()
            }
        )
    }

    // Select Meal Dialog (Requirement 2: 按下這個按鈕時先讓使用者選取要輸入哪一餐)
    if (showSelectMealPicker) {
        SelectMealDialog(
            meals = activeMeals,
            records = records,
            onSelectMeal = { selectedMeal ->
                showSelectMealPicker = false
                viewModel.openAddFoodSheet(selectedMeal)
            },
            onAddNewMealClick = {
                showSelectMealPicker = false
                showAddCustomMealDialog = true
            },
            onDismiss = { showSelectMealPicker = false }
        )
    }

    // Add Custom Meal Dialog (Requirement 3: 主頁新增一個按鈕 可以新增更多餐 例如練後餐 最多可新增10餐)
    if (showAddCustomMealDialog) {
        AddCustomMealDialog(
            currentCount = activeMeals.size,
            onConfirm = { customMealName ->
                showAddCustomMealDialog = false
                viewModel.addCustomMeal(customMealName)
            },
            onDismiss = { showAddCustomMealDialog = false }
        )
    }

    // Delete Custom Meal Confirmation
    if (mealToDelete != null) {
        AlertDialog(
            onDismissRequest = { mealToDelete = null },
            title = { Text("刪除「${mealToDelete?.displayName}」？") },
            text = { Text("刪除此餐別後，該餐別的所有飲食記錄將一併移除，並釋出餐別名額。確定要刪除嗎？") },
            confirmButton = {
                Button(
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    onClick = {
                        mealToDelete?.let { viewModel.removeCustomMeal(it.mealType) }
                        mealToDelete = null
                    }
                ) {
                    Text("確認刪除")
                }
            },
            dismissButton = {
                TextButton(onClick = { mealToDelete = null }) {
                    Text("取消")
                }
            }
        )
    }

    // Portion adjustment & Fine-tuning Dialog
    selectedFoodForPortion?.let { food ->
        PortionDialog(
            food = food,
            mealType = activeMealType,
            mealDisplayName = viewModel.getMealDisplayName(activeMealType),
            onDismiss = { viewModel.closePortionDialog() },
            onConfirm = { name, meal, amount, unit, cal, carbs, sug, fib, p, f, sod, pot, saveToLibrary, brand, barcode ->
                viewModel.confirmAddOrEditFood(
                    foodName = name,
                    mealType = meal,
                    amount = amount,
                    unit = unit,
                    calories = cal,
                    carbs = carbs,
                    sugars = sug,
                    fiber = fib,
                    protein = p,
                    fat = f,
                    sodium = sod,
                    potassium = pot,
                    saveToCustomLibrary = saveToLibrary,
                    brand = brand,
                    imageUrl = food.imageUrl,
                    barcode = barcode
                )
            }
        )
    }
}

@Composable
private fun AddFoodSheetHost(
    viewModel: DietViewModel
) {
    val activeMealType by viewModel.activeMealType.collectAsStateWithLifecycle()
    val activeMeals by viewModel.activeMeals.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val hasSearched by viewModel.hasSearched.collectAsStateWithLifecycle()
    val recentFoods by viewModel.recentFoods.collectAsStateWithLifecycle()
    val presetResults by viewModel.presetResults.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()
    val isAiEstimating by viewModel.isEstimatingAi.collectAsStateWithLifecycle()
    val myCustomFoods by viewModel.myCustomFoods.collectAsStateWithLifecycle()
    val showCustomFoodDialog by viewModel.showCustomFoodDialog.collectAsStateWithLifecycle()

    val showBarcodeScanner by viewModel.showBarcodeScannerDialog.collectAsStateWithLifecycle()
    val isSearchingBarcode by viewModel.isSearchingBarcode.collectAsStateWithLifecycle()
    val barcodeError by viewModel.barcodeSearchError.collectAsStateWithLifecycle()

    val showPhotoScanner by viewModel.showPhotoScannerDialog.collectAsStateWithLifecycle()
    val isAnalyzingPhoto by viewModel.isAnalyzingPhoto.collectAsStateWithLifecycle()
    val photoError by viewModel.photoAnalysisError.collectAsStateWithLifecycle()

    AddFoodScreen(
        mealType = activeMealType,
        mealDisplayName = viewModel.getMealDisplayName(activeMealType),
        activeMeals = activeMeals,
        onMealTypeChange = { viewModel.setActiveMealType(it) },
        searchQuery = searchQuery,
        hasSearched = hasSearched,
        recentRecords = recentFoods,
        myCustomFoods = myCustomFoods,
        presetResults = presetResults,
        isSearching = isSearching,
        onQueryChange = { viewModel.onSearchQueryChanged(it) },
        onSearchSubmit = { viewModel.performSearch(it) },
        onResetSearch = { viewModel.resetSearchToHistory() },
        onSelectFood = { viewModel.selectFoodForPortion(it) },
        onSelectRecord = { viewModel.selectRecordForPortion(it) },
        onSelectCustomFood = { viewModel.selectCustomFoodForPortion(it) },
        onQuickAddRecord = { viewModel.quickAddRecord(it) },
        onQuickAddCustomFood = { viewModel.quickAddCustomFood(it) },
        onDeleteCustomFood = { viewModel.deleteCustomFood(it) },
        onOpenCustomFood = { viewModel.openCustomFoodDialog() },
        onOpenBarcodeScanner = { viewModel.openBarcodeScannerDialog() },
        onOpenPhotoScanner = { viewModel.openPhotoScannerDialog() },
        onAiPhotoEstimate = { bitmap ->
            viewModel.estimateNutritionFromImage(bitmap)
        },
        onDismiss = { viewModel.closeAddFoodSheet() }
    )

    // Barcode Scanner Dialog
    if (showBarcodeScanner) {
        BarcodeScannerDialog(
            isSearching = isSearchingBarcode,
            errorMessage = barcodeError,
            onSearchBarcode = { viewModel.searchByBarcode(it) },
            onOpenCustomWithAi = {
                viewModel.closeBarcodeScannerDialog()
                viewModel.openCustomFoodDialog()
            },
            onOpenPhotoScanner = {
                viewModel.closeBarcodeScannerDialog()
                viewModel.openPhotoScannerDialog()
            },
            onDismiss = { viewModel.closeBarcodeScannerDialog() }
        )
    }

    // Photo Nutrition Scanner Dialog (大取景拍照辨識)
    if (showPhotoScanner) {
        PhotoNutritionScannerDialog(
            isAnalyzing = isAnalyzingPhoto,
            errorMessage = photoError,
            onCapturePhoto = { bitmap ->
                viewModel.analyzePhotoNutrition(bitmap)
            },
            onSwitchToBarcode = {
                viewModel.closePhotoScannerDialog()
                viewModel.openBarcodeScannerDialog()
            },
            onDismiss = { viewModel.closePhotoScannerDialog() }
        )
    }

    // Custom Food Dialog (AI + Manual Entry)
    if (showCustomFoodDialog) {
        CustomFoodDialog(
            initialMealType = activeMealType,
            availableMeals = activeMeals,
            isAiEstimating = isAiEstimating,
            onAiEstimate = { name, onFilled ->
                viewModel.estimateNutritionForCustomFood(name, onFilled)
            },
            onAiPhotoEstimate = { bitmap, onFilled ->
                viewModel.estimateNutritionFromImage(bitmap) { est ->
                    onFilled(
                        est.name,
                        est.calories,
                        est.protein,
                        est.carbs,
                        est.fat,
                        est.sugars,
                        est.fiber,
                        est.sodium,
                        est.potassium,
                        est.servingAmount,
                        est.servingUnit
                    )
                }
            },
            onDismiss = { viewModel.closeCustomFoodDialog() },
            onConfirm = { name, meal, amount, unit, cal, carbs, sug, fib, p, f, sod, pot, saveToLib, brand, barcode ->
                viewModel.confirmAddOrEditFood(
                    foodName = name,
                    mealType = meal,
                    amount = amount,
                    unit = unit,
                    calories = cal,
                    carbs = carbs,
                    sugars = sug,
                    fiber = fib,
                    protein = p,
                    fat = f,
                    sodium = sod,
                    potassium = pot,
                    saveToCustomLibrary = saveToLib,
                    brand = brand,
                    barcode = barcode
                )
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateNavigatorCard(
    dateText: String,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
    onSelectDate: (Long) -> Unit = {}
) {
    var showDatePicker by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onPrevious)
                    .testTag("date_prev_button")
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "前一天",
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("昨天", style = MaterialTheme.typography.labelMedium)
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = { showDatePicker = true })
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .testTag("date_today_button")
            ) {
                Icon(
                    imageVector = Icons.Default.CalendarToday,
                    contentDescription = null,
                    modifier = Modifier.size(15.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = dateText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Surface(
                shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onNext)
                    .testTag("date_next_button")
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("明天", style = MaterialTheme.typography.labelMedium)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "後一天",
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            onSelectDate(millis)
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("確定", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        onToday()
                        showDatePicker = false
                    }
                ) {
                    Text("回到今天")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@Composable
fun CalorieOverviewCard(
    consumed: Double,
    calorieGoal: Int,
    protein: Double,
    proteinGoal: Double,
    carbs: Double,
    carbsGoal: Double,
    fat: Double,
    fatGoal: Double,
    sugars: Double,
    fiber: Double,
    sodium: Double,
    sodiumGoal: Double,
    potassium: Double,
    potassiumGoal: Double,
    currentCarbCycle: CarbCycleType = CarbCycleType.MEDIUM,
    onSelectCarbCycle: (CarbCycleType) -> Unit = {},
    onEditGoal: () -> Unit
) {
    var showMicroNutrients by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Card 1: 卡路里消耗 (Calories) - styled directly from user reference
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("calorie_overview_card")
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Header with Carb Cycle quick switch pills
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "卡路里消耗",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // Carb Cycle Display
                        val currentPillBg = when {
                            currentCarbCycle == CarbCycleType.HIGH -> Color(0xFFFFE0B2)
                            currentCarbCycle == CarbCycleType.MEDIUM -> Color(0xFFC8E6C9)
                            currentCarbCycle == CarbCycleType.LOW -> Color(0xFFBBDEFB)
                            else -> Color(0xFFE1BEE7)
                        }
                        val currentPillTextColor = when {
                            currentCarbCycle == CarbCycleType.HIGH -> Color(0xFFBF360C)
                            currentCarbCycle == CarbCycleType.MEDIUM -> Color(0xFF1B5E20)
                            currentCarbCycle == CarbCycleType.LOW -> Color(0xFF0D47A1)
                            else -> Color(0xFF4A148C)
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = currentPillBg
                        ) {
                            Text(
                                text = when (currentCarbCycle) {
                                    CarbCycleType.HIGH -> "高碳日"
                                    CarbCycleType.MEDIUM -> "中碳日"
                                    CarbCycleType.LOW -> "低碳日"
                                    CarbCycleType.CUSTOM -> "自訂日"
                                },
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = currentPillTextColor,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                                )
                                .clickable(onClick = onEditGoal),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "設定高／中／低碳目標",
                                modifier = Modifier.size(15.dp),
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Numbers row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = "%,d".format(consumed.toInt()),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = " 大卡 / %,d".format(calorieGoal),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 3.dp)
                        )
                    }

                    val remaining = calorieGoal - consumed.toInt()
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (remaining >= 0)
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
                        else
                            MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.7f)
                    ) {
                        Text(
                            text = if (remaining >= 0) "尚餘 $remaining" else "超過目標 ${-remaining}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (remaining >= 0)
                                MaterialTheme.colorScheme.onSurfaceVariant
                            else
                                MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                val calProgress = if (calorieGoal > 0) (consumed / calorieGoal).toFloat().coerceIn(0f, 1f) else 0f
                val arcColor = if (consumed <= calorieGoal) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    androidx.compose.foundation.Canvas(modifier = Modifier.size(160.dp)) {
                        drawArc(
                            color = trackColor,
                            startAngle = 0f,
                            sweepAngle = 360f,
                            useCenter = false,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(
                                width = 12.dp.toPx(),
                                cap = androidx.compose.ui.graphics.StrokeCap.Round
                            )
                        )
                        drawArc(
                            color = arcColor,
                            startAngle = -90f,
                            sweepAngle = calProgress * 360f,
                            useCenter = false,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(
                                width = 12.dp.toPx(),
                                cap = androidx.compose.ui.graphics.StrokeCap.Round
                            )
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = consumed.toInt().toString(),
                            style = MaterialTheme.typography.displayMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "/ ${calorieGoal.toInt()} kcal",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Card 2: 營養攝取 (Nutrition Intake Card) - 3 macros + 鈉/鉀 goals
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("nutrition_intake_card")
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "營養攝取",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // 3 Macros: 碳水化合物, 蛋白質, 脂肪 (C -> P -> F)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    NutrientMacroColumn(
                        label = "碳水化合物",
                        current = carbs,
                        goal = carbsGoal,
                        unit = "克",
                        barColor = Color(0xFF00897B),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    NutrientMacroColumn(
                        label = "蛋白質",
                        current = protein,
                        goal = proteinGoal,
                        unit = "克",
                        barColor = Color(0xFFFB8C00),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    NutrientMacroColumn(
                        label = "脂肪",
                        current = fat,
                        goal = fatGoal,
                        unit = "克",
                        barColor = Color(0xFFB71C1C),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                Spacer(modifier = Modifier.height(14.dp))

                // 鈉 & 鉀 (User requested: 鈉 鉀 都可以讓使用者設定目標值)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    NutrientMacroColumn(
                        label = "鈉 (Sodium)",
                        current = sodium,
                        goal = sodiumGoal,
                        unit = "毫克",
                        barColor = if (sodium > sodiumGoal) MaterialTheme.colorScheme.error else Color(0xFF1E88E5),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    NutrientMacroColumn(
                        label = "鉀 (Potassium)",
                        current = potassium,
                        goal = potassiumGoal,
                        unit = "毫克",
                        barColor = Color(0xFF43A047),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Subtle expandable row for 糖 & 膳食纖維
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showMicroNutrients = !showMicroNutrients }
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "其他營養標示 (糖: ${sugars}g · 纖維: ${fiber}g)",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Icon(
                        imageVector = if (showMicroNutrients) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp)
                    )
                }

                AnimatedVisibility(visible = showMicroNutrients) {
                    Column(modifier = Modifier.padding(top = 8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            MicroNutrientPill(
                                label = "糖",
                                value = "${sugars}g",
                                subtext = "衛福建議 <50g",
                                color = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.weight(1f)
                            )
                            MicroNutrientPill(
                                label = "膳食纖維",
                                value = "${fiber}g",
                                subtext = "衛福建議 ≥25g",
                                color = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NutrientMacroColumn(
    label: String,
    current: Double,
    goal: Double,
    unit: String,
    barColor: Color,
    modifier: Modifier = Modifier
) {
    val progress = if (goal > 0) (current / goal).toFloat().coerceIn(0f, 1f) else 0f
    
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier.size(64.dp),
            contentAlignment = Alignment.Center
        ) {
            val trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                drawArc(
                    color = trackColor,
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(
                        width = 6.dp.toPx(),
                        cap = androidx.compose.ui.graphics.StrokeCap.Round
                    )
                )
                drawArc(
                    color = barColor,
                    startAngle = -90f,
                    sweepAngle = progress * 360f,
                    useCenter = false,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(
                        width = 6.dp.toPx(),
                        cap = androidx.compose.ui.graphics.StrokeCap.Round
                    )
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "${current.toInt()}",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "/ ${goal.toInt()}$unit",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}

@Composable
fun MicroNutrientPill(
    label: String,
    value: String,
    subtext: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = color.copy(alpha = 0.1f),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = color)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = color)
            Text(text = subtext, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun MealSectionCard(
    mealConfig: MealConfig,
    calories: Int,
    records: List<FoodRecord>,
    myCustomFoods: List<CustomFood> = emptyList(),
    onAddFood: () -> Unit,
    onEditFood: (FoodRecord) -> Unit,
    onDeleteFood: (FoodRecord) -> Unit,
    onDeleteMeal: (() -> Unit)? = null,
    onMoveUp: (() -> Unit)? = null,
    onMoveDown: (() -> Unit)? = null
) {
    val mealType = mealConfig.mealType
    val mealCarbs = remember(records) { records.sumOf { it.carbs } }
    val mealProtein = remember(records) { records.sumOf { it.protein } }
    val mealFat = remember(records) { records.sumOf { it.fat } }

    val density = LocalDensity.current
    val thresholdPx = with(density) { 90.dp.toPx() }
    var offsetY by remember { mutableStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }
    val scale = if (isDragging) 1.04f else 1f
    val elevation = if (isDragging) 8.dp else 1.dp

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isDragging || offsetY != 0f) {
                    Modifier.graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        translationY = offsetY
                    }
                } else Modifier
            )
            .testTag("meal_section_${mealType.name}")
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Section Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .background(
                                MaterialTheme.colorScheme.secondaryContainer,
                                RoundedCornerShape(10.dp)
                            )
                            .then(
                                if (onMoveUp != null || onMoveDown != null) {
                                    Modifier.pointerInput(onMoveUp, onMoveDown) {
                                        detectDragGesturesAfterLongPress(
                                            onDragStart = {
                                                isDragging = true
                                            },
                                            onDragEnd = {
                                                isDragging = false
                                                offsetY = 0f
                                            },
                                            onDragCancel = {
                                                isDragging = false
                                                offsetY = 0f
                                            },
                                            onDrag = { change, dragAmount ->
                                                change.consume()
                                                offsetY += dragAmount.y
                                                if (offsetY > thresholdPx && onMoveDown != null) {
                                                    onMoveDown()
                                                    offsetY = 0f
                                                } else if (offsetY < -thresholdPx && onMoveUp != null) {
                                                    onMoveUp()
                                                    offsetY = 0f
                                                }
                                            }
                                        )
                                    }
                                } else Modifier
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = getMealIcon(mealType, mealConfig.displayName),
                            contentDescription = "長按圖示可調整餐別順序",
                            tint = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = mealConfig.displayName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 2.dp)
                        ) {
                            Text(
                                text = "C: ${mealCarbs.toInt()}g",
                                style = MaterialTheme.typography.labelSmall,
                                color = CarbsColor,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "P: ${mealProtein.toInt()}g",
                                style = MaterialTheme.typography.labelSmall,
                                color = ProteinColor,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "F: ${mealFat.toInt()}g",
                                style = MaterialTheme.typography.labelSmall,
                                color = FatColor,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "$calories 卡",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                            )
                            .clickable(onClick = onAddFood)
                            .testTag("add_to_meal_${mealType.name}"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "新增",
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    if (onDeleteMeal != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                                )
                            .clickable(onClick = onDeleteMeal)
                            .testTag("delete_meal_${mealType.name}"),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.DeleteOutline,
                                contentDescription = "刪除餐別",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Food Items or Empty State
            if (records.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    records.forEach { record ->
                        key(record.id) {
                            RecordedFoodItemRow(
                                record = record,
                                myCustomFoods = myCustomFoods,
                                onClick = { onEditFood(record) },
                                onDelete = { onDeleteFood(record) }
                            )
                        }
                    }
                }
            } else {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .clickable(onClick = onAddFood)
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "尚未記錄「${mealType.displayName}」，點此新增飲食",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RecordedFoodItemRow(
    record: FoodRecord,
    myCustomFoods: List<CustomFood> = emptyList(),
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("record_item_${record.id}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Details
            Column(modifier = Modifier.weight(1f)) {
                val matchedCustom = myCustomFoods.find { it.name == record.name }
                val matchedPreset = com.example.data.model.CommonFoodsDatabase.presetList.find { it.name == record.name }
                val brand = matchedCustom?.brand ?: matchedPreset?.brand ?: ""

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = record.name,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (brand.isNotBlank() && brand != "未分類") {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f))
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = brand,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = MaterialTheme.colorScheme.secondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "點擊編輯微調",
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Line 1: Portion and P/C/F
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${record.amount.toInt()}${record.unit}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "·",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "C:${record.carbs}g",
                        style = MaterialTheme.typography.labelSmall,
                        color = CarbsColor
                    )
                    Text(
                        text = "P:${record.protein}g",
                        style = MaterialTheme.typography.labelSmall,
                        color = ProteinColor
                    )
                    Text(
                        text = "F:${record.fat}g",
                        style = MaterialTheme.typography.labelSmall,
                        color = FatColor
                    )
                }

                // Line 2: Sugars, Fiber, Sodium, Potassium (if available)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (record.sugars > 0.0) {
                        Text(
                            text = "糖:${record.sugars}g",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                    if (record.fiber > 0.0) {
                        Text(
                            text = "纖維:${record.fiber}g",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                    if (record.sodium > 0.0) {
                        Text(
                            text = "鈉:${record.sodium.toInt()}mg",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (record.potassium > 0.0) {
                        Text(
                            text = "鉀:${record.potassium.toInt()}mg",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Calories
            Text(
                text = "${record.calories.toInt()} 卡",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            // Delete button
            IconButton(
                onClick = onDelete,
                modifier = Modifier
                    .size(32.dp)
                    .testTag("delete_record_${record.id}")
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "刪除項目",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

fun getMealIcon(mealType: MealType, mealName: String = ""): ImageVector {
    val name = mealName.lowercase()
    return when {
        mealType == MealType.BREAKFAST -> Icons.Default.WbTwilight
        mealType == MealType.LUNCH -> Icons.Default.LightMode
        mealType == MealType.DINNER -> Icons.Default.DarkMode
        mealType == MealType.SNACK -> Icons.Default.Cookie
        name.contains("練") || name.contains("健身") || name.contains("運動") -> Icons.Default.FitnessCenter
        name.contains("茶") || name.contains("咖啡") -> Icons.Default.LocalCafe
        name.contains("宵夜") || name.contains("消夜") || name.contains("夜") -> Icons.Default.Bedtime
        name.contains("早午") -> Icons.Default.BrunchDining
        name.contains("水") || name.contains("飲") -> Icons.Default.LocalDrink
        else -> Icons.Default.Restaurant
    }
}

@Composable
fun SelectMealDialog(
    meals: List<MealConfig>,
    records: List<FoodRecord>,
    onSelectMeal: (MealType) -> Unit,
    onAddNewMealClick: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "選擇記錄餐別",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "請選擇要將飲食記錄加入哪一餐：",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "關閉")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    meals.forEach { mealConfig ->
                        val mealRecords = records.filter { it.mealType == mealConfig.mealType }
                        val mealCal = mealRecords.sumOf { it.calories }.toInt()
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSelectMeal(mealConfig.mealType)
                                }
                                .testTag("select_meal_option_${mealConfig.mealType.name}")
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(MaterialTheme.colorScheme.primaryContainer),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = getMealIcon(mealConfig.mealType, mealConfig.displayName),
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = mealConfig.displayName,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = if (mealCal > 0) "已記錄 $mealCal 卡 (${mealRecords.size}項)" else "尚無記錄",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = if (mealCal > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                )
                            }
                        }
                    }
                }

                if (meals.size < 10) {
                    Spacer(modifier = Modifier.height(12.dp))
                    TextButton(
                        onClick = onAddNewMealClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("select_meal_add_custom_button")
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("新增更多餐別 (如練後餐、早午餐)")
                    }
                }
            }
        }
    }
}

@Composable
fun AddCustomMealDialog(
    currentCount: Int,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var mealName by remember { mutableStateOf("") }
    val quickPresets = listOf("練後餐", "早午餐", "宵夜", "下午茶", "練前餐", "加餐", "補給餐")

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "新增自訂餐別",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "不侷限於早午晚餐，最多可設定 10 餐 ($currentCount/10)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "關閉")
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Input field
                OutlinedTextField(
                    value = mealName,
                    onValueChange = { mealName = it },
                    label = { Text("餐別名稱") },
                    placeholder = { Text("例如：練後餐、早午餐、宵夜") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("custom_meal_name_input")
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Quick presets
                Text(
                    text = "常用推薦名稱：",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    quickPresets.forEach { preset ->
                        AssistChip(
                            onClick = { mealName = preset },
                            label = { Text(preset) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("取消")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (mealName.isNotBlank()) {
                                onConfirm(mealName.trim())
                            }
                        },
                        enabled = mealName.isNotBlank() && currentCount < 10,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("confirm_add_custom_meal")
                    ) {
                        Text("確認新增")
                    }
                }
            }
        }
    }
}
