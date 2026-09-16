import { getTodayString } from './dateUtils';

export function generateFullAppExportHtml(exportData: any): string {
  const jsonString = JSON.stringify(exportData);
  const exportedAtStr = new Date().toLocaleString('zh-TW');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FitPocket 完整記錄離線報表</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#F4F8F5',
              100: '#E2EBE5',
              500: '#10B981',
              600: '#059669',
              700: '#046A42',
              800: '#064E3B',
              900: '#022C22',
            }
          }
        }
      }
    }
  </script>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: #fff !important; }
      .card-box { border: 1px solid #cbd5e1 !important; shadow: none !important; }
    }
  </style>
</head>
<body class="bg-[#F7FAF7] text-slate-800 antialiased min-h-screen pb-16">

  <!-- Header -->
  <header class="bg-white/90 backdrop-blur-md border-b border-emerald-900/10 sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Logo SVG -->
        <svg width="40" height="40" viewBox="0 0 512 512" class="rounded-2xl">
          <rect x="0" y="0" width="512" height="512" rx="128" fill="#E8F2EC" />
          <path d="M 125 170 H 225 C 236 170 245 179 245 190 C 245 201 236 210 225 210 H 167 V 238 H 215 C 226 238 235 247 235 258 C 235 269 226 278 215 278 H 167 V 332 C 167 343 158 352 146 352 C 134 352 125 343 125 332 V 170 Z" fill="#0F172A" />
          <path d="M 270 170 H 345 C 380 170 405 192 405 224 C 405 256 380 278 345 278 H 312 V 332 C 312 343 303 352 291 352 C 279 352 270 343 270 332 V 170 Z M 312 210 V 238 H 342 C 353 238 362 232 362 224 C 362 216 353 210 342 210 H 312 Z" fill="#0F172A" />
        </svg>
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">FitPocket</h1>
          <p class="text-xs text-slate-500 font-medium">完整歷史記錄備份 ‧ 匯出於 ${exportedAtStr}</p>
        </div>
      </div>
      <button onclick="window.print()" class="no-print text-xs font-semibold px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition">
        🖨️ 列印 / 另存 PDF
      </button>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-4xl mx-auto px-4 pt-6 space-y-6">

    <!-- Date Picker Bar -->
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-emerald-900/10 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-slate-700">📅 選擇查看日期：</span>
        <input type="date" id="datePicker" onchange="setDate(this.value)" class="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <div class="flex items-center gap-2">
        <button onclick="prevDate()" class="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200">◀ 前一天</button>
        <button onclick="todayDate()" class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700">今天</button>
        <button onclick="nextDate()" class="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200">後一天 ▶</button>
        <button onclick="showAllDates()" class="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900">顯示全部</button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1 no-print">
      <button id="tab-diet" onclick="switchTab('diet')" class="px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 border-emerald-600 text-emerald-800 bg-white">
        🥗 飲食與水分
      </button>
      <button id="tab-workout" onclick="switchTab('workout')" class="px-4 py-2 text-sm font-bold rounded-t-xl text-slate-500 hover:text-slate-800">
        🏋️ 訓練與健身
      </button>
      <button id="tab-weight" onclick="switchTab('weight')" class="px-4 py-2 text-sm font-bold rounded-t-xl text-slate-500 hover:text-slate-800">
        ⚖️ 體重與目標
      </button>
      <button id="tab-overview" onclick="switchTab('overview')" class="px-4 py-2 text-sm font-bold rounded-t-xl text-slate-500 hover:text-slate-800">
        📊 完整歷史清單
      </button>
    </nav>

    <!-- Tab 1: Diet & Water -->
    <section id="view-diet" class="space-y-6">
      <!-- Summary Card -->
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-black text-slate-900 flex items-center gap-2">
            🔥 每日熱量與三大營養素 (<span id="diet-date-display">--</span>)
          </h2>
          <span id="diet-status-badge" class="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">正常</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div class="bg-slate-50 p-3 rounded-2xl">
            <p class="text-xs text-slate-500 font-semibold mb-1">總攝取熱量</p>
            <p class="text-xl font-black text-emerald-700"><span id="total-calories">0</span> <span class="text-xs font-medium text-slate-500">kcal</span></p>
            <p class="text-[10px] text-slate-400 mt-1">目標: <span id="target-calories">2000</span> kcal</p>
          </div>
          <div class="bg-amber-50/60 p-3 rounded-2xl">
            <p class="text-xs text-amber-700 font-semibold mb-1">碳水化合物</p>
            <p class="text-lg font-bold text-amber-800"><span id="total-carbs">0</span> <span class="text-xs font-normal">g</span></p>
            <div class="w-full bg-amber-100 rounded-full h-1.5 mt-2">
              <div id="bar-carbs" class="bg-amber-500 h-1.5 rounded-full" style="width: 0%"></div>
            </div>
          </div>
          <div class="bg-blue-50/60 p-3 rounded-2xl">
            <p class="text-xs text-blue-700 font-semibold mb-1">蛋白質</p>
            <p class="text-lg font-bold text-blue-800"><span id="total-protein">0</span> <span class="text-xs font-normal">g</span></p>
            <div class="w-full bg-blue-100 rounded-full h-1.5 mt-2">
              <div id="bar-protein" class="bg-blue-500 h-1.5 rounded-full" style="width: 0%"></div>
            </div>
          </div>
          <div class="bg-rose-50/60 p-3 rounded-2xl">
            <p class="text-xs text-rose-700 font-semibold mb-1">脂肪</p>
            <p class="text-lg font-bold text-rose-800"><span id="total-fat">0</span> <span class="text-xs font-normal">g</span></p>
            <div class="w-full bg-rose-100 rounded-full h-1.5 mt-2">
              <div id="bar-fat" class="bg-rose-500 h-1.5 rounded-full" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- Water Progress -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700 flex items-center gap-1">💧 當日飲水量:</span>
          <span class="font-extrabold text-blue-600"><span id="water-intake">0</span> / <span id="water-goal">2000</span> ml</span>
        </div>
      </div>

      <!-- Meal Records List -->
      <div class="space-y-4" id="meals-container">
        <!-- JS rendered meals -->
      </div>
    </section>

    <!-- Tab 2: Workout -->
    <section id="view-workout" class="space-y-6 hidden">
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10">
        <h2 class="text-base font-black text-slate-900 mb-4 flex items-center justify-between">
          <span>🏋️ 健身訓練日誌 (<span id="workout-date-display">--</span>)</span>
          <span id="workout-count-badge" class="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full">0 項訓練</span>
        </h2>
        <div id="workouts-container" class="space-y-4">
          <!-- JS rendered workouts -->
        </div>
      </div>
    </section>

    <!-- Tab 3: Weight -->
    <section id="view-weight" class="space-y-6 hidden">
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 space-y-6">
        <h2 class="text-base font-black text-slate-900 flex items-center justify-between">
          <span>⚖️ 體重與健康指標</span>
        </h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div class="bg-slate-50 p-4 rounded-2xl">
            <p class="text-xs text-slate-500 font-semibold mb-1">最新體重</p>
            <p class="text-2xl font-black text-slate-800"><span id="latest-weight">--</span> <span class="text-xs font-medium">kg</span></p>
          </div>
          <div class="bg-slate-50 p-4 rounded-2xl">
            <p class="text-xs text-slate-500 font-semibold mb-1">目標體重</p>
            <p class="text-2xl font-black text-emerald-700"><span id="target-weight">--</span> <span class="text-xs font-medium">kg</span></p>
          </div>
          <div class="bg-slate-50 p-4 rounded-2xl">
            <p class="text-xs text-slate-500 font-semibold mb-1">計算 BMI</p>
            <p class="text-2xl font-black text-blue-700"><span id="calculated-bmi">--</span></p>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-bold text-slate-800 mb-3">體重紀錄列表</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr class="bg-slate-100 font-bold text-slate-800">
                  <th class="p-3 rounded-l-xl">日期</th>
                  <th class="p-3">體重 (kg)</th>
                  <th class="p-3">體脂率 (%)</th>
                  <th class="p-3 rounded-r-xl">備註</th>
                </tr>
              </thead>
              <tbody id="weight-records-body">
                <!-- JS rendered -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Tab 4: Overview -->
    <section id="view-overview" class="space-y-6 hidden">
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 space-y-4">
        <h2 class="text-base font-black text-slate-900 flex items-center justify-between">
          <span>📊 完整歷史飲食總表</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-700 border-collapse">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-800">
                <th class="p-2.5 rounded-l-lg">日期</th>
                <th class="p-2.5">餐別</th>
                <th class="p-2.5">食物名稱</th>
                <th class="p-2.5">份量</th>
                <th class="p-2.5">熱量</th>
                <th class="p-2.5">碳水</th>
                <th class="p-2.5">蛋白</th>
                <th class="p-2.5 rounded-r-lg">脂肪</th>
              </tr>
            </thead>
            <tbody id="all-food-body">
              <!-- JS rendered -->
            </tbody>
          </table>
        </div>
      </div>
    </section>

  </main>

  <!-- Embed Data Script -->
  <script>
    const APP_DATA = ${jsonString};

    let currentDate = "${getTodayString()}";
    let isAllDates = false;

    // Default User Profile Targets
    const profile = APP_DATA.userProfile || {};
    const targetCal = profile.targetCalories || 2000;
    const targetProtein = profile.targetProtein || 120;
    const targetFat = profile.targetFat || 50;
    const targetCarbs = profile.targetCarbs || 250;
    const waterGoal = APP_DATA.waterGoal || 2000;

    document.getElementById('target-calories').textContent = targetCal;
    document.getElementById('water-goal').textContent = waterGoal;

    function init() {
      const picker = document.getElementById('datePicker');
      picker.value = currentDate;
      renderAll();
    }

    function setDate(val) {
      if (!val) return;
      currentDate = val;
      isAllDates = false;
      renderAll();
    }

    function prevDate() {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      currentDate = d.toISOString().split('T')[0];
      document.getElementById('datePicker').value = currentDate;
      isAllDates = false;
      renderAll();
    }

    function nextDate() {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      currentDate = d.toISOString().split('T')[0];
      document.getElementById('datePicker').value = currentDate;
      isAllDates = false;
      renderAll();
    }

    function todayDate() {
      currentDate = "${getTodayString()}";
      document.getElementById('datePicker').value = currentDate;
      isAllDates = false;
      renderAll();
    }

    function showAllDates() {
      isAllDates = true;
      renderAll();
    }

    function switchTab(tab) {
      ['diet', 'workout', 'weight', 'overview'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const view = document.getElementById('view-' + t);
        if (t === tab) {
          btn.className = "px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 border-emerald-600 text-emerald-800 bg-white";
          view.classList.remove('hidden');
        } else {
          btn.className = "px-4 py-2 text-sm font-bold rounded-t-xl text-slate-500 hover:text-slate-800";
          view.classList.add('hidden');
        }
      });
    }

    function renderAll() {
      document.getElementById('diet-date-display').textContent = isAllDates ? "全部歷史紀錄" : currentDate;
      document.getElementById('workout-date-display').textContent = isAllDates ? "全部歷史紀錄" : currentDate;

      renderDiet();
      renderWorkouts();
      renderWeight();
      renderOverview();
    }

    function renderDiet() {
      const foods = (APP_DATA.foodRecords || []).filter(r => isAllDates || r.date === currentDate);
      
      let cal = 0, carbs = 0, pro = 0, fat = 0;
      foods.forEach(f => {
        cal += (f.calories || 0);
        carbs += (f.carbs || 0);
        pro += (f.protein || 0);
        fat += (f.fat || 0);
      });

      document.getElementById('total-calories').textContent = Math.round(cal);
      document.getElementById('total-carbs').textContent = Math.round(carbs);
      document.getElementById('total-protein').textContent = Math.round(pro);
      document.getElementById('total-fat').textContent = Math.round(fat);

      document.getElementById('bar-carbs').style.width = Math.min(100, Math.round((carbs / targetCarbs) * 100)) + '%';
      document.getElementById('bar-protein').style.width = Math.min(100, Math.round((pro / targetProtein) * 100)) + '%';
      document.getElementById('bar-fat').style.width = Math.min(100, Math.round((fat / targetFat) * 100)) + '%';

      // Water
      const waterEntry = (APP_DATA.waterRecords || []).find(w => w.date === currentDate);
      document.getElementById('water-intake').textContent = waterEntry ? waterEntry.amountMl : 0;

      // Group by Meals
      const mealsContainer = document.getElementById('meals-container');
      if (foods.length === 0) {
        mealsContainer.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">此日期尚無飲食記錄</div>';
        return;
      }

      const mealTypes = ['早餐', '午餐', '晚餐', '點心', '運動前/後'];
      let html = '';

      mealTypes.forEach(m => {
        const mFoods = foods.filter(f => f.mealType === m);
        if (mFoods.length > 0) {
          const mCal = mFoods.reduce((acc, x) => acc + (x.calories || 0), 0);
          html += \`
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <span class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span> \${m}
                </span>
                <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">\${Math.round(mCal)} kcal</span>
              </div>
              <div class="space-y-2">
                \${mFoods.map(item => \`
                  <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-none">
                    <div>
                      <span class="font-bold text-slate-800">\${item.name}</span>
                      <span class="text-slate-400 ml-1">(\${item.loggedAmount || ''}\${item.loggedUnit || ''})</span>
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-slate-700">\${item.calories} kcal</span>
                      <div class="text-[10px] text-slate-400">碳\${item.carbs}g ‧ 蛋\${item.protein}g ‧ 脂\${item.fat}g</div>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>
          \`;
        }
      });

      mealsContainer.innerHTML = html;
    }

    function renderWorkouts() {
      const workouts = (APP_DATA.workoutRecords || []).filter(w => isAllDates || w.date === currentDate);
      const container = document.getElementById('workouts-container');
      document.getElementById('workout-count-badge').textContent = workouts.length + ' 項訓練';

      if (workouts.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">此日期尚無健身記錄</div>';
        return;
      }

      let html = '';
      workouts.forEach(w => {
        html += \`
          <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">\${w.bodyPart || '訓練'}</span>
              <span class="text-xs text-slate-400 font-medium">\${w.date}</span>
            </div>
            <div class="space-y-2">
              \${(w.exercises || []).map(ex => \`
                <div class="bg-white p-3 rounded-xl border border-slate-200/50 space-y-1.5">
                  <p class="font-extrabold text-xs text-slate-800">\${ex.name}</p>
                  <div class="flex flex-wrap gap-2 text-[11px]">
                    \${(ex.sets || []).map((s, idx) => \`
                      <span class="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                        第\${idx+1}組: \${s.weightKg}kg × \${s.reps}次
                      </span>
                    \`).join('')}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      });

      container.innerHTML = html;
    }

    function renderWeight() {
      const weights = APP_DATA.weightRecords || [];
      const tbody = document.getElementById('weight-records-body');

      if (weights.length > 0) {
        const latest = weights[weights.length - 1];
        document.getElementById('latest-weight').textContent = latest.weightKg;
        if (profile.heightCm) {
          const hM = profile.heightCm / 100;
          const bmi = (latest.weightKg / (hM * hM)).toFixed(1);
          document.getElementById('calculated-bmi').textContent = bmi;
        }
      }

      if (profile.targetWeightKg) {
        document.getElementById('target-weight').textContent = profile.targetWeightKg;
      }

      if (weights.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-400">尚未記錄體重數據</td></tr>';
        return;
      }

      tbody.innerHTML = weights.map(w => \`
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="p-3 font-semibold text-slate-800">\${w.date}</td>
          <td class="p-3 font-bold text-emerald-700">\${w.weightKg} kg</td>
          <td class="p-3 font-medium text-slate-600">\${w.bodyFatPercentage ? w.bodyFatPercentage + '%' : '-'}</td>
          <td class="p-3 text-slate-400 font-normal">\${w.notes || '-'}</td>
        </tr>
      \`).join('');
    }

    function renderOverview() {
      const foods = APP_DATA.foodRecords || [];
      const tbody = document.getElementById('all-food-body');

      if (foods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400">尚無任何飲食紀錄</td></tr>';
        return;
      }

      tbody.innerHTML = foods.map(f => \`
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="p-2.5 font-medium text-slate-500">\${f.date}</td>
          <td class="p-2.5"><span class="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">\${f.mealType}</span></td>
          <td class="p-2.5 font-bold text-slate-800">\${f.name}</td>
          <td class="p-2.5 text-slate-500">\${f.loggedAmount || ''}\${f.loggedUnit || ''}</td>
          <td class="p-2.5 font-bold text-emerald-700">\${f.calories}</td>
          <td class="p-2.5 text-amber-700 font-medium">\${f.carbs}g</td>
          <td class="p-2.5 text-blue-700 font-medium">\${f.protein}g</td>
          <td class="p-2.5 text-rose-700 font-medium">\${f.fat}g</td>
        </tr>
      \`).join('');
    }

    // Launch
    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}
