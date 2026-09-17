import sys

with open('app/src/main/java/com/example/ui/screens/PortionDialog.kt', 'r') as f:
    content = f.read()

target = "                // Quick multipliers row"

replacement = """                val parsedAmount = amountText.toDoubleOrNull() ?: 0.0
                Slider(
                    value = parsedAmount.toFloat(),
                    onValueChange = { 
                        val rounded = round(it * 10) / 10.0 // 1 decimal place
                        val intValue = rounded.toInt()
                        amountText = if (rounded == intValue.toDouble()) intValue.toString() else rounded.toString()
                        recalculateNutrients(rounded, selectedUnit)
                    },
                    valueRange = 0f..1000f,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    colors = SliderDefaults.colors(
                        thumbColor = MaterialTheme.colorScheme.primary,
                        activeTrackColor = MaterialTheme.colorScheme.primary,
                        inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                )

                // Quick multipliers row"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/src/main/java/com/example/ui/screens/PortionDialog.kt', 'w') as f:
        f.write(content)
    print("Injected successfully!")
else:
    print("Target not found.")
