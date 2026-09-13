package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.verticalScroll
import com.example.data.model.ExerciseSet
import com.example.ui.components.NumericStepper
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.WorkoutWithExercises
import com.example.data.local.ExerciseWithSets
import com.example.data.model.WorkoutExercise
import com.example.ui.DietViewModel
import com.example.ui.timer.WorkoutTimerDialog
import com.example.ui.timer.WorkoutTimerFloatingButton

val DEFAULT_CARDIO_PRESETS = listOf(
    "慢跑", "跑步機", "飛輪單車", "划船機", "橢圓機",
    "跳繩", "快走・健走", "游泳", "波比跳", "開合跳",
    "戰繩訓練", "階梯機", "高強度間歇 (HIIT)"
)

fun isCardioExercise(exerciseName: String, bodyPart: String = ""): Boolean {
    val lowerName = exerciseName.lowercase().trim()
    val lowerPart = bodyPart.lowercase().trim()
    if (lowerPart.contains("有氧") || lowerPart.contains("cardio") || lowerPart.contains("心肺")) {
        return true
    }
    val cardioKeywords = listOf(
        "有氧", "cardio", "跑步", "慢跑", "快走", "健走", "散步", "跑步機",
        "單車", "自行車", "腳踏車", "飛輪", "划船機", "橢圓機", "跳繩",
        "游泳", "波比", "開合跳", "hiit", "高強度間歇", "間歇", "登山機",
        "階梯機", "踏步機", "戰繩", "爬樓梯", "滑雪機", "拳擊", "跳舞"
    )
    return cardioKeywords.any { lowerName.contains(it) }
}

data class PendingNewExercise(
    val workoutId: Long,
    val name: String,
    val bodyPart: String = ""
)

sealed class WorkoutGroupedItem {
    data class Single(val exerciseWithSets: com.example.data.local.ExerciseWithSets) : WorkoutGroupedItem()
    data class Superset(val groupId: Int, val exercises: List<com.example.data.local.ExerciseWithSets>) : WorkoutGroupedItem()
}

class SupersetExerciseInput(
    val name: String,
    initialSets: String = "3",
    initialReps: String = "10",
    initialWeight: String = "20"
) {
    var sets by mutableStateOf(initialSets)
    var reps by mutableStateOf(initialReps)
    var weight by mutableStateOf(initialWeight)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrainingTrackerScreen(viewModel: DietViewModel) {
    val workouts by viewModel.currentDayWorkouts.collectAsStateWithLifecycle()
    val formattedDate by viewModel.formattedDateDisplay.collectAsStateWithLifecycle()
    val selectedDateString by viewModel.selectedDateString.collectAsStateWithLifecycle()
    val timerState by viewModel.workoutTimerState.collectAsStateWithLifecycle()

    // Dialog state for exercise selection and detailed sets/reps/weight input
    var targetWorkoutForExercise by remember { mutableStateOf<WorkoutWithExercises?>(null) }
    var pendingNewExercise by remember { mutableStateOf<PendingNewExercise?>(null) }
    var pendingNewSuperset by remember { mutableStateOf<Pair<Long, List<String>>?>(null) }
    var editingExistingExercise by remember { mutableStateOf<com.example.data.local.ExerciseWithSets?>(null) }
    var showAddCardDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("訓練追蹤", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(
                        onClick = { viewModel.openWorkoutTimerDialog() },
                        modifier = Modifier.testTag("top_bar_timer_action_button")
                    ) {
                        Icon(
                            imageVector = if (timerState.isAnyTimerActive) Icons.Default.HourglassBottom else Icons.Default.Timer,
                            contentDescription = "碼表與計時器",
                            tint = if (timerState.isAnyTimerActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            WorkoutTimerFloatingButton(
                timerState = timerState,
                onClick = { viewModel.openWorkoutTimerDialog() },
                modifier = Modifier.padding(bottom = 8.dp)
            )
        },
        floatingActionButtonPosition = FabPosition.End
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            DateNavigatorCard(
                dateText = formattedDate,
                onPrevious = { viewModel.previousDay() },
                onNext = { viewModel.nextDay() },
                onToday = { viewModel.setToday() },
                onSelectDate = { viewModel.setDateFromUtcMillis(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                itemsIndexed(workouts, key = { _, it -> it.workout.id }) { index, workoutWithExercises ->
                    TrainingCard(
                        workoutWithExercises = workoutWithExercises,
                        canDeleteCard = workouts.size > 1,
                        viewModel = viewModel,
                        onUpdateBodyPart = { newBodyPart ->
                            viewModel.updateWorkoutBodyPart(workoutWithExercises.workout, newBodyPart)
                        },
                        onAddExerciseClick = {
                            targetWorkoutForExercise = workoutWithExercises
                        },
                        onEditExerciseClick = { exercise ->
                            editingExistingExercise = exercise
                        },
                        onDeleteCardClick = {
                            viewModel.deleteWorkout(workoutWithExercises.workout)
                        },
                        onDeleteExerciseClick = { exWithSets ->
                            viewModel.deleteExercise(exWithSets.exercise)
                        },
                        onMoveUp = if (index > 0) {
                            { viewModel.moveWorkoutUp(workoutWithExercises.workout) }
                        } else null,
                        onMoveDown = if (index < workouts.size - 1) {
                            { viewModel.moveWorkoutDown(workoutWithExercises.workout) }
                        } else null
                    )
                }

                // Add card button at the bottom (Max 5 cards)
                item {
                    val maxCards = 5
                    val canAddMoreCards = workouts.size < maxCards

                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = if (canAddMoreCards) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .clickable(enabled = canAddMoreCards) {
                                if (canAddMoreCards) {
                                    showAddCardDialog = true
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 16.dp, horizontal = 20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = if (canAddMoreCards) Icons.Default.Add else Icons.Default.Lock,
                                contentDescription = null,
                                tint = if (canAddMoreCards) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (canAddMoreCards) "新增訓練卡片 (${workouts.size}/$maxCards)" else "已達 $maxCards 張卡片上限",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (canAddMoreCards) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    // Step 1: Exercise Selection Dialog
    targetWorkoutForExercise?.let { workoutWithExercises ->
        SelectExerciseDialog(
            bodyPart = workoutWithExercises.workout.bodyPart,
            viewModel = viewModel,
            onDismiss = { targetWorkoutForExercise = null },
            onSelectExercise = { exerciseName ->
                pendingNewExercise = PendingNewExercise(workoutWithExercises.workout.id, exerciseName, workoutWithExercises.workout.bodyPart)
                targetWorkoutForExercise = null
            },
            onSelectSuperset = { exercisesList ->
                pendingNewSuperset = Pair(workoutWithExercises.workout.id, exercisesList)
                targetWorkoutForExercise = null
            }
        )
    }

    // Step 2: Set Sets, Reps, Weight for newly selected exercise
    pendingNewExercise?.let { pending ->
        EditExerciseDetailsDialog(
            initialName = pending.name,
            bodyPart = pending.bodyPart,
            initialSets = 3,
            initialReps = 10,
            initialWeight = 20.0,
            viewModel = viewModel,
            onDismiss = { pendingNewExercise = null },
            onConfirm = { name, sets, reps, weight ->
                viewModel.addExerciseToWorkout(pending.workoutId, name, sets, reps, weight)
                pendingNewExercise = null
            }
        )
    }

    // Step 2.5: Set Sets, Reps, Weight for newly selected superset
    pendingNewSuperset?.let { (workoutId, exercisesList) ->
        EditSupersetDetailsDialog(
            exercisesList = exercisesList,
            onDismiss = { pendingNewSuperset = null },
            onConfirm = { exerciseConfigs ->
                viewModel.addSupersetToWorkout(workoutId, exerciseConfigs)
                pendingNewSuperset = null
            }
        )
    }

    // Edit Sets, Reps, Weight for existing exercise
    editingExistingExercise?.let { exWithSets ->
        val currentWorkout = workouts.find { w -> w.exercises.any { it.exercise.id == exWithSets.exercise.id } }
        EditExerciseSetsDialog(
            initialName = exWithSets.exercise.name,
            bodyPart = currentWorkout?.workout?.bodyPart ?: "",
            initialSets = exWithSets.sets,
            viewModel = viewModel,
            onDismiss = { editingExistingExercise = null },
            onConfirm = { name, updatedSets ->
                viewModel.updateExercise(exWithSets.exercise.copy(name = name))
                updatedSets.forEach { set -> viewModel.updateExerciseSet(set) }
                editingExistingExercise = null
            }
        )
    }

    // Dialog for adding a new workout card with body part selection
    if (showAddCardDialog) {
        val defaultPart = when (workouts.size) {
            0 -> "胸"
            1 -> "背"
            2 -> "腿"
            3 -> "肩"
            4 -> "手臂"
            else -> "核心"
        }
        AddWorkoutCardDialog(
            initialBodyPart = defaultPart,
            viewModel = viewModel,
            onDismiss = { showAddCardDialog = false },
            onConfirm = { bodyPart ->
                viewModel.addWorkout(bodyPart, emptyList())
                showAddCardDialog = false
            }
        )
    }

    // Workout Timer & Stopwatch Dialog
    if (timerState.isDialogVisible) {
        WorkoutTimerDialog(
            viewModel = viewModel,
            timerState = timerState,
            onDismiss = { viewModel.closeWorkoutTimerDialog() }
        )
    }
}

@Composable
fun TrainingCard(
    workoutWithExercises: WorkoutWithExercises,
    canDeleteCard: Boolean,
    viewModel: DietViewModel,
    onUpdateBodyPart: (String) -> Unit,
    onAddExerciseClick: () -> Unit,
    onEditExerciseClick: (ExerciseWithSets) -> Unit,
    onDeleteCardClick: () -> Unit,
    onDeleteExerciseClick: (ExerciseWithSets) -> Unit,
    onMoveUp: (() -> Unit)? = null,
    onMoveDown: (() -> Unit)? = null
) {
    var isExpanded by remember { mutableStateOf(true) }
    var isEditingTitle by remember { mutableStateOf(false) }
    var titleText by remember(workoutWithExercises.workout.bodyPart) { mutableStateOf(workoutWithExercises.workout.bodyPart) }

    val density = LocalDensity.current
    val thresholdPx = with(density) { 90.dp.toPx() }
    var offsetY by remember { mutableStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (isDragging) 1.04f else 1f, label = "scale")
    val elevation by animateFloatAsState(if (isDragging) 8f else 1f, label = "elevation")

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation.dp),
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationY = offsetY
            }
            .pointerInput(onMoveUp, onMoveDown) {
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
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header Row (Matches Diet Tracker Card)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left Icon + Editable Body Part Name
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(
                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f),
                                RoundedCornerShape(12.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.FitnessCenter,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    if (isEditingTitle) {
                        val muscleGroupSuggestions by viewModel.muscleGroupSuggestions.collectAsStateWithLifecycle()
                        SuggestionTextField(
                            value = titleText,
                            onValueChange = { 
                                titleText = it
                                viewModel.updateMuscleGroupQuery(it)
                            },
                            suggestions = muscleGroupSuggestions.map { it.name },
                            label = "訓練部位",
                            placeholder = "輸入訓練部位",
                            modifier = Modifier.weight(1f),
                            trailingIcon = {
                                IconButton(onClick = {
                                    if (titleText.isNotBlank()) {
                                        onUpdateBodyPart(titleText.trim())
                                    }
                                    isEditingTitle = false
                                }) {
                                    Icon(Icons.Default.Check, contentDescription = "儲存", tint = MaterialTheme.colorScheme.primary)
                                }
                            }
                        )
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { isEditingTitle = true }
                        ) {
                            Text(
                                text = workoutWithExercises.workout.bodyPart.ifBlank { "點此輸入訓練部位" },
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (workoutWithExercises.workout.bodyPart.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "編輯部位",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Right side controls: Count + Expand + Add + Delete
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "${workoutWithExercises.exercises.size} 個動作",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )

                    IconButton(
                        onClick = { isExpanded = !isExpanded },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            contentDescription = if (isExpanded) "折疊" else "展開",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f))
                            .clickable(onClick = onAddExerciseClick),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "新增動作",
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    if (canDeleteCard) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f))
                                .clickable(onClick = onDeleteCardClick),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "刪除卡片",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            // Expanded Card Body
            AnimatedVisibility(visible = isExpanded) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    if (workoutWithExercises.exercises.isEmpty()) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .clickable(onClick = onAddExerciseClick)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Start
                            ) {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "尚未記錄「${workoutWithExercises.workout.bodyPart.ifBlank { "此部位" }}」，點此新增訓練內容",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            val groupedItems = remember(workoutWithExercises.exercises) {
                                val items = mutableListOf<WorkoutGroupedItem>()
                                val processedSupersets = mutableSetOf<Int>()
                                
                                workoutWithExercises.exercises.forEach { exWithSets ->
                                    val gid = exWithSets.exercise.supersetGroupId
                                    if (gid == null) {
                                        items.add(WorkoutGroupedItem.Single(exWithSets))
                                    } else {
                                        if (gid !in processedSupersets) {
                                            processedSupersets.add(gid)
                                            val group = workoutWithExercises.exercises.filter { it.exercise.supersetGroupId == gid }
                                            items.add(WorkoutGroupedItem.Superset(gid, group))
                                        }
                                    }
                                }
                                items
                            }

                            groupedItems.forEach { item ->
                                when (item) {
                                    is WorkoutGroupedItem.Single -> {
                                        val exWithSets = item.exerciseWithSets
                                        val exercise = exWithSets.exercise
                                        val sets = exWithSets.sets
                                        Surface(
                                            shape = RoundedCornerShape(14.dp),
                                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(14.dp))
                                                .clickable { onEditExerciseClick(exWithSets) }
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(8.dp)
                                                                .clip(CircleShape)
                                                                .background(MaterialTheme.colorScheme.primary)
                                                        )
                                                        Spacer(modifier = Modifier.width(10.dp))
                                                        Text(
                                                            text = exercise.name,
                                                            style = MaterialTheme.typography.bodyLarge,
                                                            fontWeight = FontWeight.SemiBold,
                                                            color = MaterialTheme.colorScheme.onSurface
                                                        )
                                                    }

                                                    Spacer(modifier = Modifier.height(4.dp))

                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        modifier = Modifier.padding(start = 18.dp)
                                                    ) {
                                                        val isCardio = isCardioExercise(exercise.name, workoutWithExercises.workout.bodyPart)
                                                        if (isCardio) {
                                                            val durationMinutes = sets.firstOrNull()?.reps ?: exercise.reps
                                                            Surface(
                                                                shape = RoundedCornerShape(8.dp),
                                                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                                                            ) {
                                                                Row(
                                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                                    verticalAlignment = Alignment.CenterVertically
                                                                ) {
                                                                    Icon(
                                                                        imageVector = Icons.Default.Timer,
                                                                        contentDescription = null,
                                                                        tint = MaterialTheme.colorScheme.primary,
                                                                        modifier = Modifier.size(16.dp)
                                                                    )
                                                                    Spacer(modifier = Modifier.width(6.dp))
                                                                    Text(
                                                                        text = "時間: $durationMinutes 分鐘",
                                                                        style = MaterialTheme.typography.labelMedium,
                                                                        fontWeight = FontWeight.Bold,
                                                                        color = MaterialTheme.colorScheme.primary
                                                                    )
                                                                }
                                                            }
                                                        } else if (sets.isNotEmpty()) {
                                                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                                sets.forEachIndexed { i, set ->
                                                                    val weightText = if (set.weight % 1.0 == 0.0) "${set.weight.toInt()}kg" else "${set.weight}kg"
                                                                    Text(
                                                                        text = "第 ${i + 1} 組: ${set.reps} 次數 / $weightText",
                                                                        style = MaterialTheme.typography.labelSmall,
                                                                        fontWeight = FontWeight.Bold,
                                                                        color = MaterialTheme.colorScheme.primary
                                                                    )
                                                                }
                                                            }
                                                        } else {
                                                            Text(
                                                                text = "點擊輸入組數、次數、重量",
                                                                style = MaterialTheme.typography.labelMedium,
                                                                color = MaterialTheme.colorScheme.primary,
                                                                fontWeight = FontWeight.Medium
                                                            )
                                                        }
                                                    }
                                                }

                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    IconButton(
                                                        onClick = { onEditExerciseClick(exWithSets) },
                                                        modifier = Modifier.size(32.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.Edit,
                                                            contentDescription = "編輯組數重量",
                                                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.8f),
                                                            modifier = Modifier.size(18.dp)
                                                        )
                                                    }
                                                    IconButton(
                                                        onClick = { onDeleteExerciseClick(exWithSets) },
                                                        modifier = Modifier.size(32.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.Close,
                                                            contentDescription = "刪除動作",
                                                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                                            modifier = Modifier.size(18.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    is WorkoutGroupedItem.Superset -> {
                                        Surface(
                                            shape = RoundedCornerShape(16.dp),
                                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.08f),
                                            border = androidx.compose.foundation.BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(12.dp)) {
                                                // Superset Header
                                                Row(
                                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Icon(
                                                            imageVector = Icons.Default.Layers,
                                                            contentDescription = null,
                                                            tint = MaterialTheme.colorScheme.primary,
                                                            modifier = Modifier.size(16.dp)
                                                        )
                                                        Spacer(modifier = Modifier.width(6.dp))
                                                        Text(
                                                            text = "超級組 (Superset)",
                                                            style = MaterialTheme.typography.labelMedium,
                                                            fontWeight = FontWeight.Bold,
                                                            color = MaterialTheme.colorScheme.primary
                                                        )
                                                        Spacer(modifier = Modifier.width(6.dp))
                                                        Text(
                                                            text = "· ${item.exercises.size} 個動作",
                                                            style = MaterialTheme.typography.labelSmall,
                                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                                        )
                                                    }
                                                }

                                                Spacer(modifier = Modifier.height(8.dp))

                                                // List the exercises inside the superset
                                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    item.exercises.forEachIndexed { innerIndex, exWithSets ->
                                                        val exercise = exWithSets.exercise
                                                        val sets = exWithSets.sets
                                                        Surface(
                                                            shape = RoundedCornerShape(12.dp),
                                                            color = MaterialTheme.colorScheme.surface,
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .clip(RoundedCornerShape(12.dp))
                                                                .clickable { onEditExerciseClick(exWithSets) }
                                                        ) {
                                                            Row(
                                                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                                                verticalAlignment = Alignment.CenterVertically,
                                                                horizontalArrangement = Arrangement.SpaceBetween
                                                            ) {
                                                                Column(modifier = Modifier.weight(1f)) {
                                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                                        Box(
                                                                            modifier = Modifier
                                                                                .size(18.dp)
                                                                                .clip(CircleShape)
                                                                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                                                                            contentAlignment = Alignment.Center
                                                                        ) {
                                                                            Text(
                                                                                text = "${innerIndex + 1}",
                                                                                style = MaterialTheme.typography.labelSmall,
                                                                                fontWeight = FontWeight.Bold,
                                                                                color = MaterialTheme.colorScheme.primary
                                                                            )
                                                                        }
                                                                        Spacer(modifier = Modifier.width(8.dp))
                                                                        Text(
                                                                            text = exercise.name,
                                                                            style = MaterialTheme.typography.bodyMedium,
                                                                            fontWeight = FontWeight.Bold,
                                                                            color = MaterialTheme.colorScheme.onSurface
                                                                        )
                                                                    }

                                                                    Spacer(modifier = Modifier.height(4.dp))

                                                                    Row(
                                                                        verticalAlignment = Alignment.CenterVertically,
                                                                        modifier = Modifier.padding(start = 26.dp)
                                                                    ) {
                                                                        val isInnerCardio = isCardioExercise(exercise.name, workoutWithExercises.workout.bodyPart)
                                                                        if (isInnerCardio) {
                                                                            val durationMinutes = sets.firstOrNull()?.reps ?: exercise.reps
                                                                            Surface(
                                                                                shape = RoundedCornerShape(6.dp),
                                                                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                                                                            ) {
                                                                                Row(
                                                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                                                                    verticalAlignment = Alignment.CenterVertically
                                                                                ) {
                                                                                    Icon(
                                                                                        imageVector = Icons.Default.Timer,
                                                                                        contentDescription = null,
                                                                                        tint = MaterialTheme.colorScheme.primary,
                                                                                        modifier = Modifier.size(14.dp)
                                                                                    )
                                                                                    Spacer(modifier = Modifier.width(4.dp))
                                                                                    Text(
                                                                                        text = "時間: $durationMinutes 分鐘",
                                                                                        style = MaterialTheme.typography.labelSmall,
                                                                                        fontWeight = FontWeight.Bold,
                                                                                        color = MaterialTheme.colorScheme.primary
                                                                                    )
                                                                                }
                                                                            }
                                                                        } else if (sets.isNotEmpty()) {
                                                                            val firstSet = sets.first()
                                                                            val weightText = if (firstSet.weight % 1.0 == 0.0) {
                                                                                "${firstSet.weight.toInt()} kg"
                                                                            } else {
                                                                                "${firstSet.weight} kg"
                                                                            }
                                                                            Text(
                                                                                text = "${sets.size} 組 · 第1組 ${firstSet.reps}次數 $weightText 等",
                                                                                style = MaterialTheme.typography.labelSmall,
                                                                                fontWeight = FontWeight.Bold,
                                                                                color = MaterialTheme.colorScheme.primary
                                                                            )
                                                                        }
                                                                    }
                                                                }

                                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                                    IconButton(
                                                                        onClick = { onEditExerciseClick(exWithSets) },
                                                                        modifier = Modifier.size(28.dp)
                                                                    ) {
                                                                        Icon(
                                                                            Icons.Default.Edit,
                                                                            contentDescription = "編輯",
                                                                            tint = MaterialTheme.colorScheme.primary,
                                                                            modifier = Modifier.size(16.dp)
                                                                        )
                                                                    }
                                                                    IconButton(
                                                                        onClick = { onDeleteExerciseClick(exWithSets) },
                                                                        modifier = Modifier.size(28.dp)
                                                                    ) {
                                                                        Icon(
                                                                            Icons.Default.Close,
                                                                            contentDescription = "刪除",
                                                                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                                                            modifier = Modifier.size(16.dp)
                                                                        )
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Add exercise button inside card
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable(onClick = onAddExerciseClick)
                            ) {
                                Row(
                                    modifier = Modifier.padding(vertical = 10.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Add,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "新增訓練內容",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectExerciseDialog(
    bodyPart: String,
    viewModel: DietViewModel,
    onDismiss: () -> Unit,
    onSelectExercise: (String) -> Unit,
    onSelectSuperset: (List<String>) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    val uniqueExercises by viewModel.uniqueExerciseNames.collectAsStateWithLifecycle()

    var isSupersetMode by remember { mutableStateOf(false) }
    val selectedExercises = remember { mutableStateListOf<String>() }

    val isCardioBodyPart = remember(bodyPart) { isCardioExercise("", bodyPart) }
    var selectedCategory by remember { mutableStateOf(if (isCardioBodyPart) "有氧" else "全部") }

    val presetDatabase = remember {
        mapOf(
            "有氧" to DEFAULT_CARDIO_PRESETS,
            "胸" to listOf("槓鈴平椅臥推", "上胸啞鈴臥推", "下胸雙槓撐體", "啞鈴飛鳥", "繩索夾胸", "俯臥撐", "史密斯機臥推"),
            "背" to listOf("滑輪下拉", "槓鈴劃船", "單臂啞鈴劃船", "引體向上", "坐姿劃船", "羅馬椅挺身", "硬舉"),
            "腿" to listOf("槓鈴深蹲", "羅馬尼亞硬舉", "腿推機", "腿伸展機", "腿彎舉", "槓鈴弓步蹲", "提踵"),
            "肩" to listOf("站姿槓鈴肩推", "坐姿啞鈴肩推", "啞鈴側平舉", "後三角繩索面拉", "俯身飛鳥", "聳肩"),
            "手臂" to listOf("槓鈴二頭彎舉", "啞鈴錘式彎舉", "三頭肌繩索下壓", "法式推舉", "窄握臥推", "雙槓體撐"),
            "核心" to listOf("棒式", "捲腹", "懸垂舉腿", "仰臥起坐", "俄羅斯轉體", "健腹輪")
        )
    }

    val categories = if (isCardioBodyPart) {
        listOf("有氧", "全部", "胸", "背", "腿", "肩", "手臂", "核心")
    } else {
        listOf("全部", "有氧", "胸", "背", "腿", "肩", "手臂", "核心")
    }

    val filteredExercises = remember(searchQuery, selectedCategory, uniqueExercises) {
        val baseList = if (selectedCategory == "全部") {
            presetDatabase.values.flatten().distinct() + uniqueExercises
        } else {
            (presetDatabase[selectedCategory] ?: emptyList()) + uniqueExercises
        }.distinct()

        if (searchQuery.isBlank()) {
            baseList
        } else {
            baseList.filter { it.contains(searchQuery, ignoreCase = true) }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("選擇訓練動作", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text(
                        text = "部位：${bodyPart.ifBlank { "未指定" }}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Superset Toggle Button Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isSupersetMode) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f),
                            RoundedCornerShape(12.dp)
                        )
                        .clickable { isSupersetMode = !isSupersetMode }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(
                            imageVector = Icons.Default.Layers,
                            contentDescription = null,
                            tint = if (isSupersetMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "超級組模式 (Superset)",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (isSupersetMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "選取多個動作設定各自數據",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Switch(
                        checked = isSupersetMode,
                        onCheckedChange = { isSupersetMode = it },
                        modifier = Modifier.scale(0.85f)
                    )
                }

                // Selected Superset exercises horizontal scroll row
                if (isSupersetMode && selectedExercises.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        selectedExercises.forEach { selected ->
                            InputChip(
                                selected = true,
                                onClick = { selectedExercises.remove(selected) },
                                label = { Text(selected, style = MaterialTheme.typography.labelSmall) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(12.dp)) }
                            )
                        }
                    }
                }

                // Search Input Box
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("搜尋或自訂動作名稱...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "清除")
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Category Chips
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState())
                ) {
                    categories.forEach { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }

                HorizontalDivider()

                // Movement items list
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    if (searchQuery.isNotBlank() && !filteredExercises.contains(searchQuery.trim())) {
                        item {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        val itemTrimmed = searchQuery.trim()
                                        if (isSupersetMode) {
                                            if (!selectedExercises.contains(itemTrimmed)) {
                                                selectedExercises.add(itemTrimmed)
                                            }
                                        } else {
                                            onSelectExercise(itemTrimmed)
                                        }
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        "新增自訂動作「${searchQuery.trim()}」",
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }

                    items(filteredExercises) { exName ->
                        val isSelected = isSupersetMode && selectedExercises.contains(exName)
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                            border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary) else null,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (isSupersetMode) {
                                        if (isSelected) {
                                            selectedExercises.remove(exName)
                                        } else {
                                            selectedExercises.add(exName)
                                        }
                                    } else {
                                        onSelectExercise(exName)
                                    }
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f, fill = false)
                                ) {
                                    Text(
                                        text = exName,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                    )
                                    if (isCardioExercise(exName, bodyPart)) {
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                                        ) {
                                            Text(
                                                text = "有氧",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                                if (isSelected) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (isSupersetMode) {
                Button(
                    onClick = { onSelectSuperset(selectedExercises.toList()) },
                    enabled = selectedExercises.isNotEmpty()
                ) {
                    Text("下一步：設定超級組 (${selectedExercises.size})", fontWeight = FontWeight.Bold)
                }
            } else {
                if (searchQuery.isNotBlank()) {
                    Button(onClick = { onSelectExercise(searchQuery.trim()) }) {
                        Text("新增自訂動作")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditSupersetDetailsDialog(
    exercisesList: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (List<WorkoutExercise>) -> Unit
) {
    val inputs = remember(exercisesList) {
        exercisesList.map { name ->
            SupersetExerciseInput(name)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Layers,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "設定超級組訓練數值",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 450.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                itemsIndexed(inputs) { index, input ->
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            // Subtitle with number and name
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "${index + 1}",
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = input.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }

                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                            // Check if this exercise in superset is cardio
                            val isCardio = isCardioExercise(input.name)
                            if (isCardio) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.DirectionsRun,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                "🏃 有氧模式 (以時間記錄)",
                                                style = MaterialTheme.typography.labelMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }

                                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text("時間 (分鐘)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            OutlinedIconButton(
                                                onClick = {
                                                    val cur = input.reps.toIntOrNull() ?: 30
                                                    if (cur > 5) input.reps = (cur - 5).toString()
                                                    input.sets = "1"
                                                    input.weight = "0"
                                                },
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Text("-", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                            }

                                            OutlinedTextField(
                                                value = input.reps,
                                                onValueChange = { 
                                                    input.reps = it.filter { char -> char.isDigit() }
                                                    input.sets = "1"
                                                    input.weight = "0"
                                                },
                                                modifier = Modifier.weight(1f),
                                                singleLine = true,
                                                textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold),
                                                trailingIcon = { Text("分鐘", style = MaterialTheme.typography.labelSmall) }
                                            )

                                            OutlinedIconButton(
                                                onClick = {
                                                    val cur = input.reps.toIntOrNull() ?: 0
                                                    input.reps = (cur + 5).toString()
                                                    input.sets = "1"
                                                    input.weight = "0"
                                                },
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Text("+", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                            }
                                        }
                                    }

                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                                    ) {
                                        listOf("15", "20", "30", "45", "60").forEach { min ->
                                            SuggestionChip(
                                                onClick = { 
                                                    input.reps = min
                                                    input.sets = "1"
                                                    input.weight = "0"
                                                },
                                                label = { Text("$min 分鐘", style = MaterialTheme.typography.labelSmall) },
                                                colors = SuggestionChipDefaults.suggestionChipColors(
                                                    containerColor = if (input.reps == min) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                                )
                                            )
                                        }
                                    }
                                }
                            } else {
                                // Compact editing inputs
                                // 1. Sets
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("組數 (Sets)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.sets.toIntOrNull() ?: 1
                                                if (cur > 1) input.sets = (cur - 1).toString()
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("-", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }

                                        OutlinedTextField(
                                            value = input.sets,
                                            onValueChange = { input.sets = it.filter { char -> char.isDigit() } },
                                            modifier = Modifier.weight(1f),
                                            singleLine = true,
                                            textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold),
                                            trailingIcon = { Text("組", style = MaterialTheme.typography.labelSmall) }
                                        )

                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.sets.toIntOrNull() ?: 0
                                                input.sets = (cur + 1).toString()
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("+", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                // 2. Reps
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("次數 (Reps)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.reps.toIntOrNull() ?: 1
                                                if (cur > 1) input.reps = (cur - 1).toString()
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("-", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }

                                        OutlinedTextField(
                                            value = input.reps,
                                            onValueChange = { input.reps = it.filter { char -> char.isDigit() } },
                                            modifier = Modifier.weight(1f),
                                            singleLine = true,
                                            textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold),
                                            trailingIcon = { Text("次數", style = MaterialTheme.typography.labelSmall) }
                                        )

                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.reps.toIntOrNull() ?: 0
                                                input.reps = (cur + 1).toString()
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("+", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                // 3. Weight
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("重量 (kg)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.weight.toDoubleOrNull() ?: 0.0
                                                if (cur >= 0.1) {
                                                    val newVal = Math.round((cur - 0.1) * 10.0) / 10.0
                                                    input.weight = if (newVal % 1.0 == 0.0) newVal.toInt().toString() else "%.1f".format(newVal)
                                                } else {
                                                    input.weight = "0"
                                                }
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("-", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }

                                        OutlinedTextField(
                                            value = input.weight,
                                            onValueChange = { str ->
                                                if (str.isEmpty() || str.matches(Regex("^\\d*\\.?\\d*$"))) {
                                                    input.weight = str
                                                }
                                            },
                                            modifier = Modifier.weight(1f),
                                            singleLine = true,
                                            textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold),
                                            trailingIcon = { Text("kg", style = MaterialTheme.typography.labelSmall) }
                                        )

                                        OutlinedIconButton(
                                            onClick = {
                                                val cur = input.weight.toDoubleOrNull() ?: 0.0
                                                val newVal = Math.round((cur + 0.1) * 10.0) / 10.0
                                                input.weight = if (newVal % 1.0 == 0.0) newVal.toInt().toString() else "%.1f".format(newVal)
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Text("+", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val list = inputs.map { input ->
                        WorkoutExercise(
                            workoutId = 0, // Assigned in viewmodel when saving
                            name = input.name,
                            sets = input.sets.toIntOrNull() ?: 3,
                            reps = input.reps.toIntOrNull() ?: 10,
                            weight = input.weight.toDoubleOrNull() ?: 20.0
                        )
                    }
                    onConfirm(list)
                }
            ) {
                Text("建立超級組", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}




@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditExerciseDetailsDialog(
    initialName: String,
    bodyPart: String = "",
    initialSets: Int,
    initialReps: Int,
    initialWeight: Double,
    viewModel: DietViewModel,
    onDismiss: () -> Unit,
    onConfirm: (name: String, sets: Int, reps: Int, weight: Double) -> Unit
) {
    var nameText by remember { mutableStateOf(initialName) }
    val exerciseSuggestions by viewModel.exerciseSuggestions.collectAsStateWithLifecycle()
    
    val detectedCardio = remember(nameText, bodyPart) { isCardioExercise(nameText, bodyPart) }
    var isCardioMode by remember { mutableStateOf(detectedCardio) }
    LaunchedEffect(detectedCardio) {
        if (detectedCardio) isCardioMode = true
    }

    var durationMinutesText by remember {
        mutableStateOf(if (detectedCardio && initialReps > 0) initialReps.toString() else "30")
    }

    var isCustomMode by remember { mutableStateOf(false) }
    var setsText by remember { mutableStateOf(if (initialSets > 0) initialSets.toString() else "3") }
    var repsText by remember { mutableStateOf(if (initialReps > 0) initialReps.toString() else "10") }
    var weightText by remember { mutableStateOf(if (initialWeight > 0.0) (if (initialWeight % 1.0 == 0.0) initialWeight.toInt().toString() else initialWeight.toString()) else "20") }
    
    // Custom mode states
    val customSets = remember { mutableStateListOf<Pair<String, String>>() }
    LaunchedEffect(setsText, isCustomMode) {
        val numSets = setsText.toIntOrNull() ?: 1
        if (isCustomMode && customSets.size != numSets) {
            val current = customSets.toList()
            customSets.clear()
            repeat(numSets) { i ->
                if (i < current.size) customSets.add(current[i])
                else customSets.add(repsText to weightText)
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (isCardioMode) Icons.Default.DirectionsRun else Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (isCardioMode) "設定有氧訓練" else "設定訓練數值",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Mode indicator and switch
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isCardioMode) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (isCardioMode) "🏃 有氧模式 (以時間記錄)" else "🏋️ 重訓模式 (以組數/次數/重量記錄)",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        TextButton(
                            onClick = { isCardioMode = !isCardioMode },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Text(
                                if (isCardioMode) "切換為重訓" else "切換為有氧",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }

                // Name Input
                SuggestionTextField(
                    value = nameText,
                    onValueChange = { 
                        nameText = it
                        viewModel.updateExerciseQuery(it)
                    },
                    suggestions = exerciseSuggestions.map { it.name },
                    label = "動作名稱",
                    placeholder = "請輸入動作名稱"
                )

                if (isCardioMode) {
                    // 有氧建議訓練內容
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "有氧建議動作",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        ) {
                            DEFAULT_CARDIO_PRESETS.forEach { preset ->
                                SuggestionChip(
                                    onClick = { 
                                        nameText = preset
                                        viewModel.updateExerciseQuery(preset)
                                    },
                                    label = { Text(preset, style = MaterialTheme.typography.labelSmall) },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = if (nameText == preset) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                    )
                                )
                            }
                        }
                    }

                    // 時間設定 (時間 stepper + quick minute chips)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        NumericStepper(
                            value = durationMinutesText,
                            onValueChange = { durationMinutesText = it },
                            label = "時間 (分鐘)",
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        ) {
                            listOf("15", "20", "30", "45", "60", "90").forEach { min ->
                                SuggestionChip(
                                    onClick = { durationMinutesText = min },
                                    label = { Text("$min 分鐘", style = MaterialTheme.typography.labelSmall) },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = if (durationMinutesText == min) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                    )
                                )
                            }
                        }
                    }
                } else {
                    // Sets Input
                    NumericStepper(
                        value = setsText,
                        onValueChange = { setsText = it },
                        label = "組數",
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Custom Mode Toggle
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("自訂每組重量/次數", modifier = Modifier.weight(1f))
                        Switch(checked = isCustomMode, onCheckedChange = { isCustomMode = it })
                    }

                    if (isCustomMode) {
                        customSets.forEachIndexed { i, _ ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("第 ${i + 1} 組", style = MaterialTheme.typography.labelLarge)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    NumericStepper(
                                        value = customSets[i].first,
                                        onValueChange = { customSets[i] = it to customSets[i].second },
                                        label = "次數",
                                        modifier = Modifier.weight(1f)
                                    )
                                    NumericStepper(
                                        value = customSets[i].second,
                                        onValueChange = { customSets[i] = customSets[i].first to it },
                                        label = "重量 (kg)",
                                        modifier = Modifier.weight(1f),
                                        isDecimal = true
                                    )
                                }
                            }
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            NumericStepper(
                                value = repsText,
                                onValueChange = { repsText = it },
                                label = "次數",
                                modifier = Modifier.weight(1f)
                            )
                            NumericStepper(
                                value = weightText,
                                onValueChange = { weightText = it },
                                label = "重量 (kg)",
                                modifier = Modifier.weight(1f),
                                isDecimal = true
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (isCardioMode) {
                    val duration = durationMinutesText.toIntOrNull() ?: 30
                    onConfirm(nameText.ifBlank { "有氧運動" }, 1, duration, 0.0)
                } else if (isCustomMode) {
                    onConfirm(nameText, setsText.toIntOrNull() ?: 0, customSets.firstOrNull()?.first?.toIntOrNull() ?: 0, customSets.firstOrNull()?.second?.toDoubleOrNull() ?: 0.0)
                } else {
                    onConfirm(nameText, setsText.toIntOrNull() ?: 0, repsText.toIntOrNull() ?: 0, weightText.toDoubleOrNull() ?: 0.0)
                }
            }) { Text("儲存") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditExerciseSetsDialog(
    initialName: String,
    bodyPart: String = "",
    initialSets: List<ExerciseSet>,
    viewModel: DietViewModel,
    onDismiss: () -> Unit,
    onConfirm: (name: String, updatedSets: List<ExerciseSet>) -> Unit
) {
    var nameText by remember { mutableStateOf(initialName) }
    val exerciseSuggestions by viewModel.exerciseSuggestions.collectAsStateWithLifecycle()
    
    val detectedCardio = remember(nameText, bodyPart) { isCardioExercise(nameText, bodyPart) }
    var isCardioMode by remember { mutableStateOf(detectedCardio) }
    LaunchedEffect(detectedCardio) {
        if (detectedCardio) isCardioMode = true
    }

    var durationMinutesText by remember {
        val existingDuration = initialSets.firstOrNull()?.reps ?: 30
        mutableStateOf(if (existingDuration > 0) existingDuration.toString() else "30")
    }

    // Create state for each set
    val setStates = remember {
        mutableStateListOf<SetEditState>().apply {
            addAll(initialSets.map { SetEditState(it.id, it.exerciseId, it.setIndex, it.reps.toString(), it.weight.toString()) })
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (isCardioMode) Icons.Default.DirectionsRun else Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isCardioMode) "編輯有氧訓練" else "編輯動作與組數",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Mode indicator and switch
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isCardioMode) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (isCardioMode) "🏃 有氧模式 (以時間記錄)" else "🏋️ 重訓模式 (以組數/次數/重量記錄)",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        TextButton(
                            onClick = { isCardioMode = !isCardioMode },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Text(
                                if (isCardioMode) "切換為重訓" else "切換為有氧",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }

                // 0. 動作名稱
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("動作名稱", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    SuggestionTextField(
                        value = nameText,
                        onValueChange = { 
                            nameText = it
                            viewModel.updateExerciseQuery(it)
                        },
                        suggestions = exerciseSuggestions.map { it.name },
                        label = "動作名稱",
                        placeholder = "請輸入動作名稱"
                    )
                }

                if (isCardioMode) {
                    // 有氧建議訓練內容
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "有氧建議動作",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        ) {
                            DEFAULT_CARDIO_PRESETS.forEach { preset ->
                                SuggestionChip(
                                    onClick = { 
                                        nameText = preset
                                        viewModel.updateExerciseQuery(preset)
                                    },
                                    label = { Text(preset, style = MaterialTheme.typography.labelSmall) },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = if (nameText == preset) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                    )
                                )
                            }
                        }
                    }

                    // 時間設定 (時間 stepper + quick minute chips)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        NumericStepper(
                            value = durationMinutesText,
                            onValueChange = { durationMinutesText = it },
                            label = "時間 (分鐘)",
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        ) {
                            listOf("15", "20", "30", "45", "60", "90").forEach { min ->
                                SuggestionChip(
                                    onClick = { durationMinutesText = min },
                                    label = { Text("$min 分鐘", style = MaterialTheme.typography.labelSmall) },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = if (durationMinutesText == min) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                    )
                                )
                            }
                        }
                    }
                } else {
                    // 1. 組數控制
                    NumericStepper(
                        value = setStates.size.toString(),
                        onValueChange = { newSize ->
                            val targetSize = newSize.toIntOrNull() ?: 1
                            if (targetSize > setStates.size) {
                                repeat(targetSize - setStates.size) {
                                    setStates.add(SetEditState(0L, 0L, setStates.size, "0", "0.0"))
                                }
                            } else if (targetSize < setStates.size && targetSize > 0) {
                                repeat(setStates.size - targetSize) {
                                    setStates.removeAt(setStates.size - 1)
                                }
                            }
                        },
                        label = "總組數",
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    // 2. 各組設定
                    Text("各組次數與重量", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    setStates.forEachIndexed { index, setState ->
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text("第 ${index + 1} 組", style = MaterialTheme.typography.labelMedium)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                NumericStepper(
                                    value = setState.reps,
                                    onValueChange = { setState.reps = it },
                                    label = "次數",
                                    modifier = Modifier.weight(1f)
                                )
                                NumericStepper(
                                    value = setState.weight,
                                    onValueChange = { setState.weight = it },
                                    label = "重量 (kg)",
                                    modifier = Modifier.weight(1f),
                                    isDecimal = true
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (isCardioMode) {
                        val duration = durationMinutesText.toIntOrNull() ?: 30
                        val existingFirst = initialSets.firstOrNull()
                        val updated = listOf(
                            ExerciseSet(
                                id = existingFirst?.id ?: 0L,
                                exerciseId = existingFirst?.exerciseId ?: 0L,
                                setIndex = 1,
                                reps = duration,
                                weight = 0.0
                            )
                        )
                        onConfirm(nameText.ifBlank { "有氧運動" }, updated)
                    } else {
                        val updatedSets = setStates.map { state ->
                            com.example.data.model.ExerciseSet(
                                id = state.id,
                                exerciseId = state.exerciseId,
                                setIndex = state.setIndex,
                                reps = state.reps.toIntOrNull() ?: 0,
                                weight = state.weight.toDoubleOrNull() ?: 0.0
                            )
                        }
                        onConfirm(nameText, updatedSets)
                    }
                }
            ) {
                Text("儲存紀錄", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

class SetEditState(val id: Long, val exerciseId: Long, val setIndex: Int, reps: String, weight: String) {
    var reps by mutableStateOf(reps)
    var weight by mutableStateOf(weight)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuggestionTextField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<String>,
    label: String,
    placeholder: String = "",
    modifier: Modifier = Modifier,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded && suggestions.isNotEmpty() && value.isEmpty(),
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {
                onValueChange(it)
                expanded = it.isEmpty()
            },
            label = { Text(label) },
            placeholder = { Text(placeholder) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth(),
            singleLine = true,
            trailingIcon = trailingIcon,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent
            )
        )

        MaterialTheme(
            colorScheme = MaterialTheme.colorScheme.copy(
                surface = MaterialTheme.colorScheme.surfaceColorAtElevation(4.dp)
            ),
            shapes = MaterialTheme.shapes.copy(
                extraSmall = RoundedCornerShape(12.dp)
            )
        ) {
            ExposedDropdownMenu(
                expanded = expanded && suggestions.isNotEmpty() && value.isEmpty(),
                onDismissRequest = { expanded = false },
                modifier = Modifier.border(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outlineVariant,
                    shape = RoundedCornerShape(12.dp)
                )
            ) {
                suggestions.take(2).forEach { suggestion ->
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.History,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = suggestion,
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            }
                        },
                        onClick = {
                            onValueChange(suggestion)
                            expanded = false
                        },
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }
        }
    }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddWorkoutCardDialog(
    initialBodyPart: String,
    viewModel: DietViewModel,
    onDismiss: () -> Unit,
    onConfirm: (bodyPart: String) -> Unit
) {
    var bodyPartText by remember { mutableStateOf(initialBodyPart) }
    val muscleGroupSuggestions by viewModel.muscleGroupSuggestions.collectAsStateWithLifecycle()
    
    val quickOptions = listOf("胸", "背", "腿", "肩", "手臂", "核心", "有氧", "臀", "全身")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("設定訓練卡片", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 1. 部位搜尋/輸入
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("訓練部位", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = bodyPartText,
                        onValueChange = { 
                            bodyPartText = it
                            viewModel.updateMuscleGroupQuery(it)
                        },
                        placeholder = { Text("搜尋或輸入部位...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (bodyPartText.isNotEmpty()) {
                                IconButton(onClick = { bodyPartText = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "清除")
                                }
                            }
                        }
                    )
                }

                // 2. 快速選擇
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("快速選取", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                    ) {
                        quickOptions.forEach { option ->
                            SuggestionChip(
                                onClick = { 
                                    bodyPartText = option
                                    viewModel.updateMuscleGroupQuery(option)
                                },
                                label = { Text(option) },
                                border = null,
                                colors = SuggestionChipDefaults.suggestionChipColors(
                                    containerColor = if (bodyPartText == option) 
                                        MaterialTheme.colorScheme.primaryContainer 
                                    else 
                                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                )
                            )
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                // 3. 建議清單 (List style)
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.heightIn(max = 200.dp)
                ) {
                    Text("建議部位", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    
                    val displaySuggestions = muscleGroupSuggestions.map { it.name }.filter { it != bodyPartText }.take(3)
                    
                    if (displaySuggestions.isEmpty() && bodyPartText.isEmpty()) {
                        Text(
                            "暫無建議，請開始輸入或從快速選取選擇",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(displaySuggestions) { suggestion ->
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            bodyPartText = suggestion
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            Icons.Default.History,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp),
                                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(
                                            text = suggestion,
                                            style = MaterialTheme.typography.bodyLarge
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val finalPart = bodyPartText.trim().ifBlank { "未指定" }
                    onConfirm(finalPart)
                },
                enabled = bodyPartText.isNotBlank()
            ) {
                Text("建立卡片", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}
