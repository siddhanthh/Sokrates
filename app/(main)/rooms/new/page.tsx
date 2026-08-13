"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, ArrowLeft, Sparkles } from "lucide-react";

export default function NewRoomPage() {
  const router = useRouter();
  const [customTopic, setCustomTopic] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cap, setCap] = useState(10);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          if (data.categories?.length > 0) {
            setCategoryId(data.categories[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customTopic.trim()) {
      setError("Custom topic is required");
      return;
    }

    if (cap < 2 || cap > 20) {
      setError("Participant cap must be between 2 and 20");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("sokrates_token");
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customTopic,
          customDescription,
          categoryId,
          cap,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create group room");
      }

      if (data.room?.id) {
        router.push(`/rooms/${data.room.id}`);
      } else {
        router.push("/rooms");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            className="p-2 hover:bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Create Group Room
            </h1>
            <p className="text-sm text-gray-400">
              Host a structured philosophical room with AI-generated discussion starters.
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/40 text-rose-400 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Discussion Topic Title *
              </label>
              <input
                type="text"
                required
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Is social contract theory adequate for digital statecraft?"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Topic Description & Context
              </label>
              <textarea
                rows={3}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Outline the core philosophical premises, assumptions, or questions for room participants..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Category Domain
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || "💡"} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Participant Cap (2 - 20)
                </label>
                <span className="text-sm font-bold text-indigo-400">{cap} Members</span>
              </div>
              <input
                type="range"
                min={2}
                max={20}
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3.5 text-sm shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                {loading ? "Creating Group Room..." : "Launch Group Room & Generate Starters"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
