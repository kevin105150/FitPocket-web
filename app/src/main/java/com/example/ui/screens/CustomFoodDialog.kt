package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import com.example.data.model.MealType
import com.example.ui.theme.CalorieColor
import com.example.ui.theme.CarbsColor
import com.example.ui.theme.FatColor
import com.example.ui.theme.FiberColor
import com.example.ui.theme.PotassiumColor
import com.example.ui.theme.ProteinColor
import com.example.ui.theme.SodiumColor
import com.example.ui.theme.SugarsColor
import com.example.ui.components.MacroCalorieVerificationCard
import com.example.ui.components.MacroMismatchConfirmDialog
import com.example.ui.components.NutritionCalculator

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

enum class InputMode {
    PER_100G, // 每 100g/ml 標示
    PER_SERVING // 整份 / 整包裝標示
}

@Composable
fun CustomFoodDialog(
    initialMealType: MealType,
    availableMeals: List<com.example.data.model.MealConfig> = emptyList(),
    isAiEstimating: Boolean,
    onAiEstimate: (name: String, onFilled: (Double, Double, Double, Double, Double, Double, Double, Double, Double, String) -> Unit) -> Unit,
    onAiPhotoEstimate: ((Bitmap, onFilled: (String, Double, Double, Double, Double, Double, Double, Double, Double, Double, String) -> Unit) -> Unit)? = null,
    onDismiss: () -> Unit,
    onConfirm: (
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
        saveToCustomLibrary: Boolean,
        brand: String,
        barcode: String?
    ) -> Unit
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var barcode by remember { mutableStateOf("") }
    var selectedMeal by remember { mutableStateOf(initialMealType) }
    var caloriesText by remember { mutableStateOf("") }
    var proteinText by remember { mutableStateOf("") }
    var carbsText by remember { mutableStateOf("") }
    var fatText by remember { mutableStateOf("") }
    var sugarsText by remember { mutableStateOf("") }
    var fiberText by remember { mutableStateOf("") }
    var sodiumText by remember { mutableStateOf("") }
    var potassiumText by remember { mutableStateOf("") }
    var servingAmountText by remember { mutableStateOf("100") }
    var servingUnitText by remember { mutableStateOf("g") }
    var saveToLibrary by remember { mutableStateOf(true) }
    var showMismatchDialog by remember { mutableStateOf(false) }
    var inputMode by remember { mutableStateOf(InputMode.PER_100G) }

    fun submitFood(finalCal: Double) {
        val inputModeIsPer100g = inputMode == InputMode.PER_100G
        val amount = servingAmountText.toDoubleOrNull() ?: 100.0
        val scale = if (inputModeIsPer100g) amount / 100.0 else 1.0

        val p = (proteinText.toDoubleOrNull() ?: 0.0) * scale
        val c = (carbsText.toDoubleOrNull() ?: 0.0) * scale
        val f = (fatText.toDoubleOrNull() ?: 0.0) * scale
        val sug = (sugarsText.toDoubleOrNull() ?: 0.0) * scale
        val fib = (fiberText.toDoubleOrNull() ?: 0.0) * scale
        val sod = (sodiumText.toDoubleOrNull() ?: 0.0) * scale
        val pot = (potassiumText.toDoubleOrNull() ?: 0.0) * scale
        val calories = finalCal * scale

        if (name.isNotBlank()) {
            onConfirm(
                name,
                selectedMeal,
                amount,
                servingUnitText,
                calories,
                c,
                sug,
                fib,
                p,
                f,
                sod,
                pot,
                saveToLibrary,
                brand,
                barcode.trim().ifBlank { null }
            )
        }
    }

    var showNestedBarcodeScanner by remember { mutableStateOf(false) }
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null && onAiPhotoEstimate != null) {
            onAiPhotoEstimate(bitmap) { detectedName, cal, p, c, f, sug, fib, sod, pot, amt, u ->
                if (detectedName.isNotBlank()) name = detectedName
                caloriesText = cal.toInt().toString()
                proteinText = p.toString()
                carbsText = c.toString()
                fatText = f.toString()
                sugarsText = sug.toString()
                fiberText = fib.toString()
                sodiumText = sod.toInt().toString()
                potassiumText = pot.toInt().toString()
                servingAmountText = amt.toInt().toString()
                servingUnitText = u
                inputMode = InputMode.PER_SERVING
            }
        }
    }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null && onAiPhotoEstimate != null) {
            val bitmap = uriToBitmap(context, uri)
            if (bitmap != null) {
                onAiPhotoEstimate(bitmap) { detectedName, cal, p, c, f, sug, fib, sod, pot, amt, u ->
                    if (detectedName.isNotBlank()) name = detectedName
                    caloriesText = cal.toInt().toString()
                    proteinText = p.toString()
                    carbsText = c.toString()
                    fatText = f.toString()
                    sugarsText = sug.toString()
                    fiberText = fib.toString()
                    sodiumText = sod.toInt().toString()
                    potassiumText = pot.toInt().toString()
                    servingAmountText = amt.toInt().toString()
                    servingUnitText = u
                    inputMode = InputMode.PER_SERVING
                }
            }
        }
    }

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
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp)
            ) {
                Text(
                    text = "手動自訂 / AI 搜尋飲食",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "輸入名稱由 AI 搜尋官方營養標示（若搜尋不到則自動估算），或拍照辨識！",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Meal type selector
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (availableMeals.isNotEmpty()) {
                        availableMeals.forEach { mealConfig ->
                            FilterChip(
                                selected = selectedMeal == mealConfig.mealType,
                                onClick = { selectedMeal = mealConfig.mealType },
                                label = { Text(mealConfig.displayName) },
                                modifier = Modifier.testTag("custom_meal_${mealConfig.mealType.name}")
                            )
                        }
                    } else {
                        MealType.values().forEach { meal ->
                            FilterChip(
                                selected = selectedMeal == meal,
                                onClick = { selectedMeal = meal },
                                label = { Text(meal.displayName) },
                                modifier = Modifier.testTag("custom_meal_${meal.name}")
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Name input
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("食物或超商品牌名稱 *") },
                    placeholder = { Text("例如：全家 烤地瓜、7-11 爪哇咖哩、排骨便當") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("custom_name_input"),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // AI Estimation Button directly below food name
                FilledTonalButton(
                    onClick = {
                        if (name.isNotBlank()) {
                            onAiEstimate(name) { cal, p, c, f, sug, fib, sod, pot, amt, u ->
                                caloriesText = cal.toInt().toString()
                                proteinText = p.toString()
                                carbsText = c.toString()
                                fatText = f.toString()
                                sugarsText = sug.toString()
                                fiberText = fib.toString()
                                sodiumText = sod.toInt().toString()
                                potassiumText = pot.toInt().toString()
                                servingAmountText = amt.toInt().toString()
                                servingUnitText = u
                                inputMode = InputMode.PER_SERVING
                            }
                        }
                    },
                    enabled = name.isNotBlank() && !isAiEstimating,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .testTag("ai_estimate_custom_food_button")
                ) {
                    if (isAiEstimating) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("AI 搜尋/分析中...", style = MaterialTheme.typography.labelMedium)
                    } else {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("✨ AI 搜尋營養標示 (無官方標示則估算)", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // AI Photo Search buttons row
                if (onAiPhotoEstimate != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { cameraLauncher.launch(null) },
                            enabled = !isAiEstimating,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(40.dp)
                                .testTag("custom_food_camera_button")
                        ) {
                            Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("📷 拍照讀標示", style = MaterialTheme.typography.labelSmall)
                        }

                        OutlinedButton(
                            onClick = {
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            enabled = !isAiEstimating,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(40.dp)
                                .testTag("custom_food_gallery_button")
                        ) {
                            Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("🖼️ 相簿選標示", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Portion amount & unit
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = servingAmountText,
                        onValueChange = { servingAmountText = it },
                        label = { Text("食用份量") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = servingUnitText,
                        onValueChange = { servingUnitText = it },
                        label = { Text("單位") },
                        placeholder = { Text("g / ml / 份") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Store/Brand Input
                Column(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = brand,
                        onValueChange = { brand = it },
                        label = { Text("商店 / 品牌") },
                        placeholder = { Text("例如：全家、7-11、一般、萊爾富") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    
                    // Suggestion Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("全家", "7-11", "萊爾富", "OK超商", "一般", "自煮").forEach { suggestion ->
                            AssistChip(
                                onClick = { brand = suggestion },
                                label = { Text(suggestion, style = MaterialTheme.typography.bodySmall) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Barcode Input
                OutlinedTextField(
                    value = barcode,
                    onValueChange = { barcode = it },
                    label = { Text("商品條碼 (選填)") },
                    placeholder = { Text("輸入或點擊右側圖示掃描條碼") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    trailingIcon = {
                        IconButton(onClick = { showNestedBarcodeScanner = true }) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = "掃描條碼")
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                Text(
                    text = "營養素輸入模式",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    androidx.compose.material3.FilterChip(
                        selected = inputMode == InputMode.PER_100G,
                        onClick = { inputMode = InputMode.PER_100G },
                        label = { Text("每 100g/ml 標示") },
                        modifier = Modifier.weight(1f)
                    )
                    androidx.compose.material3.FilterChip(
                        selected = inputMode == InputMode.PER_SERVING,
                        onClick = { inputMode = InputMode.PER_SERVING },
                        label = { Text("整份 / 總包裝標示") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                val nutrientSuffix = if (inputMode == InputMode.PER_100G) " (每 100g)" else " (單份總量)"

                Text(
                    text = "營養素明細 (可手動修改)",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(8.dp))

                // 營養素明細: 支援自訂主題配色
                ThemedNutrientInputField(
                    value = caloriesText,
                    onValueChange = { caloriesText = it },
                    label = "熱量$nutrientSuffix *",
                    unit = "kcal",
                    color = CalorieColor,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("custom_calories_input")
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = carbsText,
                    onValueChange = { carbsText = it },
                    label = "碳水化合物$nutrientSuffix",
                    unit = "g",
                    color = CarbsColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = proteinText,
                    onValueChange = { proteinText = it },
                    label = "蛋白質$nutrientSuffix",
                    unit = "g",
                    color = ProteinColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = fatText,
                    onValueChange = { fatText = it },
                    label = "脂肪$nutrientSuffix",
                    unit = "g",
                    color = FatColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = sugarsText,
                    onValueChange = { sugarsText = it },
                    label = "糖$nutrientSuffix",
                    unit = "g",
                    color = SugarsColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = fiberText,
                    onValueChange = { fiberText = it },
                    label = "膳食纖維$nutrientSuffix",
                    unit = "g",
                    color = FiberColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = sodiumText,
                    onValueChange = { sodiumText = it },
                    label = "鈉$nutrientSuffix",
                    unit = "mg",
                    color = SodiumColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                ThemedNutrientInputField(
                    value = potassiumText,
                    onValueChange = { potassiumText = it },
                    label = "鉀$nutrientSuffix",
                    unit = "mg",
                    color = PotassiumColor,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Real-time macro vs calories verification card
                MacroCalorieVerificationCard(
                    calories = caloriesText.toDoubleOrNull() ?: 0.0,
                    carbs = carbsText.toDoubleOrNull() ?: 0.0,
                    protein = proteinText.toDoubleOrNull() ?: 0.0,
                    fat = fatText.toDoubleOrNull() ?: 0.0,
                    onAutoCalibrateCalories = {
                        caloriesText = if (it % 1.0 == 0.0) it.toInt().toString() else it.toString()
                    },
                    title = "三大營養素與總熱量防呆比對"
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Save to custom library checkbox
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = saveToLibrary,
                        onCheckedChange = { saveToLibrary = it }
                    )
                    Text(
                        text = "同時儲存至「我的飲食」(日後可直接在我的飲食頁籤快速選取)",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Buttons
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
                            val cal = caloriesText.toDoubleOrNull() ?: 0.0
                            val p = proteinText.toDoubleOrNull() ?: 0.0
                            val c = carbsText.toDoubleOrNull() ?: 0.0
                            val f = fatText.toDoubleOrNull() ?: 0.0

                            val isMatched = NutritionCalculator.isMatched(cal, c, p, f)
                            if (!isMatched && (cal > 0 || (c + p + f) > 0)) {
                                showMismatchDialog = true
                            } else {
                                submitFood(cal)
                            }
                        },
                        enabled = name.isNotBlank() && caloriesText.isNotBlank(),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("confirm_custom_food_button")
                    ) {
                        Text("儲存並記錄")
                    }
                }
            }
        }
    }

    if (showMismatchDialog) {
        val cal = caloriesText.toDoubleOrNull() ?: 0.0
        val p = proteinText.toDoubleOrNull() ?: 0.0
        val c = carbsText.toDoubleOrNull() ?: 0.0
        val f = fatText.toDoubleOrNull() ?: 0.0
        val calc = NutritionCalculator.calculateCalories(c, p, f)

        MacroMismatchConfirmDialog(
            itemTitle = name.ifBlank { "自訂食品" },
            inputCalories = cal,
            calculatedCalories = calc,
            difference = cal - calc,
            onConfirmWithCalibration = {
                val calibrated = kotlin.math.round(calc)
                caloriesText = calibrated.toInt().toString()
                showMismatchDialog = false
                submitFood(calibrated)
            },
            onConfirmAsIs = {
                showMismatchDialog = false
                submitFood(cal)
            },
            onDismiss = { showMismatchDialog = false }
        )
    }

    if (showNestedBarcodeScanner) {
        Dialog(onDismissRequest = { showNestedBarcodeScanner = false }) {
            Surface(
                shape = RoundedCornerShape(28.dp),
                tonalElevation = 8.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "商品條碼掃描",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { showNestedBarcodeScanner = false }) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "關閉")
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Camera Permission Status Banner
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (hasCameraPermission) Color(0xFFDCFCE7) else Color(0xFFFEF3C7),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = if (hasCameraPermission) Icons.Default.CheckCircle else Icons.Default.WarningAmber,
                                    contentDescription = null,
                                    tint = if (hasCameraPermission) Color(0xFF166534) else Color(0xFF92400E),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (hasCameraPermission) "相機權限：已開啟" else "相機權限：尚未開啟",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (hasCameraPermission) Color(0xFF166534) else Color(0xFF92400E)
                                )
                            }

                            if (!hasCameraPermission) {
                                FilledTonalButton(
                                    onClick = {
                                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                    },
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(12.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("請求權限", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            if (hasCameraPermission) {
                                CameraPreviewWithBarcodeScanner(
                                    isSearching = false,
                                    onBarcodeDetected = { code ->
                                        barcode = code
                                        showNestedBarcodeScanner = false
                                    },
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Text(
                                    text = "請開啟相機權限以進行條碼掃描",
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    TextButton(onClick = { showNestedBarcodeScanner = false }) {
                        Text("取消")
                    }
                }
            }
        }
    }
}
