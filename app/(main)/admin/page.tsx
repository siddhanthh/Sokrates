'use client';

import React, { useState, useEffect } from 'react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isForbidden, setIsForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  // Topic Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }
      const statsData = await statsRes.json();
      setStats(statsData.stats);

      const [topicsRes, catsRes] = await Promise.all([
        fetch('/api/admin/topics'),
        fetch('/api/interests/categories'),
      ]);

      if (topicsRes.ok) {
        const tData = await topicsRes.json();
        setTopics(tData.topics || []);
      }

      if (catsRes.ok) {
        const cData = await catsRes.json();
        setCategories(cData.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !categoryId) return;

    try {
      if (editingTopicId) {
        // Update
        const res = await fetch(`/api/admin/topics/${editingTopicId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, categoryId }),
        });
        if (res.ok) {
          setShowModal(false);
          resetForm();
          fetchAdminData();
        }
      } else {
        // Create
        const res = await fetch('/api/admin/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, categoryId }),
        });
        if (res.ok) {
          setShowModal(false);
          resetForm();
          fetchAdminData();
        }
      }
    } catch (err) {
      console.error('Failed to save topic:', err);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    try {
      const res = await fetch(`/api/admin/topics/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to delete topic:', err);
    }
  };

  const resetForm = () => {
    setEditingTopicId(null);
    setTitle('');
    setDescription('');
    setCategoryId('');
  };

  const openEditModal = (t: any) => {
    setEditingTopicId(t.id);
    setTitle(t.title);
    setDescription(t.description);
    setCategoryId(t.categoryId || t.category?.id || '');
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="animate-pulse text-indigo-400 font-medium">Loading admin dashboard...</div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <div className="p-8 bg-rose-950/40 border border-rose-800/50 rounded-2xl max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-rose-400">403 Access Forbidden</h1>
          <p className="text-sm text-gray-300">
            You do not have administrative privileges to access this control panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-10 space-y-10">
      {/* Dashboard Title Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Admin Operations Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Site metrics, moderation tools, and System Topics CRUD management
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm rounded-xl transition-all shadow-lg"
        >
          + Add System Topic
        </button>
      </div>

      {/* Stats Cards Row */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-2">
            <span className="text-xs uppercase font-bold text-gray-400">Total Users</span>
            <div className="text-3xl font-extrabold text-indigo-400">{stats.totalUsers || 0}</div>
          </div>
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-2">
            <span className="text-xs uppercase font-bold text-gray-400">Total Rooms</span>
            <div className="text-3xl font-extrabold text-purple-400">{stats.totalRooms || 0}</div>
          </div>
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-2">
            <span className="text-xs uppercase font-bold text-gray-400">Active Rooms</span>
            <div className="text-3xl font-extrabold text-emerald-400">{stats.activeRooms || 0}</div>
          </div>
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-2">
            <span className="text-xs uppercase font-bold text-gray-400">Public Debates</span>
            <div className="text-3xl font-extrabold text-amber-400">{stats.totalDebates || 0}</div>
          </div>
        </div>
      )}

      {/* System Topics Management Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-200">System Topics Directory</h2>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950 text-xs uppercase font-semibold text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {topics.map((t) => (
                <tr key={t.id} className="hover:bg-gray-850/50">
                  <td className="p-4 font-bold text-white">{t.title}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-gray-800 text-gray-300 text-xs rounded-md">
                      {t.category?.name || 'Category'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 max-w-md truncate">{t.description}</td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(t)}
                      className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-lg text-indigo-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(t.id)}
                      className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-xs font-semibold rounded-lg text-rose-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingTopicId ? 'Edit System Topic' : 'Add New System Topic'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="e.g. Does objective reality exist?"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  required
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Detailed context and core questions for this discussion topic..."
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm rounded-xl font-bold text-white shadow-lg"
                >
                  {editingTopicId ? 'Save Changes' : 'Create Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
