package com.example.ui.timer

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.example.ui.DietViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutTimerDialog(
    viewModel: DietViewModel,
    timerState: WorkoutTimerState,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    // Android 13+ Notification Permission Launcher
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Permission result handled
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val isGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!isGranted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .wrapContentHeight()
                .padding(vertical = 16.dp)
                .testTag("workout_timer_dialog"),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header Bar: Title + Sound/Vibration Controls + Close Button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primaryContainer,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = if (timerState.mode == TimerMode.COUNTDOWN) Icons.Default.HourglassTop else Icons.Default.Timer,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Text(
                            text = "訓練計時與碼表",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Sound Toggle
                        IconButton(
                            onClick = { viewModel.toggleTimerSound() },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = if (timerState.soundEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                                contentDescription = "提示音切換",
                                tint = if (timerState.soundEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        // Vibration Toggle
                        IconButton(
                            onClick = { viewModel.toggleTimerVibration() },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = if (timerState.vibrationEnabled) Icons.Default.Vibration else Icons.Outlined.Smartphone,
                                contentDescription = "震動切換",
                                tint = if (timerState.vibrationEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        // Close / Minimize Dialog
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "縮小 / 關閉",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Mode Selector Segmented Switch (倒數計時 vs 碼表)
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Tab 1: 倒數計時
                        val isCountdownSelected = timerState.mode == TimerMode.COUNTDOWN
                        val countdownBgColor by animateColorAsState(
                            targetValue = if (isCountdownSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                            animationSpec = tween(250),
                            label = "countdown_bg"
                        )
                        val countdownContentColor by animateColorAsState(
                            targetValue = if (isCountdownSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                            animationSpec = tween(250),
                            label = "countdown_content"
                        )

                        Surface(
                            onClick = { viewModel.switchTimerMode(TimerMode.COUNTDOWN) },
                            shape = RoundedCornerShape(16.dp),
                            color = countdownBgColor,
                            shadowElevation = if (isCountdownSelected) 3.dp else 0.dp,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .testTag("tab_countdown_mode")
                        ) {
                            Row(
                                modifier = Modifier.fillMaxSize(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = if (isCountdownSelected) Icons.Default.HourglassBottom else Icons.Outlined.HourglassTop,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp),
                                    tint = countdownContentColor
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "組間倒數",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (isCountdownSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = countdownContentColor
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        // Tab 2: 碼表計時
                        val isStopwatchSelected = timerState.mode == TimerMode.STOPWATCH
                        val stopwatchBgColor by animateColorAsState(
                            targetValue = if (isStopwatchSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                            animationSpec = tween(250),
                            label = "stopwatch_bg"
                        )
                        val stopwatchContentColor by animateColorAsState(
                            targetValue = if (isStopwatchSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                            animationSpec = tween(250),
                            label = "stopwatch_content"
                        )

                        Surface(
                            onClick = { viewModel.switchTimerMode(TimerMode.STOPWATCH) },
                            shape = RoundedCornerShape(16.dp),
                            color = stopwatchBgColor,
                            shadowElevation = if (isStopwatchSelected) 3.dp else 0.dp,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .testTag("tab_stopwatch_mode")
                        ) {
                            Row(
                                modifier = Modifier.fillMaxSize(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = if (isStopwatchSelected) Icons.Default.Timer else Icons.Outlined.Timer,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp),
                                    tint = stopwatchContentColor
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "運動碼表",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (isStopwatchSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = stopwatchContentColor
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Content View according to mode
                if (timerState.mode == TimerMode.COUNTDOWN) {
                    CountdownTimerContent(
                        viewModel = viewModel,
                        timerState = timerState
                    )
                } else {
                    StopwatchContent(
                        viewModel = viewModel,
                        timerState = timerState
                    )
                }
            }
        }
    }
}

@Composable
private fun CountdownTimerContent(
    viewModel: DietViewModel,
    timerState: WorkoutTimerState
) {
    val context = LocalContext.current
    val isRunning = timerState.isCountdownRunning
    val isPaused = timerState.isCountdownPaused
    val isFinished = timerState.isCountdownFinished
    val remainingSec = timerState.countdownRemainingSeconds
    val totalSec = timerState.countdownTotalSeconds
    val overdueSec = timerState.overdueSeconds
    val progress = timerState.progress

    // Time finished pulsing animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(400),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    // Keypad state for entering custom hours / minutes / seconds
    var digitInput by remember { mutableStateOf("") }
    var isKeypadMode by remember { mutableStateOf(false) }

    // When timer starts or changes outside keypad, reset local keypad digits
    LaunchedEffect(isRunning, isPaused, isFinished) {
        if (isRunning || isPaused || isFinished) {
            isKeypadMode = false
            digitInput = ""
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Time's up banner
        AnimatedVisibility(
            visible = isFinished,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.errorContainer,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(text = "⏰", fontSize = 22.sp)
                        Column {
                            Text(
                                text = "組間休息時間到！",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Text(
                                text = if (overdueSec > 0) "已超時 +${WorkoutTimerFormatter.formatSecondsToDisplay(overdueSec)}" else "準備好開始下一組訓練！💪",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = if (overdueSec > 0) FontWeight.Bold else FontWeight.Normal,
                                color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.9f)
                            )
                        }
                    }
                    IconButton(
                        onClick = { viewModel.dismissCountdownAlert() },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "確認關閉",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }

        // Mode A: Standard Timer Ring Display (Running, Paused, or Setup)
        if (!isKeypadMode) {
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .scale(if (isFinished) pulseScale else 1.0f)
                    .clip(CircleShape)
                    .clickable {
                        // If timer finished, clicking the circle immediately resets/dismisses the alert
                        if (isFinished) {
                            viewModel.dismissCountdownAlert()
                        } else if (!isRunning && !isPaused) {
                            // Clicking the circle in idle allows entering keypad input like system clock
                            isKeypadMode = true
                            digitInput = ""
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                // Background track
                CircularProgressIndicator(
                    progress = { 1f },
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    strokeWidth = 10.dp,
                    strokeCap = StrokeCap.Round
                )

                // Dynamic progress fill
                val activeColor by animateColorAsState(
                    targetValue = when {
                        isFinished -> MaterialTheme.colorScheme.error
                        remainingSec <= 10 && isRunning -> MaterialTheme.colorScheme.error
                        remainingSec <= 30 && isRunning -> MaterialTheme.colorScheme.tertiary
                        isPaused -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.primary
                    },
                    label = "ring_color"
                )

                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxSize(),
                    color = activeColor,
                    strokeWidth = 10.dp,
                    strokeCap = StrokeCap.Round
                )

                // Inner Time Display
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.clickable {
                        if (isFinished) {
                            viewModel.dismissCountdownAlert()
                        } else if (!isRunning && !isPaused) {
                            isKeypadMode = true
                            digitInput = ""
                        }
                    }
                ) {
                    Text(
                        text = if (isFinished && overdueSec > 0) {
                            "+${WorkoutTimerFormatter.formatSecondsToDisplay(overdueSec)}"
                        } else {
                            WorkoutTimerFormatter.formatSecondsToDisplay(remainingSec)
                        },
                        style = MaterialTheme.typography.displayMedium.copy(
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        ),
                        fontWeight = FontWeight.ExtraBold,
                        color = when {
                            isFinished -> MaterialTheme.colorScheme.error
                            isPaused -> MaterialTheme.colorScheme.tertiary
                            else -> MaterialTheme.colorScheme.onSurface
                        }
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = when {
                            isFinished -> "時間已結束（點擊重設）"
                            isRunning -> "組間休息倒數中"
                            isPaused -> "⏸ 計時已暫停"
                            else -> "點擊數字可自訂時間"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isPaused) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Quick Adjustment Pill Buttons (+15s, +30s, +60s, -15s)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
            ) {
                listOf(-15, 15, 30, 60).forEach { delta ->
                    val label = if (delta > 0) "+${delta}s" else "${delta}s"
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { viewModel.adjustCountdownDuration(delta) }
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }

                // Switch to Number Pad Button
                if (!isRunning && !isPaused && !isFinished) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.8f),
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable {
                                isKeypadMode = true
                                digitInput = ""
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Dialpad,
                                contentDescription = "自訂鍵盤",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "自訂",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Preset Duration Chips (30s, 45s, 60s, 90s, 120s, 180s, 300s)
            Text(
                text = "組間休息快速設定",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )

            Spacer(modifier = Modifier.height(6.dp))

            val presetDurations = listOf(
                30 to "30秒",
                45 to "45秒",
                60 to "1分鐘",
                90 to "90秒",
                120 to "2分鐘",
                180 to "3分鐘",
                300 to "5分鐘"
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                presetDurations.forEach { (sec, label) ->
                    val isSelected = totalSec == sec && !isKeypadMode
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            viewModel.setCountdownTotalSeconds(sec)
                        },
                        label = {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }
        } else {
            // Mode B: System Clock Style Numeric Keypad Input View
            val paddedDigits = digitInput.padStart(6, '0')
            val h = paddedDigits.substring(0, 2)
            val m = paddedDigits.substring(2, 4)
            val s = paddedDigits.substring(4, 6)

            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header with back to circular dial
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "輸入自訂倒數時間",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        IconButton(
                            onClick = { isKeypadMode = false },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "關閉鍵盤",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    // Large Digital Time Readout: 00h 00m 00s
                    Row(
                        modifier = Modifier.padding(vertical = 10.dp),
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = h,
                            style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Monospace),
                            fontWeight = FontWeight.Bold,
                            color = if (h != "00") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        )
                        Text(
                            text = "h ",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = m,
                            style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Monospace),
                            fontWeight = FontWeight.Bold,
                            color = if (m != "00" || h != "00") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        )
                        Text(
                            text = "m ",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = s,
                            style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Monospace),
                            fontWeight = FontWeight.Bold,
                            color = if (digitInput.isNotEmpty()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        )
                        Text(
                            text = "s",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // 3x4 Numeric Keypad
                    val keys = listOf(
                        listOf("1", "2", "3"),
                        listOf("4", "5", "6"),
                        listOf("7", "8", "9"),
                        listOf("00", "0", "DEL")
                    )

                    Column(
                        modifier = Modifier.fillMaxWidth(0.85f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        keys.forEach { rowKeys ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowKeys.forEach { key ->
                                    Surface(
                                        onClick = {
                                            when (key) {
                                                "DEL" -> {
                                                    if (digitInput.isNotEmpty()) {
                                                        digitInput = digitInput.dropLast(1)
                                                    }
                                                }
                                                "00" -> {
                                                    if (digitInput.isNotEmpty() && digitInput.length <= 4) {
                                                        digitInput += "00"
                                                    }
                                                }
                                                else -> {
                                                    if (digitInput.length < 6) {
                                                        if (!(digitInput.isEmpty() && key == "0")) {
                                                            digitInput += key
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        shape = RoundedCornerShape(14.dp),
                                        color = if (key == "DEL") MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface,
                                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)),
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(46.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier.fillMaxSize(),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (key == "DEL") {
                                                Icon(
                                                    imageVector = Icons.Default.Backspace,
                                                    contentDescription = "刪除",
                                                    modifier = Modifier.size(20.dp),
                                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            } else {
                                                Text(
                                                    text = key,
                                                    style = MaterialTheme.typography.titleMedium,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Main Action Controls (Start / Pause / Resume / Reset / Cancel)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isKeypadMode) {
                // Keypad Cancel Button
                OutlinedButton(
                    onClick = {
                        isKeypadMode = false
                        digitInput = ""
                    },
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                ) {
                    Text("取消", fontWeight = FontWeight.Bold)
                }

                // Keypad Start Button
                val paddedDigits = digitInput.padStart(6, '0')
                val hours = paddedDigits.substring(0, 2).toIntOrNull() ?: 0
                val mins = paddedDigits.substring(2, 4).toIntOrNull() ?: 0
                val secs = paddedDigits.substring(4, 6).toIntOrNull() ?: 0
                val totalKeypadSeconds = (hours * 3600) + (mins * 60) + secs

                Button(
                    onClick = {
                        if (totalKeypadSeconds > 0) {
                            viewModel.setCountdownTotalSeconds(totalKeypadSeconds)
                            viewModel.startCountdown(context, totalKeypadSeconds)
                            isKeypadMode = false
                        }
                    },
                    enabled = totalKeypadSeconds > 0,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .weight(1.3f)
                        .height(52.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "開始倒數",
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "開始倒數",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            } else {
                // Reset Button
                OutlinedButton(
                    onClick = {
                        if (isFinished) {
                            viewModel.dismissCountdownAlert()
                        } else {
                            viewModel.resetCountdown()
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                ) {
                    Icon(
                        imageVector = if (isFinished) Icons.Default.Stop else Icons.Default.Refresh,
                        contentDescription = if (isFinished) "停止超時" else "重設",
                        modifier = Modifier.size(20.dp),
                        tint = if (isFinished) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isFinished) "停止超時" else "重設",
                        fontWeight = FontWeight.Bold,
                        color = if (isFinished) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                    )
                }

                // Primary Start / Pause / Resume / Next-Set Action Button
                Button(
                    onClick = {
                        when {
                            isRunning -> viewModel.pauseCountdown()
                            isPaused -> viewModel.resumeCountdown(context)
                            isFinished -> viewModel.startCountdown(context)
                            else -> viewModel.startCountdown(context)
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = when {
                            isRunning -> MaterialTheme.colorScheme.secondary
                            isPaused -> MaterialTheme.colorScheme.primary
                            isFinished -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.primary
                        }
                    ),
                    modifier = Modifier
                        .weight(1.4f)
                        .height(52.dp)
                        .testTag("workout_timer_start_pause_button")
                ) {
                    Icon(
                        imageVector = when {
                            isRunning -> Icons.Default.Pause
                            isPaused -> Icons.Default.PlayArrow
                            isFinished -> Icons.Default.Replay
                            else -> Icons.Default.PlayArrow
                        },
                        contentDescription = when {
                            isRunning -> "暫停"
                            isPaused -> "繼續"
                            isFinished -> "再計時一組"
                            else -> "開始計時"
                        },
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = when {
                            isRunning -> "暫停計時"
                            isPaused -> "繼續計時"
                            isFinished -> "再計時一組"
                            else -> "開始計時"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun StopwatchContent(
    viewModel: DietViewModel,
    timerState: WorkoutTimerState
) {
    val isRunning = timerState.isStopwatchRunning
    val elapsedMillis = timerState.stopwatchElapsedMillis
    val laps = timerState.stopwatchLaps

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Large Crisp Stopwatch Display
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = WorkoutTimerFormatter.formatMillisToStopwatch(elapsedMillis),
                    style = MaterialTheme.typography.displayMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.5.sp
                    ),
                    fontWeight = FontWeight.ExtraBold,
                    color = if (isRunning) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (isRunning) "⏱️ 碼表計時進行中" else if (elapsedMillis > 0L) "⏸ 碼表已暫停" else "準備就緒",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Action Buttons: Lap / Reset & Start / Pause
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Lap / Reset Button
            OutlinedButton(
                onClick = {
                    if (isRunning) {
                        viewModel.recordStopwatchLap()
                    } else {
                        viewModel.resetStopwatch()
                    }
                },
                enabled = elapsedMillis > 0L || isRunning,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp)
            ) {
                Icon(
                    imageVector = if (isRunning) Icons.Default.Flag else Icons.Default.Refresh,
                    contentDescription = if (isRunning) "計圈" else "重設",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (isRunning) "計圈 (Lap)" else "重設",
                    fontWeight = FontWeight.Bold
                )
            }

            // Start / Pause Button
            Button(
                onClick = {
                    if (isRunning) {
                        viewModel.pauseStopwatch()
                    } else {
                        viewModel.startStopwatch()
                    }
                },
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isRunning) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
                ),
                modifier = Modifier
                    .weight(1.3f)
                    .height(50.dp)
                    .testTag("stopwatch_start_pause_button")
            ) {
                Icon(
                    imageVector = if (isRunning) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (isRunning) "暫停" else "開始",
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (isRunning) "暫停" else if (elapsedMillis > 0L) "繼續" else "開始碼表",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }
        }

        // Lap Times Table (if any)
        if (laps.isNotEmpty()) {
            Spacer(modifier = Modifier.height(14.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("圈數", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("單圈時間", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("累計時間", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(modifier = Modifier.height(4.dp))

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 140.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(laps, key = { it.lapIndex }) { lap ->
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Lap ${lap.lapIndex}",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "+${WorkoutTimerFormatter.formatMillisToStopwatch(lap.lapTimeMillis)}",
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = WorkoutTimerFormatter.formatMillisToStopwatch(lap.splitTimeMillis),
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
