"use client";

import React, { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

export interface ChatMessage {
  id: string;
  senderId?: string;
  sender?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  isAi?: boolean;
  content: string;
  createdAt: string | Date;
}

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  typingUsers?: string[];
  streamingAiMessage?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  typingUsers = [],
  streamingAiMessage,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, streamingAiMessage]);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-gray-800">
      {messages.length === 0 && !streamingAiMessage && (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-2 py-12">
          <p className="text-sm font-medium">No messages yet in this room.</p>
          <p className="text-xs">Start the dialectic conversation by posting your first statement!</p>
        </div>
      )}

      {messages.map((msg) => {
        const isSelf = currentUserId && msg.senderId === currentUserId;
        const isAi = Boolean(msg.isAi);

        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 max-w-2xl ${
              isSelf ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isAi
                  ? "bg-purple-600/30 border border-purple-500 text-purple-300"
                  : isSelf
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 border border-gray-700 text-gray-300"
              }`}
            >
              {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-sm space-y-1 ${
                isAi
                  ? "bg-purple-950/40 border border-purple-800/60 text-purple-100"
                  : isSelf
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-xs opacity-75">
                <span className="font-semibold">
                  {isAi ? "Sokrates AI" : msg.sender?.username || (isSelf ? "You" : "Participant")}
                </span>
                <span className="text-[10px]">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        );
      })}

      {/* Real-time AI Streaming response */}
      {streamingAiMessage && (
        <div className="flex items-start gap-3 max-w-2xl mr-auto">
          <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500 text-purple-300 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <div className="bg-purple-950/40 border border-purple-800/60 text-purple-100 rounded-2xl px-4 py-3 text-sm space-y-1">
            <div className="flex items-center gap-2 text-xs text-purple-300 font-semibold">
              <span>Sokrates AI</span>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap break-words">{streamingAiMessage}</p>
          </div>
        </div>
      )}

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="text-xs text-gray-400 italic flex items-center gap-2 pl-2">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
          </span>
          <span>{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
