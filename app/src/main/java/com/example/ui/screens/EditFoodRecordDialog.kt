package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.data.model.FoodRecord
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
fun EditFoodRecordDialog(
    record: FoodRecord,
    onSave: (
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
        potassium: Double
    ) -> Unit,
    onDelete: (FoodRecord) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(record.name) }
    var amount by remember { mutableStateOf(record.amount.toInt().toString()) }
    var unit by remember { mutableStateOf(record.unit) }
    var calories by remember { mutableStateOf(record.calories.toString()) }
    var protein by remember { mutableStateOf(record.protein.toString()) }
    var carbs by remember { mutableStateOf(record.carbs.toString()) }
    var fat by remember { mutableStateOf(record.fat.toString()) }
    var sugars by remember { mutableStateOf(record.sugars.toString()) }
    var fiber by remember { mutableStateOf(record.fiber.toString()) }
    var sodium by remember { mutableStateOf(record.sodium.toInt().toString()) }
    var potassium by remember { mutableStateOf(record.potassium.toInt().toString()) }
    var showMismatchDialog by remember { mutableStateOf(false) }

    fun executeSave(finalCal: Double) {
        onSave(
            record.id,
            name,
            record.mealType,
            amount.toDoubleOrNull() ?: record.amount,
            unit,
            finalCal,
            carbs.toDoubleOrNull() ?: record.carbs,
            sugars.toDoubleOrNull() ?: record.sugars,
            fiber.toDoubleOrNull() ?: record.fiber,
            protein.toDoubleOrNull() ?: record.protein,
            fat.toDoubleOrNull() ?: record.fat,
            sodium.toDoubleOrNull() ?: record.sodium,
            potassium.toDoubleOrNull() ?: record.potassium
        )
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Edit, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "編輯飲食紀錄",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "關閉")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("食品名稱") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it },
                        label = { Text("份量數值") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("單位 (g/ml)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                Text(
                    text = "營養成分明細 (7大營養素)",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemedNutrientInputField(
                        value = calories,
                        onValueChange = { calories = it },
                        label = "熱量",
                        unit = "kcal",
                        color = CalorieColor,
                        modifier = Modifier.weight(1f)
                    )
                    ThemedNutrientInputField(
                        value = carbs,
                        onValueChange = { carbs = it },
                        label = "碳水化合物",
                        unit = "g",
                        color = CarbsColor,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemedNutrientInputField(
                        value = protein,
                        onValueChange = { protein = it },
                        label = "蛋白質",
                        unit = "g",
                        color = ProteinColor,
                        modifier = Modifier.weight(1f)
                    )
                    ThemedNutrientInputField(
                        value = fat,
                        onValueChange = { fat = it },
                        label = "脂肪",
                        unit = "g",
                        color = FatColor,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemedNutrientInputField(
                        value = sugars,
                        onValueChange = { sugars = it },
                        label = "糖",
                        unit = "g",
                        color = SugarsColor,
                        modifier = Modifier.weight(1f)
                    )
                    ThemedNutrientInputField(
                        value = fiber,
                        onValueChange = { fiber = it },
                        label = "膳食纖維",
                        unit = "g",
                        color = FiberColor,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemedNutrientInputField(
                        value = sodium,
                        onValueChange = { sodium = it },
                        label = "鈉",
                        unit = "mg",
                        color = SodiumColor,
                        modifier = Modifier.weight(1f)
                    )
                    ThemedNutrientInputField(
                        value = potassium,
                        onValueChange = { potassium = it },
                        label = "鉀",
                        unit = "mg",
                        color = PotassiumColor,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Real-time macro vs calories verification card
                MacroCalorieVerificationCard(
                    calories = calories.toDoubleOrNull() ?: 0.0,
                    carbs = carbs.toDoubleOrNull() ?: 0.0,
                    protein = protein.toDoubleOrNull() ?: 0.0,
                    fat = fat.toDoubleOrNull() ?: 0.0,
                    onAutoCalibrateCalories = {
                        calories = if (it % 1.0 == 0.0) it.toInt().toString() else it.toString()
                    },
                    title = "三大營養素與總熱量防呆比對"
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Actions: Delete & Save
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = { onDelete(record) },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("刪除")
                    }

                    Row {
                        OutlinedButton(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("取消")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val cal = calories.toDoubleOrNull() ?: 0.0
                                val p = protein.toDoubleOrNull() ?: 0.0
                                val c = carbs.toDoubleOrNull() ?: 0.0
                                val f = fat.toDoubleOrNull() ?: 0.0

                                val isMatched = NutritionCalculator.isMatched(cal, c, p, f)
                                if (!isMatched && (cal > 0 || (c + p + f) > 0)) {
                                    showMismatchDialog = true
                                } else {
                                    executeSave(cal)
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.testTag("save_edit_food_button")
                        ) {
                            Text("儲存修改")
                        }
                    }
                }
            }
        }
    }

    if (showMismatchDialog) {
        val cal = calories.toDoubleOrNull() ?: 0.0
        val p = protein.toDoubleOrNull() ?: 0.0
        val c = carbs.toDoubleOrNull() ?: 0.0
        val f = fat.toDoubleOrNull() ?: 0.0
        val calc = NutritionCalculator.calculateCalories(c, p, f)

        MacroMismatchConfirmDialog(
            itemTitle = name.ifBlank { "食品紀錄" },
            inputCalories = cal,
            calculatedCalories = calc,
            difference = cal - calc,
            onConfirmWithCalibration = {
                val calibrated = round(calc)
                calories = calibrated.toInt().toString()
                showMismatchDialog = false
                executeSave(calibrated)
            },
            onConfirmAsIs = {
                showMismatchDialog = false
                executeSave(cal)
            },
            onDismiss = { showMismatchDialog = false }
        )
    }
}
