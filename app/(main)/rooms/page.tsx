"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Users, Plus, Search, ArrowRight } from "lucide-react";

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRooms() {
      try {
        const [roomsRes, catsRes] = await Promise.all([
          fetch(`/api/rooms${selectedCategory ? `?categoryId=${selectedCategory}` : ""}`),
          fetch("/api/categories"),
        ]);

        if (roomsRes.ok) {
          const rData = await roomsRes.json();
          setRooms(rData.rooms || []);
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

    loadRooms();
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
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-800 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-indigo-400" />
              Group Discussion Rooms
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Join active group rooms or launch your own multi-participant philosophical room.
            </p>
          </div>

          <Link
            href="/rooms/new"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Group Room
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
              placeholder="Search group topics or descriptions..."
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

        {/* Rooms Grid */}
        {loading ? (
          <div className="text-center py-16 text-gray-500 font-medium animate-pulse">
            Loading active group rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-4">
            <p className="text-gray-400 text-sm">No active group rooms match your filters.</p>
            <Link
              href="/rooms/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition"
            >
              <Plus className="w-4 h-4" />
              Create Group Room
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((r) => {
              const title = r.customTopic || r.systemTopic?.title || "Philosophical Dialogue";
              const desc = r.customDescription || r.systemTopic?.description || "Open debate and discussion room.";
              const count = r.participants?.length || 1;
              const cap = r.cap || 10;

              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/rooms/${r.id}`)}
                  className="bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl space-y-4 transition hover:scale-[1.01] cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 rounded-md uppercase tracking-wider">
                        {r.category?.name || "Group Room"}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{count}/{cap}</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white leading-snug">
                      {title}
                    </h3>

                    <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                      {desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-indigo-400 font-semibold">
                    <span>Enter Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
