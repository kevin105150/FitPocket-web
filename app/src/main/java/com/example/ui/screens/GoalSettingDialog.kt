package com.example.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.CarbCycleType
import com.example.data.model.NutritionGoalPreset
import com.example.ui.components.MacroCalorieVerificationCard
import com.example.ui.components.NutritionCalculator
import com.example.ui.theme.CalorieColor
import com.example.ui.theme.CarbsColor
import com.example.ui.theme.FatColor
import com.example.ui.theme.PotassiumColor
import com.example.ui.theme.ProteinColor
import com.example.ui.theme.SodiumColor
import kotlin.math.abs
import kotlin.math.round

@Composable
fun GoalSettingDialog(
    initialCycleType: CarbCycleType = CarbCycleType.MEDIUM,
    highPreset: NutritionGoalPreset,
    mediumPreset: NutritionGoalPreset,
    lowPreset: NutritionGoalPreset,
    customPreset: NutritionGoalPreset,
    onDismiss: () -> Unit,
    onSaveAll: (high: NutritionGoalPreset, medium: NutritionGoalPreset, low: NutritionGoalPreset, custom: NutritionGoalPreset, activeType: CarbCycleType) -> Unit
) {
    var selectedTab by remember { mutableStateOf(initialCycleType) }

    // High State
    var highCalorie by remember { mutableStateOf(highPreset.calories.toString()) }
    var highCarbs by remember { mutableStateOf(if (highPreset.carbs % 1.0 == 0.0) highPreset.carbs.toInt().toString() else highPreset.carbs.toString()) }
    var highFat by remember { mutableStateOf(if (highPreset.fat % 1.0 == 0.0) highPreset.fat.toInt().toString() else highPreset.fat.toString()) }
    var highProtein by remember { mutableStateOf(if (highPreset.protein % 1.0 == 0.0) highPreset.protein.toInt().toString() else highPreset.protein.toString()) }
    var highSodium by remember { mutableStateOf(if (highPreset.sodium % 1.0 == 0.0) highPreset.sodium.toInt().toString() else highPreset.sodium.toString()) }
    var highPotassium by remember { mutableStateOf(if (highPreset.potassium % 1.0 == 0.0) highPreset.potassium.toInt().toString() else highPreset.potassium.toString()) }

    // Medium State
    var medCalorie by remember { mutableStateOf(mediumPreset.calories.toString()) }
    var medCarbs by remember { mutableStateOf(if (mediumPreset.carbs % 1.0 == 0.0) mediumPreset.carbs.toInt().toString() else mediumPreset.carbs.toString()) }
    var medFat by remember { mutableStateOf(if (mediumPreset.fat % 1.0 == 0.0) mediumPreset.fat.toInt().toString() else mediumPreset.fat.toString()) }
    var medProtein by remember { mutableStateOf(if (mediumPreset.protein % 1.0 == 0.0) mediumPreset.protein.toInt().toString() else mediumPreset.protein.toString()) }
    var medSodium by remember { mutableStateOf(if (mediumPreset.sodium % 1.0 == 0.0) mediumPreset.sodium.toInt().toString() else mediumPreset.sodium.toString()) }
    var medPotassium by remember { mutableStateOf(if (mediumPreset.potassium % 1.0 == 0.0) mediumPreset.potassium.toInt().toString() else mediumPreset.potassium.toString()) }

    // Low State
    var lowCalorie by remember { mutableStateOf(lowPreset.calories.toString()) }
    var lowCarbs by remember { mutableStateOf(if (lowPreset.carbs % 1.0 == 0.0) lowPreset.carbs.toInt().toString() else lowPreset.carbs.toString()) }
    var lowFat by remember { mutableStateOf(if (lowPreset.fat % 1.0 == 0.0) lowPreset.fat.toInt().toString() else lowPreset.fat.toString()) }
    var lowProtein by remember { mutableStateOf(if (lowPreset.protein % 1.0 == 0.0) lowPreset.protein.toInt().toString() else lowPreset.protein.toString()) }
    var lowSodium by remember { mutableStateOf(if (lowPreset.sodium % 1.0 == 0.0) lowPreset.sodium.toInt().toString() else lowPreset.sodium.toString()) }
    var lowPotassium by remember { mutableStateOf(if (lowPreset.potassium % 1.0 == 0.0) lowPreset.potassium.toInt().toString() else lowPreset.potassium.toString()) }

    // Custom State
    var customCalorie by remember { mutableStateOf(customPreset.calories.toString()) }
    var customCarbs by remember { mutableStateOf(if (customPreset.carbs % 1.0 == 0.0) customPreset.carbs.toInt().toString() else customPreset.carbs.toString()) }
    var customFat by remember { mutableStateOf(if (customPreset.fat % 1.0 == 0.0) customPreset.fat.toInt().toString() else customPreset.fat.toString()) }
    var customProtein by remember { mutableStateOf(if (customPreset.protein % 1.0 == 0.0) customPreset.protein.toInt().toString() else customPreset.protein.toString()) }
    var customSodium by remember { mutableStateOf(if (customPreset.sodium % 1.0 == 0.0) customPreset.sodium.toInt().toString() else customPreset.sodium.toString()) }
    var customPotassium by remember { mutableStateOf(if (customPreset.potassium % 1.0 == 0.0) customPreset.potassium.toInt().toString() else customPreset.potassium.toString()) }

    // Current active tab references
    val currentCalorie = when (selectedTab) {
        CarbCycleType.HIGH -> highCalorie
        CarbCycleType.MEDIUM -> medCalorie
        CarbCycleType.LOW -> lowCalorie
        CarbCycleType.CUSTOM -> customCalorie
    }
    val currentCarbs = when (selectedTab) {
        CarbCycleType.HIGH -> highCarbs
        CarbCycleType.MEDIUM -> medCarbs
        CarbCycleType.LOW -> lowCarbs
        CarbCycleType.CUSTOM -> customCarbs
    }
    val currentFat = when (selectedTab) {
        CarbCycleType.HIGH -> highFat
        CarbCycleType.MEDIUM -> medFat
        CarbCycleType.LOW -> lowFat
        CarbCycleType.CUSTOM -> customFat
    }
    val currentProtein = when (selectedTab) {
        CarbCycleType.HIGH -> highProtein
        CarbCycleType.MEDIUM -> medProtein
        CarbCycleType.LOW -> lowProtein
        CarbCycleType.CUSTOM -> customProtein
    }
    val currentSodium = when (selectedTab) {
        CarbCycleType.HIGH -> highSodium
        CarbCycleType.MEDIUM -> medSodium
        CarbCycleType.LOW -> lowSodium
        CarbCycleType.CUSTOM -> customSodium
    }
    val currentPotassium = when (selectedTab) {
        CarbCycleType.HIGH -> highPotassium
        CarbCycleType.MEDIUM -> medPotassium
        CarbCycleType.LOW -> lowPotassium
        CarbCycleType.CUSTOM -> customPotassium
    }

    val tabColors = when (selectedTab) {
        CarbCycleType.HIGH -> Color(0xFFE65100)
        CarbCycleType.MEDIUM -> Color(0xFF2E7D32)
        CarbCycleType.LOW -> Color(0xFF1565C0)
        CarbCycleType.CUSTOM -> Color(0xFF7B1FA2)
    }

    var showMismatchDialog by remember { mutableStateOf(false) }

    fun checkPresetMismatch(calStr: String, cStr: String, pStr: String, fStr: String): Pair<Boolean, Double> {
        val cal = calStr.toDoubleOrNull() ?: 0.0
        val c = cStr.toDoubleOrNull() ?: 0.0
        val p = pStr.toDoubleOrNull() ?: 0.0
        val f = fStr.toDoubleOrNull() ?: 0.0
        val calc = NutritionCalculator.calculateCalories(c, p, f)
        val diff = cal - calc
        val isMatched = abs(diff) <= maxOf(5.0, calc * 0.03)
        return Pair(!isMatched && (cal > 0 || calc > 0), calc)
    }

    fun calibrateTabCalories(type: CarbCycleType) {
        when (type) {
            CarbCycleType.HIGH -> {
                val c = highCarbs.toDoubleOrNull() ?: 0.0
                val p = highProtein.toDoubleOrNull() ?: 0.0
                val f = highFat.toDoubleOrNull() ?: 0.0
                highCalorie = round(NutritionCalculator.calculateCalories(c, p, f)).toInt().toString()
            }
            CarbCycleType.MEDIUM -> {
                val c = medCarbs.toDoubleOrNull() ?: 0.0
                val p = medProtein.toDoubleOrNull() ?: 0.0
                val f = medFat.toDoubleOrNull() ?: 0.0
                medCalorie = round(NutritionCalculator.calculateCalories(c, p, f)).toInt().toString()
            }
            CarbCycleType.LOW -> {
                val c = lowCarbs.toDoubleOrNull() ?: 0.0
                val p = lowProtein.toDoubleOrNull() ?: 0.0
                val f = lowFat.toDoubleOrNull() ?: 0.0
                lowCalorie = round(NutritionCalculator.calculateCalories(c, p, f)).toInt().toString()
            }
            CarbCycleType.CUSTOM -> {
                val c = customCarbs.toDoubleOrNull() ?: 0.0
                val p = customProtein.toDoubleOrNull() ?: 0.0
                val f = customFat.toDoubleOrNull() ?: 0.0
                customCalorie = round(NutritionCalculator.calculateCalories(c, p, f)).toInt().toString()
            }
        }
    }

    fun calibrateAllPresets() {
        calibrateTabCalories(CarbCycleType.HIGH)
        calibrateTabCalories(CarbCycleType.MEDIUM)
        calibrateTabCalories(CarbCycleType.LOW)
        calibrateTabCalories(CarbCycleType.CUSTOM)
    }

    fun balanceCurrentTabMacros() {
        val targetCal = currentCalorie.toDoubleOrNull() ?: 0.0
        if (targetCal <= 0.0) return

        val c = currentCarbs.toDoubleOrNull() ?: 0.0
        val p = currentProtein.toDoubleOrNull() ?: 0.0
        val f = currentFat.toDoubleOrNull() ?: 0.0
        val currentSum = (c * 4.0) + (p * 4.0) + (f * 9.0)
        if (currentSum <= 0.0) return

        val factor = targetCal / currentSum
        val newC = round(c * factor * 10.0) / 10.0
        val newP = round(p * factor * 10.0) / 10.0
        val newF = round(f * factor * 10.0) / 10.0

        when (selectedTab) {
            CarbCycleType.HIGH -> {
                highCarbs = if (newC % 1.0 == 0.0) newC.toInt().toString() else newC.toString()
                highProtein = if (newP % 1.0 == 0.0) newP.toInt().toString() else newP.toString()
                highFat = if (newF % 1.0 == 0.0) newF.toInt().toString() else newF.toString()
            }
            CarbCycleType.MEDIUM -> {
                medCarbs = if (newC % 1.0 == 0.0) newC.toInt().toString() else newC.toString()
                medProtein = if (newP % 1.0 == 0.0) newP.toInt().toString() else newP.toString()
                medFat = if (newF % 1.0 == 0.0) newF.toInt().toString() else newF.toString()
            }
            CarbCycleType.LOW -> {
                lowCarbs = if (newC % 1.0 == 0.0) newC.toInt().toString() else newC.toString()
                lowProtein = if (newP % 1.0 == 0.0) newP.toInt().toString() else newP.toString()
                lowFat = if (newF % 1.0 == 0.0) newF.toInt().toString() else newF.toString()
            }
            CarbCycleType.CUSTOM -> {
                customCarbs = if (newC % 1.0 == 0.0) newC.toInt().toString() else newC.toString()
                customProtein = if (newP % 1.0 == 0.0) newP.toInt().toString() else newP.toString()
                customFat = if (newF % 1.0 == 0.0) newF.toInt().toString() else newF.toString()
            }
        }
    }

    fun executeSave() {
        val finalHigh = NutritionGoalPreset(
            type = CarbCycleType.HIGH,
            calories = highCalorie.toIntOrNull() ?: highPreset.calories,
            carbs = highCarbs.toDoubleOrNull() ?: highPreset.carbs,
            fat = highFat.toDoubleOrNull() ?: highPreset.fat,
            protein = highProtein.toDoubleOrNull() ?: highPreset.protein,
            sodium = highSodium.toDoubleOrNull() ?: highPreset.sodium,
            potassium = highPotassium.toDoubleOrNull() ?: highPreset.potassium
        )
        val finalMedium = NutritionGoalPreset(
            type = CarbCycleType.MEDIUM,
            calories = medCalorie.toIntOrNull() ?: mediumPreset.calories,
            carbs = medCarbs.toDoubleOrNull() ?: mediumPreset.carbs,
            fat = medFat.toDoubleOrNull() ?: mediumPreset.fat,
            protein = medProtein.toDoubleOrNull() ?: mediumPreset.protein,
            sodium = medSodium.toDoubleOrNull() ?: mediumPreset.sodium,
            potassium = medPotassium.toDoubleOrNull() ?: mediumPreset.potassium
        )
        val finalLow = NutritionGoalPreset(
            type = CarbCycleType.LOW,
            calories = lowCalorie.toIntOrNull() ?: lowPreset.calories,
            carbs = lowCarbs.toDoubleOrNull() ?: lowPreset.carbs,
            fat = lowFat.toDoubleOrNull() ?: lowPreset.fat,
            protein = lowProtein.toDoubleOrNull() ?: lowPreset.protein,
            sodium = lowSodium.toDoubleOrNull() ?: lowPreset.sodium,
            potassium = lowPotassium.toDoubleOrNull() ?: lowPreset.potassium
        )
        val finalCustom = NutritionGoalPreset(
            type = CarbCycleType.CUSTOM,
            calories = customCalorie.toIntOrNull() ?: customPreset.calories,
            carbs = customCarbs.toDoubleOrNull() ?: customPreset.carbs,
            fat = customFat.toDoubleOrNull() ?: customPreset.fat,
            protein = customProtein.toDoubleOrNull() ?: customPreset.protein,
            sodium = customSodium.toDoubleOrNull() ?: customPreset.sodium,
            potassium = customPotassium.toDoubleOrNull() ?: customPreset.potassium
        )
        onSaveAll(finalHigh, finalMedium, finalLow, finalCustom, selectedTab)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(
                    text = "設定高／中／低碳日目標",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "自訂三大碳循環模式，隨時一鍵切換每日目標",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Carb Cycle Dropdown Selector
                var expanded by remember { mutableStateOf(false) }
                var buttonWidthPx by remember { mutableStateOf(0) }
                val density = LocalDensity.current
                val buttonWidthDp = with(density) { buttonWidthPx.toDp() }

                val currentPillBg = when {
                    selectedTab == CarbCycleType.HIGH -> Color(0xFFFFE0B2)
                    selectedTab == CarbCycleType.MEDIUM -> Color(0xFFC8E6C9)
                    selectedTab == CarbCycleType.LOW -> Color(0xFFBBDEFB)
                    else -> Color(0xFFE1BEE7)
                }
                val currentTextColor = when {
                    selectedTab == CarbCycleType.HIGH -> Color(0xFFBF360C)
                    selectedTab == CarbCycleType.MEDIUM -> Color(0xFF1B5E20)
                    selectedTab == CarbCycleType.LOW -> Color(0xFF0D47A1)
                    else -> Color(0xFF4A148C)
                }

                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "切換編輯模式",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 2.dp)
                    )
                    
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .onGloballyPositioned { coordinates ->
                                buttonWidthPx = coordinates.size.width
                            }
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = currentPillBg.copy(alpha = 0.35f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, currentTextColor.copy(alpha = 0.4f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { expanded = true }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = currentPillBg
                                    ) {
                                        Text(
                                            text = when (selectedTab) {
                                                CarbCycleType.HIGH -> "高碳日"
                                                CarbCycleType.MEDIUM -> "中碳日"
                                                CarbCycleType.LOW -> "低碳日"
                                                CarbCycleType.CUSTOM -> "自訂日"
                                            },
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = currentTextColor,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                    Text(
                                        text = selectedTab.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Icon(
                                    imageVector = Icons.Default.KeyboardArrowDown,
                                    contentDescription = null,
                                    tint = currentTextColor,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            shape = RoundedCornerShape(12.dp),
                            containerColor = MaterialTheme.colorScheme.surface,
                            shadowElevation = 4.dp,
                            modifier = Modifier
                                .then(if (buttonWidthDp > 0.dp) Modifier.width(buttonWidthDp) else Modifier.fillMaxWidth())
                        ) {
                            CarbCycleType.values().forEach { type ->
                                val isTypeSelected = selectedTab == type
                                val itemColor = when (type) {
                                    CarbCycleType.HIGH -> Color(0xFFBF360C)
                                    CarbCycleType.MEDIUM -> Color(0xFF1B5E20)
                                    CarbCycleType.LOW -> Color(0xFF0D47A1)
                                    CarbCycleType.CUSTOM -> Color(0xFF4A148C)
                                }
                                val itemBg = when (type) {
                                    CarbCycleType.HIGH -> Color(0xFFFFE0B2)
                                    CarbCycleType.MEDIUM -> Color(0xFFC8E6C9)
                                    CarbCycleType.LOW -> Color(0xFFBBDEFB)
                                    CarbCycleType.CUSTOM -> Color(0xFFE1BEE7)
                                }
                                val typeName = when (type) {
                                    CarbCycleType.HIGH -> "高碳日"
                                    CarbCycleType.MEDIUM -> "中碳日"
                                    CarbCycleType.LOW -> "低碳日"
                                    CarbCycleType.CUSTOM -> "自訂日"
                                }

                                DropdownMenuItem(
                                    text = {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = itemBg
                                            ) {
                                                Text(
                                                    text = typeName,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    color = itemColor,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                            Text(
                                                text = type.description,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedTab = type
                                        expanded = false
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            if (isTypeSelected) itemBg.copy(alpha = 0.25f) else Color.Transparent
                                        )
                                )
                            }
                        }
                    }
                }

                // Mini Cycle Status Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    CarbCycleType.values().forEach { type ->
                        val (mismatched, _) = when (type) {
                            CarbCycleType.HIGH -> checkPresetMismatch(highCalorie, highCarbs, highProtein, highFat)
                            CarbCycleType.MEDIUM -> checkPresetMismatch(medCalorie, medCarbs, medProtein, medFat)
                            CarbCycleType.LOW -> checkPresetMismatch(lowCalorie, lowCarbs, lowProtein, lowFat)
                            CarbCycleType.CUSTOM -> checkPresetMismatch(customCalorie, customCarbs, customProtein, customFat)
                        }
                        val isSelected = selectedTab == type
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            border = if (mismatched) BorderStroke(1.dp, Color(0xFFE65100)) else null,
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { selectedTab = type }
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 4.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = type.shortName,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 11.sp
                                )
                                Text(
                                    text = if (mismatched) "⚠️未平衡" else "✅對上",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (mismatched) Color(0xFFE65100) else Color(0xFF2E7D32),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                // Description Card
                Card(
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = tabColors.copy(alpha = 0.05f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${selectedTab.emoji} ${selectedTab.displayName}：${selectedTab.description}",
                            style = MaterialTheme.typography.bodySmall,
                            color = tabColors,
                            fontWeight = FontWeight.Medium,
                            fontSize = 11.sp
                        )
                    }
                }

                // Input fields for active tab
                ThemedNutrientInputField(
                    value = currentCalorie,
                    onValueChange = { input ->
                        if (input.all { it.isDigit() } && input.length <= 5) {
                            when (selectedTab) {
                                CarbCycleType.HIGH -> highCalorie = input
                                CarbCycleType.MEDIUM -> medCalorie = input
                                CarbCycleType.LOW -> lowCalorie = input
                                CarbCycleType.CUSTOM -> customCalorie = input
                            }
                        }
                    },
                    label = "每日熱量",
                    unit = "kcal",
                    color = CalorieColor,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("goal_input_calories")
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ThemedNutrientInputField(
                        value = currentCarbs,
                        onValueChange = { input ->
                            if (input.isEmpty() || input.matches(Regex("""^\d*\.?\d*$"""))) {
                                when (selectedTab) {
                                    CarbCycleType.HIGH -> highCarbs = input
                                    CarbCycleType.MEDIUM -> medCarbs = input
                                    CarbCycleType.LOW -> lowCarbs = input
                                    CarbCycleType.CUSTOM -> customCarbs = input
                                }
                            }
                        },
                        label = "碳水化合物",
                        unit = "g",
                        color = CarbsColor,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("goal_input_carbs")
                    )

                    ThemedNutrientInputField(
                        value = currentFat,
                        onValueChange = { input ->
                            if (input.isEmpty() || input.matches(Regex("""^\d*\.?\d*$"""))) {
                                when (selectedTab) {
                                    CarbCycleType.HIGH -> highFat = input
                                    CarbCycleType.MEDIUM -> medFat = input
                                    CarbCycleType.LOW -> lowFat = input
                                    CarbCycleType.CUSTOM -> customFat = input
                                }
                            }
                        },
                        label = "脂肪",
                        unit = "g",
                        color = FatColor,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("goal_input_fat")
                    )
                }

                ThemedNutrientInputField(
                    value = currentProtein,
                    onValueChange = { input ->
                        if (input.isEmpty() || input.matches(Regex("""^\d*\.?\d*$"""))) {
                            when (selectedTab) {
                                CarbCycleType.HIGH -> highProtein = input
                                CarbCycleType.MEDIUM -> medProtein = input
                                CarbCycleType.LOW -> lowProtein = input
                                CarbCycleType.CUSTOM -> customProtein = input
                            }
                        }
                    },
                    label = "蛋白質",
                    unit = "g",
                    color = ProteinColor,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("goal_input_protein")
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ThemedNutrientInputField(
                        value = currentSodium,
                        onValueChange = { input ->
                            if (input.isEmpty() || input.matches(Regex("""^\d*\.?\d*$"""))) {
                                when (selectedTab) {
                                    CarbCycleType.HIGH -> highSodium = input
                                    CarbCycleType.MEDIUM -> medSodium = input
                                    CarbCycleType.LOW -> lowSodium = input
                                    CarbCycleType.CUSTOM -> customSodium = input
                                }
                            }
                        },
                        label = "鈉",
                        unit = "mg",
                        color = SodiumColor,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("goal_input_sodium")
                    )

                    ThemedNutrientInputField(
                        value = currentPotassium,
                        onValueChange = { input ->
                            if (input.isEmpty() || input.matches(Regex("""^\d*\.?\d*$"""))) {
                                when (selectedTab) {
                                    CarbCycleType.HIGH -> highPotassium = input
                                    CarbCycleType.MEDIUM -> medPotassium = input
                                    CarbCycleType.LOW -> lowPotassium = input
                                    CarbCycleType.CUSTOM -> customPotassium = input
                                }
                            }
                        },
                        label = "鉀",
                        unit = "mg",
                        color = PotassiumColor,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("goal_input_potassium")
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Real-time macro vs calories verification card for selected tab
                MacroCalorieVerificationCard(
                    calories = currentCalorie.toDoubleOrNull() ?: 0.0,
                    carbs = currentCarbs.toDoubleOrNull() ?: 0.0,
                    protein = currentProtein.toDoubleOrNull() ?: 0.0,
                    fat = currentFat.toDoubleOrNull() ?: 0.0,
                    onAutoCalibrateCalories = {
                        calibrateTabCalories(selectedTab)
                    },
                    title = "【${selectedTab.displayName}】三大營養素與熱量防呆比對",
                    showProportionalBalance = true,
                    onProportionalBalance = { balanceCurrentTabMacros() }
                )

                val anyCycleMismatched = CarbCycleType.values().any { type ->
                    when (type) {
                        CarbCycleType.HIGH -> checkPresetMismatch(highCalorie, highCarbs, highProtein, highFat).first
                        CarbCycleType.MEDIUM -> checkPresetMismatch(medCalorie, medCarbs, medProtein, medFat).first
                        CarbCycleType.LOW -> checkPresetMismatch(lowCalorie, lowCarbs, lowProtein, lowFat).first
                        CarbCycleType.CUSTOM -> checkPresetMismatch(customCalorie, customCarbs, customProtein, customFat).first
                    }
                }

                if (anyCycleMismatched) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFFF3E0), // Soft warning orange background
                        border = BorderStroke(1.dp, Color(0xFFFFB74D)), // Warm orange border
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Bolt,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = Color(0xFFE65100)
                                )
                                Text(
                                    text = "檢測到熱量與三大營養素不符",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color(0xFFE65100),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = "高中低碳日的部分熱量設定，與其對應的蛋白質、脂肪、碳水化合物換算熱量存在落差。",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF5D4037),
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = { calibrateAllPresets() },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFE65100),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Bolt,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "一鍵自動校正全部天數熱量",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold
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
                    val anyMismatched = CarbCycleType.values().any { type ->
                        when (type) {
                            CarbCycleType.HIGH -> checkPresetMismatch(highCalorie, highCarbs, highProtein, highFat).first
                            CarbCycleType.MEDIUM -> checkPresetMismatch(medCalorie, medCarbs, medProtein, medFat).first
                            CarbCycleType.LOW -> checkPresetMismatch(lowCalorie, lowCarbs, lowProtein, lowFat).first
                            CarbCycleType.CUSTOM -> checkPresetMismatch(customCalorie, customCarbs, customProtein, customFat).first
                        }
                    }
                    if (anyMismatched) {
                        showMismatchDialog = true
                    } else {
                        executeSave()
                    }
                },
                modifier = Modifier.testTag("confirm_goal_button")
            ) {
                Text("儲存並套用 (${selectedTab.displayName})")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("cancel_goal_button")
            ) {
                Text("取消")
            }
        },
        shape = RoundedCornerShape(20.dp)
    )

    if (showMismatchDialog) {
        AlertDialog(
            onDismissRequest = { showMismatchDialog = false },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFE65100),
                    modifier = Modifier.size(32.dp)
                )
            },
            title = {
                Text(
                    text = "碳循環目標與三大營養素未對上",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "以下模式的「每日熱量」與「三大營養素換算（碳水×4 + 蛋白質×4 + 脂肪×9）」未對上：",
                        style = MaterialTheme.typography.bodySmall
                    )

                    CarbCycleType.values().forEach { type ->
                        val (mismatched, calcCal) = when (type) {
                            CarbCycleType.HIGH -> checkPresetMismatch(highCalorie, highCarbs, highProtein, highFat)
                            CarbCycleType.MEDIUM -> checkPresetMismatch(medCalorie, medCarbs, medProtein, medFat)
                            CarbCycleType.LOW -> checkPresetMismatch(lowCalorie, lowCarbs, lowProtein, lowFat)
                            CarbCycleType.CUSTOM -> checkPresetMismatch(customCalorie, customCarbs, customProtein, customFat)
                        }
                        val currentInput = when (type) {
                            CarbCycleType.HIGH -> highCalorie.toIntOrNull() ?: 0
                            CarbCycleType.MEDIUM -> medCalorie.toIntOrNull() ?: 0
                            CarbCycleType.LOW -> lowCalorie.toIntOrNull() ?: 0
                            CarbCycleType.CUSTOM -> customCalorie.toIntOrNull() ?: 0
                        }
                        if (mismatched) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFFFFF3E0),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = type.displayName,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    Text(
                                        text = "輸入 $currentInput 卡 ➔ 換算 ${calcCal.toInt()} 卡 (差 ${abs(currentInput - calcCal.toInt())} 卡)",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFFBF360C),
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "點擊「一鍵校正並儲存」，系統將自動把熱量修正為精確的三大營養素換算值。",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        calibrateAllPresets()
                        showMismatchDialog = false
                        executeSave()
                    },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("⚡ 一鍵校正全部並儲存")
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = { showMismatchDialog = false }) {
                        Text("返回修改")
                    }
                    TextButton(
                        onClick = {
                            showMismatchDialog = false
                            executeSave()
                        }
                    ) {
                        Text("維持原樣儲存")
                    }
                }
            },
            shape = RoundedCornerShape(20.dp)
        )
    }
}
