"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles, ArrowRight, Bookmark } from "lucide-react";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopicsData() {
      try {
        const [topicsRes, catsRes] = await Promise.all([
          fetch(`/api/topics${selectedCategory ? `?categoryId=${selectedCategory}` : ""}`),
          fetch("/api/categories"),
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadTopicsData();
  }, [selectedCategory]);

  const filteredTopics = topics.filter((t) => {
    if (!searchQuery) return true;
    return (
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-800 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              Browse Philosophical Topics
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Select a system topic to enter the 1-on-1 semantic matchmaking queue or watch for live discussions.
            </p>
          </div>

          <Link
            href="/feed"
            className="px-4 py-2.5 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-semibold text-gray-200 transition"
          >
            Back to Feed
          </Link>
        </div>

        {/* Filter and Search controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search philosophical topics..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                selectedCategory === ""
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All Domains
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 border ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <span>{cat.icon || "💡"}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topics Grid */}
        {loading ? (
          <div className="text-center py-16 text-gray-500 font-medium animate-pulse">
            Loading topics catalog...
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-400 text-sm">
            No system topics match your search criteria.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopics.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/topics/${t.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl space-y-4 transition hover:scale-[1.01] cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.category?.icon || "🧠"}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t.category?.name || "System Topic"}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white leading-snug">
                    {t.title}
                  </h3>

                  <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                    {t.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Enter 1-on-1 Queue</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
