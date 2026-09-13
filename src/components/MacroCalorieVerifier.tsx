import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface MacroCalorieVerifierProps {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const MacroCalorieVerifier: React.FC<MacroCalorieVerifierProps> = ({
  calories,
  carbs,
  protein,
  fat,
}) => {
  const calculated = Math.round((carbs * 4 + protein * 4 + fat * 9) * 10) / 10;
  const diff = Math.round(Math.abs(calories - calculated) * 10) / 10;
  const isMatch = diff <= Math.max(10, calories * 0.15); // within 15% tolerance

  if (calories <= 0 && calculated <= 0) return null;

  return (
    <div
      className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
        isMatch
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
          : 'bg-amber-50/80 border-amber-200 text-amber-800'
      }`}
    >
      {isMatch ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      )}
      <div className="leading-relaxed">
        <div className="font-semibold">
          熱量三大營養素換算：4×碳({carbs}g) + 4×蛋({protein}g) + 9×脂({fat}g) ={' '}
          <span className="font-bold">{calculated} kcal</span>
        </div>
        {!isMatch ? (
          <div className="text-[11px] opacity-90 mt-0.5">
            標示熱量 ({calories} kcal) 與宏量換算差值約 {diff} kcal，超商或外食可能包含糖醇、膳食纖維或調味估算偏差。
          </div>
        ) : (
          <div className="text-[11px] opacity-90 mt-0.5">
            標示熱量 ({calories} kcal) 與營養素比例吻合！
          </div>
        )}
      </div>
    </div>
  );
};
