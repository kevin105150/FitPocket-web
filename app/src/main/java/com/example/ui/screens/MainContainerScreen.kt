package com.example.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.MonitorWeight
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.outlined.LocalDrink
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import com.example.ui.DietViewModel
import kotlinx.coroutines.launch

enum class MainTab(
    val title: String,
    val activeIcon: ImageVector,
    val inactiveIcon: ImageVector,
    val testTag: String
) {
    DIET("飲食", Icons.Filled.Restaurant, Icons.Outlined.Restaurant, "tab_diet"),
    TRAINING("訓練", Icons.Filled.FitnessCenter, Icons.Outlined.FitnessCenter, "tab_training"),
    WATER("飲水", Icons.Filled.LocalDrink, Icons.Outlined.LocalDrink, "tab_water"),
    WEIGHT("體重", Icons.Filled.MonitorWeight, Icons.Outlined.MonitorWeight, "tab_weight"),
    SETTINGS("設定", Icons.Filled.Settings, Icons.Outlined.Settings, "tab_settings")
}

@Composable
fun MainContainerScreen(
    viewModel: DietViewModel
) {
    val tabs = MainTab.entries
    val pagerState = rememberPagerState(pageCount = { tabs.size })
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                windowInsets = WindowInsets.navigationBars
            ) {
                tabs.forEachIndexed { index, tab ->
                    val isSelected = pagerState.currentPage == index
                    
                    // Scale animation for icon
                    val scale by animateFloatAsState(
                        targetValue = if (isSelected) 1.2f else 1.0f,
                        animationSpec = tween(durationMillis = 300),
                        label = "icon_scale_anim"
                    )

                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(index)
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = if (isSelected) tab.activeIcon else tab.inactiveIcon,
                                contentDescription = tab.title,
                                modifier = Modifier.scale(scale)
                            )
                        },
                        label = {
                            Text(
                                text = tab.title,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        modifier = Modifier.testTag(tab.testTag)
                    )
                }
            }
        }
    ) { innerPadding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            userScrollEnabled = true
        ) { page ->
            when (tabs[page]) {
                MainTab.DIET -> DietTrackerScreen(viewModel = viewModel)
                MainTab.TRAINING -> TrainingTrackerScreen(viewModel = viewModel)
                MainTab.WATER -> WaterTrackerScreen(viewModel = viewModel)
                MainTab.WEIGHT -> WeightTrackerScreen(viewModel = viewModel)
                MainTab.SETTINGS -> SettingsScreen(viewModel = viewModel)
            }
        }
    }
}
