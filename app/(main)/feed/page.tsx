"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Users, Plus, Search, Sparkles, ArrowRight } from "lucide-react";

export default function FeedPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeedData() {
      try {
        const [roomsRes, topicsRes, catsRes] = await Promise.all([
          fetch(`/api/rooms${selectedCategory ? `?categoryId=${selectedCategory}` : ""}`),
          fetch("/api/topics"),
          fetch("/api/categories"),
        ]);

        if (roomsRes.ok) {
          const rData = await roomsRes.json();
          setRooms(rData.rooms || []);
        }

        if (topicsRes.ok) {
          const tData = await topicsRes.json();
          setTopics(tData.topics || []);
        }

        if (catsRes.ok) {
          const cData = await catsRes.json();
          setCategories(cData.categories || []);
        }
      } catch (err) {
        console.error("Failed to load feed data", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeedData();
  }, [selectedCategory]);

  const filteredRooms = rooms.filter((r) => {
    if (!searchQuery) return true;
    const title = r.customTopic || r.systemTopic?.title || "";
    const desc = r.customDescription || r.systemTopic?.description || "";
    return (
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header & Hero Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-800 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              Dialectic Feed
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Explore active group rooms, browse system topics, and engage in real-time philosophical inquiry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/topics"
              className="px-4 py-2.5 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-semibold text-gray-200 transition"
            >
              Browse All Topics
            </Link>
            <Link
              href="/rooms/new"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Group Room
            </Link>
          </div>
        </div>

        {/* Search and Category Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search group rooms or topics..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                selectedCategory === ""
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All Categories
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

        {/* Active Group Rooms Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Active Group Discussion Rooms
            </h2>
            <span className="text-xs text-gray-400 font-medium">
              {filteredRooms.length} Rooms Available
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500 font-medium animate-pulse">
              Loading active group rooms...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
              <p className="text-gray-400 text-sm">No active group rooms matching your filter.</p>
              <Link
                href="/rooms/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition"
              >
                <Plus className="w-4 h-4" />
                Start a New Group Room
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((r) => {
                const title = r.customTopic || r.systemTopic?.title || "Philosophical Inquiry";
                const desc = r.customDescription || r.systemTopic?.description || "Open debate and discussion room.";
                const count = r.participants?.length || 1;
                const cap = r.cap || 10;

                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/rooms/${r.id}`)}
                    className="bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl space-y-4 transition hover:scale-[1.01] cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 rounded-md uppercase tracking-wider">
                          {r.category?.name || "Group Room"}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{count}/{cap}</span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white leading-snug line-clamp-2">
                        {title}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                        {desc}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-gray-800/80 text-xs text-indigo-400 font-semibold">
                      <span>Enter Chat Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Featured System Topics Carousel/Grid */}
        <div className="space-y-4 pt-6 border-t border-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Browse System Topics for 1-on-1 Matchmaking
            </h2>
            <Link href="/topics" className="text-xs text-indigo-400 hover:underline font-semibold">
              View All Topics ({topics.length})
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {topics.slice(0, 6).map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/topics/${t.id}`)}
                className="bg-gray-900/60 border border-gray-800/80 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-3 hover:bg-gray-900 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.category?.icon || "🧠"}</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t.category?.name || "System Topic"}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white leading-snug">
                  {t.title}
                </h4>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
