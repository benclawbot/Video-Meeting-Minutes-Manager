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
    <div className="relative z-[2147483646]">
      {/* Compact pill */}
      <button
        type="button"
        aria-expanded={expanded}
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

      {/* Expanded breakdown. Fixed positioning prevents header/main stacking contexts from covering it. */}
      {expanded && (
        <div className="fixed right-5 top-20 w-72 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl z-[2147483647] overflow-hidden text-xs">
          {/* Header */}
          <div className="px-3 py-2 bg-slate-950 border-b border-slate-700 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-100">Token &amp; Usage Breakdown</span>
          </div>

          {/* Transcription section */}
          <div className="px-3 py-2.5 bg-slate-800 border-b border-slate-700">
            <div className="text-slate-400 uppercase tracking-wider font-semibold mb-2 text-[10px]">
              Transcription (Groq Whisper)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-300">Audio</span>
                <span className="text-slate-100 font-mono">{formatDuration(usage.audioSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Chars</span>
                <span className="text-slate-100 font-mono">{formatNumber(usage.charCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Segments</span>
                <span className="text-slate-100 font-mono">{formatNumber(usage.segmentCount)}</span>
              </div>
            </div>
          </div>

          {/* Analysis section */}
          <div className="px-3 py-2.5 bg-slate-800">
            <div className="text-slate-400 uppercase tracking-wider font-semibold mb-2 text-[10px]">
              Analysis (MiniMax M2.5)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-300">Input tokens</span>
                <span className="text-slate-100 font-mono">{formatNumber(usage.inputTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Output tokens</span>
                <span className="text-slate-100 font-mono">{formatNumber(usage.outputTokens)}</span>
              </div>
            </div>
          </div>

          {/* Click outside hint */}
          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-700 text-[10px] text-slate-400 text-center">
            Click to collapse
          </div>
        </div>
      )}
    </div>
  );
};

export { TokenTracker };
