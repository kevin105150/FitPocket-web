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
  Pencil,
  Edit3,
} from 'lucide-react';
import { ExerciseSet, WorkoutExercise, WorkoutRecord } from '../types';
import { StorageService } from '../services/storage';
import { isCardioExercise } from '../data/defaults';
import { DateNavigator } from './DateNavigator';
import { WorkoutTimerModal } from './WorkoutTimerModal';
import { checkAiKeyOrWarn, getAiRequestParams } from '../utils/aiHelper';
import { motion } from 'motion/react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export const getSupersetLetter = (groupId: number): string => {
  if (!groupId || groupId <= 0) return 'A';
  return String.fromCharCode(65 + ((groupId - 1) % 26));
};

export const SUPERSET_THEMES = [
  {
    border: 'border-purple-300',
    bg: 'bg-purple-50/50',
    headerBg: 'bg-purple-100/90',
    headerBorder: 'border-purple-200',
    text: 'text-purple-950',
    accentText: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    activeTag: 'bg-purple-600 text-white',
    btnGhost: 'text-purple-700 hover:bg-purple-200/80',
    cardBorder: 'border-purple-200',
    cardBg: 'bg-white',
  },
  {
    border: 'border-indigo-300',
    bg: 'bg-indigo-50/50',
    headerBg: 'bg-indigo-100/90',
    headerBorder: 'border-indigo-200',
    text: 'text-indigo-950',
    accentText: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    activeTag: 'bg-indigo-600 text-white',
    btnGhost: 'text-indigo-700 hover:bg-indigo-200/80',
    cardBorder: 'border-indigo-200',
    cardBg: 'bg-white',
  },
  {
    border: 'border-sky-300',
    bg: 'bg-sky-50/50',
    headerBg: 'bg-sky-100/90',
    headerBorder: 'border-sky-200',
    text: 'text-sky-950',
    accentText: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    activeTag: 'bg-sky-600 text-white',
    btnGhost: 'text-sky-700 hover:bg-sky-200/80',
    cardBorder: 'border-sky-200',
    cardBg: 'bg-white',
  },
  {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/50',
    headerBg: 'bg-emerald-100/90',
    headerBorder: 'border-emerald-200',
    text: 'text-emerald-950',
    accentText: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeTag: 'bg-emerald-600 text-white',
    btnGhost: 'text-emerald-700 hover:bg-emerald-200/80',
    cardBorder: 'border-emerald-200',
    cardBg: 'bg-white',
  },
  {
    border: 'border-rose-300',
    bg: 'bg-rose-50/50',
    headerBg: 'bg-rose-100/90',
    headerBorder: 'border-rose-200',
    text: 'text-rose-950',
    accentText: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    activeTag: 'bg-rose-600 text-white',
    btnGhost: 'text-rose-700 hover:bg-rose-200/80',
    cardBorder: 'border-rose-200',
    cardBg: 'bg-white',
  },
];

export const getSupersetTheme = (groupId: number) => {
  const index = Math.max(0, (groupId - 1) % SUPERSET_THEMES.length);
  return SUPERSET_THEMES[index];
};

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

  // New state for renaming, replacing, & custom body parts
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [showCustomBodyPartModal, setShowCustomBodyPartModal] = useState<boolean>(false);
  const [customBodyPartInput, setCustomBodyPartInput] = useState<string>('');
  const [customBodyParts, setCustomBodyParts] = useState<string[]>([]);
  const [supersetModalTarget, setSupersetModalTarget] = useState<{
    workoutId: string;
    exerciseId: string;
  } | null>(null);

  // Safe delete inline state
  const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<string | null>(null);
  const [confirmDeleteBodyPart, setConfirmDeleteBodyPart] = useState<string | null>(null);

  useModalBackHandler(showAddWorkoutModal, () => setShowAddWorkoutModal(false));
  useModalBackHandler(showAddExerciseModal, () => {
    setShowAddExerciseModal(false);
    setReplacingExerciseId(null);
  });
  useModalBackHandler(showCustomBodyPartModal, () => setShowCustomBodyPartModal(false));

  const muscleGroups = StorageService.getMuscleGroups();
  const allDictionaryExercises = StorageService.getExercises();

  const refreshCustomBodyParts = () => {
    setCustomBodyParts(StorageService.getCustomBodyParts());
  };

  const refreshWorkouts = () => {
    const list = StorageService.getWorkoutsByDate(currentDate);
    setWorkouts(list);
    refreshCustomBodyParts();
  };

  useEffect(() => {
    refreshWorkouts();
    const unsubscribe = StorageService.onDataChange(() => {
      refreshWorkouts();
    });
    return () => unsubscribe();
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

  // Handle custom body part creation
  const handleCreateCustomBodyPart = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    StorageService.addCustomBodyPart(trimmed);
    setShowCustomBodyPartModal(false);
    setCustomBodyPartInput('');
    if (editingWorkoutId) {
      handleSelectBodyPartForWorkout(trimmed);
    } else {
      handleCreateWorkout(trimmed);
    }
  };

  // Handle select / change workout body part
  const handleSelectBodyPartForWorkout = (bodyPart: string) => {
    if (!editingWorkoutId) return;
    const workout = workouts.find((w) => w.id === editingWorkoutId);
    if (workout) {
      workout.bodyPart = bodyPart;
      workout.updatedAt = Date.now();
      StorageService.saveWorkoutRecord(workout);
      refreshWorkouts();
    }
    setEditingWorkoutId(null);
  };

  // Delete entire workout
  const handleDeleteWorkout = (workoutId: string) => {
    StorageService.deleteWorkoutRecord(workoutId);
    refreshWorkouts();
  };

  // Add or Replace Exercise in Workout
  const handleAddExerciseToWorkout = (exerciseName: string, bodyPart: string) => {
    if (!targetWorkoutId) return;
    const workout = workouts.find((w) => w.id === targetWorkoutId);
    if (!workout) return;

    if (replacingExerciseId) {
      // Replace existing exercise
      const ex = workout.exercises.find((e) => e.id === replacingExerciseId);
      if (ex) {
        const isCardio = isCardioExercise(exerciseName, bodyPart);
        ex.name = exerciseName;
        ex.bodyPart = bodyPart;
        ex.isCardio = isCardio;
        StorageService.saveWorkoutRecord(workout);
        setReplacingExerciseId(null);
        setShowAddExerciseModal(false);
        refreshWorkouts();
        return;
      }
    }

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

  // Open Superset Modal
  const handleOpenSupersetModal = (workoutId: string, exerciseId: string) => {
    setSupersetModalTarget({ workoutId, exerciseId });
  };

  // Assign Superset
  const handleAssignSuperset = (
    workoutId: string,
    exerciseId: string,
    groupId: number | null | 'NEW'
  ) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    if (groupId === 'NEW') {
      const usedGids = new Set(
        workout.exercises
          .map((e) => e.supersetGroupId)
          .filter((gid): gid is number => typeof gid === 'number' && gid > 0)
      );
      let nextGid = 1;
      while (usedGids.has(nextGid)) {
        nextGid++;
      }
      ex.supersetGroupId = nextGid;
    } else {
      ex.supersetGroupId = groupId;
    }

    ex.updatedAt = Date.now();
    workout.updatedAt = Date.now();
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
    setSupersetModalTarget(null);
  };

  // Break Superset Group
  const handleBreakSuperset = (workoutId: string, groupId: number) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    workout.exercises.forEach((e) => {
      if (e.supersetGroupId === groupId) {
        e.supersetGroupId = null;
        e.updatedAt = Date.now();
      }
    });

    workout.updatedAt = Date.now();
    StorageService.saveWorkoutRecord(workout);
    refreshWorkouts();
  };

  // Fetch AI recommended exercises for selected muscle
  const handleFetchAiExercises = async () => {
    if (!checkAiKeyOrWarn()) return;
    setAiLoading(true);
    try {
      const aiParams = getAiRequestParams();
      const model = StorageService.getSelectedAiModel();
      const res = await fetch('/api/ai/workout-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bodyPart: selectedMuscle, 
          customApiKey: aiParams.customApiKey,
          apiKeySource: aiParams.apiKeySource,
          userEmail: aiParams.userEmail,
          userUid: aiParams.userUid,
          model
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data._usage) {
          StorageService.recordApiUsage(data._usage);
        }
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
              <div className="relative overflow-hidden bg-slate-50/70 border-b border-slate-100">
                {/* Beneath Action Row */}
                <div
                  className={`absolute inset-y-1.5 right-2 flex items-stretch gap-1 z-0 transition-opacity duration-150 ${
                    confirmDeleteWorkoutId === workout.id
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteWorkout(workout.id);
                      setConfirmDeleteWorkoutId(null);
                    }}
                    className="px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                  >
                    確定
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteWorkoutId(null)}
                    className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                  >
                    取消
                  </button>
                </div>

                {/* Sliding Card Content */}
                <motion.div
                  animate={{ x: confirmDeleteWorkoutId === workout.id ? -125 : 0 }}
                  transition={{ type: 'spring', stiffness: 580, damping: 28, mass: 0.4 }}
                  className="relative z-10 bg-slate-50 px-5 py-4 flex items-center justify-between gap-3 w-full will-change-transform transform-gpu"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-black px-2.5 py-1 bg-sky-600 text-white rounded-xl shadow-2xs shrink-0">
                      {workout.bodyPart}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWorkoutId(workout.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer shrink-0"
                      title="選擇/變更部位"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-slate-500 font-medium truncate">
                      {workout.exercises.length} 個動作 ·{' '}
                      {workout.exercises.reduce((sum, e) => sum + e.exerciseSets.length, 0)} 組
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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
                      onClick={() => setConfirmDeleteWorkoutId(workout.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                      title="刪除此訓練項目"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
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

                  return items.map((item) => {
                    if ('isSuperset' in item) {
                      const theme = getSupersetTheme(item.groupId);
                      const letter = getSupersetLetter(item.groupId);
                      return (
                        <div
                          key={`superset-${item.groupId}`}
                          className={`rounded-2xl border-2 ${theme.border} ${theme.bg} overflow-hidden transition-all`}
                        >
                          <div className={`${theme.headerBg} px-4 py-2 border-b ${theme.headerBorder} flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                              <Layers className={`w-4 h-4 ${theme.accentText}`} />
                              <span className={`text-[11px] font-black ${theme.text} uppercase tracking-wider`}>
                                超級組 {letter} (Superset {letter}) · {item.exercises.length} 個動作
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleBreakSuperset(workout.id, item.groupId)}
                              className={`text-[10px] font-bold ${theme.btnGhost} px-2 py-0.5 rounded cursor-pointer transition`}
                            >
                              解散群組
                            </button>
                          </div>
                          <div className="p-3 space-y-3">
                            {item.exercises.map((exercise) => (
                              <ExerciseCard
                                key={exercise.id}
                                exercise={exercise}
                                workoutId={workout.id}
                                onOpenSupersetModal={handleOpenSupersetModal}
                                onDeleteExercise={handleDeleteExercise}
                                onReplaceExercise={(wId, eId) => {
                                  setTargetWorkoutId(wId);
                                  setReplacingExerciseId(eId);
                                  setShowAddExerciseModal(true);
                                }}
                                onToggleSetComplete={handleToggleSetComplete}
                                onUpdateSet={handleUpdateSet}
                                onAddSet={handleAddSet}
                                onRemoveSet={handleRemoveSet}
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
                          onOpenSupersetModal={handleOpenSupersetModal}
                          onDeleteExercise={handleDeleteExercise}
                          onReplaceExercise={(wId, eId) => {
                            setTargetWorkoutId(wId);
                            setReplacingExerciseId(eId);
                            setShowAddExerciseModal(true);
                          }}
                          onToggleSetComplete={handleToggleSetComplete}
                          onUpdateSet={handleUpdateSet}
                          onAddSet={handleAddSet}
                          onRemoveSet={handleRemoveSet}
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
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">選擇訓練部位</h3>
              <button
                onClick={() => setShowAddWorkoutModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Saved Body Parts Section */}
            {customBodyParts.length > 0 && (
              <div className="pt-4 pb-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-400 mb-2">自訂</div>
                <div className="flex flex-wrap gap-2">
                  {customBodyParts.map((customName) => (
                    <div
                      key={customName}
                      className="group flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:bg-amber-100 cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={() => handleCreateWorkout(customName)}
                        className="text-left font-bold"
                      >
                        {customName}
                      </button>
                      {confirmDeleteBodyPart === customName ? (
                        <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-200">
                          <span className="text-[10px] font-bold text-rose-700">刪除？</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              StorageService.deleteCustomBodyPart(customName);
                              refreshCustomBodyParts();
                              setConfirmDeleteBodyPart(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded cursor-pointer"
                          >
                            確定
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteBodyPart(null);
                            }}
                            className="px-1 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteBodyPart(customName);
                          }}
                          className="p-0.5 text-amber-500 hover:text-rose-600 rounded transition cursor-pointer"
                          title="刪除此自訂部位"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3x5 Grid for Predefined Body Parts + Custom Button */}
            <div className="pt-4 pb-2">
              <div className="text-xs font-bold text-slate-400 mb-2">預設部位</div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
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
                  '自訂',
                ].map((item) => {
                  if (item === '自訂') {
                    return (
                      <button
                        key="custom"
                        type="button"
                        onClick={() => setShowCustomBodyPartModal(true)}
                        className="py-3 px-2 text-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/80 hover:border-sky-500 text-sm font-bold text-sky-800 transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4 text-sky-600" />
                        <span>自訂</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleCreateWorkout(item)}
                      className="py-3 px-2 text-center rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-sm font-bold text-slate-800 hover:text-sky-900 transition cursor-pointer"
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Exercise from Dictionary or AI */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">選擇動作</h3>
                <p className="text-xs text-slate-400">
                  {replacingExerciseId ? '選擇動作以更換目前動作' : '依肌群分類檢索、自訂動作或獲取 AI 推薦'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddExerciseModal(false);
                  setReplacingExerciseId(null);
                }}
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

      {/* Modal: Custom Body Part Input */}
      {showCustomBodyPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-800 text-base mb-1">自訂訓練部位</h3>
            <p className="text-xs text-slate-500 mb-4">輸入您想記錄的自訂部位名稱（如：小腿、前臂、壺鈴心肺等）</p>

            <input
              type="text"
              value={customBodyPartInput}
              onChange={(e) => setCustomBodyPartInput(e.target.value)}
              placeholder="例如：小腿"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-sky-600 mb-5"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCustomBodyPartModal(false);
                  setCustomBodyPartInput('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleCreateCustomBodyPart(customBodyPartInput)}
                disabled={!customBodyPartInput.trim()}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                新增部位
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change / Select Workout Body Part */}
      {editingWorkoutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">選擇訓練部位</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  目前部位：
                  <span className="font-bold text-sky-700 ml-1">
                    {workouts.find((w) => w.id === editingWorkoutId)?.bodyPart || ''}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkoutId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Saved Body Parts Section */}
            {customBodyParts.length > 0 && (
              <div className="pt-4 pb-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-400 mb-2">自訂部位</div>
                <div className="flex flex-wrap gap-2">
                  {customBodyParts.map((customName) => {
                    const currentWorkout = workouts.find((w) => w.id === editingWorkoutId);
                    const isCurrent = currentWorkout?.bodyPart === customName;
                    return (
                      <div
                        key={customName}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isCurrent
                            ? 'bg-sky-600 text-white shadow-2xs ring-2 ring-sky-300'
                            : 'bg-amber-50 border border-amber-200/80 text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectBodyPartForWorkout(customName)}
                          className="text-left font-bold"
                        >
                          {customName}
                        </button>
                        {confirmDeleteBodyPart === customName ? (
                          <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-200">
                            <span className="text-[10px] font-bold text-rose-700">刪除？</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                StorageService.deleteCustomBodyPart(customName);
                                refreshCustomBodyParts();
                                setConfirmDeleteBodyPart(null);
                              }}
                              className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded cursor-pointer"
                            >
                              確定
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteBodyPart(null);
                              }}
                              className="px-1 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteBodyPart(customName);
                            }}
                            className={`p-0.5 rounded transition cursor-pointer ${
                              isCurrent ? 'text-white/80 hover:text-white' : 'text-amber-500 hover:text-rose-600'
                            }`}
                            title="刪除此自訂部位"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3x5 Grid for Predefined Body Parts + Custom Button */}
            <div className="pt-4 pb-2">
              <div className="text-xs font-bold text-slate-400 mb-2">預設部位</div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
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
                  '自訂',
                ].map((item) => {
                  if (item === '自訂') {
                    return (
                      <button
                        key="custom"
                        type="button"
                        onClick={() => setShowCustomBodyPartModal(true)}
                        className="py-3 px-2 text-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/80 hover:border-sky-500 text-sm font-bold text-sky-800 transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4 text-sky-600" />
                        <span>自訂</span>
                      </button>
                    );
                  }
                  const currentWorkout = workouts.find((w) => w.id === editingWorkoutId);
                  const isCurrent = currentWorkout?.bodyPart === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSelectBodyPartForWorkout(item)}
                      className={`py-3 px-2 text-center rounded-2xl border text-sm font-bold transition cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs ring-2 ring-sky-300'
                          : 'border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-slate-800 hover:text-sky-900'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Select / Create Superset Group */}
      {supersetModalTarget && (() => {
        const targetWorkout = workouts.find((w) => w.id === supersetModalTarget.workoutId);
        const targetExercise = targetWorkout?.exercises.find((e) => e.id === supersetModalTarget.exerciseId);
        if (!targetWorkout || !targetExercise) return null;

        // Existing superset groups in this workout
        const existingGids = Array.from(
          new Set(
            targetWorkout.exercises
              .map((e) => e.supersetGroupId)
              .filter((gid): gid is number => typeof gid === 'number' && gid > 0)
          )
        ).sort((a, b) => a - b);

        const existingSupersets = existingGids.map((gid) => {
          const list = targetWorkout.exercises.filter((e) => e.supersetGroupId === gid);
          return {
            groupId: gid,
            letter: getSupersetLetter(gid),
            theme: getSupersetTheme(gid),
            exercises: list,
          };
        });

        // Next available superset ID & letter
        let nextGid = 1;
        const usedSet = new Set(existingGids);
        while (usedSet.has(nextGid)) {
          nextGid++;
        }
        const nextLetter = getSupersetLetter(nextGid);
        const currentGid = targetExercise.supersetGroupId;
        const currentLetter = currentGid ? getSupersetLetter(currentGid) : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">超級組設定</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    目標動作：<span className="font-extrabold text-slate-900">{targetExercise.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSupersetModalTarget(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                {/* Current Status banner */}
                {currentGid && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/80 border border-purple-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-700" />
                      <span className="text-slate-700">
                        目前已加入：<strong className="text-purple-900 font-bold">超級組 {currentLetter}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssignSuperset(targetWorkout.id, targetExercise.id, null)}
                      className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      移出超級組
                    </button>
                  </div>
                )}

                {/* Existing Supersets List */}
                {existingSupersets.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-2">加入現有超級組</div>
                    <div className="space-y-2">
                      {existingSupersets.map((group) => {
                        const isCurrent = currentGid === group.groupId;
                        return (
                          <div
                            key={group.groupId}
                            className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                              isCurrent
                                ? `${group.theme.border} ${group.theme.bg} ring-2 ring-purple-300`
                                : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${group.theme.badge}`}>
                                  超級組 {group.letter}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                  ({group.exercises.length} 個動作)
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 truncate mt-1">
                                包含：{group.exercises.map((e) => e.name).join('、')}
                              </p>
                            </div>

                            {isCurrent ? (
                              <span className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-xl shrink-0">
                                已在此組
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAssignSuperset(targetWorkout.id, targetExercise.id, group.groupId)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-2xs shrink-0 cursor-pointer"
                              >
                                {currentGid ? '移至此組' : '加入此組'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Create New Superset Option */}
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">建立新的超級組</div>
                  <button
                    type="button"
                    onClick={() => handleAssignSuperset(targetWorkout.id, targetExercise.id, 'NEW')}
                    className="w-full p-3.5 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100 hover:border-purple-500 transition text-left cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-purple-900 group-hover:text-purple-950">
                        <Plus className="w-4 h-4 text-purple-600" />
                        <span>建立新的 超級組 {nextLetter}</span>
                      </div>
                      <p className="text-xs text-purple-600/80 mt-0.5">
                        將「{targetExercise.name}」設為 超級組 {nextLetter} 的第一個動作
                      </p>
                    </div>
                    <span className="px-3 py-1.5 bg-purple-600 group-hover:bg-purple-700 text-white text-xs font-bold rounded-xl shrink-0">
                      建立
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupersetModalTarget(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rest Timer Modal */}
      <WorkoutTimerModal isOpen={showTimerModal} onClose={() => setShowTimerModal(false)} />
    </div>
  );
};

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  workoutId: string;
  onOpenSupersetModal: (workoutId: string, exerciseId: string) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  onReplaceExercise: (workoutId: string, exerciseId: string) => void;
  onToggleSetComplete: (workoutId: string, exerciseId: string, setId: string) => void;
  onUpdateSet: (workoutId: string, exerciseId: string, setId: string, field: 'weight' | 'reps' | 'durationMinutes', val: number | string) => void;
  onAddSet: (workoutId: string, exerciseId: string) => void;
  onRemoveSet: (workoutId: string, exerciseId: string, setId: string) => void;
  isInsideSuperset?: boolean;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  workoutId,
  onOpenSupersetModal,
  onDeleteExercise,
  onReplaceExercise,
  onToggleSetComplete,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  isInsideSuperset = false,
}) => {
  const [confirmDeleteExercise, setConfirmDeleteExercise] = useState<boolean>(false);
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null);

  const supersetTheme = exercise.supersetGroupId ? getSupersetTheme(exercise.supersetGroupId) : null;
  const supersetLetter = exercise.supersetGroupId ? getSupersetLetter(exercise.supersetGroupId) : '';

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Beneath Action Row */}
      <div
        className={`absolute inset-y-1.5 right-1.5 flex items-stretch gap-1 z-0 transition-opacity duration-150 ${
          confirmDeleteExercise
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onDeleteExercise(workoutId, exercise.id);
            setConfirmDeleteExercise(false);
          }}
          className="px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center transition cursor-pointer animate-in fade-in"
        >
          確定
        </button>
        <button
          type="button"
          onClick={() => setConfirmDeleteExercise(false)}
          className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
        >
          取消
        </button>
      </div>

      <motion.div
        animate={{ x: confirmDeleteExercise ? -125 : 0 }}
        transition={{ type: 'spring', stiffness: 580, damping: 28, mass: 0.4 }}
        className={`relative z-10 border p-4 rounded-2xl transition-colors duration-150 will-change-transform transform-gpu bg-white shadow-2xs ${
          isInsideSuperset
            ? `${supersetTheme?.cardBorder || 'border-slate-200'} shadow-2xs`
            : exercise.supersetGroupId
            ? `${supersetTheme?.border || 'border-purple-300'} ring-1 ${supersetTheme?.border || 'ring-purple-300'}`
            : 'border-slate-200/80'
        }`}
      >
        {/* Exercise Title */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-bold text-sm text-slate-900">{exercise.name}</h4>
              <button
                type="button"
                onClick={() => onReplaceExercise(workoutId, exercise.id)}
                className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                title="更換訓練動作"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {exercise.isCardio && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md">
                  有氧心肺
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenSupersetModal(workoutId, exercise.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                exercise.supersetGroupId
                  ? `${supersetTheme?.badge} hover:opacity-90 shadow-2xs`
                  : 'text-slate-400 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 hover:border-purple-200'
              }`}
              title={exercise.supersetGroupId ? `已加入 超級組 ${supersetLetter} (點擊變更或移出)` : "設定為超級組"}
            >
              <Link className="w-3.5 h-3.5" />
              <span>{exercise.supersetGroupId ? `超級組 ${supersetLetter}` : '超級組'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteExercise(true)}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
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
          <span className="col-span-3 text-center pr-4">完成</span>
        </div>

        {exercise.exerciseSets.map((set, sIdx) => (
          <div key={set.id} className="relative overflow-hidden rounded-xl">
            {/* Beneath Action Row */}
            <div
              className={`absolute inset-y-1 right-1.5 flex items-stretch gap-1.5 z-0 transition-opacity duration-150 ${
                confirmDeleteSetId === set.id
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onRemoveSet(workoutId, exercise.id, set.id);
                  setConfirmDeleteSetId(null);
                }}
                className="w-12 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg flex items-center justify-center transition cursor-pointer shadow-xs"
              >
                確定
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteSetId(null)}
                className="w-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg flex items-center justify-center transition cursor-pointer"
              >
                取消
              </button>
            </div>

            <motion.div
              animate={{ x: confirmDeleteSetId === set.id ? -108 : 0 }}
              transition={{ type: 'spring', stiffness: 580, damping: 28, mass: 0.4 }}
              className={`relative z-10 grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-colors duration-150 will-change-transform transform-gpu ${
                set.isCompleted
                  ? 'bg-sky-50 border-sky-200/80 text-sky-900'
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
              <div className="col-span-3 relative flex items-center justify-center pr-4">
                <button
                  type="button"
                  onClick={() => onToggleSetComplete(workoutId, exercise.id, set.id)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    set.isCompleted
                      ? 'text-sky-700 bg-sky-100 hover:bg-sky-200'
                      : 'text-slate-400 hover:text-sky-600 hover:bg-slate-200'
                  }`}
                  title={set.isCompleted ? "取消完成狀態" : "標記為已完成"}
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
                    onClick={() => setConfirmDeleteSetId(set.id)}
                    className="absolute right-0 p-1 text-slate-300 hover:text-rose-500 rounded cursor-pointer transition"
                    title="刪除此組"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
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
      </motion.div>
    </div>
  );
};
