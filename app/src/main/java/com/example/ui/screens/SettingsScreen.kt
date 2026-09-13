package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import com.example.data.model.CommonFoodsDatabase
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import com.example.ui.AiBmrEstimateResult
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import com.example.R
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.CarbCycleType
import com.example.data.model.MealConfig
import com.example.ui.DietViewModel
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: DietViewModel
) {
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
    val activeMeals by viewModel.activeMeals.collectAsStateWithLifecycle()
    val myCustomFoods by viewModel.myCustomFoods.collectAsStateWithLifecycle()
    val customFoodCount by viewModel.customFoodCount.collectAsStateWithLifecycle()
    val totalFoodCount by viewModel.totalFoodCount.collectAsStateWithLifecycle()
    val targetWeight by viewModel.targetWeightKg.collectAsStateWithLifecycle()
    val latestWeightRecord by viewModel.latestWeightRecord.collectAsStateWithLifecycle()

    val showGoalDialog by viewModel.showGoalDialog.collectAsStateWithLifecycle()
    val waterGoal by viewModel.waterGoalMl.collectAsStateWithLifecycle()
    var showBmrTdeeDialog by remember { mutableStateOf(false) }
    val isUpdatingDb by viewModel.isUpdatingCvsDb.collectAsStateWithLifecycle()
    val updateDbMessage by viewModel.updateCvsDbMessage.collectAsStateWithLifecycle()
    val isUpdatingDbByAi by viewModel.isUpdatingCvsDbByAi.collectAsStateWithLifecycle()
    val updateDbByAiMessage by viewModel.updateCvsDbByAiMessage.collectAsStateWithLifecycle()
    var showAiKeywordSearchDialog by remember { mutableStateOf(false) }
    var aiSearchKeyword by remember { mutableStateOf("") }
    var showWaterGoalDialog by remember { mutableStateOf(false) }

    var showAddMealDialog by remember { mutableStateOf(false) }
    var mealToDelete by remember { mutableStateOf<MealConfig?>(null) }
    var showAppInfoDialog by remember { mutableStateOf(false) }

    val aiCallCount by viewModel.aiCallCount.collectAsStateWithLifecycle()
    val aiCallLimit by viewModel.aiCallLimit.collectAsStateWithLifecycle()
    val devAiCallCount by viewModel.devAiCallCount.collectAsStateWithLifecycle()
    val devAiCallLimit by viewModel.devAiCallLimit.collectAsStateWithLifecycle()
    val userAiCallCount by viewModel.userAiCallCount.collectAsStateWithLifecycle()
    val userAiCallLimit by viewModel.userAiCallLimit.collectAsStateWithLifecycle()

    val devAiTokenCount by viewModel.devAiTokenCount.collectAsStateWithLifecycle()
    val devAiTokenLimit by viewModel.devAiTokenLimit.collectAsStateWithLifecycle()
    val userAiTokenCount by viewModel.userAiTokenCount.collectAsStateWithLifecycle()
    val userAiTokenLimit by viewModel.userAiTokenLimit.collectAsStateWithLifecycle()

    val userGeminiApiKey by viewModel.userGeminiApiKey.collectAsStateWithLifecycle()
    val cloudSyncState by viewModel.cloudSyncState.collectAsStateWithLifecycle()
    val detectedAnomalies by viewModel.detectedAnomalies.collectAsStateWithLifecycle()
    val isScanningAnomalies by viewModel.isScanningAnomalies.collectAsStateWithLifecycle()
    val isCalibratingAnomalies by viewModel.isCalibratingAnomalies.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.scanCustomFoodAnomalies()
    }

    var showApiKeyDialog by remember { mutableStateOf(false) }
    var showApiGuideDialog by remember { mutableStateOf(false) }
    var showClipboardDialog by remember { mutableStateOf(false) }
    var detectedKey by remember { mutableStateOf("") }
    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val lifecycleOwner = LocalLifecycleOwner.current

    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val clipText = clipboardManager.getText()?.text
                if (userGeminiApiKey.isBlank() && !clipText.isNullOrBlank() && clipText != userGeminiApiKey && clipText.length >= 20) {
                    detectedKey = clipText
                    showClipboardDialog = true
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(updateDbMessage) {
        updateDbMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
            viewModel.clearUpdateMessage()
        }
    }

    LaunchedEffect(cloudSyncState) {
        cloudSyncState?.let { state ->
            if (!state.startsWith("正在同步")) {
                Toast.makeText(context, state, Toast.LENGTH_LONG).show()
                viewModel.clearCloudSyncState()
            }
        }
    }


    var showUserLimitDialog by remember { mutableStateOf(false) }
    var showUserResetDialog by remember { mutableStateOf(false) }
    var showUserTokenLimitDialog by remember { mutableStateOf(false) }
    var showUserTokenResetDialog by remember { mutableStateOf(false) }

    var showExportDialog by remember { mutableStateOf(false) }
    var pendingHtmlContent by remember { mutableStateOf("") }

    val backupLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/octet-stream")
    ) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.openOutputStream(uri)?.use { output ->
                    val success = viewModel.backupDatabase(context, output)
                    if (success) {
                        Toast.makeText(context, "資料庫備份成功！", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, "資料庫備份失敗，請重試", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(context, "備份發生錯誤: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    val restoreLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    val success = viewModel.restoreDatabase(context, input)
                    if (success) {
                        Toast.makeText(context, "資料還原成功！資料庫已載入新資料", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, "資料還原失敗，請確認檔案格式正確", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(context, "還原發生錯誤: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    val htmlExportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/html")
    ) { uri ->
        if (uri != null && pendingHtmlContent.isNotEmpty()) {
            try {
                context.contentResolver.openOutputStream(uri)?.use { output ->
                    output.write(pendingHtmlContent.toByteArray(Charsets.UTF_8))
                    Toast.makeText(context, "週報表儲存成功！", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "儲存週報表失敗: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets.statusBars,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "設定",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                windowInsets = WindowInsets.statusBars
            )
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
            // 1. Daily Goals Section
            item(key = "section_daily_goals") {
                SettingsSectionHeader(title = "每日目標與需求")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    onClick = { viewModel.openGoalDialog() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("open_goal_settings_card")
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Tune,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "熱量與三大營養素目標",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = when (currentCarbCycle) {
                                                CarbCycleType.HIGH -> Color(0xFFFFE0B2)
                                                CarbCycleType.MEDIUM -> Color(0xFFC8E6C9)
                                                CarbCycleType.LOW -> Color(0xFFBBDEFB)
                                                CarbCycleType.CUSTOM -> Color(0xFFE1BEE7)
                                            }
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
                                                color = when (currentCarbCycle) {
                                                    CarbCycleType.HIGH -> Color(0xFFBF360C)
                                                    CarbCycleType.MEDIUM -> Color(0xFF1B5E20)
                                                    CarbCycleType.LOW -> Color(0xFF0D47A1)
                                                    CarbCycleType.CUSTOM -> Color(0xFF4A148C)
                                                },
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                    Text(
                                        text = "高／中／低碳日自訂",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "當前: $calorieGoal kcal",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "C: ${carbsGoal}g · P: ${proteinGoal}g · F: ${fatGoal}g",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                        }

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "鈉上限: ${sodiumGoal.toInt()} mg",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "鉀建議: ${potassiumGoal.toInt()} mg",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "目標體重: $targetWeight kg",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            item(key = "section_water_goal") {
                Card(
                    onClick = { showWaterGoalDialog = true },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.LocalDrink,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "每日飲水目標",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "當前目標: $waterGoal ml",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            item(key = "section_bmr_tdee") {
                Card(
                    onClick = { showBmrTdeeDialog = true },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.tertiaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Calculate,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onTertiaryContainer,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "⚡ BMR & TDEE 試算器",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "計算基礎代謝率、每日總消耗熱量與建議熱量目標",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            item(key = "section_cvs_db") {
                Card(
                    onClick = {
                        if (isUpdatingDb) {
                            Toast.makeText(context, "正在背景更新中，請稍候...", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "正在背景更新超商資料庫...", Toast.LENGTH_SHORT).show()
                            viewModel.updateCvsDatabase()
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.tertiaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Sync,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.tertiary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "更新超商資料庫",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (isUpdatingDb) "正在背景更新超商營養資料庫..." else "取得 7-11 與全家食安館最新營養標示 (不限次數)",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (isUpdatingDb) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            if (isUpdatingDb) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.tertiary
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                }
            }
            item(key = "section_ai_keyword_search") {
                Card(
                    onClick = { showAiKeywordSearchDialog = true },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.secondaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AutoAwesome,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.secondary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "AI 關鍵字搜尋建立",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "輸入任何食物關鍵字，AI 自動分析並建立營養標示 (併入 AI 呼叫額度限制)",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            // 2. Meal Categories Management
            item(key = "section_meal_categories") {
                SettingsSectionHeader(title = "餐別顯示管理 (${activeMeals.size}/10)")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        activeMeals.forEachIndexed { index, meal ->
                            key(meal.mealType.name) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Restaurant,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = meal.displayName,
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        if (meal.isCustom) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Surface(
                                                shape = RoundedCornerShape(6.dp),
                                                color = MaterialTheme.colorScheme.secondaryContainer
                                            ) {
                                                Text(
                                                    text = "自訂",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }

                                    IconButton(
                                        onClick = {
                                            if (activeMeals.size <= 1) {
                                                Toast.makeText(context, "至少需保留一個餐別", Toast.LENGTH_SHORT).show()
                                            } else {
                                                mealToDelete = meal
                                            }
                                        },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "刪除餐別",
                                            tint = MaterialTheme.colorScheme.error,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }

                                if (index < activeMeals.size - 1) {
                                    HorizontalDivider(
                                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                                    )
                                }
                            }
                        }

                        if (activeMeals.size < 10) {
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedButton(
                                onClick = { showAddMealDialog = true },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("新增餐別 (如：練後餐、下午茶)")
                            }
                        }
                    }
                }
            }

            // 3. Custom Foods Library Statistics (Only list counts, no food list)
            item(key = "section_food_library") {
                val tfdaOfficialCount = 252
                val presetConvenienceCount = (CommonFoodsDatabase.presetList.size - tfdaOfficialCount).coerceAtLeast(0)
                SettingsSectionHeader(title = "食物資料庫總覽 ($totalFoodCount 項)")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "🏛️ 衛福部官方食品成分庫",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "$tfdaOfficialCount 項",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "🏪 超商與經典外食庫",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "$presetConvenienceCount 項",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "✏️ 我的自訂食品庫",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "$customFoodCount 項",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "📊 資料庫總計食物筆數",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "$totalFoodCount 項",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(14.dp))

                        val isCloudSyncing = cloudSyncState?.startsWith("正在同步") == true
                        Button(
                            onClick = {
                                if (!isCloudSyncing) {
                                    Toast.makeText(context, "正在背景同步雲端食品資料庫...", Toast.LENGTH_SHORT).show()
                                    viewModel.syncAllFoodsWithCloud()
                                }
                            },
                            enabled = !isCloudSyncing,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary
                            )
                        ) {
                            if (isCloudSyncing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("正在背景同步中...", fontWeight = FontWeight.Bold)
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Sync,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("一鍵全量同步食品資料庫", fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "開 App 時會自動於背景同步。將本地完整資料庫（包含衛福部官方成分、各大超商、經典美食與自訂食材）與雲端 Firestore 雙向同步更新，確保資料完整不遺漏。",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "⚙️ 異常食品數據與真實份量一鍵校正",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "自動檢測自訂食品庫，挑選出「整份熱量被誤填為每 100g 熱量」或「份量誤植為 100g」的便當/熟食。一鍵校正將智慧還原食品的真實一份重量（如 350g~450g），並標準化每 100g 熱量，確保整份代入飲食紀錄時重量與總熱量完全精確無誤（自動同步雲端）。",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { viewModel.scanCustomFoodAnomalies() },
                                modifier = Modifier.weight(1f),
                                enabled = !isScanningAnomalies && !isCalibratingAnomalies,
                                shape = RoundedCornerShape(12.dp),
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                                )
                            ) {
                                if (isScanningAnomalies) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("正在掃描...")
                                } else {
                                    Icon(imageVector = Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("重新掃描")
                                }
                            }

                            if (detectedAnomalies.isNotEmpty()) {
                                Button(
                                    onClick = {
                                        val count = detectedAnomalies.size
                                        viewModel.calibrateSelectedAnomalies(detectedAnomalies)
                                        Toast.makeText(context, "已成功校正並還原 $count 筆食品的真實份量與標準熱量！", Toast.LENGTH_LONG).show()
                                    },
                                    modifier = Modifier.weight(1f),
                                    enabled = !isScanningAnomalies && !isCalibratingAnomalies,
                                    shape = RoundedCornerShape(12.dp),
                                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.errorContainer,
                                        contentColor = MaterialTheme.colorScheme.onErrorContainer
                                    )
                                ) {
                                    if (isCalibratingAnomalies) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("正在校正...")
                                    } else {
                                        Icon(imageVector = Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("一鍵校正 (${detectedAnomalies.size}筆)")
                                    }
                                }
                            }
                        }

                        if (detectedAnomalies.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "⚠️ 偵測到以下異常或過往誤填之食品數據：",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                                    .padding(8.dp)
                            ) {
                                detectedAnomalies.take(5).forEach { food ->
                                    val calibrated = viewModel.getCalibratedFood(food)
                                    val totalCal = Math.round(calibrated.caloriesPer100g * calibrated.defaultServingAmount / 100.0)
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = if (food.brand.isNotBlank()) "[${food.brand}] ${food.name}" else food.name,
                                                style = MaterialTheme.typography.bodySmall,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                            )
                                            Text(
                                                text = "原數據：${food.caloriesPer100g.toInt()}卡 ➔ 修正為標準：${calibrated.caloriesPer100g.toInt()}卡/100g",
                                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                        Text(
                                            text = "修正➔ ${calibrated.caloriesPer100g.toInt()}卡/100g\n(整份${totalCal.toInt()}卡)",
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary,
                                            textAlign = androidx.compose.ui.text.style.TextAlign.End
                                        )
                                    }
                                }
                                if (detectedAnomalies.size > 5) {
                                    Text(
                                        text = "…… 以及其他 ${detectedAnomalies.size - 5} 筆項目",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                            }
                        } else if (!isScanningAnomalies) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "✨ 目前無偵測到明顯異常自訂食品數據，或已全數完成校正！",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // 資料備份與匯出 (Data Backup & Export)
            item(key = "section_backup_restore") {
                SettingsSectionHeader(title = "資料備份與匯出")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsClickableRow(
                            icon = Icons.Default.Restaurant,
                            title = "匯出週報表 (HTML)",
                            subtitle = "可選飲食、訓練、體重，每次匯出指定一週的精美網頁報告。"
                        ) {
                            showExportDialog = true
                        }
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 10.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                        )
                        SettingsClickableRow(
                            icon = Icons.Default.CloudUpload,
                            title = "備份至 Google Drive (或本機)",
                            subtitle = "儲存 .db 備份檔。在彈出的檔案總管左側可選擇 Google Drive 進行雲端備份。"
                        ) {
                            try {
                                backupLauncher.launch("diet_tracker_backup.db")
                            } catch (e: Exception) {
                                Toast.makeText(context, "備份失敗: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 10.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                        )
                        SettingsClickableRow(
                            icon = Icons.Default.CloudDownload,
                            title = "從 Google Drive (或本機) 還原",
                            subtitle = "選取先前的 .db 備份檔進行還原（會覆蓋現有資料）。"
                        ) {
                            try {
                                restoreLauncher.launch(arrayOf("application/octet-stream", "*/*"))
                            } catch (e: Exception) {
                                Toast.makeText(context, "還原失敗: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            }

            item(key = "section_gemini_api_key") {
                SettingsSectionHeader(title = "進階：自訂 API 金鑰")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Key,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "專屬 Gemini API Key",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                val keyDisplay = if (userGeminiApiKey.isNotBlank()) "已設定：${userGeminiApiKey.take(10)}..." else "尚未設定 (使用系統預設額度)"
                                Text(
                                    text = keyDisplay,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (userGeminiApiKey.isNotBlank()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Button(
                                onClick = { showApiKeyDialog = true },
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp)
                            ) {
                                Text(if (userGeminiApiKey.isNotBlank()) "修改" else "設定")
                            }
                        }
                        if (userGeminiApiKey.isBlank()) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { showApiGuideDialog = true }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("查看取得 API Key 圖文教學", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        try {
                                            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                                        } catch (e: Exception) {
                                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                                            context.startActivity(intent)
                                        }
                                    }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.OpenInNew, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("前往瀏覽器取得 Google AI Studio 金鑰", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }

            // AI 智慧助理額度 (AI Assistant Quota)
            item(key = "section_ai_quota") {
                SettingsSectionHeader(title = "AI 助理與額度管理")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        val isCustomActive = userGeminiApiKey.isNotBlank() && 
                                             userGeminiApiKey != "null" && 
                                             userGeminiApiKey != "YOUR_GEMINI_API_KEY" && 
                                             userGeminiApiKey != "MY_GEMINI_API_KEY"

                        // 1. Developer Key Section
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(if (!isCustomActive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = if (!isCustomActive) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "開發者預設金鑰",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    if (!isCustomActive) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.padding(vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = "使用中",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.onPrimary,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = "體驗額度：固定上限 20 次 / 50,000 Tokens（鎖定不可調整）",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "呼叫次數：$devAiCallCount / 20 次",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                color = if (devAiCallCount >= 20) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Token 用量：$devAiTokenCount / $devAiTokenLimit",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                color = if (devAiTokenCount >= devAiTokenLimit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                            )
                        }

                        val devCallProgress = (devAiCallCount.toFloat() / 20f).coerceIn(0f, 1f)
                        val devTokenProgress = (devAiTokenCount.toFloat() / devAiTokenLimit.toFloat()).coerceIn(0f, 1f)
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { Math.max(devCallProgress, devTokenProgress) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = if (devCallProgress >= 1.0f || devTokenProgress >= 1.0f) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                        )

                        if ((devAiCallCount >= 20 || devAiTokenCount >= devAiTokenLimit) && !isCustomActive) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "⚠️ 開發者免費體驗額度（20 次 / 50,000 Tokens）已用完，請設定專屬金鑰繼續使用 AI 功能",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onErrorContainer,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TextButton(
                                        onClick = { showApiKeyDialog = true },
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                    ) {
                                        Text("設定金鑰", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                        )

                        // 2. User Key Section
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(if (isCustomActive) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Key,
                                    contentDescription = null,
                                    tint = if (isCustomActive) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "專屬自訂金鑰額度",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    if (isCustomActive) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = MaterialTheme.colorScheme.secondary,
                                            modifier = Modifier.padding(vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = "使用中",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.onSecondary,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = "使用您在上方輸入的專屬 Gemini API Key",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "呼叫次數：$userAiCallCount / $userAiCallLimit 次",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                color = if (userAiCallCount >= userAiCallLimit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Token 用量：$userAiTokenCount / $userAiTokenLimit",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                color = if (userAiTokenCount >= userAiTokenLimit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary
                            )
                        }

                        val userCallProgress = if (userAiCallLimit > 0) (userAiCallCount.toFloat() / userAiCallLimit).coerceIn(0f, 1f) else 1f
                        val userTokenProgress = if (userAiTokenLimit > 0) (userAiTokenCount.toFloat() / userAiTokenLimit).coerceIn(0f, 1f) else 1f
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { Math.max(userCallProgress, userTokenProgress) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = if (userCallProgress >= 0.9f || userTokenProgress >= 0.9f) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary,
                            trackColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row {
                                TextButton(
                                    onClick = { showUserLimitDialog = true },
                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("次數上限", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                                }
                                TextButton(
                                    onClick = { showUserTokenLimitDialog = true },
                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("Token上限", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                                }
                            }
                            Row {
                                TextButton(
                                    onClick = { showUserResetDialog = true },
                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("重置次數", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
                                }
                                TextButton(
                                    onClick = { showUserTokenResetDialog = true },
                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("重置Token", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }

            // 4. App Info & System Status
            item(key = "section_about_system") {
                SettingsSectionHeader(title = "關於與系統狀態")
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsInfoRow(
                            icon = Icons.Outlined.Info,
                            title = "應用程式版本",
                            subtitle = "v1.0.1 (Build 2)"
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 10.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                        )
                        SettingsInfoRow(
                            icon = Icons.Default.QrCodeScanner,
                            title = "條碼掃描引擎",
                            subtitle = "Google MLKit + CameraX"
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 10.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                        )
                        SettingsInfoRow(
                            icon = Icons.Default.AutoAwesome,
                            title = "AI 搜尋與估算引擎",
                            subtitle = "Gemini Flash (官方標示優先檢索)"
                        )
                    }
                }
            }
        }
    }

    if (showAiKeywordSearchDialog) {
        val quickSuggestions = listOf("牛肉麵", "滷肉飯", "健康水煮餐", "高蛋白雞胸肉", "溫泉蛋", "起司歐姆蛋", "美式黑咖啡", "燕麥奶")
        AlertDialog(
            onDismissRequest = { showAiKeywordSearchDialog = false },
            icon = {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = {
                Text(
                    text = "AI 搜尋並建立食品資料",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium
                )
            },
            text = {
                Column {
                    Text(
                        text = "請輸入您想搜尋的任何食品、家常菜、餐廳餐點、外食、超商便當或飲品關鍵字，AI 將為您查詢並建立詳細營養資料：",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    OutlinedTextField(
                        value = aiSearchKeyword,
                        onValueChange = { aiSearchKeyword = it },
                        placeholder = { Text("例如：雞胸肉、燕麥奶、義大利麵...") },
                        label = { Text("搜尋關鍵字") },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null)
                        },
                        trailingIcon = {
                            if (aiSearchKeyword.isNotEmpty()) {
                                IconButton(onClick = { aiSearchKeyword = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "清除")
                                }
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "熱門搜尋推薦：",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(quickSuggestions) { suggestion ->
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = if (aiSearchKeyword == suggestion)
                                    MaterialTheme.colorScheme.primaryContainer
                                else
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable {
                                        aiSearchKeyword = suggestion
                                    }
                            ) {
                                Text(
                                    text = suggestion,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (aiSearchKeyword == suggestion)
                                        MaterialTheme.colorScheme.onPrimaryContainer
                                    else
                                        MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val kw = aiSearchKeyword
                        showAiKeywordSearchDialog = false
                        viewModel.updateCvsDatabaseByAi(kw)
                    }
                ) {
                    Text("開始 AI 搜尋")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAiKeywordSearchDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (isUpdatingDbByAi || updateDbByAiMessage != null) {
        AlertDialog(
            onDismissRequest = { if (!isUpdatingDbByAi) viewModel.clearUpdateMessage() },
            title = {
                Text(
                    text = if (isUpdatingDbByAi) "AI 搜尋分析中..." else "更新結果",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                if (isUpdatingDbByAi) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(16.dp))
                        Text("正在呼叫 Gemini API 搜尋並分析「${if (aiSearchKeyword.isNotBlank()) aiSearchKeyword else "熱門食品"}」營養資料...")
                    }
                } else {
                    Text(updateDbByAiMessage ?: "")
                }
            },
            confirmButton = {
                if (!isUpdatingDbByAi) {
                    TextButton(onClick = { viewModel.clearUpdateMessage() }) {
                        Text("確定")
                    }
                }
            }
        )
    }

    if (showWaterGoalDialog) {
        var input by remember { mutableStateOf(waterGoal.toString()) }
        AlertDialog(
            onDismissRequest = { showWaterGoalDialog = false },
            title = { Text("設定每日飲水目標", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    label = { Text("飲水目標 (ml)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        input.toIntOrNull()?.let {
                            viewModel.saveWaterGoal(it)
                        }
                        showWaterGoalDialog = false
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showWaterGoalDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showBmrTdeeDialog) {
        val initialWeight = latestWeightRecord?.let { it.morningWeightKg ?: it.eveningWeightKg }
        BmrTdeeCalculatorDialog(
            initialWeightKg = initialWeight,
            onDismiss = { showBmrTdeeDialog = false },
            onApplyNutritionGoal = { cal, carbs, fat, protein ->
                viewModel.updateNutritionGoals(cal, carbs, fat, protein, -1.0, -1.0)
                Toast.makeText(context, "已成功套用熱量 ${cal} kcal 與三大營養素目標！", Toast.LENGTH_SHORT).show()
                showBmrTdeeDialog = false
            },
            onEstimateAi = { gender, age, height, weight, actLevel, notes ->
                viewModel.estimateBmrTdeeWithAi(gender, age, height, weight, actLevel, notes)
            }
        )
    }

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

    // Add Custom Meal Dialog
    if (showAddMealDialog) {
        var mealNameInput by remember { mutableStateOf("") }
        var inputError by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showAddMealDialog = false },
            title = { Text("新增自訂餐別", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    OutlinedTextField(
                        value = mealNameInput,
                        onValueChange = { mealNameInput = it },
                        label = { Text("餐別名稱 (例如: 練後餐)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (inputError != null) {
                        Text(
                            text = inputError!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val success = viewModel.addCustomMeal(mealNameInput)
                        if (success) {
                            showAddMealDialog = false
                        } else {
                            inputError = "新增失敗，名稱不可為空或最多已達10餐上限"
                        }
                    }
                ) {
                    Text("新增")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddMealDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    // Delete Meal Confirmation Dialog
    if (mealToDelete != null) {
        AlertDialog(
            onDismissRequest = { mealToDelete = null },
            title = { Text("確定刪除 ${mealToDelete!!.displayName}？") },
            text = { Text("刪除此餐別會一併移除該餐別下的所有飲食紀錄。") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.removeCustomMeal(mealToDelete!!.mealType)
                        mealToDelete = null
                    },
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("確定刪除")
                }
            },
            dismissButton = {
                TextButton(onClick = { mealToDelete = null }) {
                    Text("取消")
                }
            }
        )
    }

    if (showExportDialog) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        WeeklyExportDialog(
            initialStartDate = todayStr,
            onDismiss = { showExportDialog = false },
            onExport = { category, startDate ->
                showExportDialog = false
                coroutineScope.launch {
                    val htmlContent = when (category) {
                        "diet" -> viewModel.getDietHtmlForWeek(startDate)
                        "water" -> viewModel.getWaterHtmlForWeek(startDate)
                        "training" -> viewModel.getTrainingHtmlForWeek(startDate)
                        "weight" -> viewModel.getWeightHtmlForWeek(startDate)
                        "all" -> viewModel.getAllHtmlForWeek(startDate)
                        else -> ""
                    }
                    if (htmlContent.isNotEmpty()) {
                        pendingHtmlContent = htmlContent
                        val fileName = "weekly_${category}_report_${startDate}.html"
                        try {
                            htmlExportLauncher.launch(fileName)
                        } catch (e: Exception) {
                            Toast.makeText(context, "啟動匯出儲存失敗: ${e.message}", Toast.LENGTH_LONG).show()
                        }
                    } else {
                        Toast.makeText(context, "生成週報表失敗，內容為空", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    if (showUserLimitDialog) {
        var limitInput by remember { mutableStateOf(userAiCallLimit.toString()) }
        AlertDialog(
            onDismissRequest = { showUserLimitDialog = false },
            title = { Text("設定 專屬自訂金鑰 呼叫上限", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = "請輸入您專屬自訂金鑰的 AI 呼叫上限次數（預設為 100 次）：",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                    OutlinedTextField(
                        value = limitInput,
                        onValueChange = { newValue ->
                            if (newValue.all { it.isDigit() }) {
                                limitInput = newValue
                            }
                        },
                        label = { Text("上限次數") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondary
                    ),
                    onClick = {
                        val limitVal = limitInput.toIntOrNull() ?: 100
                        viewModel.setUserAiCallLimit(limitVal)
                        showUserLimitDialog = false
                        Toast.makeText(context, "專屬金鑰上限已設定為 $limitVal 次", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUserLimitDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showApiKeyDialog) {
        var keyInput by remember { mutableStateOf(userGeminiApiKey) }
        AlertDialog(
            onDismissRequest = { showApiKeyDialog = false },
            title = { Text("設定專屬 Gemini API Key", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = "設定專屬金鑰後，將不再受限於本 App 的呼叫次數額度，享受完全免費的 AI 體驗！",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                    OutlinedTextField(
                        value = keyInput,
                        onValueChange = { keyInput = it },
                        label = { Text("API Key") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            showApiKeyDialog = false
                            try {
                                CustomTabsIntent.Builder()
                                    .setShowTitle(true)
                                    .build()
                                    .launchUrl(context, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                                Toast.makeText(context, "請在瀏覽器複製金鑰後返回，App 將自動偵測！", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                                context.startActivity(intent)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("🌐 啟動安全瀏覽器並自動偵測")
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = {
                            val clipText = clipboardManager.getText()?.text
                            if (!clipText.isNullOrBlank()) {
                                keyInput = clipText.trim()
                                Toast.makeText(context, "已從剪貼簿貼上金鑰！", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "剪貼簿內無內容", Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("📋 一鍵貼上剪貼簿內容")
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.saveUserGeminiApiKey(keyInput.trim())
                        showApiKeyDialog = false
                        Toast.makeText(context, "API Key 已儲存！", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                Row {
                    if (userGeminiApiKey.isNotBlank()) {
                        OutlinedButton(
                            onClick = {
                                viewModel.saveUserGeminiApiKey("")
                                showApiKeyDialog = false
                                Toast.makeText(context, "API Key 已清除！", Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Text("清除")
                        }
                    }
                    TextButton(onClick = { showApiKeyDialog = false }) {
                        Text("取消")
                    }
                }
            }
        )
    }

    if (showApiGuideDialog) {
        AlertDialog(
            onDismissRequest = { showApiGuideDialog = false },
            title = { Text("取得 Gemini API Key 教學", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "只需 3 個簡單步驟即可免費取得專屬金鑰：",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Image(
                                painter = painterResource(id = R.drawable.img_gemini_api_guide),
                                contentDescription = "API Key 取得教學圖解",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Fit
                            )
                        }
                    }
                    Text(
                        text = "1. 點擊下方按鈕前往瀏覽器登入 Google AI Studio。\n2. 點擊右上角「Create API key」建立金鑰。\n3. 點擊複製金鑰後返回本 App，系統將**自動偵測並彈窗一鍵匯入**，或點擊「一鍵貼上剪貼簿」完成設定！",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showApiGuideDialog = false
                        try {
                            CustomTabsIntent.Builder()
                                .setShowTitle(true)
                                .build()
                                .launchUrl(context, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                            Toast.makeText(context, "請在瀏覽器複製金鑰後返回，App 將自動偵測！", Toast.LENGTH_LONG).show()
                        } catch (e: Exception) {
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://aistudio.google.com/app/apikey"))
                            context.startActivity(intent)
                        }
                    }
                ) {
                    Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("🌐 啟動安全瀏覽器 (自動偵測金鑰)")
                }
            },
            dismissButton = {
                TextButton(onClick = { showApiGuideDialog = false }) {
                    Text("關閉")
                }
            }
        )
    }

    if (showClipboardDialog) {
        AlertDialog(
            onDismissRequest = { showClipboardDialog = false },
            title = { Text("偵測到 API Key", fontWeight = FontWeight.Bold) },
            text = {
                Text("我們偵測到您的剪貼簿中有一組 Gemini API Key，是否自動為您匯入？")
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.saveUserGeminiApiKey(detectedKey)
                        showClipboardDialog = false
                        Toast.makeText(context, "API Key 已自動匯入成功！", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("確定匯入")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClipboardDialog = false }) {
                    Text("略過")
                }
            }
        )
    }

    if (showUserResetDialog) {
        AlertDialog(
            onDismissRequest = { showUserResetDialog = false },
            title = { Text("重設 專屬自訂金鑰 呼叫計數？", fontWeight = FontWeight.Bold) },
            text = {
                Text("確定要將您專屬金鑰的 AI 呼叫次數歸零（重新計數）嗎？這不會影響您的自訂上限。")
            },
            confirmButton = {
                Button(
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    onClick = {
                        viewModel.resetUserAiCallCount()
                        showUserResetDialog = false
                        Toast.makeText(context, "專屬自訂金鑰呼叫次數已重設為 0", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("重設")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUserResetDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showUserTokenLimitDialog) {
        var tokenLimitInput by remember { mutableStateOf(userAiTokenLimit.toString()) }
        AlertDialog(
            onDismissRequest = { showUserTokenLimitDialog = false },
            title = { Text("設定 專屬自訂金鑰 Token 上限", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = "請輸入您專屬自訂金鑰的 AI Token 上限（預設為 500,000 Tokens）：",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                    OutlinedTextField(
                        value = tokenLimitInput,
                        onValueChange = { newValue ->
                            if (newValue.all { it.isDigit() }) {
                                tokenLimitInput = newValue
                            }
                        },
                        label = { Text("Token 上限") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondary
                    ),
                    onClick = {
                        val limitVal = tokenLimitInput.toIntOrNull() ?: 500000
                        viewModel.setUserAiTokenLimit(limitVal)
                        showUserTokenLimitDialog = false
                        Toast.makeText(context, "專屬金鑰 Token 上限已設定為 $limitVal", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUserTokenLimitDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showUserTokenResetDialog) {
        AlertDialog(
            onDismissRequest = { showUserTokenResetDialog = false },
            title = { Text("重設 專屬自訂金鑰 Token 使用量？", fontWeight = FontWeight.Bold) },
            text = {
                Text("確定要將您專屬金鑰的 AI Token 使用量歸零（重新計數）嗎？這不會影響您的 Token 上限。")
            },
            confirmButton = {
                Button(
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    onClick = {
                        viewModel.resetUserAiTokenCount()
                        showUserTokenResetDialog = false
                        Toast.makeText(context, "專屬自訂金鑰 Token 使用量已重設為 0", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("重設")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUserTokenResetDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}

@Composable
fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 4.dp, top = 4.dp)
    )
}

@Composable
fun SettingsInfoRow(
    icon: ImageVector,
    title: String,
    subtitle: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SettingsClickableRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.outlineVariant,
            modifier = Modifier.size(12.dp)
        )
    }
}

@Composable
fun WeeklyExportDialog(
    initialStartDate: String,
    onDismiss: () -> Unit,
    onExport: (category: String, startDate: String) -> Unit
) {
    val context = LocalContext.current
    var selectedCategory by remember { mutableStateOf("diet") } // "diet", "training", "weight"
    var startDate by remember { mutableStateOf(initialStartDate) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("匯出週報表 (HTML)", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "請選擇匯出類型與起算日期：",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                // Custom Category Selector Chips
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val row1 = listOf(
                        "diet" to "🥗 飲食",
                        "water" to "💧 飲水",
                        "training" to "🏋️ 訓練"
                    )
                    val row2 = listOf(
                        "weight" to "⚖️ 體重",
                        "all" to "📋 全部健康總報表"
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row1.forEach { (type, label) ->
                            val isSelected = selectedCategory == type
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (isSelected) MaterialTheme.colorScheme.primaryContainer
                                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                    )
                                    .clickable { selectedCategory = type }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row2.forEach { (type, label) ->
                            val isSelected = selectedCategory == type
                            Box(
                                modifier = Modifier
                                    .weight(if (type == "all") 1.5f else 1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (isSelected) MaterialTheme.colorScheme.primaryContainer
                                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                    )
                                    .clickable { selectedCategory = type }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Start Date Input Row
                OutlinedTextField(
                    value = startDate,
                    onValueChange = { startDate = it },
                    label = { Text("起算日期 (YYYY-MM-DD)") },
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            val parts = startDate.split("-")
                            val calendar = Calendar.getInstance()
                            val year = parts.getOrNull(0)?.toIntOrNull() ?: calendar.get(Calendar.YEAR)
                            val month = (parts.getOrNull(1)?.toIntOrNull() ?: (calendar.get(Calendar.MONTH) + 1)) - 1
                            val day = parts.getOrNull(2)?.toIntOrNull() ?: calendar.get(Calendar.DAY_OF_MONTH)

                            android.app.DatePickerDialog(
                                context,
                                { _, y, m, d ->
                                    val formattedMonth = String.format("%02d", m + 1)
                                    val formattedDay = String.format("%02d", d)
                                    startDate = "$y-$formattedMonth-$formattedDay"
                                },
                                year,
                                month,
                                day
                            ).show()
                        },
                    enabled = false,
                    colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                        disabledBorderColor = MaterialTheme.colorScheme.outline,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    trailingIcon = {
                        IconButton(onClick = {
                            val parts = startDate.split("-")
                            val calendar = Calendar.getInstance()
                            val year = parts.getOrNull(0)?.toIntOrNull() ?: calendar.get(Calendar.YEAR)
                            val month = (parts.getOrNull(1)?.toIntOrNull() ?: (calendar.get(Calendar.MONTH) + 1)) - 1
                            val day = parts.getOrNull(2)?.toIntOrNull() ?: calendar.get(Calendar.DAY_OF_MONTH)

                            android.app.DatePickerDialog(
                                context,
                                { _, y, m, d ->
                                    val formattedMonth = String.format("%02d", m + 1)
                                    val formattedDay = String.format("%02d", d)
                                    startDate = "$y-$formattedMonth-$formattedDay"
                                },
                                year,
                                month,
                                day
                            ).show()
                        }) {
                            Icon(Icons.Default.Tune, contentDescription = "選擇日期")
                        }
                    }
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Informative hint
                Text(
                    text = "※ 系統會自動計算自該日期起算 7 天 (即一週) 的所有紀錄，並生成美觀、易讀的 HTML 格式報告，方便儲存。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onExport(selectedCategory, startDate) }
            ) {
                Text("開始匯出")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

@Composable
fun BmrTdeeCalculatorDialog(
    initialWeightKg: Double?,
    onDismiss: () -> Unit,
    onApplyNutritionGoal: (calories: Int, carbs: Double, fat: Double, protein: Double) -> Unit,
    onEstimateAi: suspend (gender: String, age: Int, height: Double, weight: Double, activityLevel: Double, goalNotes: String) -> Result<AiBmrEstimateResult>
) {
    var gender by remember { mutableStateOf("male") }
    var ageStr by remember { mutableStateOf("25") }
    var heightStr by remember { mutableStateOf("175") }
    var weightStr by remember {
        mutableStateOf(
            if (initialWeightKg != null && initialWeightKg > 0)
                String.format(Locale.getDefault(), "%.1f", initialWeightKg)
            else "70"
        )
    }
    var activityLevel by remember { mutableStateOf(1.2) }

    // AI 估算狀態
    var aiGoalNotes by remember { mutableStateOf("") }
    var isAiCalculating by remember { mutableStateOf(false) }
    var aiResult by remember { mutableStateOf<AiBmrEstimateResult?>(null) }
    var aiErrorMessage by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()

    val age = ageStr.toIntOrNull() ?: 25
    val height = heightStr.toDoubleOrNull() ?: 175.0
    val weight = weightStr.toDoubleOrNull() ?: 70.0

    val bmr = remember(gender, age, height, weight) {
        if (weight > 0 && height > 0 && age > 0) {
            if (gender == "male") {
                (10 * weight + 6.25 * height - 5 * age + 5).toInt()
            } else {
                (10 * weight + 6.25 * height - 5 * age - 161).toInt()
            }
        } else {
            0
        }
    }

    val tdee = remember(bmr, activityLevel) {
        (bmr * activityLevel).toInt()
    }

    val activityLabels = listOf(
        1.2 to "居 幾乎不運動 (久坐辦公室)",
        1.375 to "🚶 輕度運動 (每週 1-3 天)",
        1.55 to "🏃 中度運動 (每週 3-5 天)",
        1.725 to "🏋️ 高度運動 (每週 6-7 天)",
        1.9 to "⚡ 極高運動 (專業訓練/勞動)"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Calculate,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("⚡ BMR & TDEE 試算器", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("性別", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("male" to "👨 男性", "female" to "👩 女性").forEach { (type, label) ->
                        val isSelected = gender == type
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (isSelected) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                )
                                .clickable { gender = type }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = ageStr,
                        onValueChange = { ageStr = it.filter { char -> char.isDigit() } },
                        label = { Text("年齡 (歲)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = heightStr,
                        onValueChange = { heightStr = it },
                        label = { Text("身高 (cm)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = weightStr,
                        onValueChange = { weightStr = it },
                        label = { Text("體重 (kg)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                Text("日常活動量等級", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    activityLabels.forEach { (level, label) ->
                        val isSelected = activityLevel == level
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.85f)
                                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
                                )
                                .border(
                                    width = if (isSelected) 1.5.dp else 1.dp,
                                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable { activityLevel = level }
                                .padding(horizontal = 14.dp, vertical = 12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                // Customized Radio Button indicator
                                Box(
                                    modifier = Modifier
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(
                                            if (isSelected) MaterialTheme.colorScheme.primary
                                            else Color.Transparent
                                        )
                                        .border(
                                            width = 1.5.dp,
                                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                            shape = CircleShape
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isSelected) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .clip(CircleShape)
                                                .background(MaterialTheme.colorScheme.onPrimary)
                                        )
                                    }
                                }
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                // BMR & TDEE 獨立雙卡片 (解決橫向擠壓跑版問題，改為分行清楚呈現)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp)
                        ) {
                            Text("基礎代謝率 (BMR)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$bmr",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "kcal / 天",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                            )
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.45f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp)
                        ) {
                            Text("總熱量消耗 (TDEE)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$tdee",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.secondary
                            )
                            Text(
                                text = "kcal / 天",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.secondary.copy(alpha = 0.8f)
                            )
                        }
                    }
                }

                // 🤖 AI 智慧個人化估算與熱量營養素規劃專區
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.35f)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "🤖 AI 智慧個人化估算與規劃",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = aiGoalNotes,
                            onValueChange = { aiGoalNotes = it },
                            placeholder = { Text("例如：備賽減脂 / 低碳水 / 每週重訓4次想增肌", style = MaterialTheme.typography.bodySmall) },
                            label = { Text("個人特殊目標與需求 (可選填)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            textStyle = MaterialTheme.typography.bodySmall
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                isAiCalculating = true
                                aiErrorMessage = null
                                coroutineScope.launch {
                                    val res = onEstimateAi(gender, age, height, weight, activityLevel, aiGoalNotes)
                                    isAiCalculating = false
                                    res.onSuccess {
                                        aiResult = it
                                    }.onFailure { err ->
                                        aiErrorMessage = err.message ?: "AI 估算失敗，請稍後重試"
                                    }
                                }
                            },
                            enabled = !isAiCalculating && weight > 0 && height > 0,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary)
                        ) {
                            if (isAiCalculating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = MaterialTheme.colorScheme.onTertiary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("AI 正在分析並計算熱量與營養素...", style = MaterialTheme.typography.labelMedium)
                            } else {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("✨ 執行 AI 個人化試算分析", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                        }

                        // AI 估算產出卡片
                        aiResult?.let { res ->
                            Spacer(modifier = Modifier.height(10.dp))
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = res.strategyTitle,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("建議每日熱量", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                        Text("${res.recommendedCalories} kcal / 天", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceAround
                                    ) {
                                        MacroBadgeItem(label = "🍚 碳水化合物", value = "${res.carbsGrams.toInt()} g")
                                        MacroBadgeItem(label = "🥩 蛋白質", value = "${res.proteinGrams.toInt()} g")
                                        MacroBadgeItem(label = "🥑 脂肪", value = "${res.fatGrams.toInt()} g")
                                    }
                                    if (res.advice.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = "💡 " + res.advice,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = {
                                            onApplyNutritionGoal(res.recommendedCalories, res.carbsGrams, res.fatGrams, res.proteinGrams)
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("🚀 一鍵套用 AI 熱量與三大營養素目標", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        aiErrorMessage?.let { err ->
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = "❌ $err", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }

                // 🎯 建議熱量與三大營養素估算區
                Text("🎯 建議熱量與三大營養素目標 (點擊套用)", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)

                data class GoalCalcItem(
                    val title: String,
                    val cal: Int,
                    val carbsG: Double,
                    val proteinG: Double,
                    val fatG: Double,
                    val containerColor: androidx.compose.ui.graphics.Color
                )

                val bgSurfaceVariant = MaterialTheme.colorScheme.surfaceVariant
                val bgPrimaryContainer = MaterialTheme.colorScheme.primaryContainer
                val bgSecondaryContainer = MaterialTheme.colorScheme.secondaryContainer
                val bgTertiaryContainer = MaterialTheme.colorScheme.tertiaryContainer

                val calculatedGoals = remember(tdee, weight, bgSurfaceVariant, bgPrimaryContainer, bgSecondaryContainer, bgTertiaryContainer) {
                    val w = if (weight > 0) weight else 70.0
                    
                    // 1. 維持體重 (50% Carbs, 20% Protein, 30% Fat)
                    val c1 = tdee
                    val p1 = (w * 1.6).coerceAtLeast(c1 * 0.20 / 4)
                    val f1 = c1 * 0.30 / 9
                    val cb1 = (c1 - p1 * 4 - f1 * 9) / 4

                    // 2. 溫和減脂 (-15%, 高蛋白質保護肌肉)
                    val c2 = (tdee * 0.85).toInt()
                    val p2 = (w * 2.0).coerceAtLeast(c2 * 0.30 / 4)
                    val f2 = c2 * 0.30 / 9
                    val cb2 = (c2 - p2 * 4 - f2 * 9) / 4

                    // 3. 積極減脂 (-20%)
                    val c3 = (tdee * 0.80).toInt()
                    val p3 = (w * 2.2).coerceAtLeast(c3 * 0.35 / 4)
                    val f3 = c3 * 0.30 / 9
                    val cb3 = (c3 - p3 * 4 - f3 * 9) / 4

                    // 4. 肌肉增生 (+10%)
                    val c4 = (tdee * 1.10).toInt()
                    val p4 = (w * 1.8).coerceAtLeast(c4 * 0.25 / 4)
                    val f4 = c4 * 0.25 / 9
                    val cb4 = (c4 - p4 * 4 - f4 * 9) / 4

                    listOf(
                        GoalCalcItem("⚖️ 維持體重 (TDEE)", c1, cb1, p1, f1, bgSurfaceVariant),
                        GoalCalcItem("📉 溫和減脂 (-15%)", c2, cb2, p2, f2, bgPrimaryContainer),
                        GoalCalcItem("🔥 積極減脂 (-20%)", c3, cb3, p3, f3, bgSecondaryContainer),
                        GoalCalcItem("🏋️ 肌肉增生 (+10%)", c4, cb4, p4, f4, bgTertiaryContainer)
                    )
                }

                calculatedGoals.forEach { item ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = item.containerColor),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onApplyNutritionGoal(item.cal, item.carbsG, item.fatG, item.proteinG)
                            }
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                    Text("熱量：約 ${item.cal} kcal/天", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                }
                                Button(
                                    onClick = { onApplyNutritionGoal(item.cal, item.carbsG, item.fatG, item.proteinG) },
                                    modifier = Modifier.height(32.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp)
                                ) {
                                    Text("套用", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text("🍚 碳水 ${item.carbsG.toInt()}g", style = MaterialTheme.typography.labelSmall)
                                Text("🥩 蛋白質 ${item.proteinG.toInt()}g", style = MaterialTheme.typography.labelSmall)
                                Text("🥑 脂肪 ${item.fatG.toInt()}g", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("關閉")
            }
        }
    )
}

@Composable
private fun MacroBadgeItem(label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
    }
}
