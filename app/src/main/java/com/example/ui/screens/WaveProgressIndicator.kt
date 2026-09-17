package com.example.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.unit.dp
import kotlin.math.sin

@Composable
fun WaveProgressIndicator(
    progress: Float,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "wave_transition")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 2f * Math.PI.toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave_phase"
    )
    
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "progress"
    )

    val waveColor = MaterialTheme.colorScheme.primary
    val trackColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)

    Box(modifier = modifier.size(200.dp)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val radius = width / 2f
            
            // Draw background circle
            drawCircle(
                color = trackColor,
                radius = radius
            )

            val circlePath = Path().apply {
                addOval(Rect(0f, 0f, width, height))
            }

            clipPath(circlePath) {
                val wavePath = Path()
                
                // Calculate wave properties
                val waveHeight = 12.dp.toPx()
                val waveLength = width
                
                val yOffset = height * (1f - animatedProgress)
                
                wavePath.moveTo(0f, height)
                wavePath.lineTo(0f, yOffset)
                
                for (x in 0..width.toInt() step 5) {
                    val relativeX = x.toFloat() / waveLength
                    val y = yOffset + sin(relativeX * 2 * Math.PI.toFloat() + phase) * waveHeight
                    wavePath.lineTo(x.toFloat(), y.toFloat())
                }
                
                wavePath.lineTo(width, height)
                wavePath.close()

                drawPath(
                    path = wavePath,
                    color = waveColor.copy(alpha = 0.8f)
                )
                
                // Second wave behind
                val wavePath2 = Path()
                val phase2 = phase + Math.PI.toFloat()
                
                wavePath2.moveTo(0f, height)
                wavePath2.lineTo(0f, yOffset)
                
                for (x in 0..width.toInt() step 5) {
                    val relativeX = x.toFloat() / waveLength
                    val y = yOffset + sin(relativeX * 2 * Math.PI.toFloat() + phase2) * waveHeight * 0.8f
                    wavePath2.lineTo(x.toFloat(), y.toFloat())
                }
                
                wavePath2.lineTo(width, height)
                wavePath2.close()

                drawPath(
                    path = wavePath2,
                    color = waveColor.copy(alpha = 0.4f)
                )
            }
            
            // Draw border
            drawCircle(
                color = waveColor,
                radius = radius,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4.dp.toPx())
            )
        }
    }
}
