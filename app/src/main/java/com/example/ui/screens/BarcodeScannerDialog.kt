package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@OptIn(ExperimentalGetImage::class)
@Composable
fun CameraPreviewWithBarcodeScanner(
    isSearching: Boolean,
    onBarcodeDetected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var lastScannedCode by remember { mutableStateOf<String?>(null) }

    // Reset last scanned code if search failed or stopped
    LaunchedEffect(isSearching) {
        if (!isSearching) {
            lastScannedCode = null
        }
    }

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

                    val barcodeScannerOptions = BarcodeScannerOptions.Builder()
                        .setBarcodeFormats(
                            Barcode.FORMAT_EAN_13,
                            Barcode.FORMAT_EAN_8,
                            Barcode.FORMAT_UPC_A,
                            Barcode.FORMAT_UPC_E,
                            Barcode.FORMAT_CODE_128,
                            Barcode.FORMAT_QR_CODE
                        )
                        .build()
                    val scanner = BarcodeScanning.getClient(barcodeScannerOptions)

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()

                    val analysisExecutor = Executors.newSingleThreadExecutor()

                    imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
                        val mediaImage = imageProxy.image
                        if (mediaImage != null && !isSearching) {
                            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                            scanner.process(image)
                                .addOnSuccessListener { barcodes ->
                                    val code = barcodes.firstOrNull()?.rawValue
                                    if (!code.isNullOrBlank() && code != lastScannedCode && !isSearching) {
                                        lastScannedCode = code
                                        executor.execute {
                                            onBarcodeDetected(code)
                                        }
                                    }
                                }
                                .addOnCompleteListener {
                                    imageProxy.close()
                                }
                        } else {
                            imageProxy.close()
                        }
                    }

                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }, executor)

            previewView
        },
        onRelease = {
            try {
                if (cameraProviderFuture.isDone) {
                    cameraProviderFuture.get().unbindAll()
                }
            } catch (e: Exception) {
                // Ignore cleanup errors
            }
        },
        modifier = modifier
    )
}

@Composable
fun BarcodeScannerDialog(
    isSearching: Boolean,
    errorMessage: String?,
    onSearchBarcode: (String) -> Unit,
    onOpenCustomWithAi: () -> Unit,
    onOpenPhotoScanner: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var barcodeInput by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    // Camera permission state management
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

    // Animated scanner beam translation
    val infiniteTransition = rememberInfiniteTransition(label = "scanner_laser")
    val laserYFraction by infiniteTransition.animateFloat(
        initialValue = 0.1f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laserY"
    )

    data class TestBarcode(val name: String, val code: String)
    val testBarcodes = listOf(
        TestBarcode("7-11 茶葉蛋", "4710088012345"),
        TestBarcode("7-11 溏心蛋", "4710088023456"),
        TestBarcode("7-11 雞胸肉", "4710088034567"),
        TestBarcode("全家 夯番薯", "4710088101234"),
        TestBarcode("全家 大成嫩雞胸", "4710088123456"),
        TestBarcode("全家 健身便當", "4710088134567"),
        TestBarcode("7-11 無糖豆漿", "4710088090123")
    )

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            tonalElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.QrCodeScanner,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "超商商品條碼掃描",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (onOpenPhotoScanner != null) {
                            FilledTonalButton(
                                onClick = onOpenPhotoScanner,
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp).testTag("switch_to_photo_scanner_btn")
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("拍照辨識", style = MaterialTheme.typography.labelSmall)
                            }
                            Spacer(modifier = Modifier.width(4.dp))
                        }

                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.testTag("close_barcode_dialog")
                        ) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "關閉")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Camera Permission Status Banner
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (hasCameraPermission) Color(0xFFDCFCE7) else Color(0xFFFEF3C7),
                    modifier = Modifier.fillMaxWidth()
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
                                imageVector = if (hasCameraPermission) Icons.Default.CheckCircle else Icons.Default.WarningAmber,
                                contentDescription = null,
                                tint = if (hasCameraPermission) Color(0xFF166534) else Color(0xFF92400E),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (hasCameraPermission) "相機權限：已開啟 (即時鏡頭對焦中)" else "相機權限：尚未開啟",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = if (hasCameraPermission) Color(0xFF166534) else Color(0xFF92400E)
                            )
                        }

                        if (!hasCameraPermission) {
                            FilledTonalButton(
                                onClick = {
                                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                },
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .height(28.dp)
                                    .testTag("request_camera_permission_button")
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("請求權限", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Scanner Viewport Card Frame (Live Camera Feed)
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        if (hasCameraPermission) {
                            // Camera Preview Feed
                            CameraPreviewWithBarcodeScanner(
                                isSearching = isSearching,
                                onBarcodeDetected = { code ->
                                    barcodeInput = code
                                    onSearchBarcode(code)
                                },
                                modifier = Modifier.fillMaxSize()
                            )

                            // Corner Frame Overlay
                            Box(
                                modifier = Modifier
                                    .size(width = 220.dp, height = 110.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.Black.copy(alpha = 0.15f))
                            ) {
                                // Animated Red Laser Line
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(2.dp)
                                        .align(Alignment.TopStart)
                                        .padding(top = (110 * laserYFraction).dp)
                                        .background(Color(0xFFEF4444))
                                )
                            }

                            // Scanning State or Status Overlay Text
                            if (isSearching) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color.Black.copy(alpha = 0.6f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        CircularProgressIndicator(
                                            color = Color.White,
                                            strokeWidth = 3.dp,
                                            modifier = Modifier.size(28.dp)
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = "查詢超商與 Open Food Facts 資料庫...",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Color.White
                                        )
                                    }
                                }
                            }
                        } else {
                            // No Camera Permission Card State
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.padding(16.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CameraAlt,
                                    contentDescription = null,
                                    tint = Color(0xFFFBBF24),
                                    modifier = Modifier.size(36.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "請開啟相機權限以啟用鏡頭自動掃描",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = {
                                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(34.dp)
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
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        modifier = Modifier.height(34.dp)
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

                Spacer(modifier = Modifier.height(14.dp))

                // Manual Barcode Input
                OutlinedTextField(
                    value = barcodeInput,
                    onValueChange = { barcodeInput = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("barcode_text_input"),
                    placeholder = {
                        Text(
                            text = "輸入商品條碼 (如: 4710088012345)",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    trailingIcon = {
                        if (barcodeInput.isNotEmpty()) {
                            IconButton(onClick = { barcodeInput = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "清除")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Search
                    ),
                    keyboardActions = KeyboardActions(
                        onSearch = {
                            focusManager.clearFocus()
                            if (barcodeInput.isNotBlank()) {
                                onSearchBarcode(barcodeInput)
                            }
                        }
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Error / Warning Message
                if (!errorMessage.isNullOrBlank()) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                text = errorMessage,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            FilledTonalButton(
                                onClick = {
                                    onDismiss()
                                    onOpenCustomWithAi()
                                },
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.align(Alignment.End).height(32.dp)
                            ) {
                                Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("以 AI 建立此食品", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                // Preset Test Barcode Chips
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "💡 點選快速測試超商熱門條碼：",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        testBarcodes.forEach { tb ->
                            AssistChip(
                                onClick = {
                                    focusManager.clearFocus()
                                    barcodeInput = tb.code
                                    onSearchBarcode(tb.code)
                                },
                                label = {
                                    Text(
                                        text = tb.name,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                ),
                                border = BorderStroke(
                                    width = 1.dp,
                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.height(30.dp).testTag("test_barcode_${tb.code}")
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Submit Button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("取消")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            if (barcodeInput.isNotBlank()) {
                                onSearchBarcode(barcodeInput)
                            }
                        },
                        enabled = barcodeInput.isNotBlank() && !isSearching,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("submit_barcode_search_button")
                    ) {
                        Text("查詢條碼")
                    }
                }
            }
        }
    }
}


