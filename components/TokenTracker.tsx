import React, { useState } from 'react';
import { UsageMetrics } from '../types';
import { AnalysisStatus } from '../types';
import { Zap, CheckCircle2 } from 'lucide-react';

interface TokenTrackerProps {
  usage: UsageMetrics | null;
  status: AnalysisStatus;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

const formatNumber = (n: number): string => {
  if (n === 0) return '0';
  return n.toLocaleString('fr-FR');
};

const TokenTracker: React.FC<TokenTrackerProps> = ({ usage, status }) => {
  const [expanded, setExpanded] = useState(false);

  if (status !== AnalysisStatus.COMPLETED) return null;
  if (!usage) return null;

  const hasTokens = usage.inputTokens > 0 || usage.outputTokens > 0;

  return (
    <div className="relative">
      {/* Compact pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 cursor-pointer"
      >
        {hasTokens ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Tokens</span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">—</span>
          </>
        )}
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[9999] overflow-visible text-xs">
          {/* Header */}
          <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200">Token &amp; Usage Breakdown</span>
          </div>

          {/* Transcription section */}
          <div className="px-3 py-2.5 border-b border-slate-700/50">
            <div className="text-slate-500 uppercase tracking-wider font-semibold mb-2 text-[10px]">
              Transcription (Groq Whisper)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Audio</span>
                <span className="text-slate-200 font-mono">{formatDuration(usage.audioSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chars</span>
                <span className="text-slate-200 font-mono">{formatNumber(usage.charCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Segments</span>
                <span className="text-slate-200 font-mono">{formatNumber(usage.segmentCount)}</span>
              </div>
            </div>
          </div>

          {/* Analysis section */}
          <div className="px-3 py-2.5">
            <div className="text-slate-500 uppercase tracking-wider font-semibold mb-2 text-[10px]">
              Analysis (MiniMax M2.5)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Input tokens</span>
                <span className="text-slate-200 font-mono">{formatNumber(usage.inputTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Output tokens</span>
                <span className="text-slate-200 font-mono">{formatNumber(usage.outputTokens)}</span>
              </div>
            </div>
          </div>

          {/* Click outside hint */}
          <div className="px-3 py-1.5 bg-slate-900/50 border-t border-slate-700/50 text-[10px] text-slate-500 text-center">
            Click to collapse
          </div>
        </div>
      )}
    </div>
  );
};

export { TokenTracker };
