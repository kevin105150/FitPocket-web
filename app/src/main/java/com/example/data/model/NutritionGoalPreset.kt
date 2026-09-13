package com.example.data.model

enum class CarbCycleType(
    val displayName: String,
    val shortName: String,
    val emoji: String,
    val description: String
) {
    HIGH("高碳日", "高碳", "🔥", "適合高強度重訓、耐力訓練日"),
    MEDIUM("中碳日", "中碳", "⚖️", "適合一般訓練、常態維持日"),
    LOW("低碳日", "低碳", "🥗", "適合休息日、輕度活動、減脂日"),
    CUSTOM("自訂日", "自訂", "⚙️", "依個人需求完全自訂的營養目標")
}

data class NutritionGoalPreset(
    val type: CarbCycleType,
    val calories: Int,
    val carbs: Double,
    val fat: Double,
    val protein: Double,
    val sodium: Double = 2400.0,
    val potassium: Double = 2500.0
)
