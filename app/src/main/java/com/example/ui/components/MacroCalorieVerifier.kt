package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.CalorieColor
import com.example.ui.theme.CarbsColor
import com.example.ui.theme.FatColor
import com.example.ui.theme.ProteinColor
import kotlin.math.abs
import kotlin.math.round

object NutritionCalculator {
    /**
     * Calculate calories based on macronutrients:
     * Carbohydrates: 4 kcal/g
     * Protein: 4 kcal/g
     * Fat: 9 kcal/g
     */
    fun calculateCalories(carbs: Double, protein: Double, fat: Double): Double {
        return (carbs.coerceAtLeast(0.0) * 4.0) + 
               (protein.coerceAtLeast(0.0) * 4.0) + 
               (fat.coerceAtLeast(0.0) * 9.0)
    }

    /**
     * Checks if input calories matches macronutrients within reasonable tolerance (default 5 kcal or 3%).
     */
    fun isMatched(inputCalories: Double, carbs: Double, protein: Double, fat: Double, tolerance: Double = 5.0): Boolean {
        val calc = calculateCalories(carbs, protein, fat)
        if (calc <= 0.0 && inputCalories <= 0.0) return true
        val diff = abs(inputCalories - calc)
        val maxAllowed = maxOf(tolerance, calc * 0.03)
        return diff <= maxAllowed
    }

    fun getDifference(inputCalories: Double, carbs: Double, protein: Double, fat: Double): Double {
        return inputCalories - calculateCalories(carbs, protein, fat)
    }
}

/**
 * Visual verification card showing real-time comparison between
 * entered total calories and theoretical calories from macronutrients.
 */
@Composable
fun MacroCalorieVerificationCard(
    calories: Double,
    carbs: Double,
    protein: Double,
    fat: Double,
    onAutoCalibrateCalories: (Double) -> Unit,
    modifier: Modifier = Modifier,
    title: String = "三大營養素與熱量防呆比對",
    showProportionalBalance: Boolean = false,
    onProportionalBalance: (() -> Unit)? = null
) {
    val calculated = NutritionCalculator.calculateCalories(carbs, protein, fat)
    val diff = calories - calculated
    val absDiff = abs(diff)
    val hasInputs = calories > 0 || carbs > 0 || protein > 0 || fat > 0
    val isMatch = hasInputs && (absDiff <= maxOf(5.0, calculated * 0.03))

    val cardBg = when {
        !hasInputs -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        isMatch -> Color(0xFFE8F5E9)
        absDiff <= 20.0 -> Color(0xFFFFF8E1)
        else -> Color(0xFFFFEBEE)
    }

    val borderColor = when {
        !hasInputs -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
        isMatch -> Color(0xFF81C784)
        absDiff <= 20.0 -> Color(0xFFFFB74D)
        else -> Color(0xFFE57373)
    }

    val iconColor = when {
        !hasInputs -> MaterialTheme.colorScheme.onSurfaceVariant
        isMatch -> Color(0xFF2E7D32)
        absDiff <= 20.0 -> Color(0xFFE65100)
        else -> Color(0xFFC62828)
    }

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        border = BorderStroke(1.dp, borderColor),
        modifier = modifier.fillMaxWidth()
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
                Icon(
                    imageVector = when {
                        !hasInputs -> Icons.Default.Info
                        isMatch -> Icons.Default.CheckCircle
                        else -> Icons.Default.Warning
                    },
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = when {
                        !hasInputs -> title
                        isMatch -> "三大營養素與總熱量吻合 ✅"
                        else -> "三大營養素與總熱量未對上 ⚠️"
                    },
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = iconColor
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            if (!hasInputs) {
                Text(
                    text = "提示：總熱量應等於「碳水×4 + 蛋白質×4 + 脂肪×9」，輸入時系統將即時防呆驗證。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp
                )
            } else {
                // Breakdown summary row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "換算總熱量：${round(calculated * 10) / 10.0} kcal",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "碳水 ${(carbs * 4).toInt()} + 蛋白 ${(protein * 4).toInt()} + 脂肪 ${(fat * 9).toInt()} kcal",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isMatch) Color(0xFFC8E6C9) else if (absDiff <= 20.0) Color(0xFFFFE082) else Color(0xFFFFCDD2),
                        modifier = Modifier.padding(start = 6.dp)
                    ) {
                        Text(
                            text = if (isMatch) "差距 ±${round(absDiff * 10) / 10.0} (平衡)"
                                   else if (diff > 0) "輸入多出 +${round(absDiff * 10) / 10.0} kcal"
                                   else "輸入短少 -${round(absDiff * 10) / 10.0} kcal",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = iconColor,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            fontSize = 11.sp
                        )
                    }
                }

                if (!isMatch) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilledTonalButton(
                            onClick = {
                                val roundedCal = round(calculated)
                                onAutoCalibrateCalories(roundedCal)
                            },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = iconColor.copy(alpha = 0.15f),
                                contentColor = iconColor
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Bolt,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "校正熱量為 ${round(calculated).toInt()} kcal",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        if (showProportionalBalance && onProportionalBalance != null) {
                            OutlinedButton(
                                onClick = onProportionalBalance,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = "依熱量平衡三大",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Confirmation dialog shown when user attempts to submit food or goal
 * while macronutrients and calories are significantly out of sync.
 */
@Composable
fun MacroMismatchConfirmDialog(
    itemTitle: String,
    inputCalories: Double,
    calculatedCalories: Double,
    difference: Double,
    onConfirmWithCalibration: () -> Unit,
    onConfirmAsIs: () -> Unit,
    onDismiss: () -> Unit
) {
    val roundedInput = round(inputCalories).toInt()
    val roundedCalc = round(calculatedCalories).toInt()
    val absDiff = abs(round(difference).toInt())

    AlertDialog(
        onDismissRequest = onDismiss,
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
                text = "三大營養素與總熱量未對上",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "在【$itemTitle】中：",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
                
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("目前輸入熱量：", style = MaterialTheme.typography.bodySmall)
                            Text("$roundedInput kcal", fontWeight = FontWeight.Bold, color = CalorieColor)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("三大換算熱量 (碳4+蛋4+脂9)：", style = MaterialTheme.typography.bodySmall)
                            Text("$roundedCalc kcal", fontWeight = FontWeight.Bold, color = Color(0xFF2E7D32))
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("差距數值：", style = MaterialTheme.typography.bodySmall)
                            Text("$absDiff kcal", fontWeight = FontWeight.Bold, color = Color(0xFFBF360C))
                        }
                    }
                }

                Text(
                    text = "為確保每日飲食熱量與宏量營養素統計精準，建議自動校正為三大營養素換算熱量。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirmWithCalibration,
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("校正為 $roundedCalc kcal 並儲存")
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onDismiss) {
                    Text("返回修改")
                }
                TextButton(onClick = onConfirmAsIs) {
                    Text("維持原樣儲存")
                }
            }
        },
        shape = RoundedCornerShape(20.dp)
    )
}
