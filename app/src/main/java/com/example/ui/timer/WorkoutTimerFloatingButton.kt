package com.example.ui.timer

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HourglassBottom
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun WorkoutTimerFloatingButton(
    timerState: WorkoutTimerState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isRunning = timerState.isCountdownRunning || timerState.isStopwatchRunning
    val isPaused = timerState.isCountdownPaused
    val isFinished = timerState.isCountdownFinished

    // Pulse animation when time is up
    val infiniteTransition = rememberInfiniteTransition(label = "fab_pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.12f,
        animationSpec = infiniteRepeatable(
            animation = tween(350),
            repeatMode = RepeatMode.Reverse
        ),
        label = "fab_pulse_scale"
    )

    val containerColor by animateColorAsState(
        targetValue = when {
            isFinished -> MaterialTheme.colorScheme.errorContainer
            isRunning -> MaterialTheme.colorScheme.primaryContainer
            isPaused -> MaterialTheme.colorScheme.tertiaryContainer
            else -> MaterialTheme.colorScheme.primary
        },
        label = "fab_container_color"
    )

    val contentColor by animateColorAsState(
        targetValue = when {
            isFinished -> MaterialTheme.colorScheme.onErrorContainer
            isRunning -> MaterialTheme.colorScheme.onPrimaryContainer
            isPaused -> MaterialTheme.colorScheme.onTertiaryContainer
            else -> MaterialTheme.colorScheme.onPrimary
        },
        label = "fab_content_color"
    )

    Surface(
        onClick = onClick,
        modifier = modifier
            .scale(if (isFinished) pulseScale else 1.0f)
            .height(56.dp)
            .testTag("workout_timer_fab"),
        shape = RoundedCornerShape(28.dp),
        color = containerColor,
        contentColor = contentColor,
        shadowElevation = 6.dp,
        border = if (isRunning || isPaused || isFinished) {
            BorderStroke(
                2.dp,
                if (isFinished) MaterialTheme.colorScheme.error else if (isPaused) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary
            )
        } else null
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = when {
                    isFinished -> Icons.Default.NotificationsActive
                    timerState.mode == TimerMode.COUNTDOWN && isRunning -> Icons.Default.HourglassBottom
                    timerState.mode == TimerMode.COUNTDOWN -> Icons.Default.HourglassTop
                    else -> Icons.Default.Timer
                },
                contentDescription = "碼表與計時器",
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(8.dp))

            when {
                isFinished -> {
                    Text(
                        text = if (timerState.overdueSeconds > 0) "+${WorkoutTimerFormatter.formatSecondsToDisplay(timerState.overdueSeconds)}" else "時間到！",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                timerState.isCountdownRunning -> {
                    Text(
                        text = WorkoutTimerFormatter.formatSecondsToDisplay(timerState.countdownRemainingSeconds),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        ),
                        fontWeight = FontWeight.Bold
                    )
                }
                timerState.isCountdownPaused -> {
                    Text(
                        text = "⏸ ${WorkoutTimerFormatter.formatSecondsToDisplay(timerState.countdownRemainingSeconds)}",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        ),
                        fontWeight = FontWeight.Bold
                    )
                }
                timerState.isStopwatchRunning -> {
                    Text(
                        text = WorkoutTimerFormatter.formatMillisToMinSecTenths(timerState.stopwatchElapsedMillis),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        ),
                        fontWeight = FontWeight.Bold
                    )
                }
                else -> {
                    Text(
                        text = "碼表計時",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
