package com.example

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    setContent {
      MyApplicationTheme {
        Surface(
          modifier = Modifier.fillMaxSize(),
          color = Color(0xFFF8FAFC)
        ) {
          FitPocketWebAppContainer(
            webUrl = "https://ais-dev-unijqvmex2t42oqyhiqv5h-644777657639.asia-northeast1.run.app",
            onWebViewCreated = { wv -> webView = wv }
          )
        }
      }
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (webView?.canGoBack() == true) {
      webView?.goBack()
    } else {
      super.onBackPressed()
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FitPocketWebAppContainer(
  webUrl: String,
  onWebViewCreated: (WebView) -> Unit
) {
  AndroidView(
    modifier = Modifier.fillMaxSize(),
    factory = { context ->
      WebView(context).apply {
        layoutParams = android.view.ViewGroup.LayoutParams(
          android.view.ViewGroup.LayoutParams.MATCH_PARENT,
          android.view.ViewGroup.LayoutParams.MATCH_PARENT
        )

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          allowFileAccess = true
          allowContentAccess = true
          loadWithOverviewMode = true
          useWideViewPort = true
          builtInZoomControls = false
          displayZoomControls = false
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          mediaPlaybackRequiresUserGesture = false
          cacheMode = WebSettings.LOAD_DEFAULT
        }

        webChromeClient = object : WebChromeClient() {
          override fun onPermissionRequest(request: PermissionRequest?) {
            // Automatically grant camera / microphone permissions to web view
            request?.grant(request.resources)
          }
        }

        webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(
            view: WebView?,
            request: android.webkit.WebResourceRequest?
          ): Boolean {
            return false // Keep all navigation inside the WebView
          }
        }

        loadUrl(webUrl)
        onWebViewCreated(this)
      }
    }
  )
}
