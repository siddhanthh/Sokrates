"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatRoom } from "@/components/chat/ChatRoom";

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params.id as string;

  const [roomData, setRoomData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("sokrates_token");
      const storedUser = localStorage.getItem("sokrates_user");
      if (storedToken) setToken(storedToken);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setCurrentUserId(parsed.id);
        } catch (e) {}
      }
    }

    fetch(`/api/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) {
          setRoomData(data.room);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-indigo-400 font-medium animate-pulse">
          Connecting to Sokrates dialectic server...
        </div>
      </div>
    );
  }

  return (
    <ChatRoom
      roomId={roomId}
      initialRoomData={roomData}
      currentUserId={currentUserId}
      token={token}
    />
  );
}
