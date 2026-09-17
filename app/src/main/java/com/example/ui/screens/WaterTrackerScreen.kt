package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.WaterRecord
import com.example.ui.DietViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WaterTrackerScreen(viewModel: DietViewModel) {
    val formattedDate by viewModel.formattedDateDisplay.collectAsStateWithLifecycle()
    val selectedDateString by viewModel.selectedDateString.collectAsStateWithLifecycle()
    
    val waterRecords by viewModel.waterRecordsForDate.collectAsStateWithLifecycle()
    val totalWater by viewModel.totalWaterForDate.collectAsStateWithLifecycle()
    val waterGoal by viewModel.waterGoalMl.collectAsStateWithLifecycle()

    var showAddDialog by remember { mutableStateOf(false) }
    var showGoalDialog by remember { mutableStateOf(false) }
    var showPresetsDialog by remember { mutableStateOf(false) }
    val quickAddPresets by viewModel.quickAddWaterAmounts.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("飲水追蹤", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
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

            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.WaterDrop,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "今日飲水量",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        val progress = if (waterGoal > 0) (totalWater.toFloat() / waterGoal).coerceIn(0f, 1f) else 1f
                        
                        Box(contentAlignment = Alignment.Center) {
                            WaveProgressIndicator(
                                progress = progress,
                                modifier = Modifier.size(180.dp)
                            )
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "$totalWater",
                                    style = MaterialTheme.typography.displayMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = "/ $waterGoal ml",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                )
                            }
                        }
                    }
                    IconButton(
                        onClick = { showGoalDialog = true },
                        modifier = Modifier.align(Alignment.TopEnd)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "編輯目標",
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            // Quick Add Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("快速新增", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                IconButton(onClick = { showPresetsDialog = true }) {
                    Icon(Icons.Default.Edit, contentDescription = "編輯預設值")
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(quickAddPresets) { amount ->
                    QuickAddWaterButton("$amount ml", amount) { viewModel.addWaterRecord(amount, selectedDateString) }
                }
                item {
                    Box(
                        modifier = Modifier
                            .width(80.dp)
                            .height(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.secondaryContainer)
                            .clickable { showAddDialog = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "自訂", tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            Text("記錄", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))

            if (waterRecords.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "今日尚未喝水",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(bottom = 88.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(waterRecords) { record ->
                        WaterRecordItem(record = record, onDelete = { viewModel.deleteWaterRecord(it) })
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var customAmount by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("自訂飲水量", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = customAmount,
                    onValueChange = { customAmount = it },
                    label = { Text("水量 (ml)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amount = customAmount.toIntOrNull()
                        if (amount != null && amount > 0) {
                            viewModel.addWaterRecord(amount, selectedDateString)
                        }
                        showAddDialog = false
                    }
                ) {
                    Text("新增")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showGoalDialog) {
        var newGoal by remember { mutableStateOf(waterGoal.toString()) }
        AlertDialog(
            onDismissRequest = { showGoalDialog = false },
            title = { Text("設定每日飲水目標", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = newGoal,
                    onValueChange = { newGoal = it },
                    label = { Text("目標水量 (ml)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amount = newGoal.toIntOrNull()
                        if (amount != null && amount > 0) {
                            viewModel.setWaterGoal(amount)
                        }
                        showGoalDialog = false
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showGoalDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showPresetsDialog) {
        val initialPresets = remember(quickAddPresets) {
            val list = quickAddPresets.toMutableList()
            while (list.size < 5) list.add(250)
            list.take(5)
        }
        
        val presetInputs = remember(quickAddPresets) {
            androidx.compose.runtime.mutableStateListOf<String>().apply {
                addAll(initialPresets.map { it.toString() })
            }
        }

        AlertDialog(
            onDismissRequest = { showPresetsDialog = false },
            title = { Text("編輯快速新增預設值", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("請輸入 5 個快速新增按鈕的水量 (ml)：", style = MaterialTheme.typography.bodyMedium)
                    for (i in 0 until 5) {
                        OutlinedTextField(
                            value = presetInputs.getOrElse(i) { "" },
                            onValueChange = { presetInputs[i] = it },
                            label = { Text("按鈕 ${i + 1} 水量 (ml)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val newPresets = presetInputs.mapNotNull { it.trim().toIntOrNull() }.filter { it > 0 }
                        if (newPresets.isNotEmpty()) {
                            viewModel.setQuickAddWaterAmounts(newPresets)
                        }
                        showPresetsDialog = false
                    }
                ) {
                    Text("儲存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showPresetsDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}

@Composable
fun QuickAddWaterButton(label: String, amount: Int, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .width(80.dp)
            .height(40.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun WaterRecordItem(record: WaterRecord, onDelete: (WaterRecord) -> Unit) {
    val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    val timeString = timeFormat.format(Date(record.timestamp))

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.LocalDrink,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${record.amountMl} ml",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = timeString,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = { onDelete(record) }) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "刪除",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
