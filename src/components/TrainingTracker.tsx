import React, { useState, useEffect } from 'react';
import {
  Plus,
  Dumbbell,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  Timer,
  Sparkles,
  Link,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  X,
} from 'lucide-react';
import { ExerciseSet, WorkoutExercise, WorkoutRecord } from '../types';
import { StorageService } from '../services/storage';
import { isCardioExercise } from '../data/defaults';
import { DateNavigator } from './DateNavigator';
import { WorkoutTimerModal } from './WorkoutTimerModal';
import { checkAiKeyOrWarn } from '../utils/aiHelper';

interface TrainingTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const TrainingTracker: React.FC<TrainingTrackerProps> = ({
  currentDate,
  onDateChange,
}) => {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [targetWorkoutId, setTargetWorkoutId] = useState<string | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);

  // Exercise selection state
  const [selectedMuscle, setSelectedMuscle] = useState<string>('胸');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState<string>('');
  const [customExerciseName, setCustomExerciseName] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const muscleGroups = StorageService.getMuscleGroups();
  const allDictionaryExercises = StorageService.getExercises();

  const refreshWorkouts = () => {
    const list = StorageService.getWorkoutsByDate(currentDate);
    setWorkouts(list);
  };

  useEffect(() => {
    refreshWorkouts();
  }, [currentDate]);

  // Handle create new workout category / body part
  const handleCreateWorkout = (bodyPart: string) => {
    const newRecord: WorkoutRecord = {
      id: 'workout_' + Date.now(),
      date: currentDate,
      bodyPart,
      exercises: [],
      updatedAt: Date.now(),
    };
    StorageService.saveWorkoutRecord(newRecord);
    setShowAddWorkoutModal(false);
    refreshWorkouts();
  };

  // Delete entire workout
  const handleDeleteWorkout = (workoutId: string) => {
    StorageService.deleteWorkoutRecord(workoutId);
    refreshWorkouts();
  };

  // Add Exercise to Workout
  const handleAddExerciseToWorkout = (exerciseName: string, bodyPart: string) => {
    if (!targetWorkoutId) return;
    const workout = workouts.find((w) => w.id === targetWorkoutId);
    if (!workout) return;

    const isCardio = isCardioExercise(exerciseName, bodyPart);
    const newExerciseId = 'ex_' + Date.now();

    // Default 3 sets
    const defaultSets: ExerciseSet[] = isCardio
      ? [
          {
            id: 'set_' + Date.now() + '_1',
            exerciseId: newExerciseId,
            setIndex: 1,
            reps: 0,
            weight: 0,
            durationMinutes: 20,
            isCompleted: false,
          },
        ]
      : [
          {
            id: 'set_' + Date.now() + '_1',
            exerciseId: newExerciseId,
            setIndex: 1,
            reps: 12,
            weight: 20,
            isCompleted: false,
          },
          {
            id: 'set_' + Date.now() + '_2',
            exerciseId: newExerciseId,
            setIndex: 2,
            reps: 10,
            weight: 25,
            isCompleted: false,
          },
          {
            id: 'set_' + Date.now() + '_3',
            exerciseId: newExerciseId,
            setIndex: 3,
            reps: 8,
            weight: 30,
            isCompleted: false,
          },
        ];

    const exercise: WorkoutExercise = {
      id: newExerciseId,
      workoutId: targetWorkoutId,
      name: exerciseName,
      bodyPart,
      sets: defaultSets.length,
      reps: isCardio ? 0 : 10,
      weight: isCardio ? 0 : 25,
      isCardio,
      exerciseSets: defaultSets,
    };

    workout.exercises.push(exercise);
    StorageService.saveWorkoutRecord(workout);
    setShowAddExerciseModal(false);
    refreshWorkouts();
  };

  // Toggle set completion
  const handleToggleSetComplete = (
    workoutId: string,
    exerciseId: string,
    setId: string
  ) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const setItem = ex.exerciseSets.find((s) => s.id === setId);
    if (setItem) {
      setItem.isCompleted = !setItem.isCompleted;
      StorageService.saveWorkoutRecord(workout);
      refreshWorkouts();
    }
  };

  // Update set values (weight, reps, duration)
  const handleUpdateSet = (
    workoutId: string,
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'durationMinutes',
    val: number | string
  ) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const setItem = ex.exerciseSets.find((s) => s.id === setId);
    if (setItem) {
      setItem[field] = val as any;
      StorageService.saveWorkoutRecord(workout);
      refreshWorkouts();
    }
  };

  // Add set to exercise
  const handleAddSet = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const lastSet = ex.exerciseSets[ex.exerciseSets.length - 1];
    const newSet: ExerciseSet = {
      id: 'set_' + Date.now(),
      exerciseId,
      setIndex: ex.exerciseSets.length + 1,
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight || 20,
      durationMinutes: lastSet?.durationMinutes || 15,
      isCompleted: false,
    };

    ex.exerciseSets.push(newSet);
    ex.sets = ex.exerciseSets.length;
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
  };

  // Remove set from exercise
  const handleRemoveSet = (workoutId: string, exerciseId: string, setId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    ex.exerciseSets = ex.exerciseSets.filter((s) => s.id !== setId);
    ex.sets = ex.exerciseSets.length;
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
  };

  // Delete exercise
  const handleDeleteExercise = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    workout.exercises = workout.exercises.filter((e) => e.id !== exerciseId);
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
  };

  // Toggle Superset
  const handleToggleSuperset = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    ex.supersetGroupId = ex.supersetGroupId ? null : 1;
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
  };

  // Fetch AI recommended exercises for selected muscle
  const handleFetchAiExercises = async () => {
    if (!checkAiKeyOrWarn()) return;
    setAiLoading(true);
    try {
      const userKey = StorageService.getGeminiApiKey();
      const model = StorageService.getSelectedAiModel();
      const res = await fetch('/api/ai/workout-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bodyPart: selectedMuscle, 
          customApiKey: userKey,
          model
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data.exercises || []);
      }
    } catch (e) {
      console.warn('AI suggestions error:', e);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter dictionary
  const filteredExercises = allDictionaryExercises.filter((ex) => {
    const matchPart = ex.bodyPart === selectedMuscle;
    const matchSearch =
      !exerciseSearchQuery ||
      ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
    return matchPart && matchSearch;
  });

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Top Banner with Rest Timer CTA */}
      <div className="bg-gradient-to-r from-sky-700 to-cyan-700 text-white rounded-3xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-sky-200" />
            <h2 className="font-bold text-base">訓練日誌</h2>
          </div>
          <p className="text-xs text-sky-100/80 mt-0.5">
            記錄組數、重量、組間休息計時與有氧訓練
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTimerModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs rounded-xl backdrop-blur-xs transition cursor-pointer border border-white/20"
        >
          <Timer className="w-4 h-4 text-sky-200" />
          <span>休息碼錶</span>
        </button>
      </div>

      {/* Workouts List */}
      {workouts.length > 0 ? (
        <div className="space-y-4">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden"
            >
              {/* Workout Header */}
              <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black px-2.5 py-1 bg-sky-600 text-white rounded-xl shadow-2xs">
                    {workout.bodyPart}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {workout.exercises.length} 個動作 ·{' '}
                    {workout.exercises.reduce((sum, e) => sum + e.exerciseSets.length, 0)} 組
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetWorkoutId(workout.id);
                      setSelectedMuscle(workout.bodyPart || '胸');
                      setShowAddExerciseModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-100/80 hover:bg-sky-200 text-sky-900 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>加動作</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkout(workout.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                    title="刪除此訓練項目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

                {/* Exercises in Workout */}
              <div className="p-4 space-y-3">
                {(() => {
                  const items: (WorkoutExercise | { isSuperset: true; exercises: WorkoutExercise[]; groupId: number })[] = [];
                  const processedSupersets = new Set<number>();

                  workout.exercises.forEach((ex) => {
                    const gid = ex.supersetGroupId;
                    if (gid === null || gid === undefined) {
                      items.push(ex);
                    } else {
                      if (!processedSupersets.has(gid)) {
                        processedSupersets.add(gid);
                        const group = workout.exercises.filter((e) => e.supersetGroupId === gid);
                        items.push({ isSuperset: true, exercises: group, groupId: gid });
                      }
                    }
                  });

                  return items.map((item, idx) => {
                    if ('isSuperset' in item) {
                      return (
                        <div
                          key={`superset-${item.groupId}`}
                          className="rounded-2xl border-2 border-purple-200/60 bg-purple-50/20 overflow-hidden"
                        >
                          <div className="bg-purple-100/50 px-4 py-2 border-b border-purple-200/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-purple-700" />
                              <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider">
                                超級組 (Superset) · {item.exercises.length} 個動作
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                // Break superset for all
                                item.exercises.forEach(ex => handleToggleSuperset(workout.id, ex.id));
                              }}
                              className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
                            >
                              解除群組
                            </button>
                          </div>
                          <div className="p-3 space-y-3">
                            {item.exercises.map((exercise, innerIdx) => (
                              <ExerciseCard
                                key={exercise.id}
                                exercise={exercise}
                                workoutId={workout.id}
                                onToggleSuperset={handleToggleSuperset}
                                onDeleteExercise={handleDeleteExercise}
                                onToggleSetComplete={handleToggleSetComplete}
                                onUpdateSet={handleUpdateSet}
                                onAddSet={handleAddSet}
                                onRemoveSet={handleRemoveSet}
                                setShowTimerModal={setShowTimerModal}
                                isInsideSuperset={true}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <ExerciseCard
                          key={item.id}
                          exercise={item}
                          workoutId={workout.id}
                          onToggleSuperset={handleToggleSuperset}
                          onDeleteExercise={handleDeleteExercise}
                          onToggleSetComplete={handleToggleSetComplete}
                          onUpdateSet={handleUpdateSet}
                          onAddSet={handleAddSet}
                          onRemoveSet={handleRemoveSet}
                          setShowTimerModal={setShowTimerModal}
                        />
                      );
                    }
                  });
                })()}

                {workout.exercises.length === 0 && (
                  <div
                    onClick={() => {
                      setTargetWorkoutId(workout.id);
                      setSelectedMuscle(workout.bodyPart || '胸');
                      setShowAddExerciseModal(true);
                    }}
                    className="py-10 text-center space-y-2 border-2 border-dashed border-slate-200 rounded-3xl hover:border-sky-400 hover:bg-sky-50/30 group cursor-pointer transition-all"
                  >
                    <Plus className="w-8 h-8 text-slate-300 group-hover:text-sky-500 mx-auto" />
                    <div className="text-sm font-bold text-slate-400 group-hover:text-sky-800">
                      點擊新增「{workout.bodyPart || '此部位'}」訓練動作
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
          <Dumbbell className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 text-sm">今日尚無訓練紀錄</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            選擇訓練部位開始記錄動作、重量、組數與組間休息
          </p>
          <button
            type="button"
            onClick={() => setShowAddWorkoutModal(true)}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>開始記錄訓練</span>
          </button>
        </div>
      )}

      {/* Floating Add Workout Button */}
      {workouts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAddWorkoutModal(true)}
          className="fixed bottom-20 right-5 z-30 flex items-center gap-2 px-5 py-3.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>新增訓練部位</span>
        </button>
      )}

      {/* Modal: Add Workout (Select Body Part) */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">選擇訓練部位</h3>
              <button
                onClick={() => setShowAddWorkoutModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 py-4">
              {muscleGroups.map((mg) => (
                <button
                  key={mg}
                  onClick={() => handleCreateWorkout(mg)}
                  className="py-3 px-2 text-center rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-sm font-bold text-slate-800 hover:text-sky-900 transition cursor-pointer"
                >
                  {mg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Exercise from Dictionary or AI */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">選擇動作庫動作</h3>
                <p className="text-xs text-slate-400">依肌群分類檢索、自訂動作或獲取 AI 推薦</p>
              </div>
              <button
                onClick={() => setShowAddExerciseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Muscle selector pills */}
            <div className="px-4 py-2 border-b border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none">
              {muscleGroups.map((mg) => (
                <button
                  key={mg}
                  onClick={() => setSelectedMuscle(mg)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedMuscle === mg
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mg}
                </button>
              ))}
            </div>

            {/* Search & AI CTA */}
            <div className="p-4 space-y-2">
              <input
                type="text"
                placeholder="搜尋動作名稱..."
                value={exerciseSearchQuery}
                onChange={(e) => setExerciseSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-sky-600"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleFetchAiExercises}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Gemini 分析中...' : `Gemini 推薦${selectedMuscle}動作`}
                </button>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="新增自訂動作"
                    value={customExerciseName}
                    onChange={(e) => setCustomExerciseName(e.target.value)}
                    className="w-28 px-2 py-1 text-xs border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customExerciseName.trim()) {
                        handleAddExerciseToWorkout(customExerciseName.trim(), selectedMuscle);
                        setCustomExerciseName('');
                      }
                    }}
                    className="px-2 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    新增
                  </button>
                </div>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-xs">
                  <span className="font-bold text-purple-900 block mb-1">AI 推薦清單：</span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestions.map((aiEx) => (
                      <button
                        key={aiEx}
                        onClick={() => handleAddExerciseToWorkout(aiEx, selectedMuscle)}
                        className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900 font-semibold hover:bg-purple-100 cursor-pointer"
                      >
                        + {aiEx}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 divide-y divide-slate-100">
              {filteredExercises.map((ex) => (
                <div
                  key={ex.name}
                  onClick={() => handleAddExerciseToWorkout(ex.name, ex.bodyPart)}
                  className="py-2.5 px-2 flex items-center justify-between hover:bg-sky-50 rounded-xl transition cursor-pointer group"
                >
                  <div>
                    <span className="font-bold text-sm text-slate-800 group-hover:text-sky-900">
                      {ex.name}
                    </span>
                    {isCardioExercise(ex.name, ex.bodyPart) && (
                      <span className="ml-2 text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                        有氧
                      </span>
                    )}
                  </div>
                  <Plus className="w-4 h-4 text-slate-300 group-hover:text-sky-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Modal */}
      <WorkoutTimerModal isOpen={showTimerModal} onClose={() => setShowTimerModal(false)} />
    </div>
  );
};

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  workoutId: string;
  onToggleSuperset: (workoutId: string, exerciseId: string) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  onToggleSetComplete: (workoutId: string, exerciseId: string, setId: string) => void;
  onUpdateSet: (workoutId: string, exerciseId: string, setId: string, field: 'weight' | 'reps' | 'durationMinutes', val: number | string) => void;
  onAddSet: (workoutId: string, exerciseId: string) => void;
  onRemoveSet: (workoutId: string, exerciseId: string, setId: string) => void;
  setShowTimerModal: (show: boolean) => void;
  isInsideSuperset?: boolean;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  workoutId,
  onToggleSuperset,
  onDeleteExercise,
  onToggleSetComplete,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  setShowTimerModal,
  isInsideSuperset = false,
}) => {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isInsideSuperset
          ? 'border-slate-100 bg-white/60 shadow-sm'
          : exercise.supersetGroupId
          ? 'border-purple-200 bg-purple-50/20'
          : 'border-slate-200/70 bg-white'
      }`}
    >
      {/* Exercise Title */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-slate-900">{exercise.name}</h4>
            {exercise.isCardio && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md">
                有氧心肺
              </span>
            )}
            {exercise.supersetGroupId && !isInsideSuperset && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md flex items-center gap-1">
                <Link className="w-3 h-3" /> 超級組
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleSuperset(workoutId, exercise.id)}
            className={`p-1 rounded-md transition ${
              exercise.supersetGroupId ? 'text-purple-700 bg-purple-100' : 'text-slate-400 hover:text-purple-700 hover:bg-slate-100'
            }`}
            title="切換超級組標記"
          >
            <Link className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteExercise(workoutId, exercise.id)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition"
            title="刪除動作"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sets Table */}
      <div className="space-y-1.5 text-xs">
        <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-400 px-2 pb-1">
          <span className="col-span-2 text-center">組數</span>
          {exercise.isCardio ? (
            <span className="col-span-6 text-center">時間 (分鐘)</span>
          ) : (
            <>
              <span className="col-span-4 text-center">重量 (kg)</span>
              <span className="col-span-3 text-center">次數 (reps)</span>
            </>
          )}
          <span className="col-span-3 text-center">完成</span>
        </div>

        {exercise.exerciseSets.map((set, sIdx) => (
          <div
            key={set.id}
            className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition ${
              set.isCompleted
                ? 'bg-sky-50/70 border-sky-200/80 text-sky-900'
                : 'bg-slate-50 border-slate-100 text-slate-700'
            }`}
          >
            {/* Set number */}
            <div className="col-span-2 font-bold text-center">#{sIdx + 1}</div>

            {/* Inputs */}
            {exercise.isCardio ? (
              <div className="col-span-6 flex items-center justify-center gap-1">
                <input
                  type="number"
                  value={set.durationMinutes ?? ''}
                  onChange={(e) =>
                    onUpdateSet(
                      workoutId,
                      exercise.id,
                      set.id,
                      'durationMinutes',
                      e.target.value
                    )
                  }
                  className="w-16 py-1 px-2 text-center font-bold bg-white rounded-lg border border-slate-200 focus:outline-sky-600"
                />
                <span className="text-slate-500 font-medium">分</span>
              </div>
            ) : (
              <>
                <div className="col-span-4 flex items-center justify-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={set.weight ?? ''}
                    onChange={(e) =>
                      onUpdateSet(
                        workoutId,
                        exercise.id,
                        set.id,
                        'weight',
                        e.target.value
                      )
                    }
                    className="w-16 py-1 px-1 text-center font-bold bg-white rounded-lg border border-slate-200 focus:outline-sky-600"
                  />
                  <span className="text-slate-400 text-[10px]">kg</span>
                </div>

                <div className="col-span-3 flex items-center justify-center gap-1">
                  <input
                    type="number"
                    value={set.reps ?? ''}
                    onChange={(e) =>
                      onUpdateSet(
                        workoutId,
                        exercise.id,
                        set.id,
                        'reps',
                        e.target.value
                      )
                    }
                    className="w-12 py-1 px-1 text-center font-bold bg-white rounded-lg border border-slate-200 focus:outline-sky-600"
                  />
                  <span className="text-slate-400 text-[10px]">次</span>
                </div>
              </>
            )}

            {/* Checkbox button */}
            <div className="col-span-3 flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onToggleSetComplete(workoutId, exercise.id, set.id);
                  if (!set.isCompleted) {
                    setShowTimerModal(true);
                  }
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  set.isCompleted
                    ? 'text-sky-700 bg-sky-100 hover:bg-sky-200'
                    : 'text-slate-400 hover:text-sky-600 hover:bg-slate-200'
                }`}
                title="標記為已完成（自動啟動組間休息碼錶）"
              >
                {set.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              {exercise.exerciseSets.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveSet(workoutId, exercise.id, set.id)}
                  className="p-1 text-slate-300 hover:text-rose-500 rounded cursor-pointer"
                  title="刪除此組"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add set button */}
      <button
        type="button"
        onClick={() => onAddSet(workoutId, exercise.id)}
        className="mt-2.5 w-full py-1.5 text-center text-xs font-semibold text-sky-800 hover:bg-sky-50 border border-dashed border-sky-300 rounded-xl transition cursor-pointer"
      >
        + 新增一組
      </button>
    </div>
  );
};
