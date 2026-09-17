package com.example.data

import android.util.Log
import com.example.data.local.CustomFoodDao
import com.example.data.local.ExerciseDao
import com.example.data.local.FoodRecordDao
import com.example.data.local.MuscleGroupDao
import com.example.data.local.WeightRecordDao
import com.example.data.local.WorkoutDao
import com.example.data.local.WaterRecordDao
import com.example.data.local.WorkoutWithExercises
import com.example.data.model.CommonFoodsDatabase
import com.example.data.model.CustomFood
import com.example.data.model.Exercise
import com.example.data.model.FoodRecord
import com.example.data.model.FoodSearchResult
import com.example.data.model.MuscleGroup
import com.example.data.model.WaterRecord
import com.example.data.model.WeightRecord
import com.example.data.model.WorkoutExercise
import com.example.data.model.WorkoutRecord
import com.example.data.network.AiEstimatedNutrition
import com.example.data.network.GeminiNutritionEstimator
import com.example.data.network.GeminiResponse
import com.example.data.network.OpenFoodFactsClient
import com.example.data.network.ProductDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.first

class DietRepository(
    private val foodRecordDao: FoodRecordDao,
    private val customFoodDao: CustomFoodDao,
    private val weightRecordDao: WeightRecordDao,
    private val workoutDao: WorkoutDao,
    private val waterRecordDao: WaterRecordDao,
    private val muscleGroupDao: MuscleGroupDao,
    private val exerciseDao: ExerciseDao
) {
    // --- Dictionary ---
    fun searchMuscleGroups(query: String): Flow<List<MuscleGroup>> = muscleGroupDao.searchMuscleGroups(query)
    fun getAllMuscleGroups(): Flow<List<MuscleGroup>> = muscleGroupDao.getAllMuscleGroups()
    suspend fun insertMuscleGroup(muscleGroup: MuscleGroup) = withContext(Dispatchers.IO) {
        muscleGroupDao.insert(muscleGroup)
    }

    fun searchExercises(query: String): Flow<List<Exercise>> = exerciseDao.searchExercises(query)
    fun getAllExercises(): Flow<List<Exercise>> = exerciseDao.getAllExercises()
    suspend fun insertExerciseDictionary(exercise: Exercise) = withContext(Dispatchers.IO) {
        exerciseDao.insert(exercise)
    }

    private fun sanitizeTrainingDocId(name: String): String {
        return name.trim()
            .replace("/", "_")
            .replace(".", "_")
            .replace(" ", "_")
            .replace("?", "_")
            .replace("#", "_")
            .replace("(", "_")
            .replace(")", "_")
            .replace("[", "_")
            .replace("]", "_")
            .ifBlank { "item" }
    }

    suspend fun syncTrainingDictionariesWithCloud() = withContext(Dispatchers.IO) {
        try {
            // Pre-seed default data if database is empty or missing defaults
            val defaultMuscleGroups = listOf("胸", "背", "腿", "肩", "手臂", "核心", "有氧", "臀", "全身")
            val defaultExercises = listOf(
                "慢跑", "跑步機", "飛輪單車", "划船機", "橢圓機", "跳繩", "快走・健走", "游泳", "波比跳", "開合跳", "戰繩訓練", "階梯機", "高強度間歇 (HIIT)",
                "槓鈴平椅臥推", "上胸啞鈴臥推", "下胸雙槓撐體", "啞鈴飛鳥", "繩索夾胸", "俯臥撐", "史密斯機臥推",
                "滑輪下拉", "槓鈴劃船", "單臂啞鈴劃船", "引體向上", "坐姿劃船", "羅馬椅挺身", "硬舉",
                "槓鈴深蹲", "羅馬尼亞硬舉", "腿推機", "腿伸展機", "腿彎舉", "槓鈴弓步蹲", "提踵",
                "站姿槓鈴肩推", "坐姿啞鈴肩推", "啞鈴側平舉", "後三角繩索面拉", "俯身飛鳥", "聳肩",
                "槓鈴二頭彎舉", "啞鈴錘式彎舉", "三頭肌繩索下壓", "法式推舉", "窄握臥推", "雙槓體撐",
                "棒式", "捲腹", "懸垂舉腿", "仰臥起坐", "俄羅斯轉體", "健腹輪"
            )

            val localMg = muscleGroupDao.getAllMuscleGroups().first()
            if (localMg.isEmpty()) {
                muscleGroupDao.insertAll(defaultMuscleGroups.map { MuscleGroup(it) })
            } else {
                val existingNames = localMg.map { it.name }.toSet()
                val missingDefaults = defaultMuscleGroups.filter { it !in existingNames }.map { MuscleGroup(it) }
                if (missingDefaults.isNotEmpty()) {
                    muscleGroupDao.insertAll(missingDefaults)
                }
            }
            val localEx = exerciseDao.getAllExercises().first()
            if (localEx.isEmpty()) {
                exerciseDao.insertAll(defaultExercises.map { Exercise(it) })
            } else {
                val existingExNames = localEx.map { it.name }.toSet()
                val missingExDefaults = defaultExercises.filter { it !in existingExNames }.map { Exercise(it) }
                if (missingExDefaults.isNotEmpty()) {
                    exerciseDao.insertAll(missingExDefaults)
                }
            }

            val firestore = com.google.firebase.firestore.FirebaseFirestore.getInstance()
            
            // 1. Sync Muscle Groups
            val mgCollection = firestore.collection("training_muscle_groups")
            val currentLocalMg = muscleGroupDao.getAllMuscleGroups().first()
            val remoteMgSnapshot = mgCollection.get().awaitTask()
            
            val remoteMgNames = remoteMgSnapshot.documents.mapNotNull { it.getString("name") ?: it.id }.toSet()
            currentLocalMg.forEach { mg ->
                if (mg.name.isNotBlank() && mg.name !in remoteMgNames) {
                    val safeId = sanitizeTrainingDocId(mg.name)
                    mgCollection.document(safeId).set(mapOf("name" to mg.name))
                }
            }
            val currentLocalMgNames = currentLocalMg.map { it.name }.toSet()
            val missingMg = remoteMgSnapshot.documents
                .mapNotNull { doc ->
                    val name = doc.getString("name") ?: doc.id
                    if (name.isNotBlank() && name !in currentLocalMgNames) MuscleGroup(name) else null
                }
            if (missingMg.isNotEmpty()) {
                muscleGroupDao.insertAll(missingMg)
            }

            // 2. Sync Exercises
            val exCollection = firestore.collection("training_exercises")
            val currentLocalEx = exerciseDao.getAllExercises().first()
            val remoteExSnapshot = exCollection.get().awaitTask()
            
            val remoteExNames = remoteExSnapshot.documents.mapNotNull { it.getString("name") ?: it.id }.toSet()
            currentLocalEx.forEach { ex ->
                if (ex.name.isNotBlank() && ex.name !in remoteExNames) {
                    val safeId = sanitizeTrainingDocId(ex.name)
                    exCollection.document(safeId).set(mapOf("name" to ex.name))
                }
            }
            val currentLocalExNames = currentLocalEx.map { it.name }.toSet()
            val missingEx = remoteExSnapshot.documents
                .mapNotNull { doc ->
                    val name = doc.getString("name") ?: doc.id
                    if (name.isNotBlank() && name !in currentLocalExNames) Exercise(name) else null
                }
            if (missingEx.isNotEmpty()) {
                exerciseDao.insertAll(missingEx)
            }
        } catch (e: Exception) {
            Log.e("DietRepository", "Sync Training Dictionaries failed", e)
        }
    }

    // --- Water Records ---
    fun getWaterRecordsForDate(date: String): Flow<List<WaterRecord>> {
        return waterRecordDao.getWaterRecordsForDate(date)
    }

    fun getAllWaterRecords(): Flow<List<WaterRecord>> {
        return waterRecordDao.getAllWaterRecords()
    }

    fun getTotalWaterForDate(date: String): Flow<Int?> {
        return waterRecordDao.getTotalWaterForDate(date)
    }

    suspend fun insertWaterRecord(record: WaterRecord) = withContext(Dispatchers.IO) {
        waterRecordDao.insertWaterRecord(record)
    }

    suspend fun deleteWaterRecord(record: WaterRecord) = withContext(Dispatchers.IO) {
        waterRecordDao.deleteWaterRecord(record)
    }
    
    // --- Weight Records ---
    fun getAllWeightRecords(): Flow<List<WeightRecord>> {
        return weightRecordDao.getAllWeightRecords()
    }

    fun getLatestWeightRecord(): Flow<WeightRecord?> {
        return weightRecordDao.getLatestWeightRecord()
    }

    suspend fun insertWeightRecord(record: WeightRecord): Long = withContext(Dispatchers.IO) {
        weightRecordDao.insertWeightRecord(record)
    }

    suspend fun updateWeightRecord(record: WeightRecord) = withContext(Dispatchers.IO) {
        weightRecordDao.updateWeightRecord(record)
    }

    suspend fun deleteWeightRecord(record: WeightRecord) = withContext(Dispatchers.IO) {
        weightRecordDao.deleteWeightRecord(record)
    }

    suspend fun deleteWeightRecordById(id: String) = withContext(Dispatchers.IO) {
        weightRecordDao.deleteWeightRecordById(id)
    }

    // --- Workout Records ---
    fun getWorkoutsWithExercises(): Flow<List<WorkoutWithExercises>> {
        return workoutDao.getWorkoutsWithExercises()
    }

    fun getWorkoutsWithExercisesByDate(date: String): Flow<List<WorkoutWithExercises>> {
        return workoutDao.getWorkoutsWithExercisesByDate(date)
    }

    suspend fun updateWorkout(workout: WorkoutRecord) = withContext(Dispatchers.IO) {
        workoutDao.updateWorkout(workout)
    }

    suspend fun insertWorkout(workout: WorkoutRecord, exercises: List<WorkoutExercise>) = withContext(Dispatchers.IO) {
        workoutDao.insertWorkout(workout)
        exercises.forEach { ex ->
            val copyEx = ex.copy(workoutId = workout.id)
            workoutDao.insertExercise(copyEx)
            // Generate default sets if sets > 0
            val numSets = if (ex.sets > 0) ex.sets else 3
            val defaultReps = if (ex.reps > 0) ex.reps else 10
            val defaultWeight = if (ex.weight > 0.0) ex.weight else 20.0
            val setsList = (1..numSets).map { i ->
                com.example.data.model.ExerciseSet(
                    exerciseId = copyEx.id,
                    setIndex = i,
                    reps = defaultReps,
                    weight = defaultWeight
                )
            }
            workoutDao.insertExerciseSets(setsList)
        }
    }

    suspend fun deleteWorkout(workout: WorkoutRecord) = withContext(Dispatchers.IO) {
        workoutDao.deleteWorkout(workout)
    }

    suspend fun deleteExercise(exercise: WorkoutExercise) = withContext(Dispatchers.IO) {
        workoutDao.deleteExercise(exercise)
    }

    suspend fun insertExercise(exercise: WorkoutExercise, initialSets: Int = 3, initialReps: Int = 10, initialWeight: Double = 20.0): String = withContext(Dispatchers.IO) {
        workoutDao.insertExercise(exercise)
        val numSets = if (initialSets > 0) initialSets else 3
        val setsList = (1..numSets).map { i ->
            com.example.data.model.ExerciseSet(
                exerciseId = exercise.id,
                setIndex = i,
                reps = initialReps,
                weight = initialWeight
            )
        }
        workoutDao.insertExerciseSets(setsList)
        exercise.id
    }

    suspend fun updateExercise(exercise: WorkoutExercise) = withContext(Dispatchers.IO) {
        workoutDao.updateExercise(exercise)
    }

    suspend fun insertExerciseSet(exerciseSet: com.example.data.model.ExerciseSet) = withContext(Dispatchers.IO) {
        workoutDao.insertExerciseSet(exerciseSet)
    }

    suspend fun updateExerciseSet(exerciseSet: com.example.data.model.ExerciseSet) = withContext(Dispatchers.IO) {
        workoutDao.updateExerciseSet(exerciseSet)
    }

    suspend fun deleteExerciseSet(exerciseSet: com.example.data.model.ExerciseSet) = withContext(Dispatchers.IO) {
        workoutDao.deleteExerciseSet(exerciseSet)
    }

    fun getUniqueBodyParts(): Flow<List<String>> = kotlinx.coroutines.flow.combine(
        workoutDao.getUniqueBodyParts(),
        muscleGroupDao.getAllMuscleGroups()
    ) { fromLogs, fromDict ->
        (fromLogs + fromDict.map { it.name }).distinct().sorted()
    }

    fun getUniqueExerciseNames(): Flow<List<String>> = kotlinx.coroutines.flow.combine(
        workoutDao.getUniqueExerciseNames(),
        exerciseDao.getAllExercises()
    ) { fromLogs, fromDict ->
        (fromLogs + fromDict.map { it.name }).distinct().sorted()
    }

    suspend fun getLastExerciseByName(name: String): WorkoutExercise? = withContext(Dispatchers.IO) {
        workoutDao.getLastExerciseByName(name)
    }

    fun getRecordsForDate(date: String): Flow<List<FoodRecord>> {
        return foodRecordDao.getRecordsByDate(date)
    }

    fun getAllRecords(): Flow<List<FoodRecord>> {
        return foodRecordDao.getAllRecords()
    }

    suspend fun insertFoodRecord(record: FoodRecord): Long = withContext(Dispatchers.IO) {
        foodRecordDao.insertRecord(record)
    }

    suspend fun updateFoodRecord(record: FoodRecord) = withContext(Dispatchers.IO) {
        foodRecordDao.updateRecord(record)
    }

    suspend fun deleteFoodRecord(record: FoodRecord) = withContext(Dispatchers.IO) {
        foodRecordDao.deleteRecord(record)
    }

    suspend fun deleteRecordById(id: String) = withContext(Dispatchers.IO) {
        foodRecordDao.deleteRecordById(id)
    }

    suspend fun deleteRecordsByMealType(mealType: com.example.data.model.MealType) = withContext(Dispatchers.IO) {
        foodRecordDao.deleteRecordsByMealType(mealType)
    }

    // --- Custom Foods (Local Memory) ---
    fun getAllCustomFoods(): Flow<List<CustomFood>> {
        return customFoodDao.getAllCustomFoods()
    }

    suspend fun getCustomFoodCount(): Int = withContext(Dispatchers.IO) {
        customFoodDao.getDistinctCustomFoodCount()
    }

    data class FoodImportSummary(
        val totalProcessed: Int,
        val newAdded: Int,
        val updated: Int,
        val skippedExisting: Int
    )

    suspend fun importCvsFoodsWithDeduplication(foods: List<CustomFood>): FoodImportSummary = withContext(Dispatchers.IO) {
        if (foods.isEmpty()) {
            return@withContext FoodImportSummary(0, 0, 0, 0)
        }

        // Clean up any historical database duplicates first
        try {
            customFoodDao.removeDuplicateCustomFoods()
        } catch (e: Exception) {
            // ignore
        }

        val existingCustomFoods = try {
            customFoodDao.getAllCustomFoods().first()
        } catch (e: Exception) {
            emptyList()
        }

        val presets = CommonFoodsDatabase.presetList

        fun normalizeBrand(brand: String): String {
            val b = brand.trim().lowercase()
            return when {
                b.contains("7-11") || b.contains("7-eleven") || b.contains("統一超商") || b.contains("seven") -> "7-11"
                b.contains("全家") || b.contains("familymart") || b.contains("family mart") -> "全家"
                b.contains("萊爾富") || b.contains("hilife") || b.contains("hi-life") -> "萊爾富"
                b.contains("ok") || b.contains("ok-mart") || b.contains("okmart") -> "OK超商"
                else -> brand.trim().lowercase()
            }
        }

        fun normalizeFoodName(name: String): String {
            var n = name.trim()
            n = n.replace(Regex("""^(\[.*?\]|【.*?】|7-11|7-ELEVEN|7-Eleven|全家|FamilyMart|\(.*?\)|\s+)+""", RegexOption.IGNORE_CASE), "")
            n = n.replace(Regex("""[（\(].*?[）\)]"""), "")
            n = n.replace("　", " ").replace("-", "").replace(" ", "").trim()
            return n.lowercase()
        }

        fun isSameFood(name1: String, brand1: String, barcode1: String?, name2: String, brand2: String, barcode2: String?): Boolean {
            if (!barcode1.isNullOrBlank() && !barcode2.isNullOrBlank()) {
                if (barcode1.trim() == barcode2.trim()) return true
            }
            val nb1 = normalizeBrand(brand1)
            val nb2 = normalizeBrand(brand2)
            val brandMatches = (nb1.isEmpty() || nb2.isEmpty() || nb1 == nb2)
            if (!brandMatches) return false

            val nn1 = normalizeFoodName(name1)
            val nn2 = normalizeFoodName(name2)
            if (nn1.isEmpty() || nn2.isEmpty()) return false

            if (nn1 == nn2) return true
            if (nn1.contains(nn2) || nn2.contains(nn1)) {
                if (Math.abs(nn1.length - nn2.length) <= 4) return true
            }
            return false
        }

        var addedCount = 0
        var updatedCount = 0
        var skippedCount = 0

        // Deduplicate within the incoming batch itself first
        val distinctIncoming = mutableListOf<CustomFood>()
        val seenIncomingKeys = HashSet<String>()
        for (f in foods) {
            val key = "${normalizeBrand(f.brand)}_${normalizeFoodName(f.name)}"
            if (seenIncomingKeys.add(key)) {
                distinctIncoming.add(f)
            }
        }

        val currentCustomList = existingCustomFoods.toMutableList()

        for (food in distinctIncoming) {
            // 1. Check if already exists in Room custom foods
            val existingCustom = currentCustomList.firstOrNull { 
                isSameFood(food.name, food.brand, food.barcode, it.name, it.brand, it.barcode)
            }

            if (existingCustom != null) {
                // Check if nutrition info is significantly different
                val calDiff = Math.abs(food.calories - existingCustom.calories)
                val carbDiff = Math.abs(food.carbs - existingCustom.carbs)
                val proDiff = Math.abs(food.protein - existingCustom.protein)
                val fatDiff = Math.abs(food.fat - existingCustom.fat)

                if (calDiff > 1.0 || carbDiff > 0.5 || proDiff > 0.5 || fatDiff > 0.5) {
                    val updatedFood = food.copy(
                        id = existingCustom.id,
                        updatedAt = System.currentTimeMillis()
                    )
                    customFoodDao.updateCustomFood(updatedFood)
                    val idx = currentCustomList.indexOf(existingCustom)
                    if (idx != -1) currentCustomList[idx] = updatedFood
                    updatedCount++
                } else {
                    skippedCount++
                }
                continue
            }

            // 2. Check if already exists in built-in presets (CommonFoodsDatabase)
            val existingPreset = presets.firstOrNull {
                isSameFood(food.name, food.brand, food.barcode, it.name, it.brand, it.barcode)
            }

            if (existingPreset != null) {
                // Already in local preset database - skip to prevent duplicate
                skippedCount++
                continue
            }

            // 3. New food - Insert into Room database
            val newId = customFoodDao.insertCustomFood(food.copy(updatedAt = System.currentTimeMillis()))
            currentCustomList.add(food.copy(id = newId))
            addedCount++
        }

        FoodImportSummary(
            totalProcessed = distinctIncoming.size,
            newAdded = addedCount,
            updated = updatedCount,
            skippedExisting = skippedCount
        )
    }

    suspend fun saveOrUpdateCustomFoods(foods: List<CustomFood>) = withContext(Dispatchers.IO) {
        importCvsFoodsWithDeduplication(foods)
    }

    suspend fun saveCustomFood(food: CustomFood): Long = withContext(Dispatchers.IO) {
        val existing = customFoodDao.getCustomFoodByNameAndBrand(food.name, food.brand)
        if (existing != null) {
            customFoodDao.updateCustomFood(food.copy(id = existing.id))
            existing.id
        } else {
            customFoodDao.insertCustomFood(food)
        }
    }

    suspend fun deleteCustomFood(id: String) = withContext(Dispatchers.IO) {
        customFoodDao.deleteCustomFoodById(id)
    }

    private fun normalizeText(text: String): String {
        return text.trim().lowercase()
            .replace("蕃", "番")
            .replace("臺", "台")
            .replace("麪", "麵")
            .replace("面", "麵")
    }

    suspend fun getLocalAndCustomFoods(query: String = ""): List<FoodSearchResult> = withContext(Dispatchers.IO) {
        val trimmed = query.trim().lowercase()

        // 1. Fetch user's personal custom foods from Room
        val customFoods = try {
            val allCustom = customFoodDao.getAllCustomFoods().first()
            if (trimmed.isBlank()) {
                allCustom
            } else {
                val queryNorm = normalizeText(trimmed)
                allCustom.filter { cf ->
                    normalizeText(cf.name).contains(queryNorm) || 
                    normalizeText(cf.brand).contains(queryNorm) ||
                    (cf.barcode != null && cf.barcode.contains(trimmed))
                }
            }
        } catch (e: Exception) {
            emptyList()
        }

        val customResults = customFoods.map { cf ->
            FoodSearchResult(
                id = "custom_${cf.id}",
                name = cf.name,
                brand = if (cf.brand.isNotBlank()) cf.brand else "我的常用自訂",
                caloriesPer100g = cf.caloriesPer100g,
                carbsPer100g = cf.carbsPer100g,
                sugarsPer100g = cf.sugarsPer100g,
                fiberPer100g = cf.fiberPer100g,
                proteinPer100g = cf.proteinPer100g,
                fatPer100g = cf.fatPer100g,
                sodiumPer100g = cf.sodiumPer100g,
                potassiumPer100g = cf.potassiumPer100g,
                defaultServingAmount = cf.defaultServingAmount,
                servingUnit = cf.servingUnit,
                servingSizeText = cf.servingSizeText,
                imageUrl = cf.imageUrl,
                isLocalPreset = false,
                isUserCustom = true,
                barcode = cf.barcode
            )
        }

        // 2. Fetch presets (TFDA official, convenience stores, and staples)
        val presetResults = if (trimmed.isBlank()) {
            CommonFoodsDatabase.presetList
        } else {
            val queryNorm = normalizeText(trimmed)
            CommonFoodsDatabase.presetList.filter {
                normalizeText(it.name).contains(queryNorm) || 
                normalizeText(it.brand).contains(queryNorm) ||
                (it.barcode != null && it.barcode.contains(trimmed))
            }
        }

        // Deduplicate: User custom foods appear first, followed by unique presets
        val seenKeys = HashSet<String>()
        val mergedList = mutableListOf<FoodSearchResult>()

        for (item in customResults) {
            val key = "${item.brand.trim().lowercase()}_${item.name.trim().lowercase()}"
            if (seenKeys.add(key)) {
                mergedList.add(item)
            }
        }

        for (item in presetResults) {
            val key = "${item.brand.trim().lowercase()}_${item.name.trim().lowercase()}"
            if (seenKeys.add(key)) {
                mergedList.add(item)
            }
        }

        mergedList
    }

    // --- Gemini AI Estimation ---
    suspend fun generateWorkoutExercises(bodyPart: String, userApiKey: String? = null): Result<GeminiResponse<List<String>>> {
        return GeminiNutritionEstimator.generateWorkoutExercises(bodyPart, userApiKey)
    }

    suspend fun generateRawContentWithGemini(prompt: String, userApiKey: String? = null): Result<GeminiResponse<String>> {
        return GeminiNutritionEstimator.generateRawContent(prompt, userApiKey)
    }

    suspend fun estimateWithGemini(query: String, userApiKey: String? = null): Result<GeminiResponse<AiEstimatedNutrition>> {
        return GeminiNutritionEstimator.estimateNutrition(query, userApiKey)
    }

    suspend fun estimateWithGeminiImage(bitmap: android.graphics.Bitmap, userApiKey: String? = null): Result<GeminiResponse<AiEstimatedNutrition>> {
        return GeminiNutritionEstimator.analyzeImageNutrition(bitmap, userApiKey)
    }

    // --- Open Food Facts Online Search ---
    suspend fun searchOpenFoodFacts(query: String): Result<List<FoodSearchResult>> =
        withContext(Dispatchers.IO) {
            val trimmed = query.trim()
            if (trimmed.isBlank()) {
                return@withContext Result.success(emptyList())
            }

            var lastError: Exception? = null
            var products: List<ProductDto>? = null

            // 1. Try Primary Mirror Server (.net)
            try {
                val response = OpenFoodFactsClient.primaryService.searchProducts(
                    searchTerms = trimmed,
                    pageSize = 30
                )
                products = response.products
            } catch (e: Exception) {
                lastError = e
            }

            // 2. Try Backup Server (.org) if needed
            if (products == null || products.isEmpty()) {
                try {
                    val backupResponse = OpenFoodFactsClient.backupService.searchProducts(
                        searchTerms = trimmed,
                        pageSize = 30
                    )
                    products = backupResponse.products
                } catch (e: Exception) {
                    if (lastError == null) lastError = e
                }
            }

            if (products != null && products.isNotEmpty()) {
                val results = products
                    .filter {
                        val name = it.getResolvedName()
                        name.isNotBlank() && !name.startsWith("未命名")
                    }
                    .map { product ->
                        FoodSearchResult(
                            id = "off_${product.getResolvedCode().ifEmpty { System.currentTimeMillis().toString() }}_${product.hashCode()}",
                            name = product.getResolvedName(),
                            brand = product.brands.orEmpty().take(30),
                            caloriesPer100g = product.getCaloriesPer100g(),
                            carbsPer100g = product.getCarbsPer100g(),
                            sugarsPer100g = product.getSugarsPer100g(),
                            fiberPer100g = product.getFiberPer100g(),
                            proteinPer100g = product.getProteinPer100g(),
                            fatPer100g = product.getFatPer100g(),
                            sodiumPer100g = product.getSodiumPer100g(),
                            potassiumPer100g = product.getPotassiumPer100g(),
                            defaultServingAmount = product.getServingQuantityDouble(),
                            servingUnit = "g",
                            servingSizeText = product.servingSize,
                            imageUrl = product.imageFrontSmallUrl ?: product.imageUrl,
                            isLocalPreset = false,
                            isUserCustom = false,
                            barcode = product.getResolvedCode()
                        )
                    }

                return@withContext Result.success(results)
            }

            // Fallback: check local presets
            val localMatches = getLocalAndCustomFoods(trimmed)
            if (localMatches.isNotEmpty()) {
                return@withContext Result.success(localMatches)
            }

            if (lastError != null) {
                Result.failure(lastError)
            } else {
                Result.success(emptyList())
            }
        }

    // --- Barcode Lookup (Local + Open Food Facts API) ---
    suspend fun searchByBarcode(barcode: String): Result<FoodSearchResult> = withContext(Dispatchers.IO) {
        val cleanCode = barcode.trim()
        if (cleanCode.isBlank()) {
            return@withContext Result.failure(Exception("請輸入有效的商品條碼"))
        }

        // 1. Check local pre-seeded store foods and user custom foods first
        val localAndCustom = getLocalAndCustomFoods("")
        val matchedLocal = localAndCustom.firstOrNull { it.barcode == cleanCode }
        if (matchedLocal != null) {
            return@withContext Result.success(matchedLocal)
        }

        // 2. Fetch from Open Food Facts API
        try {
            val response = OpenFoodFactsClient.primaryService.getProductByBarcode(cleanCode)
            val product = response.product
            if (response.status == 1 && product != null) {
                val result = FoodSearchResult(
                    id = "off_${product.getResolvedCode().ifEmpty { cleanCode }}",
                    name = product.getResolvedName(),
                    brand = product.brands.orEmpty().take(30).ifBlank { "條碼查詢" },
                    caloriesPer100g = product.getCaloriesPer100g(),
                    carbsPer100g = product.getCarbsPer100g(),
                    sugarsPer100g = product.getSugarsPer100g(),
                    fiberPer100g = product.getFiberPer100g(),
                    proteinPer100g = product.getProteinPer100g(),
                    fatPer100g = product.getFatPer100g(),
                    sodiumPer100g = product.getSodiumPer100g(),
                    potassiumPer100g = product.getPotassiumPer100g(),
                    defaultServingAmount = product.getServingQuantityDouble(),
                    servingUnit = "g",
                    servingSizeText = product.servingSize ?: "1份 (100g)",
                    imageUrl = product.imageFrontSmallUrl ?: product.imageUrl,
                    isLocalPreset = false,
                    isUserCustom = false,
                    barcode = cleanCode
                )
                return@withContext Result.success(result)
            }
        } catch (e: Exception) {
            // Backup service attempt
            try {
                val backupResp = OpenFoodFactsClient.backupService.getProductByBarcode(cleanCode)
                val p = backupResp.product
                if (backupResp.status == 1 && p != null) {
                    val result = FoodSearchResult(
                        id = "off_${p.getResolvedCode().ifEmpty { cleanCode }}",
                        name = p.getResolvedName(),
                        brand = p.brands.orEmpty().take(30).ifBlank { "條碼查詢" },
                        caloriesPer100g = p.getCaloriesPer100g(),
                        carbsPer100g = p.getCarbsPer100g(),
                        sugarsPer100g = p.getSugarsPer100g(),
                        fiberPer100g = p.getFiberPer100g(),
                        proteinPer100g = p.getProteinPer100g(),
                        fatPer100g = p.getFatPer100g(),
                        sodiumPer100g = p.getSodiumPer100g(),
                        potassiumPer100g = p.getPotassiumPer100g(),
                        defaultServingAmount = p.getServingQuantityDouble(),
                        servingUnit = "g",
                        servingSizeText = p.servingSize ?: "1份 (100g)",
                        imageUrl = p.imageFrontSmallUrl ?: p.imageUrl,
                        isLocalPreset = false,
                        isUserCustom = false,
                        barcode = cleanCode
                    )
                    return@withContext Result.success(result)
                }
            } catch (e2: Exception) {
                // Ignore backup error
            }
        }

        Result.failure(Exception("未在資料庫找到與條碼「$cleanCode」符合的超商商品，您可以直接使用自訂 / AI 建立此商品！"))
    }

    private suspend fun <T> com.google.android.gms.tasks.Task<T>.awaitTask(): T = kotlinx.coroutines.suspendCancellableCoroutine { cont ->
        addOnCompleteListener { task ->
            if (task.isSuccessful) {
                cont.resumeWith(Result.success(task.result))
            } else {
                cont.resumeWith(Result.failure(task.exception ?: Exception("Task failed")))
            }
        }
    }

    suspend fun syncAllFoodsWithCloud(): Result<Pair<Int, Int>> = withContext(Dispatchers.IO) {
        try {
            kotlinx.coroutines.withTimeout(60000) { // 60 seconds timeout for comprehensive dataset
                val firestore = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                val collectionRef = firestore.collection("shared_custom_foods")

                // Clean up any duplicates in local SQLite database first
                customFoodDao.removeDuplicateCustomFoods()

                // 1. Gather all local foods (Presets including TFDA + 7-Eleven + FamilyMart + Staples, plus user custom foods)
                val localFoodsMap = mutableMapOf<String, CustomFood>()

                // Built-in presets mapped to CustomFood format
                val presetFoods = com.example.data.model.CommonFoodsDatabase.presetList.map { p ->
                    CustomFood(
                        id = 0,
                        name = p.name,
                        brand = p.brand,
                        caloriesPer100g = p.caloriesPer100g,
                        carbsPer100g = p.carbsPer100g,
                        sugarsPer100g = p.sugarsPer100g,
                        fiberPer100g = p.fiberPer100g,
                        proteinPer100g = p.proteinPer100g,
                        fatPer100g = p.fatPer100g,
                        sodiumPer100g = p.sodiumPer100g,
                        potassiumPer100g = p.potassiumPer100g,
                        defaultServingAmount = p.defaultServingAmount,
                        servingUnit = p.servingUnit,
                        servingSizeText = p.servingSizeText,
                        imageUrl = p.imageUrl,
                        barcode = p.barcode,
                        updatedAt = 1710000000000L
                    )
                }

                for (food in presetFoods) {
                    val key = "${food.brand.trim().lowercase()}_${food.name.trim().lowercase()}"
                    localFoodsMap[key] = food
                }

                // User custom foods from Room (overrides base preset timestamps if newer)
                val userFoods = customFoodDao.getAllCustomFoods().first()
                for (food in userFoods) {
                    val key = "${food.brand.trim().lowercase()}_${food.name.trim().lowercase()}"
                    localFoodsMap[key] = food
                }

                // 2. Fetch all shared custom foods from Cloud Firestore using awaitTask
                val cloudSnapshot = collectionRef.get().awaitTask()
                val cloudFoodsMap = mutableMapOf<String, CustomFood>()

                for (doc in cloudSnapshot.documents) {
                    val name = doc.getString("name") ?: continue
                    val brand = doc.getString("brand") ?: ""
                    val caloriesPer100g = doc.getDouble("caloriesPer100g") ?: 0.0
                    val carbsPer100g = doc.getDouble("carbsPer100g") ?: 0.0
                    val sugarsPer100g = doc.getDouble("sugarsPer100g") ?: 0.0
                    val fiberPer100g = doc.getDouble("fiberPer100g") ?: 0.0
                    val proteinPer100g = doc.getDouble("proteinPer100g") ?: 0.0
                    val fatPer100g = doc.getDouble("fatPer100g") ?: 0.0
                    val sodiumPer100g = doc.getDouble("sodiumPer100g") ?: 0.0
                    val potassiumPer100g = doc.getDouble("potassiumPer100g") ?: 0.0
                    val defaultServingAmount = doc.getDouble("defaultServingAmount") ?: 100.0
                    val servingUnit = doc.getString("servingUnit") ?: "g"
                    val servingSizeText = doc.getString("servingSizeText")
                    val imageUrl = doc.getString("imageUrl")
                    val barcode = doc.getString("barcode")
                    val updatedAt = doc.getLong("updatedAt") ?: 0L

                    val cloudFood = CustomFood(
                        id = 0,
                        name = name,
                        brand = brand,
                        caloriesPer100g = caloriesPer100g,
                        carbsPer100g = carbsPer100g,
                        sugarsPer100g = sugarsPer100g,
                        fiberPer100g = fiberPer100g,
                        proteinPer100g = proteinPer100g,
                        fatPer100g = fatPer100g,
                        sodiumPer100g = sodiumPer100g,
                        potassiumPer100g = potassiumPer100g,
                        defaultServingAmount = defaultServingAmount,
                        servingUnit = servingUnit,
                        servingSizeText = servingSizeText,
                        imageUrl = imageUrl,
                        barcode = barcode,
                        updatedAt = updatedAt
                    )
                    val key = "${brand.trim().lowercase()}_${name.trim().lowercase()}"
                    cloudFoodsMap[key] = cloudFood
                }

                var uploadedCount = 0
                var downloadedCount = 0

                // 3. Bidirectional Sync
                // A. Upload missing or newer local foods to Firestore using Batched Writes
                var batch = firestore.batch()
                var batchCount = 0

                for ((key, localFood) in localFoodsMap) {
                    val docId = key.replace("/", "_").replace(".", "_").replace(" ", "_").replace("?", "_").replace("#", "_").replace("(", "_").replace(")", "_").replace("[", "_").replace("]", "_")
                    val cloudFood = cloudFoodsMap[key]

                    if (cloudFood == null || localFood.updatedAt > cloudFood.updatedAt) {
                        val docMap = hashMapOf(
                            "name" to localFood.name,
                            "brand" to localFood.brand,
                            "caloriesPer100g" to localFood.caloriesPer100g,
                            "carbsPer100g" to localFood.carbsPer100g,
                            "sugarsPer100g" to localFood.sugarsPer100g,
                            "fiberPer100g" to localFood.fiberPer100g,
                            "proteinPer100g" to localFood.proteinPer100g,
                            "fatPer100g" to localFood.fatPer100g,
                            "sodiumPer100g" to localFood.sodiumPer100g,
                            "potassiumPer100g" to localFood.potassiumPer100g,
                            "defaultServingAmount" to localFood.defaultServingAmount,
                            "servingUnit" to localFood.servingUnit,
                            "servingSizeText" to localFood.servingSizeText,
                            "imageUrl" to localFood.imageUrl,
                            "barcode" to localFood.barcode,
                            "updatedAt" to localFood.updatedAt
                        )
                        val docRef = collectionRef.document(docId)
                        batch.set(docRef, docMap)
                        uploadedCount++
                        batchCount++

                        if (batchCount >= 400) {
                            batch.commit().awaitTask()
                            batch = firestore.batch()
                            batchCount = 0
                        }
                    }
                }

                if (batchCount > 0) {
                    batch.commit().awaitTask()
                }

                // B. Download new or updated cloud foods into local SQLite Room database
                val presetFoodKeys = presetFoods.map { "${it.brand.trim().lowercase()}_${it.name.trim().lowercase()}" }.toHashSet()
                val userFoodMap = userFoods.associateBy { "${it.brand.trim().lowercase()}_${it.name.trim().lowercase()}" }

                val toInsert = mutableListOf<CustomFood>()
                val toUpdate = mutableListOf<CustomFood>()

                for ((key, cloudFood) in cloudFoodsMap) {
                    val localExisting = userFoodMap[key]
                    if (localExisting == null) {
                        if (!presetFoodKeys.contains(key)) {
                            toInsert.add(cloudFood)
                            downloadedCount++
                        }
                    } else if (cloudFood.updatedAt > localExisting.updatedAt) {
                        toUpdate.add(cloudFood.copy(id = localExisting.id))
                        downloadedCount++
                    }
                }

                if (toInsert.isNotEmpty()) {
                    customFoodDao.insertCustomFoods(toInsert)
                }
                for (food in toUpdate) {
                    customFoodDao.updateCustomFood(food)
                }

                // Final deduplication guarantee
                customFoodDao.removeDuplicateCustomFoods()

                Result.success(Pair(uploadedCount, downloadedCount))
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            Result.failure(Exception("連線逾時！請確認您的網路連線與 Firebase 設置。"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
