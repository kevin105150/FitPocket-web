package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.WeightRecord
import com.example.ui.DietViewModel
import android.graphics.Paint
import android.os.Build
import android.widget.EditText
import android.widget.NumberPicker
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeightTrackerScreen(
    viewModel: DietViewModel
) {
    val weightRecords by viewModel.allWeightRecords.collectAsStateWithLifecycle()
    val latestRecord by viewModel.latestWeightRecord.collectAsStateWithLifecycle()
    val targetWeight by viewModel.targetWeightKg.collectAsStateWithLifecycle()

    var showAddWeightDialog by remember { mutableStateOf(false) }
    var showEditTargetDialog by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) } // 0 = 早上, 1 = 晚上

    val filteredRecords = remember(weightRecords, selectedTab) {
        if (selectedTab == 0) {
            weightRecords.filter { it.morningWeightKg != null }
        } else {
            weightRecords.filter { it.eveningWeightKg != null }
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets.statusBars,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "體重記錄",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                windowInsets = WindowInsets.statusBars
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddWeightDialog = true },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                shape = RoundedCornerShape(28.dp),
                modifier = Modifier.testTag("add_weight_fab")
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (selectedTab == 0) "記錄早上體重" else "記錄晚上體重",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }
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
            // 1. Target and Current Weight Dashboard Card
            item {
                WeightOverviewCard(
                    latestRecord = latestRecord,
                    targetWeight = targetWeight,
                    previousRecord = weightRecords.getOrNull(1),
                    onEditTarget = { showEditTargetDialog = true }
                )
            }

            // 1.2 Morning/Night TabRow below WeightOverviewCard
            item {
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
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
                    listOf("早上", "晚上").forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            selectedContentColor = MaterialTheme.colorScheme.primary,
                            unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            text = {
                                Text(
                                    text = title,
                                    fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 15.sp
                                )
                            }
                        )
                    }
                }
            }

            // 1.5 Weight Trend Chart
            if (filteredRecords.isNotEmpty()) {
                item {
                    TemplateWeightChart(
                        records = weightRecords,
                        isMorning = (selectedTab == 0)
                    )
                }
            }

            // 2. Weight History Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (selectedTab == 0) "早上歷史體重紀錄 (${filteredRecords.size} 筆)" else "晚上歷史體重紀錄 (${filteredRecords.size} 筆)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // 3. Weight Records List
            if (filteredRecords.isEmpty()) {
                item {
                    EmptyWeightCard(onAddClick = { showAddWeightDialog = true })
                }
            } else {
                items(filteredRecords, key = { it.id }) { record ->
                    WeightRecordItemCard(
                        record = record,
                        isMorning = (selectedTab == 0),
                        onDelete = { viewModel.deleteWeightRecord(record) }
                    )
                }
            }
        }
    }

    // Add Weight Dialog
    if (showAddWeightDialog) {
        AddWeightDialog(
            isMorning = (selectedTab == 0),
            initialWeight = if (selectedTab == 0) {
                latestRecord?.morningWeightKg ?: 65.0
            } else {
                latestRecord?.eveningWeightKg ?: 65.0
            },
            onDismiss = { showAddWeightDialog = false },
            onConfirm = { weight, time, date ->
                if (selectedTab == 0) {
                    viewModel.addWeightRecord(morningWeightKg = weight, morningTime = time, date = date)
                } else {
                    viewModel.addWeightRecord(eveningWeightKg = weight, eveningTime = time, date = date)
                }
                showAddWeightDialog = false
            }
        )
    }

    // Edit Target Dialog
    if (showEditTargetDialog) {
        EditTargetWeightDialog(
            currentTarget = targetWeight,
            onDismiss = { showEditTargetDialog = false },
            onConfirm = { newTarget ->
                viewModel.updateTargetWeight(newTarget)
                showEditTargetDialog = false
            }
        )
    }
}

@Composable
fun WeightOverviewCard(
    latestRecord: WeightRecord?,
    targetWeight: Double,
    previousRecord: WeightRecord?,
    onEditTarget: () -> Unit
) {
    // Use morning weight as primary for comparison if available
    val currentWeight = latestRecord?.morningWeightKg ?: latestRecord?.eveningWeightKg
    val prevWeight = previousRecord?.morningWeightKg ?: previousRecord?.eveningWeightKg
    
    val diff = if (currentWeight != null && prevWeight != null) {
        Math.round((currentWeight - prevWeight) * 10.0) / 10.0
    } else null

    val diffToTarget = if (currentWeight != null) {
        Math.round((currentWeight - targetWeight) * 10.0) / 10.0
    } else null

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.MonitorWeight,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "最新體重概況",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = latestRecord?.date ?: "尚未輸入體重紀錄",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(
                    onClick = onEditTarget,
                    modifier = Modifier.testTag("edit_target_weight_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "修改目標體重",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 1. Morning Weight
                Column {
                    Text(
                        text = "早上體重" + (latestRecord?.morningTime?.let { " ($it)" } ?: ""),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = latestRecord?.morningWeightKg?.toString() ?: "--",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "kg",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }
                }

                // 2. Evening Weight
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "晚上體重" + (latestRecord?.eveningTime?.let { " ($it)" } ?: ""),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = latestRecord?.eveningWeightKg?.toString() ?: "--",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "kg",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }
                }

                // 3. Target Weight
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "目標體重",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = targetWeight.toString(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "kg",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Stat Badges Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (diff != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (diff <= 0) Color(0xFFDCFCE7) else Color(0xFFFEE2E2),
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (diff <= 0) Icons.Default.TrendingDown else Icons.Default.TrendingUp,
                                contentDescription = null,
                                tint = if (diff <= 0) Color(0xFF166534) else Color(0xFF991B1B),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "早上較上次 ${if (diff > 0) "+$diff" else "$diff"} kg",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = if (diff <= 0) Color(0xFF166534) else Color(0xFF991B1B)
                            )
                        }
                    }
                }

                if (diffToTarget != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Flag,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "距離目標 ${if (diffToTarget > 0) "+$diffToTarget" else "$diffToTarget"} kg",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WeightRecordItemCard(
    record: WeightRecord,
    isMorning: Boolean,
    onDelete: () -> Unit
) {
    val weight = if (isMorning) record.morningWeightKg else record.eveningWeightKg
    val time = if (isMorning) record.morningTime else record.eveningTime

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = record.date,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (!time.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "記錄時間：$time",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${weight ?: "--"} kg",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isMorning) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
                )

                Spacer(modifier = Modifier.width(12.dp))

                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteOutline,
                        contentDescription = "刪除記錄",
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun TemplateWeightChart(
    records: List<WeightRecord>,
    isMorning: Boolean
) {
    val chartData = remember(records, isMorning) {
        records
            .filter { if (isMorning) it.morningWeightKg != null else it.eveningWeightKg != null }
            .sortedBy { it.date }
            .takeLast(7)
    }

    if (chartData.isEmpty()) {
        return
    }

    val latestRecord = chartData.last()
    val latestWeight = if (isMorning) latestRecord.morningWeightKg else latestRecord.eveningWeightKg
    val latestTime = if (isMorning) latestRecord.morningTime else latestRecord.eveningTime
    
    val badgeText = remember(latestRecord, latestWeight, latestTime) {
        if (latestRecord != null && latestWeight != null) {
            val dateParts = latestRecord.date.split("-")
            val yy = if (dateParts.size > 0 && dateParts[0].length >= 4) dateParts[0].substring(2, 4) else "26"
            val mm = if (dateParts.size > 1) dateParts[1] else "09"
            val dd = if (dateParts.size > 2) dateParts[2] else "11"
            val time = latestTime ?: "08:00"
            "$yy.$mm.$dd $time  ${latestWeight}kg"
        } else ""
    }

    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "體重 (kg)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                if (badgeText.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF1F5F9),
                        modifier = Modifier.padding(bottom = 4.dp)
                    ) {
                        Text(
                            text = badgeText,
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1E293B)
                            ),
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
            ) {
                val weights = chartData.map { (if (isMorning) it.morningWeightKg else it.eveningWeightKg) ?: 0.0 }
                val dates = chartData.map {
                    val parts = it.date.split("-")
                    if (parts.size >= 3) "${parts[1]}.${parts[2]}" else ""
                }

                CanvasChart(
                    weights = weights,
                    dates = dates,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

@Composable
fun CanvasChart(
    weights: List<Double>,
    dates: List<String>,
    modifier: Modifier = Modifier
) {
    if (weights.isEmpty()) return

    val minWeight = remember(weights) { (weights.minOrNull() ?: 50.0) - 1.5 }
    val maxWeight = remember(weights) { (weights.maxOrNull() ?: 100.0) + 1.5 }
    val weightRange = remember(minWeight, maxWeight) { maxWeight - minWeight }

    val tealColor = Color(0xFF14B8A6) // Stunning Teal
    val lineStrokeColor = MaterialTheme.colorScheme.outlineVariant // adaptive line curve color
    val gridColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f) // adaptive grid lines
    val textColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f) // adaptive Axis text
    val labelColor = MaterialTheme.colorScheme.onSurface // adaptive point label values

    val textMeasurer = rememberTextMeasurer()
    val boldStyle = MaterialTheme.typography.labelMedium.copy(
        fontWeight = FontWeight.Bold,
        color = labelColor
    )
    val axisStyle = MaterialTheme.typography.bodySmall.copy(
        color = textColor
    )

    Canvas(modifier = modifier) {
        val width = size.width
        val height = size.height

        val paddingBottom = 30.dp.toPx()
        val paddingTop = 25.dp.toPx()
        val paddingLeft = 15.dp.toPx()
        val paddingRight = 15.dp.toPx()

        val chartHeight = height - paddingTop - paddingBottom
        val chartWidth = width - paddingLeft - paddingRight

        val pointsCount = weights.size
        val xStep = if (pointsCount > 1) chartWidth / (pointsCount - 1) else chartWidth

        // 1. Draw horizontal grid lines (4 lines)
        val gridLinesCount = 4
        for (i in 0 until gridLinesCount) {
            val y = paddingTop + (chartHeight / (gridLinesCount - 1)) * i
            drawLine(
                color = gridColor,
                start = Offset(paddingLeft, y),
                end = Offset(width - paddingRight, y),
                strokeWidth = 1.dp.toPx()
            )
        }

        // Calculate point coordinate offsets
        val points = weights.mapIndexed { index, weight ->
            val x = paddingLeft + index * xStep
            val normalizedY = if (weightRange > 0) (weight - minWeight) / weightRange else 0.5
            val y = height - paddingBottom - (normalizedY * chartHeight).toFloat()
            Offset(x, y)
        }

        // 2. Draw curved smooth curve
        if (points.size > 1) {
            val path = Path().apply {
                moveTo(points[0].x, points[0].y)
                for (i in 0 until points.size - 1) {
                    val p0 = points[i]
                    val p1 = points[i + 1]
                    val controlX1 = p0.x + (p1.x - p0.x) / 3f
                    val controlY1 = p0.y
                    val controlX2 = p0.x + 2 * (p1.x - p0.x) / 3f
                    val controlY2 = p1.y
                    cubicTo(controlX1, controlY1, controlX2, controlY2, p1.x, p1.y)
                }
            }

            // Create fill path for gradient
            val fillPath = Path().apply {
                addPath(path)
                lineTo(points.last().x, height - paddingBottom)
                lineTo(points.first().x, height - paddingBottom)
                close()
            }

            drawPath(
                path = fillPath,
                brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(
                        tealColor.copy(alpha = 0.3f),
                        tealColor.copy(alpha = 0.05f),
                        Color.Transparent
                    ),
                    startY = paddingTop,
                    endY = height - paddingBottom
                )
            )

            drawPath(
                path = path,
                color = lineStrokeColor,
                style = Stroke(
                    width = 4.dp.toPx(),
                    cap = StrokeCap.Round
                )
            )
        }

        // 3. Draw dashed vertical indicator line for the last point
        if (points.isNotEmpty()) {
            val lastPoint = points.last()
            val pathEffect = PathEffect.dashPathEffect(
                intervals = floatArrayOf(8f, 8f),
                phase = 0f
            )
            drawLine(
                color = Color(0xFFCBD5E1),
                start = Offset(lastPoint.x, paddingTop),
                end = Offset(lastPoint.x, height - paddingBottom),
                strokeWidth = 1.5.dp.toPx(),
                pathEffect = pathEffect
            )
        }

        // 4. Draw points, text value labels and date labels
        points.forEachIndexed { index, point ->
            // Point circle
            drawCircle(
                color = tealColor,
                radius = 5.dp.toPx(),
                center = point
            )

            // Value label above dot
            val label = String.format(Locale.US, "%.1f", weights[index])
            val labelResult = textMeasurer.measure(label, style = boldStyle)
            val labelWidth = labelResult.size.width
            val labelHeight = labelResult.size.height
            drawText(
                textLayoutResult = labelResult,
                topLeft = Offset(
                    x = point.x - labelWidth / 2f,
                    y = point.y - labelHeight - 6.dp.toPx()
                )
            )

            // Date label below axis line
            val dateLabel = dates.getOrNull(index) ?: ""
            if (dateLabel.isNotEmpty()) {
                val dateResult = textMeasurer.measure(dateLabel, style = axisStyle)
                val dateWidth = dateResult.size.width
                drawText(
                    textLayoutResult = dateResult,
                    topLeft = Offset(
                        x = point.x - dateWidth / 2f,
                        y = height - paddingBottom + 8.dp.toPx()
                    )
                )
            }
        }
    }
}

@Composable
fun EmptyWeightCard(onAddClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.MonitorWeight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "尚未有體重記錄",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "點擊下方按鈕開始記錄每日體重變化",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onAddClick,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("新增第一筆體重紀錄")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddWeightDialog(
    isMorning: Boolean,
    initialWeight: Double,
    onDismiss: () -> Unit,
    onConfirm: (weight: Double, time: String, date: String) -> Unit
) {
    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val now = Calendar.getInstance()

    var weightInput by remember { mutableStateOf(if (initialWeight > 0.0) initialWeight.toString() else "") }
    var selectedHour by remember { mutableIntStateOf(now.get(Calendar.HOUR_OF_DAY)) }
    var selectedMinute by remember { mutableIntStateOf(now.get(Calendar.MINUTE)) }
    var dateInput by remember { mutableStateOf(dateFormat.format(now.time)) }
    var showDatePicker by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.MonitorWeight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isMorning) "記錄早上體重" else "記錄晚上體重",
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                // 1. Weight Input
                OutlinedTextField(
                    value = weightInput,
                    onValueChange = { weightInput = it },
                    label = { Text("體重 (kg)") },
                    placeholder = { Text("例如：65.5") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )

                // 2. Date Selection with Mini Calendar
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showDatePicker = true }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "記錄日期（點擊開啓行事曆）",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = dateInput,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CalendarToday,
                                    contentDescription = "選擇日期",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "行事曆",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }
                }

                // 3. Scrollable Time Wheel Picker
                ScrollableTimePicker(
                    hour = selectedHour,
                    minute = selectedMinute,
                    onTimeChange = { newHour, newMin ->
                        selectedHour = newHour
                        selectedMinute = newMin
                    },
                    onResetToNow = {
                        val current = Calendar.getInstance()
                        selectedHour = current.get(Calendar.HOUR_OF_DAY)
                        selectedMinute = current.get(Calendar.MINUTE)
                    }
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val w = weightInput.toDoubleOrNull()
                    if (w == null || w <= 0.0) {
                        errorMessage = "請輸入有效的體重數值"
                        return@Button
                    }
                    val formattedTime = String.format(Locale.getDefault(), "%02d:%02d", selectedHour, selectedMinute)
                    onConfirm(
                        w,
                        formattedTime,
                        dateInput.ifBlank { dateFormat.format(Date()) }
                    )
                }
            ) {
                Text("儲存")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )

    // Calendar DatePicker Dialog
    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = System.currentTimeMillis()
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                                timeInMillis = millis
                            }
                            val localCal = Calendar.getInstance().apply {
                                set(utcCal.get(Calendar.YEAR), utcCal.get(Calendar.MONTH), utcCal.get(Calendar.DAY_OF_MONTH), 12, 0, 0)
                            }
                            dateInput = dateFormat.format(localCal.time)
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("確定", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("取消")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

private fun NumberPicker.setCustomTextColor(color: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        textColor = color
    } else {
        try {
            val selectorWheelPaintField = NumberPicker::class.java.getDeclaredField("mSelectorWheelPaint")
            selectorWheelPaintField.isAccessible = true
            (selectorWheelPaintField.get(this) as? Paint)?.color = color

            val count = childCount
            for (i in 0 until count) {
                val child = getChildAt(i)
                if (child is EditText) {
                    child.setTextColor(color)
                }
            }
            invalidate()
        } catch (_: Exception) {}
    }
}

@Composable
fun ScrollableTimePicker(
    hour: Int,
    minute: Int,
    onTimeChange: (hour: Int, minute: Int) -> Unit,
    onResetToNow: () -> Unit
) {
    val primaryColor = MaterialTheme.colorScheme.primary.toArgb()

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.AccessTime,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "記錄時間（上下滾動調整）",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        text = String.format(Locale.getDefault(), "%02d:%02d", hour, minute),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Hour Picker
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "時",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    AndroidView(
                        modifier = Modifier.width(64.dp),
                        factory = { context ->
                            NumberPicker(context).apply {
                                minValue = 0
                                maxValue = 23
                                value = hour
                                setFormatter { String.format(Locale.getDefault(), "%02d", it) }
                                wrapSelectorWheel = true
                                descendantFocusability = NumberPicker.FOCUS_BLOCK_DESCENDANTS
                                setCustomTextColor(primaryColor)
                                setOnValueChangedListener { _, _, newVal ->
                                    onTimeChange(newVal, minute)
                                }
                            }
                        },
                        update = { picker ->
                            if (picker.value != hour) {
                                picker.value = hour
                            }
                            picker.setCustomTextColor(primaryColor)
                        }
                    )
                }

                Text(
                    text = ":",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 14.dp).padding(top = 16.dp)
                )

                // Minute Picker
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "分",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    AndroidView(
                        modifier = Modifier.width(64.dp),
                        factory = { context ->
                            NumberPicker(context).apply {
                                minValue = 0
                                maxValue = 59
                                value = minute
                                setFormatter { String.format(Locale.getDefault(), "%02d", it) }
                                wrapSelectorWheel = true
                                descendantFocusability = NumberPicker.FOCUS_BLOCK_DESCENDANTS
                                setCustomTextColor(primaryColor)
                                setOnValueChangedListener { _, _, newVal ->
                                    onTimeChange(hour, newVal)
                                }
                            }
                        },
                        update = { picker ->
                            if (picker.value != minute) {
                                picker.value = minute
                            }
                            picker.setCustomTextColor(primaryColor)
                        }
                    )
                }
            }

            TextButton(
                onClick = onResetToNow,
                modifier = Modifier.height(32.dp)
            ) {
                Text(
                    text = "設為現在時間",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun EditTargetWeightDialog(
    currentTarget: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var targetInput by remember { mutableStateOf(currentTarget.toString()) }
    var errorText by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("設定目標體重", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = targetInput,
                    onValueChange = { targetInput = it },
                    label = { Text("目標體重 (kg)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )
                if (errorText != null) {
                    Text(
                        text = errorText!!,
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
                    val t = targetInput.toDoubleOrNull()
                    if (t == null || t !in 20.0..300.0) {
                        errorText = "請輸入 20 ~ 300 之間的合理體重"
                    } else {
                        onConfirm(t)
                    }
                }
            ) {
                Text("確定")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}
