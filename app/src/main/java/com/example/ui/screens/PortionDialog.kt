package com.example.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import com.example.data.model.FoodSearchResult
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
import kotlin.math.round

@Composable
fun PortionDialog(
    food: FoodSearchResult,
    mealType: MealType,
    mealDisplayName: String = mealType.displayName,
    onConfirm: (
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
        brand: String,
        barcode: String?
    ) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var foodName by remember { mutableStateOf(food.name) }
    var brand by remember { mutableStateOf(food.brand) }
    var barcode by remember { mutableStateOf(food.barcode ?: "") }
    var selectedUnit by remember { mutableStateOf(food.servingUnit) }
    var servingAmount by remember { mutableDoubleStateOf(food.defaultServingAmount) }
    var amountText by remember {
        mutableStateOf(
            if (food.defaultServingAmount % 1.0 == 0.0) food.defaultServingAmount.toInt().toString()
            else food.defaultServingAmount.toString()
        )
    }

    var isCustomTuning by remember { mutableStateOf(false) }
    var saveToLibrary by remember { mutableStateOf(true) }

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

    // Initial base nutrition per serving
    val baseFactor = servingAmount / 100.0
    var customCalories by remember { mutableStateOf((Math.round(food.caloriesPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customCarbs by remember { mutableStateOf((Math.round(food.carbsPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customSugars by remember { mutableStateOf((Math.round(food.sugarsPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customFiber by remember { mutableStateOf((Math.round(food.fiberPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customProtein by remember { mutableStateOf((Math.round(food.proteinPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customFat by remember { mutableStateOf((Math.round(food.fatPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customSodium by remember { mutableStateOf((Math.round(food.sodiumPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var customPotassium by remember { mutableStateOf((Math.round(food.potassiumPer100g * baseFactor * 10.0) / 10.0).toString()) }
    var showMismatchDialog by remember { mutableStateOf(false) }

    fun executeConfirm(finalCal: Double) {
        val c = customCarbs.toDoubleOrNull() ?: 0.0
        val sug = customSugars.toDoubleOrNull() ?: 0.0
        val fib = customFiber.toDoubleOrNull() ?: 0.0
        val p = customProtein.toDoubleOrNull() ?: 0.0
        val f = customFat.toDoubleOrNull() ?: 0.0
        val sod = customSodium.toDoubleOrNull() ?: 0.0
        val pot = customPotassium.toDoubleOrNull() ?: 0.0
        val finalAmount = amountText.toDoubleOrNull() ?: 1.0

        onConfirm(
            foodName.ifBlank { food.name },
            mealType,
            finalAmount,
            selectedUnit,
            finalCal,
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

    fun recalculateNutrients(newAmount: Double, unit: String = selectedUnit) {
        val baseAmt = if (food.defaultServingAmount > 0) food.defaultServingAmount else 100.0
        val f = when (unit) {
            "g", "ml" -> newAmount / 100.0
            "份" -> (newAmount * baseAmt) / 100.0
            else -> (newAmount * baseAmt) / 100.0
        }.coerceAtLeast(0.0)

        customCalories = (Math.round(food.caloriesPer100g * f * 10.0) / 10.0).toString()
        customCarbs = (Math.round(food.carbsPer100g * f * 10.0) / 10.0).toString()
        customSugars = (Math.round(food.sugarsPer100g * f * 10.0) / 10.0).toString()
        customFiber = (Math.round(food.fiberPer100g * f * 10.0) / 10.0).toString()
        customProtein = (Math.round(food.proteinPer100g * f * 10.0) / 10.0).toString()
        customFat = (Math.round(food.fatPer100g * f * 10.0) / 10.0).toString()
        customSodium = (Math.round(food.sodiumPer100g * f * 10.0) / 10.0).toString()
        customPotassium = (Math.round(food.potassiumPer100g * f * 10.0) / 10.0).toString()
    }

    fun onUnitChanged(newUnit: String) {
        val oldUnit = selectedUnit
        if (oldUnit == newUnit) return
        selectedUnit = newUnit
        
        val currentAmount = amountText.toDoubleOrNull() ?: 1.0
        val baseAmt = if (food.defaultServingAmount > 0) food.defaultServingAmount else 100.0
        
        val convertedAmount = when {
            (oldUnit == "g" || oldUnit == "ml") && (newUnit != "g" && newUnit != "ml") -> {
                // Grams to Portion/Piece
                currentAmount / baseAmt
            }
            (oldUnit != "g" && oldUnit != "ml") && (newUnit == "g" || newUnit == "ml") -> {
                // Portion/Piece to Grams
                currentAmount * baseAmt
            }
            else -> {
                currentAmount
            }
        }
        
        val rounded = Math.round(convertedAmount * 10.0) / 10.0
        amountText = if (rounded % 1.0 == 0.0) rounded.toInt().toString() else rounded.toString()
        recalculateNutrients(rounded, newUnit)
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
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "加入「$mealDisplayName」",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (food.brand.isNotBlank()) {
                            Text(
                                text = food.brand,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "關閉")
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Food Info Box & Editable Food Name
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                if (food.brand.isNotBlank()) {
                                    Text(
                                        text = food.brand,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                if (!food.servingSizeText.isNullOrBlank()) {
                                    Text(
                                        text = "標準份量: ${food.servingSizeText}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Editable Food Name
                        OutlinedTextField(
                            value = foodName,
                            onValueChange = { foodName = it },
                            label = { Text("食品名稱 (可自訂修改)") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("food_name_input"),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Brand/Store Input
                        OutlinedTextField(
                            value = brand,
                            onValueChange = { brand = it },
                            label = { Text("商店 / 品牌") },
                            placeholder = { Text("例如：全家、7-11、一般、自煮") },
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
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Portion Input with Unit Selector Dropdown
                Text(
                    text = "設定您的食用份量與單位",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { text ->
                            amountText = text
                            val parsed = text.toDoubleOrNull()
                            if (parsed != null && parsed > 0) {
                                recalculateNutrients(parsed, selectedUnit)
                            }
                        },
                        label = { Text("食用數值") },
                        modifier = Modifier
                            .weight(1.3f)
                            .testTag("portion_amount_input"),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        shape = RoundedCornerShape(12.dp)
                    )

                    // Unit Selection Dropdown Trigger
                    var unitDropdownExpanded by remember { mutableStateOf(false) }
                    val defaultUnits = listOf("g", "ml", "份", "個", "碗", "杯", "包", "瓶")
                    val unitOptions = (listOf(food.servingUnit) + defaultUnits).distinct()

                    Box(modifier = Modifier.weight(1f)) {
                        OutlinedButton(
                            onClick = { unitDropdownExpanded = true },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = selectedUnit,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Icon(Icons.Default.ArrowDropDown, contentDescription = "選擇單位")
                            }
                        }

                        DropdownMenu(
                            expanded = unitDropdownExpanded,
                            onDismissRequest = { unitDropdownExpanded = false }
                        ) {
                            unitOptions.forEach { unit ->
                                DropdownMenuItem(
                                    text = { Text(unit) },
                                    onClick = {
                                        onUnitChanged(unit)
                                        unitDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Quick multipliers row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    listOf(0.5, 1.0, 1.5, 2.0).forEach { multiplier ->
                        val targetAmt = if (selectedUnit == "g" || selectedUnit == "ml") {
                            food.defaultServingAmount * multiplier
                        } else {
                            multiplier
                        }
                        val currentVal = amountText.toDoubleOrNull() ?: 0.0
                        val isSelected = Math.abs(currentVal - targetAmt) < 0.1
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .clickable {
                                    val r = Math.round(targetAmt * 10.0) / 10.0
                                    amountText = if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
                                    recalculateNutrients(r, selectedUnit)
                                }
                        ) {
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(vertical = 8.dp)) {
                                Text(
                                    text = "${multiplier}份",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Toggle fine-tuning mode
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "微調營養素 (依實際包裝標示修改)",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Switch(
                        checked = isCustomTuning,
                        onCheckedChange = { isCustomTuning = it }
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

                if (isCustomTuning) {
                    // Fine-tune all 7 nutrients + calories with thematic input colors
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ThemedNutrientInputField(
                                value = customCalories,
                                onValueChange = { customCalories = it },
                                label = "熱量",
                                unit = "kcal",
                                color = CalorieColor,
                                modifier = Modifier.weight(1f)
                            )
                            ThemedNutrientInputField(
                                value = customCarbs,
                                onValueChange = { customCarbs = it },
                                label = "碳水化合物",
                                unit = "g",
                                color = CarbsColor,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ThemedNutrientInputField(
                                value = customProtein,
                                onValueChange = { customProtein = it },
                                label = "蛋白質",
                                unit = "g",
                                color = ProteinColor,
                                modifier = Modifier.weight(1f)
                            )
                            ThemedNutrientInputField(
                                value = customFat,
                                onValueChange = { customFat = it },
                                label = "脂肪",
                                unit = "g",
                                color = FatColor,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ThemedNutrientInputField(
                                value = customSugars,
                                onValueChange = { customSugars = it },
                                label = "糖",
                                unit = "g",
                                color = SugarsColor,
                                modifier = Modifier.weight(1f)
                            )
                            ThemedNutrientInputField(
                                value = customFiber,
                                onValueChange = { customFiber = it },
                                label = "膳食纖維",
                                unit = "g",
                                color = FiberColor,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ThemedNutrientInputField(
                                value = customSodium,
                                onValueChange = { customSodium = it },
                                label = "鈉",
                                unit = "mg",
                                color = SodiumColor,
                                modifier = Modifier.weight(1f)
                            )
                            ThemedNutrientInputField(
                                value = customPotassium,
                                onValueChange = { customPotassium = it },
                                label = "鉀",
                                unit = "mg",
                                color = PotassiumColor,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Real-time macro vs calories verification card
                        MacroCalorieVerificationCard(
                            calories = customCalories.toDoubleOrNull() ?: 0.0,
                            carbs = customCarbs.toDoubleOrNull() ?: 0.0,
                            protein = customProtein.toDoubleOrNull() ?: 0.0,
                            fat = customFat.toDoubleOrNull() ?: 0.0,
                            onAutoCalibrateCalories = {
                                customCalories = if (it % 1.0 == 0.0) it.toInt().toString() else it.toString()
                            },
                            title = "微調營養素與總熱量防呆比對"
                        )
                    }
                } else {
                    // Nutrition preview cards
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "預估熱量: ${customCalories} 卡",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = CalorieColor
                            )
                        }

                        // Macro row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            NutrientBadge(name = "蛋白質", value = "${customProtein}g", color = ProteinColor, modifier = Modifier.weight(1f))
                            NutrientBadge(name = "碳水", value = "${customCarbs}g", color = CarbsColor, modifier = Modifier.weight(1f))
                            NutrientBadge(name = "脂肪", value = "${customFat}g", color = FatColor, modifier = Modifier.weight(1f))
                        }

                        // Micro row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            NutrientBadge(name = "糖", value = "${customSugars}g", color = SugarsColor, modifier = Modifier.weight(1f))
                            NutrientBadge(name = "纖維", value = "${customFiber}g", color = FiberColor, modifier = Modifier.weight(1f))
                            NutrientBadge(name = "鈉", value = "${customSodium.toDoubleOrNull()?.toInt() ?: 0}mg", color = SodiumColor, modifier = Modifier.weight(1f))
                            NutrientBadge(name = "鉀", value = "${customPotassium.toDoubleOrNull()?.toInt() ?: 0}mg", color = PotassiumColor, modifier = Modifier.weight(1f))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Checkbox to remember to custom library
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = saveToLibrary,
                        onCheckedChange = { saveToLibrary = it }
                    )
                    Text(
                        text = "儲存到「我的飲食」(日後可直接在我的飲食分頁快速加入)",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("取消")
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Button(
                        onClick = {
                            val cal = customCalories.toDoubleOrNull() ?: 0.0
                            val c = customCarbs.toDoubleOrNull() ?: 0.0
                            val p = customProtein.toDoubleOrNull() ?: 0.0
                            val f = customFat.toDoubleOrNull() ?: 0.0

                            if (isCustomTuning) {
                                val isMatched = NutritionCalculator.isMatched(cal, c, p, f)
                                if (!isMatched && (cal > 0 || (c + p + f) > 0)) {
                                    showMismatchDialog = true
                                } else {
                                    executeConfirm(cal)
                                }
                            } else {
                                executeConfirm(cal)
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("confirm_portion_button")
                    ) {
                        Text("確認新增")
                    }
                }
            }
        }
    }

    if (showMismatchDialog) {
        val cal = customCalories.toDoubleOrNull() ?: 0.0
        val p = customProtein.toDoubleOrNull() ?: 0.0
        val c = customCarbs.toDoubleOrNull() ?: 0.0
        val f = customFat.toDoubleOrNull() ?: 0.0
        val calc = NutritionCalculator.calculateCalories(c, p, f)

        MacroMismatchConfirmDialog(
            itemTitle = foodName.ifBlank { food.name },
            inputCalories = cal,
            calculatedCalories = calc,
            difference = cal - calc,
            onConfirmWithCalibration = {
                val calibrated = round(calc)
                customCalories = calibrated.toInt().toString()
                showMismatchDialog = false
                executeConfirm(calibrated)
            },
            onConfirmAsIs = {
                showMismatchDialog = false
                executeConfirm(cal)
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

@Composable
fun ThemedNutrientInputField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    unit: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = {
            Text(
                text = "$label ($unit)",
                color = color,
                fontWeight = FontWeight.Medium
            )
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = color,
            unfocusedBorderColor = color.copy(alpha = 0.55f),
            focusedLabelColor = color,
            unfocusedLabelColor = color,
            cursorColor = color,
            focusedContainerColor = color.copy(alpha = 0.06f),
            unfocusedContainerColor = color.copy(alpha = 0.02f)
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
}

@Composable
fun NutrientBadge(
    name: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.12f),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = name, style = MaterialTheme.typography.labelSmall, color = color)
            Text(text = value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = color)
        }
    }
}
