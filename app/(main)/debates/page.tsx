'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PublicDebatesPage() {
  const [debates, setDebates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebates();
  }, []);

  const fetchDebates = async (query = '') => {
    setLoading(true);
    try {
      const endpoint = query ? `/api/search?q=${encodeURIComponent(query)}` : '/api/debates';
      const res = await fetch(endpoint);
      const data = await res.json();

      if (query) {
        setDebates(data.results?.rooms || []);
      } else {
        setDebates(data.debates || []);
      }
    } catch (err) {
      console.error('Failed to fetch debates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDebates(searchQuery);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 space-y-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          Public Philosophical Debates
        </h1>
        <p className="text-lg text-gray-400">
          Explore published dialogues, AI digests, and argument maps from the Sokrates community.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="pt-4 flex gap-3">
          <input
            type="text"
            placeholder="Search debates by keyword or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-5 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl text-white transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Grid of Public Debates */}
      <div className="max-w-5xl mx-auto">
        {loading ? (
          <div className="text-center py-16 text-indigo-400 font-medium animate-pulse">
            Loading public debates...
          </div>
        ) : debates.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-gray-900/40 rounded-2xl border border-gray-800">
            No public debates found matching your query.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {debates.map((d) => (
              <div
                key={d.id}
                className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-4 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 bg-indigo-950 text-indigo-300 rounded-full border border-indigo-800/50">
                      {d.type === 'ONE_ON_ONE' || d.type === '1on1' ? '1-on-1 Debate' : 'Group Room'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    {d.systemTopic?.title || d.customTopic || 'Philosophical Dialogue'}
                  </h3>

                  <p className="text-sm text-gray-300 line-clamp-3">
                    {d.digest?.summary || d.postChatDigest?.summaryStanceUser1 || d.customDescription || 'No summary available.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {d.participants?.length || 2} Participants
                  </span>

                  <div className="flex gap-2">
                    <Link
                      href={`/conversations/${d.id}/map`}
                      className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 text-xs font-semibold rounded-lg transition-all"
                    >
                      Argument Map
                    </Link>
                    <Link
                      href={`/debates/${d.id}`}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      View Debate
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
