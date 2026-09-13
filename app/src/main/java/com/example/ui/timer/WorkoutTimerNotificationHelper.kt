package com.example.ui.timer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.MainActivity

object WorkoutTimerNotificationHelper {
    const val CHANNEL_ID = "workout_timer_channel"
    private const val NOTIFICATION_ID = 1001

    private var activeVibrator: Vibrator? = null
    private var vibrationStopHandler: Handler? = null
    private var vibrationStopRunnable: Runnable? = null

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "訓練組間計時器"
            val descriptionText = "訓練組間休息倒數與碼表計時完成通知"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
                // Default notification vibrate pattern
                vibrationPattern = longArrayOf(0, 500, 300, 500)
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()
                setSound(soundUri, audioAttributes)
            }
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun sendTimerFinishedNotification(
        context: Context,
        totalSeconds: Int,
        title: String = "⏰ 訓練組間休息時間到！",
        message: String = "休息結束（${WorkoutTimerFormatter.formatSecondsToDisplay(totalSeconds)}），準備開始下一組訓練！💪"
    ) {
        try {
            createNotificationChannel(context)

            // 1. Main Intent when clicking notification body (Open App)
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openAppPendingIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // 2. Action: Stop / Dismiss Notification and Stop Vibration
            val stopIntent = Intent(context, WorkoutTimerReceiver::class.java).apply {
                action = WorkoutTimerReceiver.ACTION_STOP_TIMER
            }
            val stopPendingIntent = PendingIntent.getBroadcast(
                context,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // 3. Action: Repeat / Start Next Set Timer
            val repeatIntent = Intent(context, WorkoutTimerReceiver::class.java).apply {
                action = WorkoutTimerReceiver.ACTION_REPEAT_TIMER
                putExtra(WorkoutTimerReceiver.EXTRA_TOTAL_SECONDS, totalSeconds)
            }
            val repeatPendingIntent = PendingIntent.getBroadcast(
                context,
                2,
                repeatIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                .setContentIntent(openAppPendingIntent)
                .setDeleteIntent(stopPendingIntent) // User swiped away notification -> stop vibration
                // Action Buttons on Notification
                .addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "停止",
                    stopPendingIntent
                )
                .addAction(
                    android.R.drawable.ic_media_play,
                    "再計時一組",
                    repeatPendingIntent
                )

            with(NotificationManagerCompat.from(context)) {
                notify(NOTIFICATION_ID, builder.build())
            }
        } catch (e: SecurityException) {
            // Android 13+ POST_NOTIFICATIONS permission might not be granted
        } catch (e: Exception) {
            // Safe fallback
        }
    }

    fun cancelTimerFinishedNotification(context: Context) {
        try {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            // Ignore
        }
    }

    /**
     * Triggers continuous vibration for up to 30 seconds (or until user stops/cancels)
     */
    fun triggerContinuousVibration(context: Context, maxDurationMillis: Long = 30000L) {
        try {
            stopVibration(context)

            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager =
                    context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            activeVibrator = vibrator

            if (vibrator != null && vibrator.hasVibrator()) {
                // Waveform: vibrate 500ms, pause 400ms, vibrate 500ms, pause 400ms... repeat at index 0
                val pattern = longArrayOf(0, 500, 400, 500, 400, 700, 400)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(pattern, 0)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern, 0)
                }

                // Automatically cancel vibration after maxDurationMillis (30 seconds)
                val handler = Handler(Looper.getMainLooper())
                vibrationStopHandler = handler
                val runnable = Runnable {
                    stopVibration(context)
                }
                vibrationStopRunnable = runnable
                handler.postDelayed(runnable, maxDurationMillis)
            }
        } catch (e: Exception) {
            // Ignore vibration error
        }
    }

    /**
     * Stop active continuous vibration immediately
     */
    fun stopVibration(context: Context? = null) {
        try {
            vibrationStopRunnable?.let { vibrationStopHandler?.removeCallbacks(it) }
            vibrationStopHandler = null
            vibrationStopRunnable = null
            activeVibrator?.cancel()
            activeVibrator = null

            // Extra safety: cancel from system service if context is available
            context?.let { ctx ->
                try {
                    val sysVib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val vm = ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                        vm?.defaultVibrator
                    } else {
                        @Suppress("DEPRECATION")
                        ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    }
                    sysVib?.cancel()
                } catch (ex: Exception) {
                    // Ignore
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
    }

    fun playSoundAlert(context: Context) {
        try {
            val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(context, notificationUri)
            ringtone?.play()
        } catch (e: Exception) {
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                toneGen.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 400)
            } catch (ex: Exception) {
                // Ignore tone error
            }
        }
    }

    fun playCountdownBeep() {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 100)
        } catch (e: Exception) {
            // Ignore
        }
    }
}
