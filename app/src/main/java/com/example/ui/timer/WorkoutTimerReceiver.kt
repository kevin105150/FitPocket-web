package com.example.ui.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WorkoutTimerReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_STOP_TIMER = "com.example.workouttimer.ACTION_STOP_TIMER"
        const val ACTION_REPEAT_TIMER = "com.example.workouttimer.ACTION_REPEAT_TIMER"
        const val EXTRA_TOTAL_SECONDS = "extra_total_seconds"

        // Callback listener to notify active ViewModel or Service
        var onStopTimerListener: (() -> Unit)? = null
        var onRepeatTimerListener: ((Context, Int) -> Unit)? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_STOP_TIMER -> {
                // Cancel notification and stop continuous vibration/sound
                WorkoutTimerNotificationHelper.cancelTimerFinishedNotification(context)
                WorkoutTimerNotificationHelper.stopVibration(context)
                onStopTimerListener?.invoke()
            }
            ACTION_REPEAT_TIMER -> {
                val totalSeconds = intent.getIntExtra(EXTRA_TOTAL_SECONDS, 60)
                WorkoutTimerNotificationHelper.cancelTimerFinishedNotification(context)
                WorkoutTimerNotificationHelper.stopVibration(context)
                onRepeatTimerListener?.invoke(context, totalSeconds)
            }
        }
    }
}
