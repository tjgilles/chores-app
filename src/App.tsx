import React, { useState, useEffect, useCallback } from "react";
import { motion, Reorder, AnimatePresence } from "motion/react";
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Users, 
  BarChart3, 
  Settings,
  Trash2,
  ChevronRight,
  UserCircle
} from "lucide-react";

// Firebase Imports
// Corrected Path: Going up one level from /src to the root folder
import { db } from '../firebase'; 
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

// --- Interfaces ---
interface User {
  id: string;
  name: string;
  email: string | null;
}

interface Chore {
  id: string;
  name: string;
  duration: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
  sort_order: number;
  start_date: string | null;
  last_completed_at: string | null;
}

interface Stat {
  name: string;
  completion_count: number;
}

const FREQUENCY_COLORS = {
  daily: { bg: "bg-[#f0f9f1]", text: "text-[#2d5a27]", border: "border-[#d8ead9]", accent: "bg-[#4a7c44]" },
  weekly: { bg: "bg-[#fef9e7]", text: "text-[#7d6608]", border: "border-[#f9e79f]", accent: "bg-[#b7950b]" },
  monthly: { bg: "bg-[#f4f7fb]", text: "text-[#28527a]", border: "border-[#d6e4f0]", accent: "bg-[#396eb0]" },
  quarterly: { bg: "bg-[#f0f4f8]", text: "text-[#1a365d]", border: "border-[#cbd5e0]", accent: "bg-[#2b6cb0]" },
  biannually: { bg: "bg-[#fdf2f0]", text: "text-[#7b341e]", border: "border-[#f5d5cb]", accent: "bg-[#a04000]" },
  yearly: { bg: "bg-[#f5f5f0]", text: "text-[#4a4a4a]", border: "border-[#e0e0d1]", accent: "bg-[#616161]" }
};

export default function App() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [newChore, setNewChore] = useState({ 
    name: "", 
    duration: "", 
    frequency: "daily" as Chore['frequency'],
    start_date: new Date().toISOString().split('T')[0]
  });
  const [newUser, setNewUser] = useState({ name: "", email: "" });

  // --- Real-time Data Sync ---
  useEffect(() => {
    // 1. Listen for Chores
    const qChores = query(collection(db, "chores"), orderBy("sort_order", "asc"));
    const unsubscribeChores = onSnapshot(qChores, (snapshot) => {
      const choresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chore[];
      setChores(choresData);
    });

    // 2. Listen for Users
    const qUsers = collection(db, "users");
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);
      if (!currentUser && usersData.length > 0) {
        setCurrentUser(usersData[0]);
      }
    });

    // 3. Listen for Completions (The Leaderboard Logic)
    const qStats = collection(db, "completions");
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userName) {
          counts[data.userName] = (counts[data.userName] || 0) + 1;
        }
      });
      
      const statsData = Object.entries(counts).map(([name, count]) => ({
        name,
        completion_count: count
      }));
      setStats(statsData);
    });

    return () => {
      unsubscribeChores();
      unsubscribeUsers();
      unsubscribeStats(); // Clean up all three listeners
    };
  }, [currentUser]);

// --- Handlers ---
  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChore.name) return;

    try {
      if (editingChore) {
        const choreRef = doc(db, "chores", editingChore);
        await updateDoc(choreRef, { ...newChore });
      } else {
        await addDoc(collection(db, "chores"), {
          ...newChore,
          created_at: new Date().toISOString(),
          sort_order: chores.length
        });
      }
      
      setIsAdding(false);
      setEditingChore(null);
      setNewChore({ name: '', duration: '', frequency: 'weekly', start_date: '' });
    } catch (error) {
      console.error("Error saving chore:", error);
    }
  };

  const handleDeleteChore = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this chore?")) return;
    try {
      await deleteDoc(doc(db, "chores", id));
    } catch (error) {
      console.error("Error deleting chore:", error);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingChore) return;
    // We use editingChore as an ID string based on handleEdit logic
    if (!window.confirm(`Delete this chore?`)) return;

    try {
      await deleteDoc(doc(db, "chores", editingChore));
      setEditingChore(null);
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to delete chore:", error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name) return;
    try {
      await addDoc(collection(db, "users"), { 
        name: newUser.name, 
        email: newUser.email 
      });
      setNewUser({ name: "", email: "" });
    } catch (error) {
      console.error("Failed to add user:", error);
    }
  };

  const handleDeleteUser = async (e: React.MouseEvent, userId: string, userName: string) => {
    e.preventDefault();
    if (!window.confirm(`Remove ${userName}?`)) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      if (currentUser?.id === userId) setCurrentUser(null);
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleComplete = async (choreId: string) => {
    if (!currentUser) return;
    try {
      const choreRef = doc(db, "chores", choreId);
      await updateDoc(choreRef, {
        last_completed_at: new Date().toISOString()
      });

      await addDoc(collection(db, "completions"), {
        choreId,
        userId: currentUser.id,
        userName: currentUser.name,
        completedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to complete chore:", error);
    }
  };

  const handleReorder = async (newOrder: Chore[]) => {
    setChores(newOrder);
    // Logic for Firebase sync can be added here
  };

  const handleEdit = (chore: Chore) => {
    setEditingChore(chore.id);
    setNewChore({
      name: chore.name,
      duration: chore.duration,
      frequency: chore.frequency,
      start_date: chore.start_date || ''
    });
    setIsAdding(true);
  };
 const getDaysOverdue = (chore: Chore) => {
    const now = new Date();
    // Normalize "Today" to midnight for clean comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // 1. Check the Start Date first
    if (chore.start_date) {
      const start = new Date(chore.start_date);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      
      // If today is BEFORE the start date, it's not due yet (returns a negative number)
      if (today < startDate) {
        return -1; 
      }
    }

    // 2. If never completed, calculate from Start Date or default to today
    if (!chore.last_completed_at) {
      if (!chore.start_date) return 0;
      const start = new Date(chore.start_date);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const diff = today - startDate;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    // 3. Standard frequency calculation
    const last = new Date(chore.last_completed_at);
    const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
    const diff = today - lastDate;
    const daysSince = Math.floor(diff / (1000 * 60 * 60 * 24));

    switch (chore.frequency) {
      case 'daily': return daysSince - 1;
      case 'weekly': return daysSince - 7;
      case 'monthly': return daysSince - 30;
      case 'quarterly': return daysSince - 91;
      case 'biannually': return daysSince - 182;
      case 'yearly': return daysSince - 365;
      default: return 0;
    }
  };

  const isDue = (chore: Chore) => getDaysOverdue(chore) >= 0;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      <header className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">ChoreSync</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-[300px] md:max-w-md no-scrollbar">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => setCurrentUser(user)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                    currentUser?.id === user.id ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {user.name}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsManagingUsers(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100"
            >
              <Users size={18} />
              <span className="text-sm font-medium hidden md:inline">Manage</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Household Chores</h2>
                <p className="text-gray-500 mt-1">Real-time sync active.</p>
              </div>
              <button 
            onClick={() => {
              setEditingChore(null);
              setNewChore({ name: '', duration: '', frequency: 'weekly', start_date: '' });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} /> Add New Chore
          </button>
            </div>

            <Reorder.Group 
            axis="y" 
            values={chores} 
            onReorder={handleReorder} 
            className="space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {chores.map((chore) => (
                <Reorder.Item
                  key={chore.id}
                  value={chore}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex items-center gap-6 group relative"
                >
                  <button
                    onClick={() => handleComplete(chore.id)}
                    className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${
                      !isDue(chore)
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                        : 'border-gray-100 text-transparent hover:border-emerald-500 hover:text-emerald-500'
                    }`}
                  >
                    <CheckCircle2 size={24} />
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{chore.name}</h3>
                      <div>
                        {getDaysOverdue(chore) < 0 ? (
                          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Upcoming</span>
                        ) : !isDue(chore) ? (
                          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Completed</span>
                        ) : getDaysOverdue(chore) > 0 ? (
                          <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full">{getDaysOverdue(chore)} Days Overdue</span>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Due Today</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5"><Clock size={14} /> {chore.duration}</span>
                      <span className={`flex items-center gap-1.5 capitalize px-2 py-0.5 rounded-md border ${FREQUENCY_COLORS[chore.frequency].bg} ${FREQUENCY_COLORS[chore.frequency].text} ${FREQUENCY_COLORS[chore.frequency].border}`}>
                        <Calendar size={14} /> {chore.frequency}
                      </span>
                      {chore.start_date && (
                        <span className="flex items-center gap-1.5 ml-2">
                          <Calendar size={14} className="text-emerald-500" />
                          <span className="text-gray-400">Starts:</span> {new Date(chore.start_date + 'T00:00:00').toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEdit(chore)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteChore(chore.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
          </div>

          <div className="space-y-8">
            {/* 1. Household Activity / Leaderboard */}
            <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <BarChart3 size={20} />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Leaderboard</h2>
              </div>
              
              <div className="space-y-6">
                {stats.length > 0 ? stats.map((userStat) => (
                  <div key={userStat.name} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{userStat.name}</span>
                      <span className="text-emerald-600 font-bold">{userStat.completion_count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((userStat.completion_count / 10) * 100, 100)}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 italic">No activity recorded yet this week.</p>
                )}
              </div>
            </section>

            {/* 2. Smart Notifications / Black Box */}
            <section className="bg-black text-white p-8 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold tracking-tight">Smart Notifications</h3>
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Live Sync
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 font-mono">Daily Digest</p>
                  <div className="space-y-3">
                    {chores.filter(c => isDue(c)).length > 0 ? (
                      chores.filter(c => isDue(c)).slice(0, 3).map(chore => (
                        <div key={chore.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div className={`w-2 h-2 rounded-full ${FREQUENCY_COLORS[chore.frequency].bg.replace('bg-', 'bg-')}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{chore.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tight">Action Required</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-emerald-400 italic">You're all caught up! ✨</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-4 font-mono">Sunday Preview</p>
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                    <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                      {chores.length} tasks in rotation. 
                      <strong> {chores.filter(c => isDue(c)).length}</strong> are currently due.
                    </p>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full" 
                        style={{ width: `${(chores.filter(c => !isDue(c)).length / chores.length) * 100}%` }}

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.form 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleAddChore} 
              className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <h2 className="text-2xl font-bold">{editingChore ? "Edit" : "New"} Chore</h2>
              <input type="text" value={newChore.name} onChange={e => setNewChore({...newChore, name: e.target.value})} placeholder="Chore Name" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3" />
            <div className="grid grid-cols-2 gap-4">
                <input type="text" value={newChore.duration} onChange={e => setNewChore({...newChore, duration: e.target.value})} placeholder="Duration" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3" />
                <select value={newChore.frequency} onChange={e => setNewChore({...newChore, frequency: e.target.value as any})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannually">Biannually</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">Start Date</label>
                <input 
                  type="date" 
                  value={newChore.start_date || ''} 
                  onChange={e => setNewChore({...newChore, start_date: e.target.value})} 
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all" 
                />
                <p className="text-[10px] text-gray-400 mt-1">The chore will stay in "Upcoming" status until this date.</p>
              </div>
              <div className="flex gap-3 pt-4">
                {editingChore && <button type="button" onClick={handleDelete} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={24} /></button>}
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 px-6 py-3 font-bold text-gray-500">Cancel</button>
                <button type="submit" className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200">Save</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

     {/* Manage Users Modal */}
      <AnimatePresence>
        {isManagingUsers && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsManagingUsers(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6">
              <h2 className="text-2xl font-bold">People</h2>
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{user.name}</span>
                      <p className="text-[10px] text-gray-500">{user.email || "No email"}</p>
                    </div>
                    <button onClick={(e) => handleDeleteUser(e, user.id, user.name)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddUser} className="pt-4 border-t space-y-3">
                <input type="text" placeholder="Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3" />
                <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3" />
                <button type="submit" className="w-full px-6 py-3 bg-black text-white rounded-xl font-bold">Add Person</button>
              </form>
              <button onClick={() => setIsManagingUsers(false)} className="w-full py-3 text-gray-500">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
