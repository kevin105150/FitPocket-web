package com.example.data

import com.example.data.local.WorkoutWithExercises
import com.example.data.model.FoodRecord
import com.example.data.model.WaterRecord
import com.example.data.model.WeightRecord
import com.example.data.model.WorkoutExercise
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object HtmlExportHelper {

    private val dbDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val displayDateFormat = SimpleDateFormat("yyyy年MM月dd日 (E)", Locale.CHINESE)

    /**
     * Generates a 7-day date list starting from [startDateStr] (format: yyyy-MM-dd).
     */
    fun getWeekDays(startDateStr: String): List<String> {
        val days = mutableListOf<String>()
        try {
            val date = dbDateFormat.parse(startDateStr) ?: return emptyList()
            val cal = Calendar.getInstance()
            cal.time = date
            for (i in 0 until 7) {
                days.add(dbDateFormat.format(cal.time))
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return days
    }

    /**
     * Formats database date string "yyyy-MM-dd" into a friendly Chinese display format.
     */
    fun formatDisplayDate(dateStr: String): String {
        return try {
            val date = dbDateFormat.parse(dateStr) ?: return dateStr
            displayDateFormat.format(date)
        } catch (e: Exception) {
            dateStr
        }
    }

    /**
     * Builds HTML content for Diet Records.
     */
    fun generateDietHtml(startDate: String, days: List<String>, records: List<FoodRecord>): String {
        val endDate = days.lastOrNull() ?: startDate
        val recordMap = records.groupBy { it.date }

        val bodyContent = StringBuilder()

        // Overall stats
        var totalCalories = 0.0
        var totalCarbs = 0.0
        var totalProtein = 0.0
        var totalFat = 0.0
        var recordCount = 0

        for (record in records) {
            totalCalories += record.calories
            totalCarbs += record.carbs
            totalProtein += record.protein
            totalFat += record.fat
            recordCount++
        }

        val avgCalories = if (days.isNotEmpty()) totalCalories / days.size else 0.0

        // Weekly Summary Card
        bodyContent.append("""
            <div class="summary-card">
                <h2>📊 本週飲食摘要 (Weekly Summary)</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">總熱量攝取</span>
                        <span class="stat-value">${totalCalories.toInt()} kcal</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">日均熱量</span>
                        <span class="stat-value">${avgCalories.toInt()} kcal</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">總碳水化合物</span>
                        <span class="stat-value">${String.format("%.1f", totalCarbs)} g</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">總蛋白質</span>
                        <span class="stat-value">${String.format("%.1f", totalProtein)} g</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">總脂肪</span>
                        <span class="stat-value">${String.format("%.1f", totalFat)} g</span>
                    </div>
                </div>
            </div>
        """.trimIndent())

        // Daily breakdown
        for (day in days) {
            val dayRecords = recordMap[day] ?: emptyList()
            bodyContent.append("<div class='day-card'>")
            bodyContent.append("<h3 class='day-title'>📅 ${formatDisplayDate(day)}</h3>")

            if (dayRecords.isEmpty()) {
                bodyContent.append("<p class='no-data'>本日無飲食紀錄</p>")
            } else {
                bodyContent.append("""
                    <table>
                        <thead>
                            <tr>
                                <th>餐別</th>
                                <th>食物名稱</th>
                                <th>份量</th>
                                <th>熱量 (kcal)</th>
                                <th>碳水 (g)</th>
                                <th>蛋白 (g)</th>
                                <th>脂肪 (g)</th>
                                <th>鈉 (mg)</th>
                            </tr>
                        </thead>
                        <tbody>
                """.trimIndent())

                var dayCal = 0.0
                var dayCarb = 0.0
                var dayProt = 0.0
                var dayFat = 0.0
                var daySodium = 0.0

                for (rec in dayRecords) {
                    dayCal += rec.calories
                    dayCarb += rec.carbs
                    dayProt += rec.protein
                    dayFat += rec.fat
                    daySodium += rec.sodium

                    bodyContent.append("""
                        <tr>
                            <td><span class="badge badge-meal">${rec.mealType.displayName}</span></td>
                            <td><strong>${rec.name}</strong></td>
                            <td>${rec.amount.toInt()}${rec.unit}</td>
                            <td>${rec.calories.toInt()}</td>
                            <td>${String.format("%.1f", rec.carbs)}</td>
                            <td>${String.format("%.1f", rec.protein)}</td>
                            <td>${String.format("%.1f", rec.fat)}</td>
                            <td>${rec.sodium.toInt()}</td>
                        </tr>
                    """.trimIndent())
                }

                bodyContent.append("""
                        <tr class="total-row">
                            <td colspan="3"><strong>本日加總 (Daily Total)</strong></td>
                            <td><strong>${dayCal.toInt()}</strong></td>
                            <td><strong>${String.format("%.1f", dayCarb)}</strong></td>
                            <td><strong>${String.format("%.1f", dayProt)}</strong></td>
                            <td><strong>${String.format("%.1f", dayFat)}</strong></td>
                            <td><strong>${daySodium.toInt()}</strong></td>
                        </tr>
                        </tbody>
                    </table>
                """.trimIndent())
            }
            bodyContent.append("</div>")
        }

        return buildFullHtml("🥗 飲食紀錄週報表", "$startDate 至 $endDate", bodyContent.toString())
    }

    /**
     * Builds HTML content for Training/Workout Records.
     */
    fun generateTrainingHtml(startDate: String, days: List<String>, workouts: List<WorkoutWithExercises>): String {
        val endDate = days.lastOrNull() ?: startDate
        val workoutMap = workouts.groupBy { it.workout.date }

        val bodyContent = StringBuilder()

        // Stats summary
        val totalSessions = workouts.size
        var totalSets = 0
        var totalExercisesCount = 0

        for (w in workouts) {
            totalExercisesCount += w.exercises.size
            for (exWithSets in w.exercises) {
                totalSets += exWithSets.sets.size
            }
        }

        bodyContent.append("""
            <div class="summary-card" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-left: 6px solid #4CAF50;">
                <h2>🏋️ 本週訓練摘要 (Training Summary)</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">訓練總天數</span>
                        <span class="stat-value">$totalSessions 天</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">訓練動作數</span>
                        <span class="stat-value">$totalExercisesCount 個</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">累積訓練組數</span>
                        <span class="stat-value">$totalSets 組</span>
                    </div>
                </div>
            </div>
        """.trimIndent())

        for (day in days) {
            val dayWorkouts = workoutMap[day] ?: emptyList()
            bodyContent.append("<div class='day-card'>")
            bodyContent.append("<h3 class='day-title'>📅 ${formatDisplayDate(day)}</h3>")

            if (dayWorkouts.isEmpty()) {
                bodyContent.append("<p class='no-data'>本日無訓練紀錄</p>")
            } else {
                for (w in dayWorkouts) {
                    bodyContent.append("""
                        <div class="workout-header">
                            <span class="body-part-badge">🎯 ${w.workout.bodyPart.ifBlank { "健身訓練" }}</span>
                        </div>
                    """.trimIndent())

                    // Group exercises by supersetGroupId
                    val groupedExercises = mutableListOf<WorkoutGroupedExportItem>()
                    val supersets = w.exercises.filter { it.exercise.supersetGroupId != null }.groupBy { it.exercise.supersetGroupId!! }
                    val processedSupersets = mutableSetOf<Int>()

                    for (exWithSets in w.exercises) {
                        val gid = exWithSets.exercise.supersetGroupId
                        if (gid == null) {
                            groupedExercises.add(WorkoutGroupedExportItem.Single(exWithSets))
                        } else {
                            if (!processedSupersets.contains(gid)) {
                                val list = supersets[gid] ?: emptyList()
                                groupedExercises.add(WorkoutGroupedExportItem.Superset(gid, list))
                                processedSupersets.add(gid)
                            }
                        }
                    }

                    for (item in groupedExercises) {
                        when (item) {
                            is WorkoutGroupedExportItem.Single -> {
                                val exWithSets = item.exerciseWithSets
                                bodyContent.append("""
                                    <div class="exercise-row" style="flex-direction: column; align-items: flex-start;">
                                        <div class="exercise-name" style="margin-bottom: 6px;">🏃 ${exWithSets.exercise.name}</div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px; width: 100%;">
                                """.trimIndent())
                                exWithSets.sets.forEach { setItem ->
                                    val wText = if (setItem.weight % 1.0 == 0.0) "${setItem.weight.toInt()}kg" else "${setItem.weight}kg"
                                    bodyContent.append("""
                                        <span class="badge badge-sets" style="background-color: #E8F5E9; color: #2E7D32;">第 ${setItem.setIndex} 組: ${setItem.reps}次 · $wText</span>
                                    """.trimIndent())
                                }
                                bodyContent.append("""
                                        </div>
                                    </div>
                                """.trimIndent())
                            }
                            is WorkoutGroupedExportItem.Superset -> {
                                bodyContent.append("""
                                    <div class="superset-container">
                                        <div class="superset-badge">⚡ 超級組 (Superset)</div>
                                """.trimIndent())
                                item.exercises.forEachIndexed { idx, exWithSets ->
                                    bodyContent.append("""
                                        <div class="exercise-row" style="margin-left: 10px; border-left: 3px solid #FF9800; padding-left: 10px; flex-direction: column; align-items: flex-start; margin-top: 8px;">
                                            <div class="exercise-name" style="margin-bottom: 6px;"><span class="sub-num">${idx + 1}</span> ${exWithSets.exercise.name}</div>
                                            <div style="display: flex; flex-wrap: wrap; gap: 6px; width: 100%;">
                                    """.trimIndent())
                                    exWithSets.sets.forEach { setItem ->
                                        val wText = if (setItem.weight % 1.0 == 0.0) "${setItem.weight.toInt()}kg" else "${setItem.weight}kg"
                                        bodyContent.append("""
                                            <span class="badge badge-sets" style="background-color: #FFFDE7; color: #F57F17;">第 ${setItem.setIndex} 組: ${setItem.reps}次 · $wText</span>
                                        """.trimIndent())
                                    }
                                    bodyContent.append("""
                                            </div>
                                        </div>
                                    """.trimIndent())
                                }
                                bodyContent.append("</div>")
                            }
                        }
                    }
                }
            }
            bodyContent.append("</div>")
        }

        return buildFullHtml("🏋️ 訓練紀錄週報表", "$startDate 至 $endDate", bodyContent.toString())
    }

    /**
     * Builds HTML content for Weight Records.
     */
    fun generateWeightHtml(startDate: String, days: List<String>, records: List<WeightRecord>): String {
        val endDate = days.lastOrNull() ?: startDate
        val recordMap = records.associateBy { it.date }

        val bodyContent = StringBuilder()

        // Math statistics
        var morningCount = 0
        var morningSum = 0.0
        var morningMax = Double.MIN_VALUE
        var morningMin = Double.MAX_VALUE

        var eveningCount = 0
        var eveningSum = 0.0
        var eveningMax = Double.MIN_VALUE
        var eveningMin = Double.MAX_VALUE

        for (rec in records) {
            rec.morningWeightKg?.let {
                morningSum += it
                morningCount++
                if (it > morningMax) morningMax = it
                if (it < morningMin) morningMin = it
            }
            rec.eveningWeightKg?.let {
                eveningSum += it
                eveningCount++
                if (it > eveningMax) eveningMax = it
                if (it < eveningMin) eveningMin = it
            }
        }

        val avgMorning = if (morningCount > 0) morningSum / morningCount else 0.0
        val avgEvening = if (eveningCount > 0) eveningSum / eveningCount else 0.0

        bodyContent.append("""
            <div class="summary-card" style="background: linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%); border-left: 6px solid #607D8B;">
                <h2>⚖️ 本週體重摘要 (Weight Summary)</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">早上平均體重</span>
                        <span class="stat-value">${if (morningCount > 0) String.format("%.2f kg", avgMorning) else "--"}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">晚上平均體重</span>
                        <span class="stat-value">${if (eveningCount > 0) String.format("%.2f kg", avgEvening) else "--"}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">早上最低體重</span>
                        <span class="stat-value">${if (morningCount > 0) String.format("%.2f kg", morningMin) else "--"}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">早上最高體重</span>
                        <span class="stat-value">${if (morningCount > 0) String.format("%.2f kg", morningMax) else "--"}</span>
                    </div>
                </div>
            </div>
        """.trimIndent())

        // Weight Table
        bodyContent.append("""
            <div class="day-card">
                <h3 class="day-title">📅 每日體重詳細對照表</h3>
                <table>
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>早上體重</th>
                            <th>測量時間 (AM)</th>
                            <th>晚上體重</th>
                            <th>測量時間 (PM)</th>
                            <th>當日溫差</th>
                        </tr>
                    </thead>
                    <tbody>
        """.trimIndent())

        for (day in days) {
            val rec = recordMap[day]
            if (rec == null) {
                bodyContent.append("""
                    <tr>
                        <td><strong>${formatDisplayDate(day)}</strong></td>
                        <td colspan="5" class="no-data" style="text-align: center; color: #999;">本日無體重資料</td>
                    </tr>
                """.trimIndent())
            } else {
                val mWeight = rec.morningWeightKg?.let { String.format("%.1f kg", it) } ?: "--"
                val mTime = rec.morningTime?.ifBlank { "--" } ?: "--"
                val eWeight = rec.eveningWeightKg?.let { String.format("%.1f kg", it) } ?: "--"
                val eTime = rec.eveningTime?.ifBlank { "--" } ?: "--"

                val diff = if (rec.morningWeightKg != null && rec.eveningWeightKg != null) {
                    val d = rec.eveningWeightKg - rec.morningWeightKg
                    val sign = if (d > 0) "+" else ""
                    val color = if (d > 0) "#e53935" else "#43a047"
                    "<span style='color: $color; font-weight: bold;'>$sign${String.format("%.1f kg", d)}</span>"
                } else {
                    "--"
                }

                bodyContent.append("""
                    <tr>
                        <td><strong>${formatDisplayDate(day)}</strong></td>
                        <td><span style="font-size: 1.1em; color: #2196F3; font-weight: bold;">$mWeight</span></td>
                        <td><span class="badge" style="background-color: #E3F2FD; color: #0D47A1; font-weight: normal;">$mTime</span></td>
                        <td><span style="font-size: 1.1em; color: #FF9800; font-weight: bold;">$eWeight</span></td>
                        <td><span class="badge" style="background-color: #FFF3E0; color: #E65100; font-weight: normal;">$eTime</span></td>
                        <td>$diff</td>
                    </tr>
                """.trimIndent())
            }
        }

        bodyContent.append("""
                    </tbody>
                </table>
            </div>
        """.trimIndent())

        return buildFullHtml("⚖️ 體重與健康週報表", "$startDate 至 $endDate", bodyContent.toString())
    }

    /**
     * Builds HTML content for Water Records.
     */
    fun generateWaterHtml(startDate: String, days: List<String>, records: List<WaterRecord>, goalMl: Int = 2000): String {
        val endDate = days.lastOrNull() ?: startDate
        val recordMap = records.groupBy { it.date }
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

        val bodyContent = StringBuilder()

        var totalWaterMl = 0
        var achievedDays = 0

        val dailyTotals = days.associateWith { day ->
            val dayRecs = recordMap[day] ?: emptyList()
            val sum = dayRecs.sumOf { it.amountMl }
            totalWaterMl += sum
            if (sum >= goalMl) achievedDays++
            sum
        }

        val avgWaterMl = if (days.isNotEmpty()) totalWaterMl / days.size else 0

        bodyContent.append("""
            <div class="summary-card" style="background: linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%); border-left: 6px solid #00ACC1;">
                <h2 style="color: #006064;">💧 本週飲水摘要 (Water Summary)</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">總飲水攝取</span>
                        <span class="stat-value">${String.format("%.1f", totalWaterMl / 1000.0)} L (${totalWaterMl} ml)</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">日均飲水量</span>
                        <span class="stat-value">${avgWaterMl} ml</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">每日設定目標</span>
                        <span class="stat-value">${goalMl} ml</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">達標天數</span>
                        <span class="stat-value">${achievedDays} / ${days.size} 天</span>
                    </div>
                </div>
            </div>
        """.trimIndent())

        for (day in days) {
            val dayRecords = recordMap[day] ?: emptyList()
            val dayTotal = dailyTotals[day] ?: 0
            val isAchieved = dayTotal >= goalMl
            val percent = if (goalMl > 0) ((dayTotal.toDouble() / goalMl) * 100).toInt() else 0

            bodyContent.append("<div class='day-card'>")
            bodyContent.append("""
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E0F7FA; padding-bottom: 8px; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 1.15rem; color: #00838F;">📅 ${formatDisplayDate(day)}</h3>
                    <div>
                        <span style="font-weight: bold; font-size: 1.05rem; color: #0097A7; margin-right: 8px;">${dayTotal} / ${goalMl} ml</span>
                        ${
                            if (isAchieved) "<span class='badge' style='background-color: #E8F5E9; color: #2E7D32;'>✅ 達標 ($percent%)</span>"
                            else "<span class='badge' style='background-color: #FFF3E0; color: #E65100;'>未達標 ($percent%)</span>"
                        }
                    </div>
                </div>
            """.trimIndent())

            if (dayRecords.isEmpty()) {
                bodyContent.append("<p class='no-data'>本日無飲水紀錄</p>")
            } else {
                bodyContent.append("""
                    <table>
                        <thead>
                            <tr>
                                <th>記錄時間</th>
                                <th>飲水量 (ml)</th>
                                <th>進度狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                """.trimIndent())

                for (rec in dayRecords) {
                    val timeStr = timeFormat.format(Date(rec.timestamp))
                    bodyContent.append("""
                        <tr>
                            <td><span class="badge" style="background-color: #E0F7FA; color: #006064;">🕒 $timeStr</span></td>
                            <td><strong style="color: #0284c7; font-size: 1.05em;">${rec.amountMl} ml</strong></td>
                            <td><span style="color: #64748b; font-size: 0.85em;">單次喝水補充</span></td>
                        </tr>
                    """.trimIndent())
                }

                bodyContent.append("""
                        </tbody>
                    </table>
                """.trimIndent())
            }
            bodyContent.append("</div>")
        }

        return buildFullHtml("💧 飲水健康週報表", "$startDate 至 $endDate", bodyContent.toString())
    }

    /**
     * Builds comprehensive HTML content combining Diet, Water, Training, and Weight.
     */
    fun generateAllHtml(
        startDate: String,
        days: List<String>,
        dietRecords: List<FoodRecord>,
        waterRecords: List<WaterRecord>,
        waterGoalMl: Int,
        workouts: List<WorkoutWithExercises>,
        weightRecords: List<WeightRecord>
    ): String {
        val endDate = days.lastOrNull() ?: startDate
        val bodyContent = StringBuilder()

        val totalCalories = dietRecords.sumOf { it.calories }
        val totalWaterMl = waterRecords.sumOf { it.amountMl }
        val workoutCount = workouts.size
        val totalExercises = workouts.sumOf { it.exercises.size }
        val validWeights = weightRecords.mapNotNull { it.morningWeightKg ?: it.eveningWeightKg }
        val avgWeight = if (validWeights.isNotEmpty()) validWeights.average() else 0.0

        bodyContent.append("""
            <div class="summary-card" style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); color: white; border-left: 6px solid #38BDF8; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
                <h2 style="color: #38BDF8; font-size: 1.35rem; margin-bottom: 16px;">📋 本週全方位健康總覽 (Executive Health Summary)</h2>
                <div class="stats-grid">
                    <div class="stat-box" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);">
                        <span class="stat-label" style="color: #94A3B8;">🥗 總熱量攝取</span>
                        <span class="stat-value" style="color: #F8FAFC;">${totalCalories.toInt()} kcal</span>
                    </div>
                    <div class="stat-box" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);">
                        <span class="stat-label" style="color: #94A3B8;">💧 總水份攝取</span>
                        <span class="stat-value" style="color: #F8FAFC;">${String.format("%.1f", totalWaterMl / 1000.0)} L</span>
                    </div>
                    <div class="stat-box" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);">
                        <span class="stat-label" style="color: #94A3B8;">🏋️ 訓練總場次</span>
                        <span class="stat-value" style="color: #F8FAFC;">${workoutCount} 場 (${totalExercises} 動作)</span>
                    </div>
                    <div class="stat-box" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);">
                        <span class="stat-label" style="color: #94A3B8;">⚖️ 週平均體重</span>
                        <span class="stat-value" style="color: #F8FAFC;">${if (avgWeight > 0) String.format("%.1f kg", avgWeight) else "--"}</span>
                    </div>
                </div>
            </div>
        """.trimIndent())

        // Section 1: Diet Records
        bodyContent.append("""
            <div style="margin-top: 36px; margin-bottom: 16px;">
                <h2 style="color: #6200EE; border-bottom: 3px solid #6200EE; padding-bottom: 8px; font-size: 1.3rem;">🥗 一、 飲食紀錄 (Diet Records)</h2>
            </div>
        """.trimIndent())
        bodyContent.append(generateDietHtml(startDate, days, dietRecords).extractBodyContent())

        // Section 2: Water Records
        bodyContent.append("""
            <div style="margin-top: 36px; margin-bottom: 16px;">
                <h2 style="color: #00ACC1; border-bottom: 3px solid #00ACC1; padding-bottom: 8px; font-size: 1.3rem;">💧 二、 飲水紀錄 (Water Records)</h2>
            </div>
        """.trimIndent())
        bodyContent.append(generateWaterHtml(startDate, days, waterRecords, waterGoalMl).extractBodyContent())

        // Section 3: Training Records
        bodyContent.append("""
            <div style="margin-top: 36px; margin-bottom: 16px;">
                <h2 style="color: #2E7D32; border-bottom: 3px solid #2E7D32; padding-bottom: 8px; font-size: 1.3rem;">🏋️ 三、 訓練紀錄 (Training Records)</h2>
            </div>
        """.trimIndent())
        bodyContent.append(generateTrainingHtml(startDate, days, workouts).extractBodyContent())

        // Section 4: Weight Records
        bodyContent.append("""
            <div style="margin-top: 36px; margin-bottom: 16px;">
                <h2 style="color: #607D8B; border-bottom: 3px solid #607D8B; padding-bottom: 8px; font-size: 1.3rem;">⚖️ 四、 體重紀錄 (Weight Records)</h2>
            </div>
        """.trimIndent())
        bodyContent.append(generateWeightHtml(startDate, days, weightRecords).extractBodyContent())

        return buildFullHtml("📋 全方位健康與飲食訓練總報表", "$startDate 至 $endDate", bodyContent.toString())
    }

    private fun String.extractBodyContent(): String {
        val startTag = "<div class=\"container\">"
        val headerEndTag = "</header>"
        val footerStartTag = "<footer>"
        val headerIdx = this.indexOf(headerEndTag)
        val footerIdx = this.indexOf(footerStartTag)
        return if (headerIdx != -1 && footerIdx != -1) {
            this.substring(headerIdx + headerEndTag.length, footerIdx).trim()
        } else {
            this
        }
    }

    /**
     * Formulates the complete standalone HTML string with professional modern styling.
     */
    private fun buildFullHtml(title: String, range: String, body: String): String {
        return """
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>$title</title>
                <style>
                    :root {
                        --primary: #6200EE;
                        --primary-container: #F2E7FE;
                        --background: #FAFAFA;
                        --surface: #FFFFFF;
                        --on-surface: #212121;
                        --on-surface-variant: #666666;
                        --border: #E0E0E0;
                        --radius: 16px;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans TC", sans-serif;
                        background-color: var(--background);
                        color: var(--on-surface);
                        margin: 0;
                        padding: 16px;
                        line-height: 1.5;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    header {
                        text-align: center;
                        margin-bottom: 24px;
                        background-color: var(--surface);
                        padding: 24px;
                        border-radius: var(--radius);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    }
                    h1 {
                        margin: 0 0 8px 0;
                        color: var(--primary);
                        font-size: 1.8rem;
                        font-weight: 800;
                    }
                    .date-range {
                        color: var(--on-surface-variant);
                        font-size: 1rem;
                        font-weight: bold;
                    }
                    .summary-card {
                        background: linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%);
                        border-left: 6px solid var(--primary);
                        border-radius: var(--radius);
                        padding: 20px;
                        margin-bottom: 24px;
                        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                    }
                    .summary-card h2 {
                        margin: 0 0 16px 0;
                        font-size: 1.25rem;
                        color: #4A148C;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                        gap: 12px;
                    }
                    .stat-box {
                        background-color: rgba(255, 255, 255, 0.85);
                        border-radius: 12px;
                        padding: 12px;
                        text-align: center;
                        border: 1px solid rgba(0,0,0,0.04);
                    }
                    .stat-label {
                        display: block;
                        font-size: 0.8rem;
                        color: var(--on-surface-variant);
                        margin-bottom: 4px;
                        font-weight: bold;
                    }
                    .stat-value {
                        font-size: 1.15rem;
                        font-weight: 800;
                        color: #1A1A1A;
                    }
                    .day-card {
                        background-color: var(--surface);
                        border-radius: var(--radius);
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                        border: 1px solid var(--border);
                    }
                    .day-title {
                        margin: 0 0 14px 0;
                        font-size: 1.15rem;
                        color: #333;
                        border-bottom: 2px solid var(--primary-container);
                        padding-bottom: 8px;
                    }
                    .no-data {
                        color: #999;
                        font-style: italic;
                        font-size: 0.95rem;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9rem;
                        margin-top: 8px;
                    }
                    th, td {
                        padding: 10px 12px;
                        text-align: left;
                        border-bottom: 1px solid var(--border);
                    }
                    th {
                        background-color: var(--primary-container);
                        color: var(--primary);
                        font-weight: 800;
                        font-size: 0.85rem;
                    }
                    tr:last-child td {
                        border-bottom: none;
                    }
                    .total-row {
                        background-color: #FAF5FF;
                        color: var(--primary);
                    }
                    .badge {
                        display: inline-block;
                        padding: 3px 8px;
                        font-size: 0.75rem;
                        font-weight: bold;
                        border-radius: 6px;
                    }
                    .badge-meal {
                        background-color: #EDE7F6;
                        color: #5E35B1;
                    }
                    .workout-header {
                        margin-bottom: 12px;
                    }
                    .body-part-badge {
                        background-color: #E8F5E9;
                        color: #2E7D32;
                        font-weight: bold;
                        padding: 4px 10px;
                        border-radius: 8px;
                        font-size: 0.9rem;
                        display: inline-block;
                    }
                    .exercise-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 0;
                        border-bottom: 1px dashed var(--border);
                    }
                    .exercise-row:last-child {
                        border-bottom: none;
                    }
                    .exercise-name {
                        font-weight: bold;
                        font-size: 0.95rem;
                    }
                    .exercise-details {
                        display: flex;
                        gap: 4px;
                    }
                    .badge-sets {
                        background-color: #E0F2F1;
                        color: #00796B;
                    }
                    .badge-reps {
                        background-color: #FFF3E0;
                        color: #E65100;
                    }
                    .badge-weight {
                        background-color: #ECEFF1;
                        color: #455A64;
                    }
                    .superset-container {
                        background-color: #FFFDE7;
                        border: 1px solid #FFF59D;
                        border-radius: 12px;
                        padding: 12px;
                        margin: 12px 0;
                    }
                    .superset-badge {
                        font-weight: bold;
                        color: #F57F17;
                        font-size: 0.8rem;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .sub-num {
                        display: inline-block;
                        width: 18px;
                        height: 18px;
                        line-height: 18px;
                        text-align: center;
                        background-color: #FF9800;
                        color: white;
                        border-radius: 50%;
                        font-size: 0.7rem;
                        font-weight: bold;
                        margin-right: 4px;
                    }
                    footer {
                        text-align: center;
                        margin-top: 32px;
                        color: var(--on-surface-variant);
                        font-size: 0.8rem;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>$title</h1>
                        <div class="date-range">$range</div>
                    </header>
                    
                    $body
                    
                    <footer>
                        <p>由 運動飲食與體重管家 應用程式自動生成報告</p>
                    </footer>
                </div>
            </body>
            </html>
        """.trimIndent()
    }
}

sealed class WorkoutGroupedExportItem {
    data class Single(val exerciseWithSets: com.example.data.local.ExerciseWithSets) : WorkoutGroupedExportItem()
    data class Superset(val groupId: Int, val exercises: List<com.example.data.local.ExerciseWithSets>) : WorkoutGroupedExportItem()
}
