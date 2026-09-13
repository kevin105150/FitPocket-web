package com.example.ui.timer

import java.util.Locale

enum class TimerMode(val title: String) {
    COUNTDOWN("倒數計時"),
    STOPWATCH("碼表計時")
}

data class StopwatchLap(
    val lapIndex: Int,
    val lapTimeMillis: Long,
    val splitTimeMillis: Long
)

data class WorkoutTimerState(
    val mode: TimerMode = TimerMode.COUNTDOWN,
    val countdownTotalSeconds: Int = 60,
    val countdownRemainingSeconds: Int = 60,
    val isCountdownRunning: Boolean = false,
    val isCountdownPaused: Boolean = false,
    val isCountdownFinished: Boolean = false,
    // When time is up, count up overdue seconds (like native Clock app)
    val overdueSeconds: Int = 0,
    val stopwatchElapsedMillis: Long = 0L,
    val isStopwatchRunning: Boolean = false,
    val stopwatchLaps: List<StopwatchLap> = emptyList(),
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val isDialogVisible: Boolean = false
) {
    val isAnyTimerActive: Boolean
        get() = isCountdownRunning || isCountdownPaused || isStopwatchRunning || isCountdownFinished

    // Keypad input seconds when in editing mode
    val isSettingTime: Boolean
        get() = !isCountdownRunning && !isCountdownPaused && !isCountdownFinished

    val progress: Float
        get() = if (countdownTotalSeconds > 0) {
            (countdownRemainingSeconds.toFloat() / countdownTotalSeconds.toFloat()).coerceIn(0f, 1f)
        } else 0f
}

object WorkoutTimerFormatter {
    fun formatSecondsToDisplay(totalSeconds: Int): String {
        val safeSeconds = totalSeconds.coerceAtLeast(0)
        val hours = safeSeconds / 3600
        val minutes = (safeSeconds % 3600) / 60
        val seconds = safeSeconds % 60
        return if (hours > 0) {
            String.format(Locale.getDefault(), "%02d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
        }
    }

    fun formatSecondsToMinSec(totalSeconds: Int): String {
        val safeSeconds = totalSeconds.coerceAtLeast(0)
        val minutes = safeSeconds / 60
        val seconds = safeSeconds % 60
        return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
    }

    fun formatMillisToStopwatch(millis: Long): String {
        val safeMillis = millis.coerceAtLeast(0L)
        val minutes = safeMillis / (1000 * 60)
        val seconds = (safeMillis / 1000) % 60
        val hundredths = (safeMillis % 1000) / 10
        return String.format(Locale.getDefault(), "%02d:%02d.%02d", minutes, seconds, hundredths)
    }

    fun formatMillisToMinSecTenths(millis: Long): String {
        val safeMillis = millis.coerceAtLeast(0L)
        val minutes = safeMillis / (1000 * 60)
        val seconds = (safeMillis / 1000) % 60
        val tenths = (safeMillis % 1000) / 100
        return String.format(Locale.getDefault(), "%02d:%02d.%d", minutes, seconds, tenths)
    }
}
