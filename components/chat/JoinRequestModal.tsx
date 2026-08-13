"use client";

import React from "react";
import { Check, X, UserCheck } from "lucide-react";

export interface JoinRequestItem {
  id: string;
  roomId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  createdAt: string | Date;
}

interface JoinRequestModalProps {
  requests: JoinRequestItem[];
  onRespond: (requestId: string, status: "approved" | "rejected") => void;
  onClose: () => void;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  requests,
  onRespond,
  onClose,
}) => {
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Pending Join Requests</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No pending join requests at this moment.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 bg-gray-800/80 border border-gray-700/60 rounded-xl"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {req.user?.username || "Anonymous Thinker"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Requested {new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRespond(req.id, "approved")}
                    className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 rounded-lg hover:bg-emerald-600/30 transition"
                    title="Accept Request"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRespond(req.id, "rejected")}
                    className="p-2 bg-rose-600/20 text-rose-400 border border-rose-500/40 rounded-lg hover:bg-rose-600/30 transition"
                    title="Reject Request"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinRequestModal;
