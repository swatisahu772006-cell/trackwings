/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  Plus, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Flame, 
  X,
  LogOut,
  User as UserIcon,
  LogIn
} from 'lucide-react';
import { 
  format, 
  addDays, 
  subDays, 
  startOfToday, 
  eachDayOfInterval, 
  isToday
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  Tooltip, 
  Cell 
} from 'recharts';
import { Habit, Completion } from './types';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  User 
} from './firebase';

const COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
];

const ICONS = ['🎯', '💧', '🏃', '📚', '🧘', '🍎', '💻', '🎸', '🧹', '😴'];

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50 p-6">
          <div className="bg-white p-12 rounded-[48px] shadow-2xl max-w-lg w-full text-center border border-rose-100">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <X size={40} className="text-rose-600" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 mb-4">Something went wrong</h2>
            <p className="text-slate-500 mb-8 font-medium">We encountered an error. Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      
      // Save user profile to Firestore
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          role: 'user'
        }, { merge: true }).catch(err => console.error("Error saving user profile:", err));
      }
    });
    return unsubscribe;
  }, []);

  // Firestore Sync - Habits
  useEffect(() => {
    if (!user) {
      setHabits([]);
      return;
    }

    const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Habit[];
      setHabits(habitsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'habits');
    });

    return unsubscribe;
  }, [user]);

  // Firestore Sync - Completions
  useEffect(() => {
    if (!user) {
      setCompletions([]);
      return;
    }

    const q = query(collection(db, 'completions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const completionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Completion[];
      setCompletions(completionsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'completions');
    });

    return unsubscribe;
  }, [user]);

  const toggleHabit = async (habitId: string) => {
    if (!user) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = completions.find(
      c => c.habitId === habitId && c.date === dateStr
    );

    try {
      if (existing && existing.id) {
        await deleteDoc(doc(db, 'completions', existing.id));
      } else {
        await addDoc(collection(db, 'completions'), {
          habitId,
          date: dateStr,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'completions');
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim() || !user) return;
    
    try {
      await addDoc(collection(db, 'habits'), {
        name: newHabitName,
        color: selectedColor,
        icon: selectedIcon,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewHabitName('');
      setIsAddModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'habits');
    }
  };

  const deleteHabit = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'habits', id));
      // Also delete completions for this habit
      const habitCompletions = completions.filter(c => c.habitId === id);
      for (const comp of habitCompletions) {
        if (comp.id) await deleteDoc(doc(db, 'completions', comp.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'habits');
    }
  };

  const getStreak = (habitId: string) => {
    let streak = 0;
    let checkDate = startOfToday();
    
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const completed = completions.some(c => c.habitId === habitId && c.date === dateStr);
      if (completed) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        if (isToday(checkDate)) {
          checkDate = subDays(checkDate, 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(startOfToday(), 6),
      end: startOfToday(),
    });

    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayCompletions = completions.filter(c => c.date === dateStr).length;
      return {
        name: format(date, 'EEE'),
        completed: dayCompletions,
        fullDate: dateStr,
      };
    });
  }, [completions]);

  const completionRate = useMemo(() => {
    if (habits.length === 0) return 0;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const done = completions.filter(c => c.date === dateStr).length;
    return Math.round((done / habits.length) * 100);
  }, [habits, completions, selectedDate]);

  const totalCompletions = useMemo(() => completions.length, [completions]);

  const dailyQuote = useMemo(() => {
    const quotes = [
      "Small wings, big flights.",
      "Consistency is the wind beneath your wings.",
      "Every small step is a flight towards greatness.",
      "Your habits define your horizon.",
      "Fly higher with every daily win.",
      "The sky is not the limit, it's your playground.",
      "Steady wings conquer the strongest storms."
    ];
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return quotes[dayOfYear % quotes.length];
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfaff]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdfaff] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-200/20 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/80 backdrop-blur-3xl p-12 rounded-[64px] shadow-2xl border border-white text-center relative z-10"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-600 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-indigo-200 transform -rotate-6">
            <Flame size={48} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-900 mb-4">TrackWings</h1>
          <p className="text-slate-500 mb-12 font-medium leading-relaxed">
            Your personal habit flight deck. <br />
            Sign in to sync your wings across all devices.
          </p>
          
          <button 
            onClick={signInWithGoogle}
            className="w-full py-6 bg-white border-2 border-slate-100 rounded-[28px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all shadow-xl shadow-slate-200/50 active:scale-95 group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            <span className="text-slate-900 font-black uppercase tracking-widest text-xs">Sign in with Google</span>
          </button>
          
          <p className="mt-12 text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
            Secure & Private • Cloud Sync
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfaff] text-[#1e293b] font-sans selection:bg-indigo-100 relative overflow-hidden">
      {/* Shifting Gradient Background Elements */}
      <motion.div 
        animate={{ 
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-gradient-to-br from-indigo-400/30 via-violet-400/30 to-fuchsia-400/30 blur-[140px] rounded-full" 
      />
      <motion.div 
        animate={{ 
          x: [0, -100, 0],
          y: [0, -50, 0],
          scale: [1.3, 1, 1.3],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-gradient-to-tl from-rose-300/30 via-orange-300/30 to-amber-300/30 blur-[140px] rounded-full" 
      />
      <motion.div 
        animate={{ 
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-emerald-300/20 blur-[100px] rounded-full" 
      />

      <div className="max-w-2xl mx-auto px-6 py-12 relative z-10">
        {/* App Title */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 transform -rotate-6 group-hover:rotate-0 group-hover:scale-110 transition-all duration-500">
              <Flame size={26} className="text-white" fill="currentColor" />
            </div>
            <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-600">TrackWings</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilot</span>
              <span className="text-xs font-bold text-slate-900">{user.displayName}</span>
            </div>
            <button 
              onClick={logout}
              className="w-12 h-12 bg-white/80 backdrop-blur-xl rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-white shadow-xl shadow-indigo-500/5 group"
              title="Sign Out"
            >
              <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <h1 className="text-7xl font-black tracking-tighter mb-2 text-slate-900 leading-none drop-shadow-sm">
              {format(selectedDate, 'EEEE')}
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full" />
              <p className="text-sm uppercase tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-rose-600 font-black">
                {format(selectedDate, 'MMMM d, yyyy')}
              </p>
            </div>
            <p className="mt-4 text-slate-400 font-medium italic text-sm">
              "{dailyQuote}"
            </p>
          </motion.div>
          <div className="flex gap-2 bg-white/40 backdrop-blur-2xl p-2.5 rounded-[24px] border border-white/60 shadow-2xl shadow-indigo-500/10">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-3 hover:bg-indigo-500 hover:text-white rounded-2xl transition-all text-indigo-600 active:scale-90 shadow-sm"
            >
              <ChevronLeft size={24} strokeWidth={3} />
            </button>
            <button 
              onClick={() => setSelectedDate(startOfToday())}
              className={cn(
                "px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg",
                isToday(selectedDate) 
                  ? "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-indigo-300" 
                  : "bg-white text-indigo-600 border border-indigo-50 hover:border-indigo-200"
              )}
            >
              Today
            </button>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-3 hover:bg-indigo-500 hover:text-white rounded-2xl transition-all text-indigo-600 active:scale-90 shadow-sm"
            >
              <ChevronRight size={24} strokeWidth={3} />
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-3xl p-10 rounded-[48px] shadow-2xl shadow-indigo-500/10 border border-white flex flex-col justify-between group hover:shadow-indigo-500/20 transition-all duration-500 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-500 font-black mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 animate-pulse" />
                Daily Flow
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-8xl font-black tracking-tighter text-slate-900 leading-none">{completionRate}</span>
                <span className="text-4xl text-indigo-400 font-black">%</span>
              </div>
            </div>
            <div className="mt-10 h-5 bg-indigo-50/50 rounded-full overflow-hidden p-1.5 shadow-inner border border-indigo-100/50 relative">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 via-fuchsia-500 to-rose-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] relative overflow-hidden"
              >
                <motion.div 
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
              </motion.div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/70 backdrop-blur-3xl p-10 rounded-[48px] shadow-2xl shadow-indigo-500/10 border border-white group hover:shadow-indigo-500/20 transition-all duration-500 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-500 font-black mb-6">Weekly Pulse</p>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#f43f5e" />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="completed" radius={[10, 10, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fullDate === format(selectedDate, 'yyyy-MM-dd') ? 'url(#barGradient)' : '#f1f5ff'} 
                        />
                      ))}
                    </Bar>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 900, fill: '#818cf8' }}
                      dy={12}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 10 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900/90 backdrop-blur-xl text-white text-[10px] px-5 py-2.5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl border border-white/20">
                              {payload[0].value} Wings Caught
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Wings</span>
              <span className="text-2xl font-black text-indigo-600">{totalCompletions}</span>
            </div>
          </motion.div>
        </div>

        {/* Habit List */}
        <section className="space-y-8">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-indigo-400">Your Wings</h2>
              <div className="h-px w-24 bg-gradient-to-r from-indigo-200 to-transparent" />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-16 h-16 bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-600 text-white rounded-[24px] flex items-center justify-center hover:scale-110 hover:rotate-12 transition-all shadow-[0_20px_40px_-10px_rgba(99,102,241,0.5)] active:scale-95 group"
            >
              <Plus size={32} strokeWidth={4} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {habits.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-32 text-center border-4 border-dashed border-indigo-100 rounded-[64px] bg-white/30 backdrop-blur-md relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-rose-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Plus size={48} className="text-indigo-300" strokeWidth={3} />
                  </div>
                  <p className="text-indigo-500 font-black uppercase tracking-[0.4em] text-xs">Empty Skies</p>
                  <p className="text-indigo-400/60 text-sm mt-3 font-medium">Add your first wing to begin the journey</p>
                </div>
              </motion.div>
            ) : (
              habits.map((habit) => {
                const isCompleted = completions.some(
                  c => c.habitId === habit.id && c.date === format(selectedDate, 'yyyy-MM-dd')
                );
                const streak = getStreak(habit.id);

                return (
                  <motion.div
                    key={habit.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "group relative bg-white/80 backdrop-blur-2xl p-8 rounded-[40px] shadow-2xl shadow-indigo-500/5 border border-white flex items-center gap-8 transition-all hover:shadow-indigo-500/15 hover:scale-[1.03] hover:-translate-y-1",
                      isCompleted && "bg-gradient-to-r from-indigo-50/80 via-violet-50/80 to-rose-50/80 border-indigo-100/50 shadow-inner"
                    )}
                  >
                    <button 
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        "w-24 h-24 rounded-[32px] flex items-center justify-center text-5xl transition-all duration-700 relative overflow-hidden",
                        isCompleted ? "scale-90 shadow-inner bg-white/80" : "shadow-[0_25px_50px_-12px_rgba(99,102,241,0.3)] hover:scale-105"
                      )}
                      style={{ 
                        backgroundColor: isCompleted ? undefined : habit.color + '30',
                        color: isCompleted ? '#818cf8' : habit.color,
                        border: isCompleted ? '3px solid #e0e7ff' : `3px solid ${habit.color}50`
                      }}
                    >
                      {!isCompleted && (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <Check size={44} strokeWidth={5} className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-rose-500" />
                        </motion.div>
                      ) : habit.icon}
                    </button>

                    <div className="flex-1">
                      <h3 className={cn(
                        "text-3xl font-black tracking-tighter transition-all text-slate-800",
                        isCompleted && "text-slate-300 line-through decoration-[6px] decoration-indigo-200/50"
                      )}>
                        {habit.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2 text-orange-600 font-black text-[11px] uppercase tracking-[0.2em] bg-orange-100/40 px-4 py-1.5 rounded-full border border-orange-200/50 shadow-sm">
                          <Flame size={16} fill="currentColor" />
                          <span>{streak} Day Streak</span>
                        </div>
                        {isCompleted && (
                          <div className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-[0.2em] bg-emerald-100/40 px-4 py-1.5 rounded-full border border-emerald-200/50 shadow-sm">
                            <Check size={14} strokeWidth={4} />
                            <span>Cleared</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteHabit(habit.id)}
                      className="opacity-0 group-hover:opacity-100 p-4 text-slate-300 hover:text-rose-600 transition-all hover:bg-rose-100/50 rounded-[24px] active:scale-90"
                    >
                      <Trash2 size={26} strokeWidth={2.5} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 100 }}
              className="relative w-full max-w-lg bg-white rounded-[72px] p-16 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.4)] border border-indigo-50 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500" />
              
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-10 right-10 p-4 text-slate-400 hover:text-indigo-600 transition-all bg-indigo-50 rounded-[28px] hover:rotate-90 active:scale-90"
              >
                <X size={28} strokeWidth={3} />
              </button>

              <h2 className="text-5xl font-black tracking-tighter mb-12 text-slate-900">New Wing</h2>
              
              <div className="space-y-12">
                <div>
                  <label className="text-[11px] uppercase tracking-[0.4em] text-indigo-400 font-black block mb-5">Identify the Goal</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Morning Run"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="w-full text-4xl font-black border-b-4 border-indigo-50 focus:border-indigo-600 outline-none pb-5 transition-colors text-slate-800 placeholder:text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-[0.4em] text-indigo-400 font-black block mb-6">Visual Identity</label>
                  <div className="grid grid-cols-5 gap-5">
                    {ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setSelectedIcon(icon)}
                        className={cn(
                          "w-16 h-16 rounded-[24px] flex items-center justify-center text-3xl transition-all",
                          selectedIcon === icon 
                            ? "bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-600 text-white scale-110 shadow-2xl shadow-indigo-300" 
                            : "bg-indigo-50/50 hover:bg-indigo-50 text-slate-600"
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-[0.4em] text-indigo-400 font-black block mb-6">Energy Color</label>
                  <div className="flex flex-wrap gap-5">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={cn(
                          "w-12 h-12 rounded-full transition-all relative",
                          selectedColor === color ? "scale-125 ring-4 ring-indigo-100 shadow-xl" : "hover:scale-110"
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {selectedColor === color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={addHabit}
                  disabled={!newHabitName.trim()}
                  className="w-full py-8 bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-600 text-white rounded-[32px] font-black uppercase tracking-[0.3em] text-base hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_25px_50px_-10px_rgba(99,102,241,0.5)] relative overflow-hidden group"
                >
                  <motion.div 
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                  <span className="relative z-10">Launch Wing</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}



