"use client";

import React, { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { MessageList, ChatMessage } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { JoinRequestModal, JoinRequestItem } from "./JoinRequestModal";
import { Users, Bot, MessageSquare, ArrowLeft, LogOut, UserPlus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export interface ChatRoomProps {
  roomId: string;
  initialRoomData?: any;
  currentUserId?: string;
  token?: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  roomId,
  initialRoomData,
  currentUserId,
  token,
}) => {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<any>(initialRoomData || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [activeCount, setActiveCount] = useState<number>(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [streamingAi, setStreamingAi] = useState<string>("");
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [userJoined, setUserJoined] = useState(false);
  const [endingRoom, setEndingRoom] = useState(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:4000";
    const jwtToken = token || (typeof window !== "undefined" ? localStorage.getItem("sokrates_token") : null);

    const s = io(socketUrl, {
      auth: { token: jwtToken },
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      s.emit("join_room", roomId);
    });

    s.on("room_joined", (data: { room: any; participants: any[]; messages: any[]; starters?: string[] }) => {
      setRoom(data.room);
      setMessages(data.messages || []);
      if (data.starters) setStarters(data.starters);
      const isPart = data.participants?.some((p) => p.userId === currentUserId || !p.userId);
      setUserJoined(Boolean(isPart));
    });

    s.on("new_message", (data: { message: ChatMessage }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      setStreamingAi("");
    });

    s.on("room_message", (data: { message: ChatMessage }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    });

    s.on("ai_chunk", (data: { messageId: string; chunk: string }) => {
      setStreamingAi((prev) => prev + data.chunk);
    });

    s.on("ai_done", (data: { messageId: string; fullMessage: string; message?: ChatMessage }) => {
      setStreamingAi("");
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message?.id)) return prev;
          return [...prev, data.message!];
        });
      }
    });

    s.on("user_typing", (data: { userId: string; username?: string; isTyping: boolean }) => {
      if (!data.username) return;
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.username!) ? prev : [...prev, data.username!];
        } else {
          return prev.filter((u) => u !== data.username);
        }
      });
    });

    s.on("room_participants_updated", (data: { roomId: string; activeCount: number }) => {
      if (data.roomId === roomId) {
        setActiveCount(data.activeCount);
      }
    });

    s.on("join_request_received", (data: { request: JoinRequestItem }) => {
      setJoinRequests((prev) => [...prev.filter((r) => r.id !== data.request.id), data.request]);
    });

    setSocket(s);

    return () => {
      s.emit("leave_room", roomId);
      s.disconnect();
    };
  }, [roomId, token, currentUserId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (socket) {
        socket.emit("send_message", { roomId, content });
      }
    },
    [socket, roomId]
  );

  const handleTypingStart = useCallback(() => {
    if (socket) socket.emit("typing_start", roomId);
  }, [socket, roomId]);

  const handleTypingStop = useCallback(() => {
    if (socket) socket.emit("typing_stop", roomId);
  }, [socket, roomId]);

  const handleRequestJoin = async () => {
    if (socket) {
      socket.emit("request_join_room", { roomId });
    }
    try {
      const jwtToken = token || localStorage.getItem("sokrates_token");
      await fetch(`/api/rooms/${roomId}/join-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
    } catch (e) {}
  };

  const handleRespondRequest = async (requestId: string, status: "approved" | "rejected") => {
    if (socket) {
      socket.emit("respond_join_request", { requestId, status });
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    try {
      const jwtToken = token || localStorage.getItem("sokrates_token");
      await fetch(`/api/rooms/${roomId}/join-request/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (e) {}
  };

  const handleEndRoom = async () => {
    setEndingRoom(true);
    try {
      const jwtToken = token || localStorage.getItem("sokrates_token");
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (res.ok) {
        router.push(`/conversations/${roomId}/map`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEndingRoom(false);
    }
  };

  const topicTitle = room?.systemTopic?.title || room?.customTopic || "Group Philosophical Inquiry";
  const topicDesc = room?.systemTopic?.description || room?.customDescription || "Exploring concepts through structured dialogue.";
  const isCreator = currentUserId && room?.createdBy === currentUserId;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/feed")}
            className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight leading-snug">
              {topicTitle}
            </h1>
            <p className="text-xs text-gray-400 truncate max-w-xs md:max-w-md">
              {topicDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/60 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{activeCount} Active</span>
          </div>

          {room?.hasAi && (
            <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-500/40 px-3 py-1.5 rounded-full text-xs font-semibold text-purple-300">
              <Bot className="w-3.5 h-3.5" />
              <span>AI Enabled</span>
            </div>
          )}

          {isCreator && joinRequests.length > 0 && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="bg-amber-600/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-600/30 transition flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{joinRequests.length} Requests</span>
            </button>
          )}

          <button
            onClick={handleEndRoom}
            disabled={endingRoom}
            className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{endingRoom ? "Ending..." : "End & Digest"}</span>
          </button>
        </div>
      </header>

      {/* AI Conversation Starters if available */}
      {starters.length > 0 && (
        <div className="bg-indigo-950/40 border-b border-indigo-900/50 p-3 px-6 flex items-center gap-3 shrink-0 overflow-x-auto">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider shrink-0">
            Discussion Starters:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto">
            {starters.map((q, idx) => (
              <span
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-200 text-xs px-3 py-1 rounded-full whitespace-nowrap cursor-pointer transition"
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Message Stream */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsers={typingUsers}
        streamingAiMessage={streamingAi}
      />

      {/* Input Area */}
      <footer className="bg-gray-900 border-t border-gray-800 p-4 shrink-0">
        <MessageInput
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          placeholder="Formulate your argument or counterpoint..."
        />
      </footer>

      {/* Join Requests Modal */}
      {showRequestModal && (
        <JoinRequestModal
          requests={joinRequests}
          onRespond={handleRespondRequest}
          onClose={() => setShowRequestModal(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;
