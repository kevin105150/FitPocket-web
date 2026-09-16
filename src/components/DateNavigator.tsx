import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { addDays, formatChineseDisplayDate, getTodayString } from '../utils/dateUtils';

interface DateNavigatorProps {
  currentDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  currentDate,
  onDateChange,
}) => {
  const todayStr = getTodayString();
  const isToday = currentDate === todayStr;

  const handlePrevDay = () => {
    onDateChange(addDays(currentDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDays(currentDate, 1));
  };

  const handleToday = () => {
    onDateChange(todayStr);
  };

  const formattedDisplay = formatChineseDisplayDate(currentDate);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-sky-900/5 p-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handlePrevDay}
        className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition cursor-pointer"
        aria-label="前一天"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        <label className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer">
          <CalendarIcon className="w-4 h-4 text-sky-700" />
          <span className="font-semibold text-slate-800 text-sm sm:text-base">
            {formattedDisplay}
          </span>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => {
              if (e.target.value) onDateChange(e.target.value);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        {!isToday && (
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition cursor-pointer"
          >
            回到今天
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleNextDay}
        className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition cursor-pointer"
        aria-label="後一天"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
