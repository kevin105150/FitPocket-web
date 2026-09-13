
package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun NumericStepper(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    isDecimal: Boolean = false
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.medium)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 4.dp, vertical = 2.dp)
        ) {
            IconButton(
                onClick = {
                    val current = if (isDecimal) value.toDoubleOrNull() ?: 0.0 else value.toIntOrNull() ?: 0
                    val newValue = if (isDecimal) {
                        (current.toDouble() - 0.1).coerceAtLeast(0.0)
                    } else {
                        (current.toInt() - 1).coerceAtLeast(1).toDouble()
                    }
                    val formatted = if (isDecimal) "%.1f".format(newValue) else newValue.toInt().toString()
                    onValueChange(formatted)
                },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = MaterialTheme.colorScheme.primary)
            }

            TextField(
                value = value,
                onValueChange = { input ->
                    if (input.isEmpty() || (if (isDecimal) input.matches(Regex("^\\d*\\.?\\d*$")) else input.matches(Regex("^\\d*$")))) {
                        onValueChange(input)
                    }
                },
                textStyle = MaterialTheme.typography.bodyMedium.copy(textAlign = TextAlign.Center),
                modifier = Modifier.weight(1f),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                singleLine = true
            )

            IconButton(
                onClick = {
                    val current = if (isDecimal) value.toDoubleOrNull() ?: 0.0 else value.toIntOrNull() ?: 0
                    val newValue = if (isDecimal) {
                        (current.toDouble() + 0.1)
                    } else {
                        (current.toInt() + 1).toDouble()
                    }
                    val formatted = if (isDecimal) "%.1f".format(newValue) else newValue.toInt().toString()
                    onValueChange(formatted)
                },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Increase", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
