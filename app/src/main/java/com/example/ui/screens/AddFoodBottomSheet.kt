package com.example.ui.screens

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.TextButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.model.CustomFood
import com.example.data.model.FoodRecord
import com.example.data.model.FoodSearchResult
import com.example.data.model.MealType
import kotlinx.coroutines.delay

private fun normalizeSearchText(text: String): String {
    return text.trim().lowercase()
        .replace("蕃", "番")
        .replace("臺", "台")
        .replace("麪", "麵")
        .replace("面", "麵")
}

private fun uriToBitmap(context: android.content.Context, uri: Uri): Bitmap? {
    return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
                decoder.isMutableRequired = true
            }
        } else {
            @Suppress("DEPRECATION")
            MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
        }
    } catch (e: Exception) {
        null
    }
}

/**
 * 完整常規「新增 / 搜尋飲食」頁面 (AddFoodScreen)
 * 解決 ModalBottomSheet 容易因往下滑動或返回誤觸而關閉被收掉的問題。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddFoodScreen(
    mealType: MealType,
    mealDisplayName: String = mealType.displayName,
    activeMeals: List<com.example.data.model.MealConfig> = emptyList(),
    onMealTypeChange: ((MealType) -> Unit)? = null,
    searchQuery: String,
    hasSearched: Boolean,
    recentRecords: List<FoodRecord>,
    myCustomFoods: List<CustomFood>,
    presetResults: List<FoodSearchResult>,
    isSearching: Boolean = false,
    onQueryChange: (String) -> Unit,
    onSearchSubmit: (String) -> Unit,
    onResetSearch: () -> Unit,
    onSelectFood: (FoodSearchResult) -> Unit,
    onSelectRecord: (FoodRecord) -> Unit,
    onSelectCustomFood: (CustomFood) -> Unit,
    onQuickAddRecord: (FoodRecord) -> Unit,
    onQuickAddCustomFood: (CustomFood) -> Unit,
    onDeleteCustomFood: ((CustomFood) -> Unit)? = null,
    onOpenCustomFood: () -> Unit,
    onOpenBarcodeScanner: () -> Unit = {},
    onOpenPhotoScanner: (() -> Unit)? = null,
    onAiPhotoEstimate: ((Bitmap) -> Unit)? = null,
    onDismiss: () -> Unit
) {
    // 攔截系統返回鍵，安全返回，避免滑動誤關
    BackHandler(enabled = true) {
        onDismiss()
    }

    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("全部", "我的飲食")
    var foodToDelete by remember { mutableStateOf<CustomFood?>(null) }
    var showPhotoOptionDialog by remember { mutableStateOf(false) }
    var isSpeedDialOpen by remember { mutableStateOf(false) }

    val fabRotation by animateFloatAsState(
        targetValue = if (isSpeedDialOpen) 45f else 0f,
        label = "fab_rotation"
    )

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null && onAiPhotoEstimate != null) {
            onAiPhotoEstimate(bitmap)
        }
    }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null && onAiPhotoEstimate != null) {
            val bitmap = uriToBitmap(context, uri)
            if (bitmap != null) {
                onAiPhotoEstimate(bitmap)
            }
        }
    }

    val searchSuggestions = listOf(
        "🏪 7-11", "🏪 全家", "🏪 萊爾富", "🏪 OK",
        "茶葉蛋", "地瓜", "雞胸肉", "無糖豆漿", "御飯糰", "咖啡", "香蕉", "燕麥"
    )

    Scaffold(
        contentWindowInsets = WindowInsets.statusBars,
        topBar = {
            TopAppBar(
                title = {
                    var expanded by remember { mutableStateOf(false) }
                    Box {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { expanded = true }
                                .padding(horizontal = 4.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "新增飲食 • $mealDisplayName",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = "選擇餐別"
                            )
                        }
                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            activeMeals.forEach { mealConfig ->
                                DropdownMenuItem(
                                    text = { Text(mealConfig.displayName) },
                                    onClick = {
                                        onMealTypeChange?.invoke(mealConfig.mealType)
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.testTag("back_from_add_food_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "返回飲食記錄"
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
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 3 Expandable Action Buttons when Open
                AnimatedVisibility(
                    visible = isSpeedDialOpen,
                    enter = fadeIn() + slideInVertically { it / 2 },
                    exit = fadeOut() + slideOutVertically { it / 2 }
                ) {
                    Column(
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // 1. AI 搜尋與自訂飲食
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.End,
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable {
                                    isSpeedDialOpen = false
                                    onOpenCustomFood()
                                }
                                .testTag("speed_dial_ai_custom_row")
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surface,
                                tonalElevation = 6.dp,
                                shadowElevation = 4.dp
                            ) {
                                Text(
                                    text = "✨ AI 搜尋與自訂",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            FloatingActionButton(
                                onClick = {
                                    isSpeedDialOpen = false
                                    onOpenCustomFood()
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .testTag("speed_dial_ai_custom_button"),
                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                shape = CircleShape
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = "AI 搜尋與自訂飲食",
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }

                        // 2. 拍照辨識
                        if (onAiPhotoEstimate != null) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.End,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable {
                                        isSpeedDialOpen = false
                                        if (onOpenPhotoScanner != null) {
                                            onOpenPhotoScanner()
                                        } else {
                                            showPhotoOptionDialog = true
                                        }
                                    }
                                    .testTag("speed_dial_photo_row")
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surface,
                                    tonalElevation = 6.dp,
                                    shadowElevation = 4.dp
                                ) {
                                    Text(
                                        text = "📷 拍照辨識",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.tertiary,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                FloatingActionButton(
                                    onClick = {
                                        isSpeedDialOpen = false
                                        if (onOpenPhotoScanner != null) {
                                            onOpenPhotoScanner()
                                        } else {
                                            showPhotoOptionDialog = true
                                        }
                                    },
                                    modifier = Modifier
                                    .size(48.dp)
                                    .testTag("speed_dial_photo_button"),
                                    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                                    shape = CircleShape
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PhotoCamera,
                                        contentDescription = "拍照辨識",
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }
                        }

                        // 3. 條碼辨識
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.End,
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable {
                                    isSpeedDialOpen = false
                                    onOpenBarcodeScanner()
                                }
                                .testTag("speed_dial_barcode_row")
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surface,
                                tonalElevation = 6.dp,
                                shadowElevation = 4.dp
                            ) {
                                Text(
                                    text = "🔍 條碼辨識",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.secondary,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            FloatingActionButton(
                                onClick = {
                                    isSpeedDialOpen = false
                                    onOpenBarcodeScanner()
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .testTag("speed_dial_barcode_button"),
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                shape = CircleShape
                            ) {
                                Icon(
                                    imageVector = Icons.Default.QrCodeScanner,
                                    contentDescription = "條碼辨識",
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                }

                // Main Floating Action Button
                FloatingActionButton(
                    onClick = { isSpeedDialOpen = !isSpeedDialOpen },
                    modifier = Modifier.testTag("speed_dial_main_fab"),
                    containerColor = if (isSpeedDialOpen) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.primary,
                    contentColor = if (isSpeedDialOpen) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onPrimary,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = if (isSpeedDialOpen) "關閉智慧選單" else "快捷智慧辨識 (AI、拍照、條碼)",
                        modifier = Modifier
                            .size(28.dp)
                            .rotate(fabRotation)
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                // Search Bar with Search Icon and Submit
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onQueryChange,
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp)
                            .testTag("food_search_input"),
                        placeholder = {
                            Text(
                                text = "搜尋食物 (例如：茶葉蛋、地瓜)",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "搜尋圖示",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                        },
                        trailingIcon = {
                            if (isSearching) {
                                androidx.compose.material3.CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            } else if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = {
                                    onResetSearch()
                                }) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "清除",
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(25.dp),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                focusManager.clearFocus()
                                onSearchSubmit(searchQuery)
                            }
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Search trigger button
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                            .clickable {
                                focusManager.clearFocus()
                                onSearchSubmit(searchQuery)
                            }
                            .testTag("submit_search_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "執行搜尋",
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    if (onOpenPhotoScanner != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.tertiary)
                                .clickable {
                                    onOpenPhotoScanner()
                                }
                                .testTag("open_photo_scanner_search_bar"),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = "拍照辨識",
                                tint = MaterialTheme.colorScheme.onTertiary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // 建議搜尋文字 (Requirement 3: 搜尋下方可以新增建議搜尋文字)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "建議：",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                )
                searchSuggestions.forEach { suggestion ->
                    val cleanQuery = suggestion.replace("🏪 ", "").trim()
                    AssistChip(
                        onClick = {
                            focusManager.clearFocus()
                            onQueryChange(cleanQuery)
                            onSearchSubmit(cleanQuery)
                        },
                        label = {
                            Text(
                                text = suggestion,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = androidx.compose.ui.graphics.Color.Transparent
                        ),
                        border = BorderStroke(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.height(28.dp).testTag("suggestion_chip_$suggestion")
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Categories Tab Row (Requirement 1: 搜尋中 全部與我的飲食欄位 可以移除背景嗎~ -> 移除背景使用 Transparent)
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = androidx.compose.ui.graphics.Color.Transparent,
                contentColor = MaterialTheme.colorScheme.primary,
                divider = {
                    HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                },
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = MaterialTheme.colorScheme.primary
                    )
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = {
                            selectedTab = index
                        },
                        selectedContentColor = MaterialTheme.colorScheme.primary,
                        unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Body Area:
            if (selectedTab == 1) {
                // Tab 1: 「我的飲食」- 支援關鍵字即時搜尋與繁簡異體字標準化
                val filteredCustomFoods = remember(myCustomFoods, searchQuery) {
                    if (searchQuery.isBlank()) {
                        myCustomFoods
                    } else {
                        val queryNorm = normalizeSearchText(searchQuery)
                        val queryTokens = queryNorm.split("\\s+".toRegex()).filter { it.isNotBlank() }
                        myCustomFoods.filter { food ->
                            val targetNorm = normalizeSearchText("${food.brand} ${food.name} ${food.servingUnit} ${food.servingSizeText ?: ""}")
                            queryTokens.all { token -> targetNorm.contains(token) } ||
                            food.name.contains(searchQuery, ignoreCase = true) ||
                            food.brand.contains(searchQuery, ignoreCase = true)
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (searchQuery.isNotBlank()) "我的飲食搜尋結果 (${filteredCustomFoods.size} / ${myCustomFoods.size}筆)" else "我的自訂飲食 (${myCustomFoods.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (searchQuery.isNotBlank()) {
                            TextButton(
                                onClick = onResetSearch,
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                modifier = Modifier.height(30.dp)
                            ) {
                                Text("清除搜尋", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        FilledTonalButton(
                            onClick = onOpenCustomFood,
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("新增自訂", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (filteredCustomFoods.isNotEmpty()) {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .testTag("my_custom_foods_list"),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(filteredCustomFoods, key = { "custom_${it.id}" }) { custom ->
                            CustomFoodItem(
                                customFood = custom,
                                onQuickAdd = { onQuickAddCustomFood(custom) },
                                onDelete = if (onDeleteCustomFood != null) {
                                    { foodToDelete = custom }
                                } else null,
                                onClick = { onSelectCustomFood(custom) }
                            )
                        }
                    }
                } else if (searchQuery.isNotBlank()) {
                    // Empty search state for 我的飲食
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            modifier = Modifier.size(44.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "在「我的飲食」中找不到「$searchQuery」",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "您可以切換至「全部」搜尋超商或官方資料庫，或直接建立為新的自訂飲食！",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = {
                                    selectedTab = 0
                                    onSearchSubmit(searchQuery)
                                },
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("🔍 在「全部」中搜尋")
                            }
                            FilledTonalButton(
                                onClick = onOpenCustomFood,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("✨ 新增自訂")
                            }
                        }
                    }
                } else {
                    // Empty state for 我的飲食
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Restaurant,
                            contentDescription = null,
                            modifier = Modifier.size(44.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "尚未有自訂飲食記錄",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "在右上角點擊「自訂 / AI」新增的食品，勾選儲存後都會完整保留在「我的飲食」！",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        FilledTonalButton(
                            onClick = onOpenCustomFood,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("✨ 立即新增自訂飲食")
                        }
                    }
                }
            } else {
                // Tab 0: 「全部」- 顯示僅以歷程為主 若按下搜尋 才跳出其他選項
                if (!hasSearched) {
                    // History View (歷程為主)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "歷程",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // "最近" pill filter button matching reference
                        AssistChip(
                            onClick = { /* Toggle sorting or recent */ },
                            label = {
                                Text(
                                    text = "最近",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            },
                            trailingIcon = {
                                Icon(
                                    imageVector = Icons.Default.FilterList,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp)
                                )
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                            ),
                            border = null,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.height(28.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (recentRecords.isNotEmpty()) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .testTag("history_foods_list"),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(bottom = 24.dp)
                        ) {
                            items(recentRecords, key = { "recent_${it.id}" }) { record ->
                                val matchedCustom = myCustomFoods.find { it.name == record.name }
                                val matchedPreset = com.example.data.model.CommonFoodsDatabase.presetList.find { it.name == record.name }
                                val brand = matchedCustom?.brand ?: matchedPreset?.brand ?: ""
                                RecentFoodHistoryItem(
                                    record = record,
                                    brand = brand,
                                    onQuickAdd = { onQuickAddRecord(record) },
                                    onClick = { onSelectRecord(record) }
                                )
                            }
                        }
                    } else {
                        // Empty history state with friendly convenience store presets
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.History,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "尚無飲食歷程記錄",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "輸入關鍵字並按下搜尋，或點選自訂新增，歷程將會自動儲存在此！",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp)
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            // Quick recommendations
                            Text(
                                text = "💡 超商常見食品快速加入：",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.align(Alignment.Start).padding(bottom = 8.dp)
                            )

                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                contentPadding = PaddingValues(bottom = 24.dp)
                            ) {
                                items(presetResults.take(6), key = { "rec_${it.id}" }) { item ->
                                    SearchResultFoodItem(
                                        item = item,
                                        onClick = { onSelectFood(item) },
                                        onDirectAdd = {
                                            val factor = item.defaultServingAmount / 100.0
                                            onQuickAddRecord(
                                                FoodRecord(
                                                    name = item.name,
                                                    mealType = mealType,
                                                    date = "", 
                                                    calories = item.caloriesPer100g * factor,
                                                    carbs = item.carbsPer100g * factor,
                                                    sugars = item.sugarsPer100g * factor,
                                                    fiber = item.fiberPer100g * factor,
                                                    protein = item.proteinPer100g * factor,
                                                    fat = item.fatPer100g * factor,
                                                    sodium = item.sodiumPer100g * factor,
                                                    potassium = item.potassiumPer100g * factor,
                                                    amount = item.defaultServingAmount,
                                                    unit = item.servingUnit,
                                                    imageUrl = item.imageUrl,
                                                    barcode = item.barcode
                                                )
                                            )
                                        }
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Search Results View (按下搜尋 才跳出其他選項)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "搜尋結果 (${presetResults.size} 項)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )

                        TextButton(
                            onClick = onResetSearch,
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("返回歷程", style = MaterialTheme.typography.labelMedium)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (presetResults.isNotEmpty()) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .testTag("search_results_list"),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(bottom = 24.dp)
                        ) {
                                items(presetResults, key = { "result_${it.id}" }) { item ->
                                SearchResultFoodItem(
                                    item = item,
                                    onClick = { onSelectFood(item) },
                                    onDirectAdd = {
                                        // Requirement: Clicking plus adds directly
                                        val factor = item.defaultServingAmount / 100.0
                                        onQuickAddRecord(
                                            FoodRecord(
                                                name = item.name,
                                                mealType = mealType,
                                                date = "", // ViewModel handles date
                                                calories = item.caloriesPer100g * factor,
                                                carbs = item.carbsPer100g * factor,
                                                sugars = item.sugarsPer100g * factor,
                                                fiber = item.fiberPer100g * factor,
                                                protein = item.proteinPer100g * factor,
                                                fat = item.fatPer100g * factor,
                                                sodium = item.sodiumPer100g * factor,
                                                potassium = item.potassiumPer100g * factor,
                                                amount = item.defaultServingAmount,
                                                unit = item.servingUnit,
                                                imageUrl = item.imageUrl,
                                                barcode = item.barcode
                                            )
                                        )
                                    }
                                )
                            }
                        }
                    } else {
                        // Empty search results: Guide to Custom Food with AI
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fastfood,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "查無「$searchQuery」的資料",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "您可以透過「自訂輸入」由 AI 搜尋官方營養標示（若無標示則自動估算）！",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            FilledTonalButton(
                                onClick = onOpenCustomFood,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("✨ 手動自訂 / AI 搜尋")
                            }
                        }
                    }
                }
            }
        }

        // Scrim backdrop when Speed Dial is open to allow tapping outside to close
        if (isSpeedDialOpen) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.32f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        isSpeedDialOpen = false
                    }
            )
        }
    }

        // Delete Confirmation Dialog (Requirement 2: 我的飲食欄位可以刪除飲食)
        foodToDelete?.let { custom ->
            AlertDialog(
                onDismissRequest = { foodToDelete = null },
                title = { Text("刪除自訂飲食") },
                text = { Text("確定要從「我的飲食」中刪除「${custom.name}」嗎？這不會影響已記錄在飲食日誌中的資料。") },
                confirmButton = {
                    Button(
                        onClick = {
                            onDeleteCustomFood?.invoke(custom)
                            foodToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("刪除")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { foodToDelete = null }) {
                        Text("取消")
                    }
                }
            )
        }

        // Photo Option Dialog for AI Search
        if (showPhotoOptionDialog) {
            AlertDialog(
                onDismissRequest = { showPhotoOptionDialog = false },
                title = { Text("📷 AI 圖片與外包裝辨識") },
                text = {
                    Column {
                        Text("拍下超商餐點外包裝、菜單或標示，AI 將自動辨識名稱與營養素：")
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedButton(
                            onClick = {
                                showPhotoOptionDialog = false
                                cameraLauncher.launch(null)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("photo_dialog_camera_button"),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("開啟相機拍攝")
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                showPhotoOptionDialog = false
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("photo_dialog_gallery_button"),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("從相簿選擇圖片")
                        }
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(onClick = { showPhotoOptionDialog = false }) {
                        Text("取消")
                    }
                }
            )
        }
    }
}

/**
 * 為了向下相容既有呼叫點保留的別名
 */
@Composable
fun AddFoodBottomSheet(
    mealType: MealType,
    mealDisplayName: String = mealType.displayName,
    activeMeals: List<com.example.data.model.MealConfig> = emptyList(),
    onMealTypeChange: ((MealType) -> Unit)? = null,
    searchQuery: String,
    hasSearched: Boolean,
    recentRecords: List<FoodRecord>,
    myCustomFoods: List<CustomFood>,
    presetResults: List<FoodSearchResult>,
    onQueryChange: (String) -> Unit,
    onSearchSubmit: (String) -> Unit,
    onResetSearch: () -> Unit,
    onSelectFood: (FoodSearchResult) -> Unit,
    onSelectRecord: (FoodRecord) -> Unit,
    onSelectCustomFood: (CustomFood) -> Unit,
    onQuickAddRecord: (FoodRecord) -> Unit,
    onQuickAddCustomFood: (CustomFood) -> Unit,
    onDeleteCustomFood: ((CustomFood) -> Unit)? = null,
    onOpenCustomFood: () -> Unit,
    onOpenBarcodeScanner: () -> Unit = {},
    onAiPhotoEstimate: ((Bitmap) -> Unit)? = null,
    onDismiss: () -> Unit
) {
    AddFoodScreen(
        mealType = mealType,
        mealDisplayName = mealDisplayName,
        searchQuery = searchQuery,
        hasSearched = hasSearched,
        recentRecords = recentRecords,
        myCustomFoods = myCustomFoods,
        presetResults = presetResults,
        onQueryChange = onQueryChange,
        onSearchSubmit = onSearchSubmit,
        onResetSearch = onResetSearch,
        onSelectFood = onSelectFood,
        onSelectRecord = onSelectRecord,
        onSelectCustomFood = onSelectCustomFood,
        onQuickAddRecord = onQuickAddRecord,
        onQuickAddCustomFood = onQuickAddCustomFood,
        onDeleteCustomFood = onDeleteCustomFood,
        onOpenCustomFood = onOpenCustomFood,
        onOpenBarcodeScanner = onOpenBarcodeScanner,
        onAiPhotoEstimate = onAiPhotoEstimate,
        onDismiss = onDismiss
    )
}

/**
 * Card for 歷程 (加回俐落卡片樣式 + 保留 26dp 快速加入按鈕)
 */
@Composable
fun RecentFoodHistoryItem(
    record: FoodRecord,
    brand: String = "",
    onQuickAdd: () -> Unit,
    onClick: () -> Unit
) {
    var isAdded by remember { mutableStateOf(false) }

    LaunchedEffect(isAdded) {
        if (isAdded) {
            delay(1500)
            isAdded = false
        }
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("recent_record_${record.id}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = record.name,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f, fill = false),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
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
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "${record.calories.toInt()} 卡, ${record.amount.toInt()}${record.unit}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "C: ${record.carbs}g  P: ${record.protein}g  F: ${record.fat}g",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Circular Add Button (26dp)
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(
                        if (isAdded) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f)
                    )
                    .clickable {
                        if (!isAdded) {
                            onQuickAdd()
                            isAdded = true
                        }
                    }
                    .testTag("quick_add_${record.id}"),
                contentAlignment = Alignment.Center
            ) {
                Crossfade(targetState = isAdded, label = "add_success_anim") { added ->
                    if (added) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "已加入",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "快速加入",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Card for Custom Foods (我的飲食 - 用戶自訂庫)
 */
@Composable
fun CustomFoodItem(
    customFood: CustomFood,
    onQuickAdd: () -> Unit,
    onDelete: (() -> Unit)? = null,
    onClick: () -> Unit
) {
    var isAdded by remember { mutableStateOf(false) }

    LaunchedEffect(isAdded) {
        if (isAdded) {
            delay(1500)
            isAdded = false
        }
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("custom_food_${customFood.id}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = customFood.name,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f, fill = false),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                            .padding(horizontal = 5.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = "自訂",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    if (customFood.brand.isNotBlank() && customFood.brand != "未分類") {
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f))
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = customFood.brand,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = MaterialTheme.colorScheme.secondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                val cal = (customFood.caloriesPer100g * customFood.defaultServingAmount / 100.0).toInt()
                Text(
                    text = "$cal 卡, ${customFood.defaultServingAmount.toInt()}${customFood.servingUnit}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "C: ${customFood.carbsPer100g}g  P: ${customFood.proteinPer100g}g  F: ${customFood.fatPer100g}g",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                // Delete Button (Requirement 2: 我的飲食欄位可以刪除飲食)
                if (onDelete != null) {
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier
                            .size(32.dp)
                            .testTag("delete_custom_food_${customFood.id}")
                    ) {
                        Icon(
                            imageVector = Icons.Default.DeleteOutline,
                            contentDescription = "刪除自訂飲食",
                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                }

                // Circular Add Button (26dp)
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(
                            if (isAdded) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f)
                        )
                        .clickable {
                            if (!isAdded) {
                                onQuickAdd()
                                isAdded = true
                            }
                        }
                        .testTag("quick_add_custom_${customFood.id}"),
                    contentAlignment = Alignment.Center
                ) {
                    Crossfade(targetState = isAdded, label = "add_success_anim_custom") { added ->
                        if (added) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "已加入",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "快速加入",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Card for Search Results / Presets
 */
@Composable
fun SearchResultFoodItem(
    item: FoodSearchResult,
    onClick: () -> Unit,
    onDirectAdd: () -> Unit = {}
) {
    var isAdded by remember { mutableStateOf(false) }

    LaunchedEffect(isAdded) {
        if (isAdded) {
            delay(1500)
            isAdded = false
        }
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("search_result_${item.id}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.name,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f, fill = false),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (item.brand.isNotBlank() && item.brand != "未分類") {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f))
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = item.brand,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = MaterialTheme.colorScheme.secondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                val cal = (item.caloriesPer100g * item.defaultServingAmount / 100.0).toInt()
                Text(
                    text = "$cal 卡, ${item.defaultServingAmount.toInt()}${item.servingUnit}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "C: ${item.carbsPer100g}g  P: ${item.proteinPer100g}g  F: ${item.fatPer100g}g",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Circular Add Button (26dp)
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(
                        if (isAdded) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f)
                    )
                    .clickable {
                        if (!isAdded) {
                            onDirectAdd()
                            isAdded = true
                        }
                    }
                    .testTag("add_item_${item.id}"),
                contentAlignment = Alignment.Center
            ) {
                Crossfade(targetState = isAdded, label = "add_success_anim_search") { added ->
                    if (added) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "已加入",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "加入",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}
