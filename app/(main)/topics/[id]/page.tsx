'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.id as string;

  const [topic, setTopic] = useState<any>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueStatusText, setQueueStatusText] = useState('Enter 1-on-1 Queue');
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Topic details and watchlist status
    fetch(`/api/topics/${topicId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.topic) {
          setTopic(data.topic);
          setIsWatching(Boolean(data.isWatching));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Connect Socket for live matchmaking & watched topic events
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const newSocket = io(socketServerUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected on topic page');
    });

    newSocket.on('match_found', (data: { roomId: string; topicTitle: string }) => {
      setInQueue(false);
      setQueueStatusText('Match Found! Redirecting...');
      setTimeout(() => {
        router.push(`/rooms/${data.roomId}`);
      }, 1000);
    });

    newSocket.on('ai_joining', (data: { roomId: string; topicTitle: string }) => {
      setInQueue(false);
      setQueueStatusText('AI Partner Joined! Redirecting...');
      setTimeout(() => {
        router.push(`/rooms/${data.roomId}`);
      }, 1000);
    });

    newSocket.on('watched_topic_active', (data: { topicId: string; topicTitle: string }) => {
      setToastNotification(`Someone just entered the queue for "${data.topicTitle}" — join now?`);
      setTimeout(() => setToastNotification(null), 8000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [topicId, router]);

  const toggleWatchlist = async () => {
    const method = isWatching ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`/api/topics/${topicId}/watch`, { method });
      if (res.ok) {
        setIsWatching(!isWatching);
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    }
  };

  const handleQueueToggle = () => {
    if (!socket) return;

    if (!inQueue) {
      setInQueue(true);
      setQueueStatusText('Searching for intellectual partner...');
      socket.emit('queue_enter', { topicId });
    } else {
      setInQueue(false);
      setQueueStatusText('Enter 1-on-1 Queue');
      socket.emit('queue_leave', { topicId });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="animate-pulse text-indigo-400 font-medium">Loading topic details...</div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 text-rose-500">Topic Not Found</h1>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 relative">
      {/* Toast Notification for Watched Topic Activity */}
      {toastNotification && (
        <div className="fixed top-6 right-6 z-50 bg-indigo-600/90 backdrop-blur-md border border-indigo-400 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 max-w-md animate-bounce">
          <p className="text-sm font-medium">{toastNotification}</p>
          <button
            onClick={handleQueueToggle}
            className="px-3 py-1 bg-white text-indigo-950 font-bold rounded-lg text-xs hover:bg-gray-100"
          >
            Join Now
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Badge & Action Bar */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{topic.category?.icon || '💡'}</span>
            <span className="text-xs uppercase tracking-wider font-semibold bg-gray-800 text-gray-300 px-3 py-1 rounded-full">
              {topic.category?.name || 'Philosophical Inquiry'}
            </span>
          </div>

          <button
            onClick={toggleWatchlist}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              isWatching
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {isWatching ? '★ Watching Topic' : '☆ Watch Topic'}
          </button>
        </div>

        {/* Title & Description */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {topic.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed font-normal">
            {topic.description}
          </p>
        </div>

        {/* 1-on-1 Matchmaking Section */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-800/50 shadow-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-indigo-300">1-on-1 Intellectual Matchmaking</h2>
            <p className="text-sm text-gray-300">
              Get paired in real time with another thinker whose interest vector complements your philosophical perspective.
            </p>
          </div>

          <button
            onClick={handleQueueToggle}
            className={`w-full py-5 rounded-xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${
              inQueue
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01]'
            }`}
          >
            {inQueue && <span className="w-3 h-3 bg-white rounded-full animate-ping"></span>}
            {queueStatusText}
          </button>
        </div>
      </div>
    </div>
  );
}
