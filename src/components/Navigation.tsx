import React from 'react';
import { Utensils, Dumbbell, Droplets, Scale, Settings } from 'lucide-react';

export type TabType = 'DIET' | 'TRAINING' | 'WATER' | 'WEIGHT' | 'SETTINGS';

interface NavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'DIET' as TabType, label: '飲食', icon: Utensils },
    { id: 'TRAINING' as TabType, label: '訓練', icon: Dumbbell },
    { id: 'WATER' as TabType, label: '飲水', icon: Droplets },
    { id: 'WEIGHT' as TabType, label: '體重', icon: Scale },
    { id: 'SETTINGS' as TabType, label: '設定', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 safe-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5 sm:py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition cursor-pointer ${
                isSelected
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition ${
                  isSelected ? 'bg-emerald-100 text-emerald-800' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
