/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

interface User {
  id: number;
  name: string;
  email: string | null;
}

interface Chore {
  id: number;
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
  daily: {
    bg: "bg-[#f0f9f1]", // Light Sage
    text: "text-[#2d5a27]",
    border: "border-[#d8ead9]",
    accent: "bg-[#4a7c44]"
  },
  weekly: {
    bg: "bg-[#fef9e7]", // Light Wheat
    text: "text-[#7d6608]",
    border: "border-[#f9e79f]",
    accent: "bg-[#b7950b]"
  },
  monthly: {
    bg: "bg-[#f4f7fb]", // Sky Mist
    text: "text-[#28527a]",
    border: "border-[#d6e4f0]",
    accent: "bg-[#396eb0]"
  },
  quarterly: {
    bg: "bg-[#f0f4f8]", // Cool Blue
    text: "text-[#1a365d]",
    border: "border-[#cbd5e0]",
    accent: "bg-[#2b6cb0]"
  },
  biannually: {
    bg: "bg-[#fdf2f0]", // Soft Clay
    text: "text-[#7b341e]",
    border: "border-[#f5d5cb]",
    accent: "bg-[#a04000]"
  },
  yearly: {
    bg: "bg-[#f5f5f0]", // Stone
    text: "text-[#4a4a4a]",
    border: "border-[#e0e0d1]",
    accent: "bg-[#616161]"
  }
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

  const fetchData = useCallback(async () => {
    try {
      const [choresRes, usersRes, statsRes] = await Promise.all([
        fetch("/api/chores"),
        fetch("/api/users"),
        fetch("/api/stats")
      ]);
      
      const choresData = await choresRes.json();
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      setChores(choresData);
      setUsers(usersData);
      setStats(statsData);
      
      if (!currentUser && usersData.length > 0) {
        setCurrentUser(usersData[0]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();

    // WebSocket setup
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (["CHORE_ADDED", "CHORES_REORDERED", "CHORE_COMPLETED", "CHORE_UPDATED", "CHORE_DELETED", "USER_ADDED", "USER_DELETED"].includes(data.type)) {
        fetchData();
      }
    };

    return () => socket.close();
  }, [fetchData]);

  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChore.name) return;

    try {
      if (editingChore) {
        const res = await fetch(`/api/chores/${editingChore.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newChore)
        });
        if (res.ok) {
          setEditingChore(null);
          setIsAdding(false);
          fetchData();
        }
      } else {
        const res = await fetch("/api/chores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newChore)
        });
        if (res.ok) {
          setNewChore({ 
            name: "", 
            duration: "", 
            frequency: "daily",
            start_date: new Date().toISOString().split('T')[0]
          });
          setIsAdding(false);
          fetchData();
        }
      }
    } catch (error) {
      console.error("Failed to save chore:", error);
    }
  };

  const handleEdit = (chore: Chore) => {
    setEditingChore(chore);
    setNewChore({
      name: chore.name,
      duration: chore.duration,
      frequency: chore.frequency,
      start_date: chore.start_date ? chore.start_date.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setIsAdding(true);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editingChore) return;
    if (!window.confirm(`Are you sure you want to delete "${editingChore.name}"?`)) return;

    console.log("Deleting chore:", editingChore.id);
    try {
      const res = await fetch(`/api/chores/${editingChore.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        console.log("Chore deleted successfully");
        setEditingChore(null);
        setIsAdding(false);
        setNewChore({ 
          name: "", 
          duration: "", 
          frequency: "daily",
          start_date: new Date().toISOString().split('T')[0]
        });
        fetchData();
      } else {
        console.error("Failed to delete chore:", res.statusText);
      }
    } catch (error) {
      console.error("Failed to delete chore:", error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name) return;

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setNewUser({ name: "", email: "" });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add user:", error);
    }
  };

  const handleDeleteUser = async (e: React.MouseEvent, userId: number, userName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Deleting user:", userId, userName);
    if (!window.confirm(`Are you sure you want to remove ${userName}? This will delete all their chore completions too.`)) return;
    
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        console.log("User deleted successfully");
        if (currentUser?.id === userId) {
          setCurrentUser(null);
        }
        fetchData();
      } else {
        const errorData = await res.json();
        console.error("Failed to delete user:", errorData.error);
        alert("Failed to delete user: " + errorData.error);
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };
  const handleComplete = async (choreId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/chores/${choreId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to complete chore:", error);
    }
  };

  const handleReorder = async (newOrder: Chore[]) => {
    setChores(newOrder);
    try {
      await fetch("/api/chores/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: newOrder.map((c, i) => ({ id: c.id, sort_order: i + 1 }))
        })
      });
    } catch (error) {
      console.error("Failed to reorder chores:", error);
    }
  };

  const getDaysOverdue = (chore: Chore) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (!chore.last_completed_at) {
      if (!chore.start_date) return 1; // Arbitrary overdue if no start date and never completed
      const start = new Date(chore.start_date);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const diff = today.getTime() - startDate.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const last = new Date(chore.last_completed_at);
    const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    const diff = today.getTime() - lastDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    switch (chore.frequency) {
      case 'daily': return days - 1;
      case 'weekly': return days - 7;
      case 'monthly': return days - 30;
      case 'quarterly': return days - 91;
      case 'biannually': return days - 182;
      case 'yearly': return days - 365;
      default: return 0;
    }
  };

  const isDue = (chore: Chore) => {
    return getDaysOverdue(chore) >= 0;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Header */}
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
                    currentUser?.id === user.id 
                      ? "bg-white text-emerald-600 shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {user.name}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsManagingUsers(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100"
              title="Manage Users"
            >
              <Users size={18} />
              <span className="text-sm font-medium hidden md:inline">Manage</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Chores List */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Household Chores</h2>
                <p className="text-gray-500 mt-1">Drag to reorder. Click to complete.</p>
              </div>
              <button 
                onClick={() => setIsAdding(true)}
                className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl"
              >
                <Plus size={24} />
              </button>
            </div>

            <Reorder.Group axis="y" values={chores} onReorder={handleReorder} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {chores.map((chore) => (
                  <Reorder.Item
                    key={chore.id}
                    value={chore}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`group bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                      !isDue(chore) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleComplete(chore.id);
                          }}
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                            isDue(chore) 
                              ? `${FREQUENCY_COLORS[chore.frequency].bg} ${FREQUENCY_COLORS[chore.frequency].text} hover:${FREQUENCY_COLORS[chore.frequency].accent} hover:text-white` 
                              : "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}
                          title={isDue(chore) ? "Mark as complete" : "Complete early"}
                        >
                          <CheckCircle2 size={28} />
                        </button>
                        <div>
                          <h3 className="text-xl font-semibold">{chore.name}</h3>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Clock size={14} /> {chore.duration}
                            </span>
                            <span className={`flex items-center gap-1.5 capitalize px-2 py-0.5 rounded-md border ${FREQUENCY_COLORS[chore.frequency].bg} ${FREQUENCY_COLORS[chore.frequency].text} ${FREQUENCY_COLORS[chore.frequency].border}`}>
                              <Calendar size={14} /> {chore.frequency}
                            </span>
                            {chore.start_date && !chore.last_completed_at && (
                              <span className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-emerald-500" /> Starts: {new Date(chore.start_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          {!isDue(chore) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                              Completed
                            </span>
                          ) : getDaysOverdue(chore) > 0 ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full">
                              {getDaysOverdue(chore) === 1 ? "1 Day Overdue" : `${getDaysOverdue(chore)} Days Overdue`}
                            </span>
                          ) : (
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                              Due Today
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(chore);
                          }}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Edit Chore"
                        >
                          <Settings size={18} />
                        </button>
                      </div>
                    </div>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>

            {chores.length === 0 && !isAdding && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400">No chores added yet. Start by clicking the + button.</p>
              </div>
            )}
          </div>

          {/* Right Column: Stats & Progress */}
          <div className="space-y-8">
            <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <BarChart3 className="text-emerald-600" />
                <h2 className="text-xl font-bold">Progress Tracking</h2>
              </div>
              
              <div className="space-y-6">
                {stats.map((stat) => (
                  <div key={stat.name}>
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-medium text-gray-700">{stat.name}</span>
                      <span className="text-2xl font-bold">{stat.completion_count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (stat.completion_count / (chores.length || 1)) * 100)}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-black text-white p-8 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Smart Notifications</h3>
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Daily Digest (8:00 AM)</p>
                  <div className="space-y-2">
                    {chores.filter(c => isDue(c)).slice(0, 2).map(chore => (
                      <div key={chore.id} className={`p-3 rounded-xl border ${FREQUENCY_COLORS[chore.frequency].bg} ${FREQUENCY_COLORS[chore.frequency].text} ${FREQUENCY_COLORS[chore.frequency].border} opacity-90`}>
                        <p className="font-bold text-sm">{chore.name}</p>
                        <p className="text-[10px] opacity-70 uppercase tracking-tighter">{chore.frequency} • {chore.duration}</p>
                      </div>
                    ))}
                    {chores.filter(c => isDue(c)).length === 0 && (
                      <p className="text-xs text-emerald-400 italic">No chores due today! ✨</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Sunday Weekly Preview (6:00 PM)</p>
                  <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                    A summary of all chores coming due in the next 7 days to help you plan your week.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {chores.slice(0, 4).map(chore => (
                      <div key={chore.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-[10px] font-bold truncate">{chore.name}</p>
                        <p className="text-[8px] text-gray-500 uppercase">{chore.frequency}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Add Chore Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.form 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleAddChore}
              className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <h2 className="text-2xl font-bold">{editingChore ? "Edit Chore" : "Add New Chore"}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">Chore Name</label>
                  <input 
                    autoFocus
                    type="text"
                    value={newChore.name}
                    onChange={e => setNewChore({...newChore, name: e.target.value})}
                    placeholder="e.g. Mowing the lawn"
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">Duration</label>
                    <input 
                      type="text"
                      value={newChore.duration}
                      onChange={e => setNewChore({...newChore, duration: e.target.value})}
                      placeholder="e.g. 30 mins"
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">Frequency</label>
                    <select 
                      value={newChore.frequency}
                      onChange={e => setNewChore({...newChore, frequency: e.target.value as Chore['frequency']})}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="biannually">Biannually</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">Start Date</label>
                  <input 
                    type="date"
                    value={newChore.start_date}
                    onChange={e => setNewChore({...newChore, start_date: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">The chore will not be due until this date.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {editingChore && (
                  <button 
                    type="button"
                    onClick={handleDelete}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center"
                    title="Delete Chore"
                  >
                    <Trash2 size={24} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingChore(null);
                    setNewChore({ 
                      name: "", 
                      duration: "", 
                      frequency: "daily",
                      start_date: new Date().toISOString().split('T')[0]
                    });
                  }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  {editingChore ? "Update" : "Save"} Chore
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Users Modal */}
      <AnimatePresence>
        {isManagingUsers && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingUsers(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <h2 className="text-2xl font-bold">Manage People</h2>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {users.length === 0 && (
                  <p className="text-center py-4 text-gray-400 text-sm italic">No people added yet.</p>
                )}
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-transparent hover:border-emerald-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[150px]">{user.email || "No email"}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteUser(e, user.id, user.name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center"
                      title={`Remove ${user.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddUser} className="pt-4 border-t border-gray-100 space-y-4">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Add New Person</p>
                <input 
                  type="text"
                  placeholder="Name"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <input 
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <button 
                  type="submit"
                  className="w-full px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Add Person
                </button>
              </form>

              <button 
                onClick={() => setIsManagingUsers(false)}
                className="w-full px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
