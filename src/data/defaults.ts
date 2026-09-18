import { CarbCycleInfo, CarbCycleType, MealConfig, NutritionGoalPreset, UserProfile } from '../types';

export const CARB_CYCLE_INFO: Record<CarbCycleType, CarbCycleInfo> = {
  HIGH: {
    type: 'HIGH',
    displayName: '高碳日',
    shortName: '高碳',
    emoji: '🔥',
    description: '適合高強度重訓、耐力訓練日',
  },
  MEDIUM: {
    type: 'MEDIUM',
    displayName: '中碳日',
    shortName: '中碳',
    emoji: '⚖️',
    description: '適合一般訓練、常態維持日',
  },
  LOW: {
    type: 'LOW',
    displayName: '低碳日',
    shortName: '低碳',
    emoji: '🥗',
    description: '適合休息日、輕度活動、減脂日',
  },
  CUSTOM: {
    type: 'CUSTOM',
    displayName: '自訂日',
    shortName: '自訂',
    emoji: '⚙️',
    description: '依個人需求完全自訂的營養目標',
  },
};

export function getCarbCycleBadgeStyle(type: CarbCycleType, isSelected: boolean): string {
  switch (type) {
    case 'HIGH':
      return isSelected
        ? 'bg-rose-500 text-white shadow-xs border-rose-500'
        : 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100/80';
    case 'MEDIUM':
      return isSelected
        ? 'bg-amber-500 text-white shadow-xs border-amber-500'
        : 'bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100/80';
    case 'LOW':
      return isSelected
        ? 'bg-emerald-600 text-white shadow-xs border-emerald-600'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100/80';
    case 'CUSTOM':
    default:
      return isSelected
        ? 'bg-indigo-600 text-white shadow-xs border-indigo-600'
        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100/80';
  }
}

export const DEFAULT_PRESETS: Record<CarbCycleType, NutritionGoalPreset> = {
  HIGH: {
    type: 'HIGH',
    calories: 2400,
    carbs: 300,
    fat: 53,
    protein: 180,
    sodium: 2400,
    potassium: 2500,
  },
  MEDIUM: {
    type: 'MEDIUM',
    calories: 2100,
    carbs: 210,
    fat: 58,
    protein: 180,
    sodium: 2400,
    potassium: 2500,
  },
  LOW: {
    type: 'LOW',
    calories: 1800,
    carbs: 120,
    fat: 60,
    protein: 195,
    sodium: 2400,
    potassium: 2500,
  },
  CUSTOM: {
    type: 'CUSTOM',
    calories: 2000,
    carbs: 200,
    fat: 55,
    protein: 175,
    sodium: 2400,
    potassium: 2500,
  },
};

export const DEFAULT_MEALS: MealConfig[] = [
  { mealType: 'BREAKFAST', customName: '早餐', isCustom: false },
  { mealType: 'LUNCH', customName: '午餐', isCustom: false },
  { mealType: 'DINNER', customName: '晚餐', isCustom: false },
  { mealType: 'SNACK', customName: '點心', isCustom: false },
];

export const DEFAULT_MUSCLE_GROUPS = [
  '胸',
  '背',
  '肩',
  '腿',
  '臀',
  '手臂',
  '推',
  '拉',
  '核心',
  '有氧',
  '上半身',
  '下半身',
  '全身',
];

export const DEFAULT_EXERCISES = [
  // 有氧
  { name: '慢跑', bodyPart: '有氧' },
  { name: '跑步機', bodyPart: '有氧' },
  { name: '飛輪單車', bodyPart: '有氧' },
  { name: '划船機', bodyPart: '有氧' },
  { name: '橢圓機', bodyPart: '有氧' },
  { name: '跳繩', bodyPart: '有氧' },
  { name: '快走・健走', bodyPart: '有氧' },
  { name: '游泳', bodyPart: '有氧' },
  { name: '波比跳', bodyPart: '有氧' },
  { name: '開合跳', bodyPart: '有氧' },
  { name: '戰繩訓練', bodyPart: '有氧' },
  { name: '階梯機', bodyPart: '有氧' },
  { name: '高強度間歇 (HIIT)', bodyPart: '有氧' },
  // 胸
  { name: '槓鈴平椅臥推', bodyPart: '胸' },
  { name: '上胸啞鈴臥推', bodyPart: '胸' },
  { name: '下胸雙槓撐體', bodyPart: '胸' },
  { name: '啞鈴飛鳥', bodyPart: '胸' },
  { name: '繩索夾胸', bodyPart: '胸' },
  { name: '俯臥撐', bodyPart: '胸' },
  { name: '史密斯機臥推', bodyPart: '胸' },
  // 背
  { name: '滑輪下拉', bodyPart: '背' },
  { name: '槓鈴划船', bodyPart: '背' },
  { name: '單臂啞鈴划船', bodyPart: '背' },
  { name: '引體向上', bodyPart: '背' },
  { name: '坐姿划船', bodyPart: '背' },
  { name: '羅馬椅挺身', bodyPart: '背' },
  { name: '硬舉', bodyPart: '背' },
  // 腿
  { name: '槓鈴深蹲', bodyPart: '腿' },
  { name: '羅馬尼亞硬舉', bodyPart: '腿' },
  { name: '腿推機', bodyPart: '腿' },
  { name: '腿伸展機', bodyPart: '腿' },
  { name: '腿彎舉', bodyPart: '腿' },
  { name: '槓鈴弓步蹲', bodyPart: '腿' },
  { name: '提踵', bodyPart: '腿' },
  // 肩
  { name: '站姿槓鈴肩推', bodyPart: '肩' },
  { name: '坐姿啞鈴肩推', bodyPart: '肩' },
  { name: '啞鈴側平舉', bodyPart: '肩' },
  { name: '後三角繩索面拉', bodyPart: '肩' },
  { name: '俯身飛鳥', bodyPart: '肩' },
  { name: '聳肩', bodyPart: '肩' },
  // 手臂
  { name: '槓鈴二頭彎舉', bodyPart: '手臂' },
  { name: '啞鈴錘式彎舉', bodyPart: '手臂' },
  { name: '三頭肌繩索下壓', bodyPart: '手臂' },
  { name: '法式推舉', bodyPart: '手臂' },
  { name: '窄握臥推', bodyPart: '手臂' },
  { name: '雙槓體撐', bodyPart: '手臂' },
  // 核心
  { name: '棒式', bodyPart: '核心' },
  { name: '捲腹', bodyPart: '核心' },
  { name: '懸垂舉腿', bodyPart: '核心' },
  { name: '仰臥起坐', bodyPart: '核心' },
  { name: '俄羅斯轉體', bodyPart: '核心' },
  { name: '健腹輪', bodyPart: '核心' },
];

export const CARDIO_KEYWORDS = [
  '有氧',
  'cardio',
  '跑步',
  '慢跑',
  '快走',
  '健走',
  '散步',
  '跑步機',
  '單車',
  '自行車',
  '腳踏車',
  '飛輪',
  '划船機',
  '橢圓機',
  '跳繩',
  '游泳',
  '波比',
  '開合跳',
  'hiit',
  '高強度間歇',
  '間歇',
  '登山機',
  '階梯機',
  '踏步機',
  '戰繩',
  '爬樓梯',
  '滑雪機',
  '拳擊',
  '跳舞',
];

export function isCardioExercise(name: string, bodyPart: string = ''): boolean {
  const lowerName = name.toLowerCase().trim();
  const lowerPart = bodyPart.toLowerCase().trim();
  if (
    lowerPart.includes('有氧') ||
    lowerPart.includes('cardio') ||
    lowerPart.includes('心肺')
  ) {
    return true;
  }
  return CARDIO_KEYWORDS.some((kw) => lowerName.includes(kw));
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  gender: 'male',
  age: 26,
  heightCm: 175,
  currentWeightKg: 72.5,
  targetWeightKg: 68.0,
  activityLevel: 'moderate',
  fitnessGoal: 'fat_loss',
};
