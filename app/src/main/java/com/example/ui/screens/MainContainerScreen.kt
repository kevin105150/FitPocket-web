package com.example.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import com.example.ui.DietViewModel

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
    var selectedTab by rememberSaveable { mutableStateOf(MainTab.DIET) }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                windowInsets = WindowInsets.navigationBars
            ) {
                MainTab.entries.forEach { tab ->
                    val isSelected = selectedTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { selectedTab = tab },
                        icon = {
                            Icon(
                                imageVector = if (isSelected) tab.activeIcon else tab.inactiveIcon,
                                contentDescription = tab.title
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedTab) {
                MainTab.DIET -> DietTrackerScreen(viewModel = viewModel)
                MainTab.WATER -> WaterTrackerScreen(viewModel = viewModel)
                MainTab.TRAINING -> TrainingTrackerScreen(viewModel = viewModel)
                MainTab.WEIGHT -> WeightTrackerScreen(viewModel = viewModel)
                MainTab.SETTINGS -> SettingsScreen(viewModel = viewModel)
            }
        }
    }
}
