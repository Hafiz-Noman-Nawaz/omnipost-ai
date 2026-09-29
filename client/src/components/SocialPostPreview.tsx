"use client";

import { useState } from "react";

export type SocialPlatform = "INSTAGRAM" | "TWITTER" | "LINKEDIN" | "TIKTOK" | "FACEBOOK" | "YOUTUBE";

interface SocialPostPreviewProps {
  content: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "VIDEO";
  authorName?: string;
  authorHandle?: string;
  campaignTitle?: string;
}

export default function SocialPostPreview({
  content,
  mediaUrl,
  mediaType = "IMAGE",
  authorName = "OmniPost Official",
  authorHandle = "@omnipost",
  campaignTitle,
}: SocialPostPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("INSTAGRAM");

  const platformLimits: Record<SocialPlatform, { maxChars: number; label: string; icon: string }> = {
    INSTAGRAM: { maxChars: 2200, label: "Instagram", icon: "📸" },
    TWITTER: { maxChars: 280, label: "X (Twitter)", icon: "𝕏" },
    LINKEDIN: { maxChars: 3000, label: "LinkedIn", icon: "💼" },
    TIKTOK: { maxChars: 2200, label: "TikTok", icon: "🎵" },
    FACEBOOK: { maxChars: 63206, label: "Facebook", icon: "👥" },
    YOUTUBE: { maxChars: 5000, label: "YouTube Community", icon: "▶️" },
  };

  const limitInfo = platformLimits[activePlatform];
  const charCount = content.length;
  const isOverLimit = charCount > limitInfo.maxChars;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl flex flex-col gap-4">
      {/* Header with Platform Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>👁️</span> Live Platform Preview
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Pixel-accurate preview for social audiences
          </p>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
          {(Object.keys(platformLimits) as SocialPlatform[]).map((p) => {
            const isSelected = activePlatform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActivePlatform(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="mr-1">{platformLimits[p].icon}</span>
                <span className="hidden sm:inline">{platformLimits[p].label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Character Counter & Warning */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-[var(--muted)]">
          Target: <strong className="text-white">{limitInfo.label}</strong>
        </span>
        <div className="flex items-center gap-2">
          {campaignTitle && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              🏷️ {campaignTitle}
            </span>
          )}
          <span
            className={`font-mono font-medium ${
              isOverLimit ? "text-rose-400 font-bold" : charCount > limitInfo.maxChars * 0.9 ? "text-amber-400" : "text-[var(--muted)]"
            }`}
          >
            {charCount} / {limitInfo.maxChars} chars
          </span>
        </div>
      </div>

      {isOverLimit && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span> Post exceeds the maximum character limit for {limitInfo.label} by {charCount - limitInfo.maxChars} characters!
        </div>
      )}

      {/* Mock Device Container */}
      <div className="flex justify-center p-3 sm:p-6 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
        {/* Instagram Preview */}
        {activePlatform === "INSTAGRAM" && (
          <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white shadow-2xl overflow-hidden text-xs">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[1.5px]">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-[10px]">
                    OP
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-white leading-tight">{authorHandle.replace("@", "")}</div>
                  <div className="text-[10px] text-neutral-400">Sponsored · Original audio</div>
                </div>
              </div>
              <span className="text-neutral-400 font-bold">•••</span>
            </div>

            {/* Media Area */}
            <div className="aspect-square bg-neutral-800 flex items-center justify-center relative overflow-hidden">
              {mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="Post asset preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-500">
                  <span className="text-4xl">🖼️</span>
                  <span className="text-xs">No media attached</span>
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between text-base">
                <div className="flex items-center gap-3">
                  <span>❤️</span>
                  <span>💬</span>
                  <span>↗️</span>
                </div>
                <span>🔖</span>
              </div>
              <div className="font-semibold text-[11px]">1,428 likes</div>
              <div className="space-y-1">
                <span className="font-semibold mr-1.5">{authorHandle.replace("@", "")}</span>
                <span className="text-neutral-200 whitespace-pre-wrap">{content || "Your caption here..."}</span>
              </div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider pt-1">Just now</div>
            </div>
          </div>
        )}

        {/* X / Twitter Preview */}
        {activePlatform === "TWITTER" && (
          <div className="w-full max-w-sm rounded-xl bg-black border border-neutral-800 text-white shadow-2xl p-4 text-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                OP
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white truncate">{authorName}</span>
                  <span className="text-neutral-500 text-[11px] truncate">{authorHandle}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-neutral-500 text-[11px]">now</span>
                </div>
                <div className="text-neutral-100 whitespace-pre-wrap leading-relaxed text-sm">
                  {content || "What is happening?!"}
                </div>

                {mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-neutral-800 max-h-56 mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl} alt="X media attachment" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex items-center justify-between text-neutral-500 pt-2 text-xs">
                  <span className="hover:text-sky-400 cursor-pointer">💬 12</span>
                  <span className="hover:text-emerald-400 cursor-pointer">🔄 34</span>
                  <span className="hover:text-rose-400 cursor-pointer">❤️ 89</span>
                  <span className="hover:text-sky-400 cursor-pointer">📊 2.4K</span>
                  <span>📤</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LinkedIn Preview */}
        {activePlatform === "LINKEDIN" && (
          <div className="w-full max-w-md rounded-xl bg-neutral-900 border border-neutral-800 text-white shadow-2xl text-xs space-y-3">
            <div className="p-3.5 pb-0 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-sm shrink-0 text-blue-400">
                OP
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-xs">{authorName}</div>
                <div className="text-[11px] text-neutral-400">Marketing & AI Automation Platform</div>
                <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                  <span>Just now</span> • <span>🌐</span>
                </div>
              </div>
            </div>

            <div className="px-3.5 text-neutral-200 whitespace-pre-wrap leading-relaxed">
              {content || "Share an insight or company update..."}
            </div>

            {mediaUrl && (
              <div className="border-y border-neutral-800 max-h-64 overflow-hidden bg-neutral-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="LinkedIn media asset" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="px-3.5 py-2.5 border-t border-neutral-800 flex items-center justify-between text-neutral-400 text-xs">
              <span className="hover:text-blue-400 cursor-pointer flex items-center gap-1">👍 Like</span>
              <span className="hover:text-blue-400 cursor-pointer flex items-center gap-1">💬 Comment</span>
              <span className="hover:text-blue-400 cursor-pointer flex items-center gap-1">🔄 Repost</span>
              <span className="hover:text-blue-400 cursor-pointer flex items-center gap-1">✈️ Send</span>
            </div>
          </div>
        )}

        {/* TikTok Preview */}
        {activePlatform === "TIKTOK" && (
          <div className="w-full max-w-xs rounded-2xl bg-black border border-neutral-800 text-white shadow-2xl aspect-[9/16] max-h-[480px] relative overflow-hidden flex flex-col justify-between p-4 text-xs">
            {/* Background Media */}
            {mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="TikTok video background" className="absolute inset-0 w-full h-full object-cover opacity-75" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-black flex items-center justify-center text-neutral-600 text-4xl">
                🎵
              </div>
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-center gap-4 text-xs font-semibold text-neutral-300">
              <span className="text-white border-b-2 border-white pb-1">Following</span>
              <span className="text-neutral-400">For You</span>
            </div>

            {/* Bottom & Side Info */}
            <div className="relative z-10 flex items-end justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="font-bold text-sm text-white drop-shadow-md">{authorHandle}</div>
                <div className="line-clamp-3 text-neutral-100 text-xs drop-shadow whitespace-pre-wrap">
                  {content || "#trend #fyp #omnipost"}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                  <span>🎵</span> <span className="truncate">Original Sound - OmniPost</span>
                </div>
              </div>

              {/* Side engagement rail */}
              <div className="flex flex-col items-center gap-3 text-center text-white drop-shadow pb-1">
                <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center font-bold text-xs border-2 border-white">
                  +
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl">❤️</span>
                  <span className="text-[10px] font-bold">42.1K</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl">💬</span>
                  <span className="text-[10px] font-bold">892</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl">🔖</span>
                  <span className="text-[10px] font-bold">5.3K</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl">↗️</span>
                  <span className="text-[10px] font-bold">1.2K</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Facebook Preview */}
        {activePlatform === "FACEBOOK" && (
          <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white shadow-2xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
                OP
              </div>
              <div>
                <div className="font-semibold text-white">{authorName}</div>
                <div className="text-[10px] text-neutral-400">Just now · 🌍 Public</div>
              </div>
            </div>

            <div className="text-neutral-100 whitespace-pre-wrap leading-relaxed">
              {content || "What's on your mind?"}
            </div>

            {mediaUrl && (
              <div className="rounded-lg overflow-hidden border border-neutral-800 max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Facebook post asset" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-around text-neutral-400 text-xs">
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>↗️ Share</span>
            </div>
          </div>
        )}

        {/* YouTube Community Preview */}
        {activePlatform === "YOUTUBE" && (
          <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white shadow-2xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs text-white">
                ▶
              </div>
              <div>
                <div className="font-semibold text-white">{authorName}</div>
                <div className="text-[10px] text-neutral-400">Community Post · just now</div>
              </div>
            </div>

            <div className="text-neutral-100 whitespace-pre-wrap leading-relaxed">
              {content || "Post an update to your channel subscribers..."}
            </div>

            {mediaUrl && (
              <div className="rounded-lg overflow-hidden border border-neutral-800 max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="YouTube community post asset" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="pt-2 border-t border-neutral-800 flex items-center gap-4 text-neutral-400 text-xs">
              <span>👍 2.8K</span>
              <span>👎</span>
              <span>💬 164</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
