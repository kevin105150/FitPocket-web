import { getTodayString } from './dateUtils';

export function generateFullAppExportHtml(exportData: any): string {
  const jsonString = JSON.stringify(exportData);
  const exportedAtStr = new Date().toLocaleString('zh-TW');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FitPocket 完整健康記錄離線備份</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            emerald: {
              50: '#ecfdf5',
              100: '#d1fae5',
              600: '#059669',
              700: '#046a42',
              800: '#064e3b',
              900: '#022c22',
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
      .shadow-sm, .shadow-md, .shadow-xl { box-shadow: none !important; }
    }
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="bg-[#F7FAF7] text-slate-800 antialiased min-h-screen pb-16 selection:bg-emerald-500 selection:text-white">

  <!-- Main App Header -->
  <header class="bg-white/90 backdrop-blur-md border-b border-emerald-900/10 sticky top-0 z-50">
    <div class="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Exact FP Logo SVG -->
        <svg width="36" height="36" viewBox="0 0 512 512" class="rounded-2xl shrink-0">
          <rect x="0" y="0" width="512" height="512" rx="128" fill="#E8F2EC"/>
          <path d="M 125 170 H 225 C 236 170 245 179 245 190 C 245 201 236 210 225 210 H 167 V 238 H 215 C 226 238 235 247 235 258 C 235 269 226 278 215 278 H 167 V 332 C 167 343 158 352 146 352 C 134 352 125 343 125 332 V 170 Z" fill="#0F172A"/>
          <path d="M 270 170 H 345 C 380 170 405 192 405 224 C 405 256 380 278 345 278 H 312 V 332 C 312 343 303 352 291 352 C 279 352 270 343 270 332 V 170 Z M 312 210 V 238 H 342 C 353 238 362 232 362 224 C 362 216 353 210 342 210 H 312 Z" fill="#0F172A"/>
        </svg>
        <div>
          <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">FitPocket</h1>
          <p class="text-[11px] text-slate-500 font-medium">完整歷史記錄備份 ‧ 匯出於 ${exportedAtStr}</p>
        </div>
      </div>
      <button onclick="window.print()" class="no-print text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100 transition border border-emerald-200">
        🖨️ 列印 / PDF
      </button>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-2xl mx-auto px-4 py-5 space-y-4">

    <!-- Date Navigator Card (Identical to DateNavigator.tsx) -->
    <div class="bg-white rounded-2xl shadow-xs border border-emerald-900/5 p-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onclick="prevDay()"
        class="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
        aria-label="前一天"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>

      <div class="flex items-center gap-2 min-w-0">
        <label class="relative flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer min-w-0">
          <svg class="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span id="date-display" class="font-semibold text-slate-800 text-xs sm:text-sm truncate">--</span>
          <input
            type="date"
            id="datePicker"
            onchange="setDate(this.value)"
            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        <button
          id="today-btn"
          onclick="todayDate()"
          class="hidden px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg hover:bg-emerald-200 transition shrink-0"
        >
          今天
        </button>
      </div>

      <button
        type="button"
        onclick="nextDay()"
        class="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
        aria-label="後一天"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Navigation Tabs (Identical to Navigation.tsx) -->
    <div class="bg-white/80 backdrop-blur-md rounded-2xl border border-emerald-900/5 p-1.5 flex items-center justify-around no-print shadow-xs">
      <button id="tab-diet" onclick="switchTab('diet')" class="flex-1 py-2 text-xs font-bold rounded-xl transition text-center bg-emerald-800 text-white shadow-2xs">
        🥗 飲食與水分
      </button>
      <button id="tab-workout" onclick="switchTab('workout')" class="flex-1 py-2 text-xs font-bold rounded-xl transition text-center text-slate-600 hover:text-slate-900">
        🏋️ 訓練健身
      </button>
      <button id="tab-weight" onclick="switchTab('weight')" class="flex-1 py-2 text-xs font-bold rounded-xl transition text-center text-slate-600 hover:text-slate-900">
        ⚖️ 體重目標
      </button>
    </div>

    <!-- TAB 1: DIET & WATER -->
    <section id="view-diet" class="space-y-4">

      <!-- Macro Summary Card (Identical to DietTracker.tsx) -->
      <div class="bg-white rounded-3xl border border-emerald-950/5 shadow-sm p-5 space-y-4">
        
        <!-- Carb Cycle Pills -->
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5" id="carb-cycle-container">
            <!-- JS Rendered -->
          </div>
        </div>

        <!-- Calorie Big Numbers -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">今日攝取</div>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span id="total-calories" class="text-3xl font-black text-slate-900">0</span>
              <span class="text-sm font-semibold text-slate-400">/ <span id="target-calories">2000</span> kcal</span>
            </div>
          </div>

          <div class="text-right">
            <div id="cal-diff-label" class="text-xs font-bold text-slate-400 uppercase tracking-wider">剩餘可攝取</div>
            <div id="cal-diff-val" class="text-2xl font-black mt-0.5 text-emerald-700">
              0 <span class="text-xs font-semibold">kcal</span>
            </div>
          </div>
        </div>

        <!-- Calorie Bar -->
        <div class="space-y-1">
          <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div id="cal-progress-bar" class="h-full bg-emerald-600 transition-all duration-300 rounded-full" style="width: 0%"></div>
          </div>
          <div class="flex justify-between text-[11px] font-medium text-slate-400 px-0.5">
            <span>進度 <span id="cal-percent">0</span>%</span>
            <span>目標 <span id="cal-target-text">2000</span> kcal</span>
          </div>
        </div>

        <!-- 3 Main Macros Grid -->
        <div class="grid grid-cols-3 gap-2.5 pt-1">
          <!-- Carbs -->
          <div class="bg-amber-50/60 border border-amber-200/50 p-2.5 rounded-2xl">
            <div class="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
              <span>C (碳水)</span>
              <span id="pct-carbs" class="text-[10px] text-amber-600 font-semibold">0%</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span id="val-carbs" class="text-lg font-black text-slate-900">0</span>
              <span class="text-xs font-medium text-slate-400">/ <span id="target-carbs">250</span>g</span>
            </div>
            <div class="w-full h-1.5 bg-amber-100 rounded-full mt-1.5 overflow-hidden">
              <div id="bar-carbs" class="h-full bg-amber-500 rounded-full" style="width: 0%"></div>
            </div>
          </div>

          <!-- Protein -->
          <div class="bg-blue-50/60 border border-blue-200/50 p-2.5 rounded-2xl">
            <div class="flex items-center justify-between text-xs font-bold text-blue-800 mb-1">
              <span>P (蛋白)</span>
              <span id="pct-protein" class="text-[10px] text-blue-600 font-semibold">0%</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span id="val-protein" class="text-lg font-black text-slate-900">0</span>
              <span class="text-xs font-medium text-slate-400">/ <span id="target-protein">120</span>g</span>
            </div>
            <div class="w-full h-1.5 bg-blue-100 rounded-full mt-1.5 overflow-hidden">
              <div id="bar-protein" class="h-full bg-blue-500 rounded-full" style="width: 0%"></div>
            </div>
          </div>

          <!-- Fat -->
          <div class="bg-rose-50/60 border border-rose-200/50 p-2.5 rounded-2xl">
            <div class="flex items-center justify-between text-xs font-bold text-rose-800 mb-1">
              <span>F (脂肪)</span>
              <span id="pct-fat" class="text-[10px] text-rose-600 font-semibold">0%</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span id="val-fat" class="text-lg font-black text-slate-900">0</span>
              <span class="text-xs font-medium text-slate-400">/ <span id="target-fat">50</span>g</span>
            </div>
            <div class="w-full h-1.5 bg-rose-100 rounded-full mt-1.5 overflow-hidden">
              <div id="bar-fat" class="h-full bg-rose-500 rounded-full" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- 4 Micro Nutrients Grid -->
        <div class="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
          <div class="p-1.5 bg-slate-50 rounded-xl">
            <span class="text-[10px] text-slate-400 block font-semibold">糖分</span>
            <span id="val-sugars" class="font-bold text-slate-800">0g</span>
          </div>
          <div class="p-1.5 bg-slate-50 rounded-xl">
            <span class="text-[10px] text-slate-400 block font-semibold">膳食纖維</span>
            <span id="val-fiber" class="font-bold text-slate-800">0g</span>
          </div>
          <div class="p-1.5 bg-slate-50 rounded-xl">
            <span class="text-[10px] text-slate-400 block font-semibold">鈉含量</span>
            <span id="val-sodium" class="font-bold text-slate-800">0 mg</span>
          </div>
          <div class="p-1.5 bg-slate-50 rounded-xl">
            <span class="text-[10px] text-slate-400 block font-semibold">鉀含量</span>
            <span id="val-potassium" class="font-bold text-slate-800">0 mg</span>
          </div>
        </div>

      </div>

      <!-- Water Tracker Card (Identical to WaterTracker.tsx) -->
      <div class="bg-white rounded-3xl border border-emerald-950/5 shadow-sm p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 text-blue-600 rounded-2xl">
              💧
            </div>
            <div>
              <h3 class="font-black text-sm text-slate-900">每日飲水進度</h3>
              <p class="text-xs text-slate-400 font-medium">補充足夠水分維持基礎代謝</p>
            </div>
          </div>
          <div class="text-right">
            <span id="water-intake" class="text-xl font-black text-blue-600">0</span>
            <span class="text-xs font-semibold text-slate-400"> / <span id="water-goal">2500</span> ml</span>
          </div>
        </div>

        <div class="w-full h-2.5 bg-blue-50 rounded-full overflow-hidden">
          <div id="water-bar" class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>

      <!-- Meal Sections Container -->
      <div id="meals-container" class="space-y-3">
        <!-- JS Rendered Meals -->
      </div>
    </section>

    <!-- TAB 2: WORKOUT -->
    <section id="view-workout" class="space-y-4 hidden">
      <div class="bg-white rounded-3xl border border-emerald-950/5 shadow-sm p-5 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 class="font-black text-base text-slate-900">🏋️ 健身訓練日誌</h2>
          <span id="workout-count-badge" class="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-100">
            0 項記錄
          </span>
        </div>
        <div id="workouts-container" class="space-y-3">
          <!-- JS Rendered Workouts -->
        </div>
      </div>
    </section>

    <!-- TAB 3: WEIGHT -->
    <section id="view-weight" class="space-y-4 hidden">
      <div class="bg-white rounded-3xl border border-emerald-950/5 shadow-sm p-5 space-y-5">
        <h2 class="font-black text-base text-slate-900">⚖️ 體重與健康目標</h2>
        
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/50">
            <p class="text-[11px] text-amber-800 font-bold mb-1">🌅 最新晨重</p>
            <p class="text-xl font-black text-amber-900"><span id="latest-morning-weight">--</span> <span class="text-xs font-normal">kg</span></p>
          </div>
          <div class="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/50">
            <p class="text-[11px] text-indigo-800 font-bold mb-1">🌙 最新晚重</p>
            <p class="text-xl font-black text-indigo-900"><span id="latest-evening-weight">--</span> <span class="text-xs font-normal">kg</span></p>
          </div>
          <div class="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
            <p class="text-[11px] text-emerald-700 font-bold mb-1">🎯 目標體重</p>
            <p class="text-xl font-black text-emerald-800"><span id="target-weight">--</span> <span class="text-xs font-normal">kg</span></p>
          </div>
          <div class="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
            <p class="text-[11px] text-blue-700 font-bold mb-1">📐 BMI 指數</p>
            <p class="text-xl font-black text-blue-800"><span id="calculated-bmi">--</span></p>
          </div>
        </div>

        <!-- Morning & Evening Trend Charts -->
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              <button id="weight-tab-morning" onclick="setWeightTab('morning')" class="px-3 py-1.5 text-xs font-bold rounded-xl transition bg-amber-500 text-white shadow-2xs">
                🌅 晨間趨勢
              </button>
              <button id="weight-tab-evening" onclick="setWeightTab('evening')" class="px-3 py-1.5 text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900">
                🌙 晚間趨勢
              </button>
            </div>
            
            <div class="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button onclick="setWeightChartDays(7)" id="w-days-7" class="px-2.5 py-1 text-xs font-bold rounded-lg transition bg-white text-emerald-800 shadow-2xs">7天</button>
              <button onclick="setWeightChartDays(30)" id="w-days-30" class="px-2.5 py-1 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800">30天</button>
              <button onclick="setWeightChartDays(90)" id="w-days-90" class="px-2.5 py-1 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800">90天</button>
              <button onclick="setWeightChartDays(0)" id="w-days-0" class="px-2.5 py-1 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800">全部</button>
            </div>
          </div>

          <!-- Chart Card Container -->
          <div id="weight-chart-box" class="bg-slate-50/60 rounded-2xl border border-slate-200/60 p-4 min-h-[160px] flex items-center justify-center">
            <!-- Rendered SVG Chart -->
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold text-slate-700 mb-2">歷史體重明細記錄</h3>
          <div class="overflow-x-auto rounded-2xl border border-slate-100">
            <table class="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr class="bg-slate-50 font-bold text-slate-800 border-b border-slate-100">
                  <th class="p-3">日期</th>
                  <th class="p-3">🌅 晨間體重</th>
                  <th class="p-3">🌙 晚間體重</th>
                  <th class="p-3">備註</th>
                </tr>
              </thead>
              <tbody id="weight-records-body" class="divide-y divide-slate-100">
                <!-- JS Rendered -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

  </main>

  <script>
    const APP_DATA = ${jsonString};

    let currentDate = "${getTodayString()}";
    const todayStr = "${getTodayString()}";

    // Carb Cycle Information
    const CARB_CYCLE_INFO = {
      HIGH: { name: '高碳日', shortName: '高碳', emoji: '🔥' },
      MEDIUM: { name: '中碳日', shortName: '中碳', emoji: '🥗' },
      LOW: { name: '低碳日', shortName: '低碳', emoji: '🥬' },
      CUSTOM: { name: '自訂目標', shortName: '自訂', emoji: '⚙️' },
    };

    let activeCycle = APP_DATA.activeCarbCycle || 'MEDIUM';

    // Chinese Day of Week Helper
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    
    function formatChineseDisplayDate(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dt = new Date(parseInt(y, 10), m - 1, d);
      const dayOfWeek = weekDays[dt.getDay()];
      return y + '年' + (m < 10 ? '0' + m : m) + '月' + (d < 10 ? '0' + d : d) + '日 ' + dayOfWeek;
    }

    function addDays(dateStr, days) {
      const parts = dateStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function init() {
      document.getElementById('datePicker').value = currentDate;
      renderCarbCyclePills();
      renderAll();
    }

    function renderCarbCyclePills() {
      const container = document.getElementById('carb-cycle-container');
      const cycles = ['HIGH', 'MEDIUM', 'LOW', 'CUSTOM'];
      container.innerHTML = cycles.map(c => {
        const info = CARB_CYCLE_INFO[c];
        const isSelected = activeCycle === c;
        const cls = isSelected
          ? 'bg-emerald-800 text-white shadow-2xs'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
        return '<button type="button" onclick="selectCycle(\\'' + c + '\\')" class="px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ' + cls + '">' +
          '<span>' + info.emoji + '</span>' +
          '<span>' + info.shortName + '</span>' +
        '</button>';
      }).join('');
    }

    function selectCycle(c) {
      activeCycle = c;
      renderCarbCyclePills();
      renderDiet();
    }

    function setDate(val) {
      if (!val) return;
      currentDate = val;
      document.getElementById('datePicker').value = currentDate;
      renderAll();
    }

    function prevDay() {
      currentDate = addDays(currentDate, -1);
      document.getElementById('datePicker').value = currentDate;
      renderAll();
    }

    function nextDay() {
      currentDate = addDays(currentDate, 1);
      document.getElementById('datePicker').value = currentDate;
      renderAll();
    }

    function todayDate() {
      currentDate = todayStr;
      document.getElementById('datePicker').value = currentDate;
      renderAll();
    }

    function switchTab(tab) {
      const tabs = ['diet', 'workout', 'weight'];
      tabs.forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const view = document.getElementById('view-' + t);
        if (t === tab) {
          btn.className = "flex-1 py-2 text-xs font-bold rounded-xl transition text-center bg-emerald-800 text-white shadow-2xs";
          view.classList.remove('hidden');
        } else {
          btn.className = "flex-1 py-2 text-xs font-bold rounded-xl transition text-center text-slate-600 hover:text-slate-900";
          view.classList.add('hidden');
        }
      });
    }

    function getCurrentGoal() {
      const presets = APP_DATA.presets || {};
      const preset = presets[activeCycle] || {};
      const profile = APP_DATA.userProfile || {};

      return {
        calories: preset.calories || profile.targetCalories || 2000,
        carbs: preset.carbs || profile.targetCarbs || 250,
        protein: preset.protein || profile.targetProtein || 120,
        fat: preset.fat || profile.targetFat || 50,
      };
    }

    function renderAll() {
      // Update Date Display
      const dateDisplay = document.getElementById('date-display');
      const todayBtn = document.getElementById('today-btn');

      dateDisplay.textContent = formatChineseDisplayDate(currentDate);

      if (currentDate !== todayStr) {
        todayBtn.classList.remove('hidden');
      } else {
        todayBtn.classList.add('hidden');
      }

      renderDiet();
      renderWorkouts();
      renderWeight();
    }

    function renderDiet() {
      const foods = (APP_DATA.foodRecords || []).filter(r => r.date === currentDate);
      const goal = getCurrentGoal();

      let totalCal = 0, totalCarbs = 0, totalProtein = 0, totalFat = 0;
      let totalSugars = 0, totalFiber = 0, totalSodium = 0, totalPotassium = 0;

      foods.forEach(f => {
        totalCal += (f.calories || 0);
        totalCarbs += (f.carbs || 0);
        totalProtein += (f.protein || 0);
        totalFat += (f.fat || 0);
        totalSugars += (f.sugars || 0);
        totalFiber += (f.fiber || 0);
        totalSodium += (f.sodium || 0);
        totalPotassium += (f.potassium || 0);
      });

      const calDiff = goal.calories - totalCal;
      const calPercent = Math.min(100, Math.round((totalCal / (goal.calories || 1)) * 100));

      document.getElementById('total-calories').textContent = Math.round(totalCal);
      document.getElementById('target-calories').textContent = goal.calories;
      document.getElementById('cal-target-text').textContent = goal.calories;
      document.getElementById('cal-percent').textContent = calPercent;

      const calDiffLabel = document.getElementById('cal-diff-label');
      const calDiffVal = document.getElementById('cal-diff-val');
      const calProgressBar = document.getElementById('cal-progress-bar');

      if (calDiff >= 0) {
        calDiffLabel.textContent = '剩餘可攝取';
        calDiffVal.className = 'text-2xl font-black mt-0.5 text-emerald-700';
        calDiffVal.innerHTML = Math.round(calDiff) + ' <span class="text-xs font-semibold">kcal</span>';
        calProgressBar.className = 'h-full bg-emerald-600 transition-all duration-300 rounded-full';
      } else {
        calDiffLabel.textContent = '超出預算';
        calDiffVal.className = 'text-2xl font-black mt-0.5 text-rose-600';
        calDiffVal.innerHTML = Math.abs(Math.round(calDiff)) + ' <span class="text-xs font-semibold">kcal</span>';
        calProgressBar.className = 'h-full bg-rose-500 transition-all duration-300 rounded-full';
      }
      calProgressBar.style.width = calPercent + '%';

      // 3 Macros
      document.getElementById('val-carbs').textContent = Math.round(totalCarbs);
      document.getElementById('target-carbs').textContent = goal.carbs;
      const pctC = Math.round((totalCarbs / (goal.carbs || 1)) * 100);
      document.getElementById('pct-carbs').textContent = pctC + '%';
      document.getElementById('bar-carbs').style.width = Math.min(100, pctC) + '%';

      document.getElementById('val-protein').textContent = Math.round(totalProtein);
      document.getElementById('target-protein').textContent = goal.protein;
      const pctP = Math.round((totalProtein / (goal.protein || 1)) * 100);
      document.getElementById('pct-protein').textContent = pctP + '%';
      document.getElementById('bar-protein').style.width = Math.min(100, pctP) + '%';

      document.getElementById('val-fat').textContent = Math.round(totalFat);
      document.getElementById('target-fat').textContent = goal.fat;
      const pctF = Math.round((totalFat / (goal.fat || 1)) * 100);
      document.getElementById('pct-fat').textContent = pctF + '%';
      document.getElementById('bar-fat').style.width = Math.min(100, pctF) + '%';

      // 4 Micros
      document.getElementById('val-sugars').textContent = Math.round(totalSugars) + 'g';
      document.getElementById('val-fiber').textContent = Math.round(totalFiber) + 'g';
      document.getElementById('val-sodium').innerHTML = Math.round(totalSodium) + ' <span class="text-[9px]">mg</span>';
      document.getElementById('val-potassium').innerHTML = Math.round(totalPotassium) + ' <span class="text-[9px]">mg</span>';

      // Water
      const waterGoal = APP_DATA.waterGoal || 2500;
      const waterRecords = (APP_DATA.waterRecords || []).filter(w => w.date === currentDate);
      const waterIntake = waterRecords.reduce((sum, w) => sum + (w.amountMl || 0), 0);
      document.getElementById('water-intake').textContent = waterIntake;
      document.getElementById('water-goal').textContent = waterGoal;
      document.getElementById('water-bar').style.width = Math.min(100, Math.round((waterIntake / waterGoal) * 100)) + '%';

      // Meal Sections
      const activeMeals = APP_DATA.activeMeals || [
        { mealType: 'BREAKFAST', customName: '早餐' },
        { mealType: 'LUNCH', customName: '午餐' },
        { mealType: 'DINNER', customName: '晚餐' },
        { mealType: 'SNACK', customName: '點心' }
      ];

      const mealsContainer = document.getElementById('meals-container');
      let html = '';

      activeMeals.forEach(meal => {
        const mRecords = foods.filter(r => r.mealType === meal.mealType);
        const mCal = Math.round(mRecords.reduce((s, r) => s + (r.calories || 0), 0));
        const mC = Math.round(mRecords.reduce((s, r) => s + (r.carbs || 0), 0));
        const mP = Math.round(mRecords.reduce((s, r) => s + (r.protein || 0), 0));
        const mF = Math.round(mRecords.reduce((s, r) => s + (r.fat || 0), 0));

        html += '<div class="bg-white rounded-3xl border border-slate-200/70 shadow-2xs overflow-hidden">' +
          '<div class="px-5 py-3.5 flex items-center justify-between bg-white">' +
            '<div class="flex items-center gap-2.5 flex-1 min-w-0">' +
              '<span class="font-black text-base text-slate-900 truncate">' + meal.customName + '</span>' +
              '<span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">' + mCal + ' kcal</span>';

        if (mRecords.length > 0) {
          html += '<div class="hidden sm:flex items-center gap-1.5 ml-2">' +
            '<span class="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full">C: ' + mC + 'g</span>' +
            '<span class="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full">P: ' + mP + 'g</span>' +
            '<span class="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full">F: ' + mF + 'g</span>' +
          '</div>';
        }

        html += '</div></div>';

        if (mRecords.length > 0) {
          html += '<div class="px-5 pb-4 pt-1 border-t border-slate-100 divide-y divide-slate-100">';
          mRecords.forEach(item => {
            html += '<div class="py-2.5 flex items-center justify-between gap-3">' +
              '<div class="min-w-0 flex-1">' +
                '<div class="flex items-center gap-1.5 font-bold text-sm text-slate-800">' +
                  '<span class="truncate">' + item.name + '</span>' +
                  (item.brand ? '<span class="text-xs font-medium text-slate-400 shrink-0">' + item.brand + '</span>' : '') +
                '</div>' +
                '<div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">' +
                  '<span class="font-semibold text-emerald-800">' + item.loggedAmount + (item.loggedUnit || '') + ' , ' + item.calories + ' kcal</span>' +
                  '<div class="flex items-center gap-1">' +
                    '<span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: ' + item.carbs + 'g</span>' +
                    '<span class="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: ' + item.protein + 'g</span>' +
                    '<span class="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: ' + item.fat + 'g</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        } else {
          html += '<div class="px-5 py-3 border-t border-slate-50 text-xs text-slate-400 font-semibold text-center">此餐次尚無紀錄</div>';
        }

        html += '</div>';
      });

      mealsContainer.innerHTML = html;
    }

    function renderWorkouts() {
      const workouts = (APP_DATA.workoutRecords || []).filter(w => w.date === currentDate);
      const container = document.getElementById('workouts-container');
      document.getElementById('workout-count-badge').textContent = workouts.length + ' 項記錄';

      if (workouts.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">此日期尚無訓練記錄</div>';
        return;
      }

      let html = '';
      workouts.forEach(w => {
        html += '<div class="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 space-y-3">' +
          '<div class="flex items-center justify-between">' +
            '<span class="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">' + (w.bodyPart || '健身訓練') + '</span>' +
            '<span class="text-xs text-slate-400 font-medium">' + w.date + '</span>' +
          '</div>' +
          '<div class="space-y-2">';

        (w.exercises || []).forEach(ex => {
          html += '<div class="bg-white p-3 rounded-xl border border-slate-200/50 space-y-1.5">' +
            '<p class="font-extrabold text-xs text-slate-800">' + ex.name + '</p>' +
            '<div class="flex flex-wrap gap-1.5 text-[11px]">';

          (ex.sets || []).forEach((s, idx) => {
            html += '<span class="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">' +
              '第' + (idx + 1) + '組: ' + s.weightKg + 'kg × ' + s.reps + '次' +
            '</span>';
          });

          html += '</div></div>';
        });

        html += '</div></div>';
      });

      container.innerHTML = html;
    }

    let currentWeightTab = 'morning';
    let currentWeightDays = 7;

    function setWeightTab(tab) {
      currentWeightTab = tab;
      const mBtn = document.getElementById('weight-tab-morning');
      const eBtn = document.getElementById('weight-tab-evening');
      if (mBtn && eBtn) {
        if (tab === 'morning') {
          mBtn.className = "px-3 py-1.5 text-xs font-bold rounded-xl transition bg-amber-500 text-white shadow-2xs";
          eBtn.className = "px-3 py-1.5 text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900";
        } else {
          mBtn.className = "px-3 py-1.5 text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900";
          eBtn.className = "px-3 py-1.5 text-xs font-bold rounded-xl transition bg-indigo-600 text-white shadow-2xs";
        }
      }
      renderWeight();
    }

    function setWeightChartDays(days) {
      currentWeightDays = days;
      [7, 30, 90, 0].forEach(d => {
        const btn = document.getElementById('w-days-' + d);
        if (btn) {
          if (d === days) {
            btn.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition bg-white text-emerald-800 shadow-2xs";
          } else {
            btn.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800";
          }
        }
      });
      renderWeight();
    }

    function renderWeight() {
      const weights = APP_DATA.weightRecords || [];
      const profile = APP_DATA.userProfile || {};
      const tbody = document.getElementById('weight-records-body');

      const sortedWeights = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Latest Morning & Evening
      const latestMorningRec = [...sortedWeights].reverse().find(r => r.morningWeightKg || (r.weightKg && !r.eveningWeightKg));
      const latestMorning = latestMorningRec ? (latestMorningRec.morningWeightKg || latestMorningRec.weightKg) : null;

      const latestEveningRec = [...sortedWeights].reverse().find(r => r.eveningWeightKg);
      const latestEvening = latestEveningRec ? latestEveningRec.eveningWeightKg : null;

      const morningEl = document.getElementById('latest-morning-weight');
      const eveningEl = document.getElementById('latest-evening-weight');
      if (morningEl) morningEl.textContent = latestMorning ? latestMorning.toString() : '--';
      if (eveningEl) eveningEl.textContent = latestEvening ? latestEvening.toString() : '--';

      const latestW = latestMorning || latestEvening || profile.currentWeightKg || null;
      if (latestW && profile.heightCm) {
        const hM = profile.heightCm / 100;
        const bmi = (latestW / (hM * hM)).toFixed(1);
        const bmiEl = document.getElementById('calculated-bmi');
        if (bmiEl) bmiEl.textContent = bmi;
      }

      if (profile.targetWeightKg) {
        const targetEl = document.getElementById('target-weight');
        if (targetEl) targetEl.textContent = profile.targetWeightKg.toString();
      }

      // Filtered records for Chart
      const filteredForChart = currentWeightDays === 0 ? sortedWeights : sortedWeights.slice(-currentWeightDays);

      // Extract points based on currentWeightTab
      const chartPoints = [];
      filteredForChart.forEach(r => {
        const val = currentWeightTab === 'morning' 
          ? (r.morningWeightKg || (r.weightKg && !r.eveningWeightKg ? r.weightKg : null))
          : r.eveningWeightKg;
        if (val != null && !isNaN(val)) {
          chartPoints.push({
            date: r.date.length > 5 ? r.date.slice(5) : r.date,
            weight: Number(val),
            time: currentWeightTab === 'morning' ? (r.morningTime || '') : (r.eveningTime || '')
          });
        }
      });

      // Render SVG Chart
      const chartBox = document.getElementById('weight-chart-box');
      if (chartBox) {
        if (chartPoints.length < 2) {
          chartBox.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs font-semibold">' +
            '請至少記錄 2 筆以上的' + (currentWeightTab === 'morning' ? '晨間' : '晚間') + '體重資料以繪製連續變化曲線' +
          '</div>';
        } else {
          const targetW = profile.targetWeightKg || null;
          const weightsList = chartPoints.map(p => p.weight);
          if (targetW) weightsList.push(targetW);

          const minW = Math.min(...weightsList) - 0.5;
          const maxW = Math.max(...weightsList) + 0.5;
          const rangeW = maxW - minW || 1;

          const chartWidth = 320;
          const chartHeight = 130;
          const padding = 25;
          const drawW = chartWidth - padding * 2;
          const drawH = chartHeight - padding * 2;

          const coords = chartPoints.map((p, i) => {
            const x = padding + (i / (chartPoints.length - 1)) * drawW;
            const y = padding + drawH - ((p.weight - minW) / rangeW) * drawH;
            return { x, y, weight: p.weight, date: p.date, time: p.time };
          });

          const linePath = coords.map((c, i) => (i === 0 ? 'M' : 'L') + ' ' + c.x.toFixed(1) + ' ' + c.y.toFixed(1)).join(' ');
          const fillPath = linePath + ' L ' + coords[coords.length - 1].x.toFixed(1) + ' ' + (chartHeight - padding) + ' L ' + coords[0].x.toFixed(1) + ' ' + (chartHeight - padding) + ' Z';

          const strokeColor = currentWeightTab === 'morning' ? '#f59e0b' : '#6366f1';
          const fillColor = currentWeightTab === 'morning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)';

          let targetLineSvg = '';
          if (targetW) {
            const targetY = padding + drawH - ((targetW - minW) / rangeW) * drawH;
            targetLineSvg = '<line x1="' + padding + '" y1="' + targetY.toFixed(1) + '" x2="' + (chartWidth - padding) + '" y2="' + targetY.toFixed(1) + '" stroke="#10b981" stroke-dasharray="4 4" stroke-width="1.5"/>' +
              '<text x="' + (chartWidth - padding) + '" y="' + (targetY - 4).toFixed(1) + '" fill="#10b981" font-size="9" font-weight="bold" text-anchor="end">目標 ' + targetW + 'kg</text>';
          }

          let dotsSvg = '';
          coords.forEach(c => {
            dotsSvg += '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="4" fill="' + strokeColor + '" stroke="#ffffff" stroke-width="2"/>' +
              '<text x="' + c.x.toFixed(1) + '" y="' + (c.y - 7).toFixed(1) + '" fill="#1e293b" font-size="9" font-weight="extrabold" text-anchor="middle">' + c.weight + '</text>' +
              '<text x="' + c.x.toFixed(1) + '" y="' + (chartHeight - 6) + '" fill="#94a3b8" font-size="9" font-weight="medium" text-anchor="middle">' + c.date + '</text>';
          });

          chartBox.innerHTML = '<svg viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" class="w-full h-auto overflow-visible">' +
            '<path d="' + fillPath + '" fill="' + fillColor + '"/>' +
            targetLineSvg +
            '<path d="' + linePath + '" fill="none" stroke="' + strokeColor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            dotsSvg +
          '</svg>';
        }
      }

      // Render Table Body
      if (tbody) {
        if (sortedWeights.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-400">尚未記錄體重數據</td></tr>';
          return;
        }

        tbody.innerHTML = [...sortedWeights].reverse().map(w => {
          const mw = w.morningWeightKg || (w.weightKg && !w.eveningWeightKg ? w.weightKg : null);
          const ew = w.eveningWeightKg;
          const mwStr = mw ? mw + ' kg' + (w.morningTime ? ' <span class="text-[10px] text-slate-400 font-normal">(' + w.morningTime + ')</span>' : '') : '-';
          const ewStr = ew ? ew + ' kg' + (w.eveningTime ? ' <span class="text-[10px] text-slate-400 font-normal">(' + w.eveningTime + ')</span>' : '') : '-';

          return '<tr class="hover:bg-slate-50">' +
            '<td class="p-3 font-semibold text-slate-800">' + w.date + '</td>' +
            '<td class="p-3 font-bold text-amber-800">' + mwStr + '</td>' +
            '<td class="p-3 font-bold text-indigo-800">' + ewStr + '</td>' +
            '<td class="p-3 text-slate-400 font-normal">' + (w.notes || '-') + '</td>' +
          '</tr>';
        }).join('');
      }
    }

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}
