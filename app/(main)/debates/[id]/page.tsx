'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicDebateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const debateId = params.id as string;

  const [debate, setDebate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rooms/${debateId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) setDebate(data.room);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="animate-pulse text-indigo-400 font-medium">Loading debate transcript...</div>
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 text-rose-500">Debate Not Found</h1>
        <button
          onClick={() => router.push('/debates')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
        >
          Return to Showcase
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 space-y-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto space-y-4 border-b border-gray-800 pb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-bold bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-800">
            {debate.type === 'ONE_ON_ONE' || debate.type === '1on1' ? '1-on-1 Dialogue' : 'Group Discussion'}
          </span>

          <Link
            href={`/conversations/${debateId}/map`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
          >
            View Argument Map Graph
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-white">
          {debate.systemTopic?.title || debate.customTopic || 'Philosophical Debate'}
        </h1>

        {debate.digest && (
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 leading-relaxed">
            <strong className="text-indigo-400 block mb-1">AI Digest Summary:</strong>
            {debate.digest.summary}
          </div>
        )}
      </div>

      {/* Message Timeline Log */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h3 className="text-lg font-bold text-gray-300">Transcript Log</h3>

        {debate.messages && debate.messages.length > 0 ? (
          <div className="space-y-4">
            {debate.messages.map((m: any) => (
              <div
                key={m.id}
                className={`p-4 rounded-xl border ${
                  m.isAi
                    ? 'bg-purple-950/30 border-purple-800/50 text-purple-100'
                    : 'bg-gray-900 border-gray-800 text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-400">
                    {m.sender?.username || (m.isAi ? 'Sokrates AI' : 'Participant')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{m.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-900 rounded-xl border border-gray-800 text-gray-500">
            No messages recorded in this debate.
          </div>
        )}
      </div>
    </div>
  );
}
