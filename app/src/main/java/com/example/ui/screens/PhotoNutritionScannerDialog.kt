package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.Camera
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.FlipCameraAndroid
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.data.network.AiEstimatedNutrition
import java.util.concurrent.Executors

private fun uriToBitmap(context: android.content.Context, uri: Uri): Bitmap? {
    return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
                decoder.isMutableRequired = true
            }
        } else {
            @Suppress("DEPRECATION")
            MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
        }
    } catch (e: Exception) {
        null
    }
}

private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
    return try {
        val bitmap = imageProxy.toBitmap()
        val rotationDegrees = imageProxy.imageInfo.rotationDegrees
        if (rotationDegrees != 0 && bitmap != null) {
            val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }
    } catch (e: Exception) {
        null
    } finally {
        imageProxy.close()
    }
}

/**
 * 拍照辨識營養素相機視窗 (PhotoNutritionScannerDialog)
 * 類似掃碼介面，擁有超大取景拍照框，專門精準擷取「外包裝營養標示表」與「食物餐點」。
 */
@Composable
fun PhotoNutritionScannerDialog(
    isAnalyzing: Boolean,
    errorMessage: String? = null,
    onCapturePhoto: (Bitmap) -> Unit,
    onSwitchToBarcode: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Camera permission check
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    // Photo album picker
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            val bitmap = uriToBitmap(context, uri)
            if (bitmap != null) {
                onCapturePhoto(bitmap)
            }
        }
    }

    // Camera controls state
    var isFrontCamera by remember { mutableStateOf(false) }
    var isTorchOn by remember { mutableStateOf(false) }
    var cameraControlRef by remember { mutableStateOf<CameraControl?>(null) }
    var imageCaptureRef by remember { mutableStateOf<ImageCapture?>(null) }

    // Laser scan animation
    val infiniteTransition = rememberInfiniteTransition(label = "nutrition_laser")
    val laserYFraction by infiniteTransition.animateFloat(
        initialValue = 0.05f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laserY"
    )

    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }

    DisposableEffect(lifecycleOwner) {
        onDispose {
            try {
                cameraProviderFuture.get().unbindAll()
            } catch (e: Exception) {
                // Ignore unbind error
            }
        }
    }

    Dialog(
        onDismissRequest = { if (!isAnalyzing) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            tonalElevation = 10.dp,
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .padding(vertical = 12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top Header Row
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
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "拍照辨識營養素",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "支援辨識外包裝營養標示與餐點",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Switch to barcode button
                        FilledTonalButton(
                            onClick = {
                                onDismiss()
                                onSwitchToBarcode()
                            },
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp).testTag("switch_to_barcode_btn")
                        ) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("條碼掃描", style = MaterialTheme.typography.labelSmall)
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        IconButton(
                            onClick = onDismiss,
                            enabled = !isAnalyzing,
                            modifier = Modifier.testTag("close_photo_scanner_dialog")
                        ) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "關閉")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Permission Status Banner if not granted
                if (!hasCameraPermission) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFEF3C7),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.WarningAmber,
                                    contentDescription = null,
                                    tint = Color(0xFF92400E),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "相機權限尚未開啟",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF92400E)
                                )
                            }

                            FilledTonalButton(
                                onClick = {
                                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                },
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.height(28.dp)
                            ) {
                                Text("請求權限", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }

                // Camera Viewport Card with LARGE Viewfinder Frame (大取景框)
                Card(
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(310.dp)
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        if (hasCameraPermission) {
                            // Live CameraX Preview
                            AndroidView(
                                factory = { ctx ->
                                    val previewView = PreviewView(ctx).apply {
                                        scaleType = PreviewView.ScaleType.FILL_CENTER
                                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                                    }

                                    val executor = ContextCompat.getMainExecutor(ctx)
                                    cameraProviderFuture.addListener({
                                        try {
                                            val cameraProvider = cameraProviderFuture.get()

                                            val preview = Preview.Builder().build().also {
                                                it.setSurfaceProvider(previewView.surfaceProvider)
                                            }

                                            val imageCapture = ImageCapture.Builder()
                                                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                                                .build()
                                            imageCaptureRef = imageCapture

                                            val cameraSelector = if (isFrontCamera) {
                                                CameraSelector.DEFAULT_FRONT_CAMERA
                                            } else {
                                                CameraSelector.DEFAULT_BACK_CAMERA
                                            }

                                            cameraProvider.unbindAll()
                                            val camera = cameraProvider.bindToLifecycle(
                                                lifecycleOwner,
                                                cameraSelector,
                                                preview,
                                                imageCapture
                                            )
                                            cameraControlRef = camera.cameraControl
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }, executor)

                                    previewView
                                },
                                update = { previewView ->
                                    // When switching front/back camera
                                    try {
                                        val cameraProvider = cameraProviderFuture.get()
                                        val preview = Preview.Builder().build().also {
                                            it.setSurfaceProvider(previewView.surfaceProvider)
                                        }
                                        val imageCapture = ImageCapture.Builder().build()
                                        imageCaptureRef = imageCapture
                                        val cameraSelector = if (isFrontCamera) {
                                            CameraSelector.DEFAULT_FRONT_CAMERA
                                        } else {
                                            CameraSelector.DEFAULT_BACK_CAMERA
                                        }
                                        cameraProvider.unbindAll()
                                        val camera = cameraProvider.bindToLifecycle(
                                            lifecycleOwner,
                                            cameraSelector,
                                            preview,
                                            imageCapture
                                        )
                                        cameraControlRef = camera.cameraControl
                                    } catch (e: Exception) {
                                        // Ignore
                                    }
                                },
                                modifier = Modifier.fillMaxSize()
                            )

                            // Top Overlay Bar: Flashlight & Camera Switch
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .align(Alignment.TopCenter)
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                // Torch toggle button
                                FilledTonalIconButton(
                                    onClick = {
                                        isTorchOn = !isTorchOn
                                        cameraControlRef?.enableTorch(isTorchOn)
                                    },
                                    colors = IconButtonDefaults.filledTonalIconButtonColors(
                                        containerColor = if (isTorchOn) Color(0xFFFBBF24) else Color.Black.copy(alpha = 0.5f),
                                        contentColor = if (isTorchOn) Color.Black else Color.White
                                    ),
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isTorchOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                                        contentDescription = "補光燈",
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                // Front / Back Switch
                                FilledTonalIconButton(
                                    onClick = { isFrontCamera = !isFrontCamera },
                                    colors = IconButtonDefaults.filledTonalIconButtonColors(
                                        containerColor = Color.Black.copy(alpha = 0.5f),
                                        contentColor = Color.White
                                    ),
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.FlipCameraAndroid,
                                        contentDescription = "翻轉鏡頭",
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }

                            // 📸 LARGE Viewfinder Frame Overlay (大取景框)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.9f)
                                    .height(230.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .border(
                                        width = 2.dp,
                                        brush = Brush.verticalGradient(
                                            colors = listOf(
                                                MaterialTheme.colorScheme.primary,
                                                MaterialTheme.colorScheme.tertiary
                                            )
                                        ),
                                        shape = RoundedCornerShape(16.dp)
                                    )
                                    .background(Color.Black.copy(alpha = 0.12f))
                            ) {
                                // Four Corner Brackets Aesthetic
                                CornerBracket(Alignment.TopStart)
                                CornerBracket(Alignment.TopEnd)
                                CornerBracket(Alignment.BottomStart)
                                CornerBracket(Alignment.BottomEnd)

                                // Animated Laser Scanning Beam
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(3.dp)
                                        .padding(top = (230 * laserYFraction).dp)
                                        .background(
                                            Brush.horizontalGradient(
                                                colors = listOf(
                                                    Color.Transparent,
                                                    Color(0xFF38BDF8),
                                                    Color(0xFF67E8F9),
                                                    Color(0xFF38BDF8),
                                                    Color.Transparent
                                                )
                                            )
                                        )
                                )

                                // Viewfinder Helper Subtitle at Bottom
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color.Black.copy(alpha = 0.65f),
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .padding(bottom = 10.dp)
                                ) {
                                    Text(
                                        text = "將「營養標示表」或「餐點食物」置於框內",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }

                            // Analyzing AI Progress Overlay
                            androidx.compose.animation.AnimatedVisibility(
                                visible = isAnalyzing,
                                enter = fadeIn(),
                                exit = fadeOut()
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color.Black.copy(alpha = 0.75f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.padding(20.dp)
                                    ) {
                                        CircularProgressIndicator(
                                            color = MaterialTheme.colorScheme.primary,
                                            strokeWidth = 3.5.dp,
                                            modifier = Modifier.size(36.dp)
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Text(
                                            text = "🤖 Gemini AI 正在解析照片中營養素...",
                                            style = MaterialTheme.typography.titleSmall,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "精準讀取：熱量、蛋白質、碳水、脂肪、糖、鈉、鉀",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color.White.copy(alpha = 0.8f),
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                        } else {
                            // Permission Denied Viewport
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.padding(16.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CameraAlt,
                                    contentDescription = null,
                                    tint = Color(0xFFFBBF24),
                                    modifier = Modifier.size(42.dp)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "請開啟相機權限以啟用大取景框拍照辨識",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.9f),
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = {
                                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
                                        modifier = Modifier.height(36.dp)
                                    ) {
                                        Text("開啟相機權限", style = MaterialTheme.typography.labelMedium)
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                                data = Uri.fromParts("package", context.packageName, null)
                                            }
                                            context.startActivity(intent)
                                        },
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.5f)),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(36.dp)
                                    ) {
                                        Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(14.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("系統設定", style = MaterialTheme.typography.labelMedium)
                                    }
                                }
                            }
                        }
                    }
                }

                // Error Notification Card
                if (!errorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Bottom Controls Row: Album Picker + Big Shutter Button + Cancel
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 1. Pick from Album (相簿選取)
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(enabled = !isAnalyzing) {
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            }
                            .padding(8.dp)
                            .testTag("pick_from_album_button")
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PhotoLibrary,
                                contentDescription = "從相簿選取",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "相簿選取",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // 2. Large Shutter Button (拍照辨識)
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.colorScheme.tertiary
                                    )
                                )
                            )
                            .clickable(enabled = hasCameraPermission && !isAnalyzing) {
                                val imageCapture = imageCaptureRef
                                if (imageCapture != null) {
                                    val executor = ContextCompat.getMainExecutor(context)
                                    imageCapture.takePicture(
                                        executor,
                                        object : ImageCapture.OnImageCapturedCallback() {
                                            override fun onCaptureSuccess(imageProxy: ImageProxy) {
                                                val bitmap = imageProxyToBitmap(imageProxy)
                                                if (bitmap != null) {
                                                    onCapturePhoto(bitmap)
                                                }
                                            }

                                            override fun onError(exception: ImageCaptureException) {
                                                exception.printStackTrace()
                                            }
                                        }
                                    )
                                }
                            }
                            .testTag("shutter_capture_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(58.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = "拍照辨識",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }

                    // 3. Cancel / Dismiss
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(enabled = !isAnalyzing) { onDismiss() }
                            .padding(8.dp)
                            .testTag("cancel_photo_scanner_button")
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "取消",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "取消",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CornerBracket(alignment: Alignment) {
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .align(alignment)
                .size(24.dp)
                .padding(4.dp)
                .border(
                    width = 3.dp,
                    color = Color(0xFF38BDF8),
                    shape = when (alignment) {
                        Alignment.TopStart -> RoundedCornerShape(topStart = 8.dp)
                        Alignment.TopEnd -> RoundedCornerShape(topEnd = 8.dp)
                        Alignment.BottomStart -> RoundedCornerShape(bottomStart = 8.dp)
                        Alignment.BottomEnd -> RoundedCornerShape(bottomEnd = 8.dp)
                        else -> RoundedCornerShape(0.dp)
                    }
                )
        )
    }
}
