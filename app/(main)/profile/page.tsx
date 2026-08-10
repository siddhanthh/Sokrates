"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InterestPicker, InterestCategory } from "@/components/auth/InterestPicker";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<InterestCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem("sokrates_token");
      if (!token) {
        // Fallback for demonstration/mock or redirect
        const cachedUser = localStorage.getItem("sokrates_user");
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            setUser(parsed);
            setBio(parsed.bio || "");
            setSelectedCategoryIds(parsed.interestCategories || []);
          } catch (e) {}
        }
        setLoading(false);
        return;
      }

      try {
        const [profRes, catRes] = await Promise.all([
          fetch("/api/profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/categories"),
        ]);

        if (profRes.ok) {
          const profData = await profRes.json();
          if (profData.user) {
            setUser(profData.user);
            setBio(profData.user.bio || "");
            setSelectedCategoryIds(profData.user.interestCategories || []);
          }
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.categories) {
            setCategories(catData.categories);
          }
        }
      } catch (err: any) {
        setMessage({ type: "error", text: "Failed to load profile data" });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    const token = localStorage.getItem("sokrates_token");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bio,
          categoryIds: selectedCategoryIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setUser(data.user);
      if (data.user) {
        localStorage.setItem("sokrates_user", JSON.stringify(data.user));
      }
      setMessage({ type: "success", text: "Profile and 768-dim interest vector updated!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Update failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-400 font-medium">Loading profile...</div>
      </div>
    );
  }

  const vectorDim = user?.interestVec?.length || 768;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {user?.username || "Philosopher"}
            </h1>
            <p className="text-gray-400 text-sm">{user?.email || "philosopher@sokrates.app"}</p>
            <span className="inline-block mt-2 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-md border border-indigo-500/30 uppercase tracking-wider">
              Role: {user?.role || "user"}
            </span>
          </div>

          {/* 768-dim vector embedding status badge */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/40 rounded-xl p-4 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Gemini Vector Embedding
              </span>
            </div>
            <p className="text-sm font-semibold text-emerald-100">
              Active ({vectorDim}-dim Normalized)
            </p>
            <p className="text-xs text-emerald-400/80">
              Model: text-embedding-004
            </p>
          </div>
        </div>

        {/* Profile edit form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-4">
            Manage Profile & Interests
          </h2>

          {message && (
            <div
              className={`p-4 rounded-xl text-sm font-medium border ${
                message.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-red-500/10 border-red-500/40 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Philosophical Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your primary philosophical perspectives or areas of inquiry..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
              />
            </div>

            <div>
              <InterestPicker
                categories={categories}
                selectedCategoryIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                disabled={saving}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-6 py-3 text-sm shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {saving ? "Re-generating Embedding..." : "Save Profile & Re-generate Vector"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
