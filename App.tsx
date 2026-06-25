import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Mic2,
  Music,
  PlayCircle,
  Sparkles,
  UploadCloud,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { MeetingDetails, AnalysisResult, AnalysisStatus, DocxTemplateId, MediaFile, OutputLanguage, UsageMetrics } from './types';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { TokenTracker } from './components/TokenTracker';
import { analyzeMeetingVideo } from './services/geminiService';
import { generateAndDownloadDocx } from './services/docxService';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Reference design palette (Stripe-style MeetingMind mockup)
const ACCENT = {
  violet: '#635BFF',
  violetDeep: '#4F46E5',
  violetLight: '#8B7DFF',
  pageBg: '#F8F9FF',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  borderDashed: '#D1D5DB',
  emerald: '#10b981',
};

const TEMPLATES = [
  { id: 'briefing' as DocxTemplateId, name: 'Anthropic', gradient: 'from-[#f3efe6] via-[#eee4d6] to-[#b9402d]', border: 'rgba(185,64,45,0.4)' },
  { id: 'corporate' as DocxTemplateId, name: 'Corporate', gradient: 'from-slate-700 to-slate-800', border: 'rgba(100,116,139,0.4)' },
  { id: 'modern' as DocxTemplateId, name: 'Modern', gradient: 'from-cyan-600 to-blue-700', border: 'rgba(6,182,212,0.4)' },
  { id: 'executive' as DocxTemplateId, name: 'Executive', gradient: 'from-slate-800 to-black', border: 'rgba(71,85,105,0.4)' },
];

const isProcessingStatus = (status: AnalysisStatus) =>
  status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED;

const ProgressBar: React.FC<{ step: number; total: number }> = ({ step, total }) => {
  const pct = Math.round(total === 0 ? 0 : (step / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-stone-200 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT.violet}, ${ACCENT.violetLight})` }} />
      </div>
      <span className="text-[10px] font-mono text-stone-500 tabular-nums">{pct}%</span>
    </div>
  );
};

const PipelineStepper: React.FC<{ status: AnalysisStatus }> = ({ status }) => {
  const isProcessing = isProcessingStatus(status);
  const stepOrder = [AnalysisStatus.EXTRACTING_AUDIO, AnalysisStatus.UPLOADING, AnalysisStatus.TRANSCRIBING, AnalysisStatus.PROCESSING];
  const currentIdx = isProcessing ? stepOrder.indexOf(status) : -1;
  const labels = ['Audio', 'Upload', 'Transcription', 'Analyse'];
  const icons = [Clock, UploadCloud, Mic2, BrainCircuit];
  const accents = [ACCENT.violet, ACCENT.violet, ACCENT.violet, ACCENT.violet];

  return (
    <div className="flex items-center gap-0">
      {labels.map((label, idx) => {
        const Icon = icons[idx];
        const accent = accents[idx];
        const done = currentIdx > idx;
        const active = currentIdx === idx;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl" style={{ opacity: !done && !active && isProcessing ? 0.4 : 1 }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: done ? `${ACCENT.emerald}15` : `${accent}10`, border: `1.5px solid ${done ? ACCENT.emerald : active ? accent : '#E5E7EB'}` }}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: ACCENT.emerald }} /> : <Icon className="w-3.5 h-3.5" style={{ color: active ? accent : '#9CA3AF' }} />}
              </div>
              <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: active ? accent : done ? ACCENT.emerald : '#6B7280' }}>{label}</span>
            </div>
            {idx < labels.length - 1 && <div className="flex-1 h-px mx-1 mb-4 bg-stone-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const TemplatePicker: React.FC<{ selected: DocxTemplateId; onChange: (id: DocxTemplateId) => void }> = ({ selected, onChange }) => (
  <div className="flex gap-2">
    {TEMPLATES.map(tpl => (
      <button
        key={tpl.id}
        type="button"
        onClick={() => onChange(tpl.id)}
        className="flex-1 min-w-[86px] flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: selected === tpl.id ? `${ACCENT.violet}0D` : '#F9FAFB', borderColor: selected === tpl.id ? `${ACCENT.violet}80` : tpl.border, boxShadow: selected === tpl.id ? `0 0 0 4px ${ACCENT.violet}1A` : 'none' }}
      >
        <div className={`w-full h-7 rounded-lg bg-gradient-to-br ${tpl.gradient}`} style={{ border: '1px solid rgba(0,0,0,0.2)' }} />
        <span className="text-[11px] font-semibold" style={{ color: selected === tpl.id ? ACCENT.violet : '#6B7280' }}>{tpl.name}</span>
      </button>
    ))}
  </div>
);

const LanguageToggle: React.FC<{ value: OutputLanguage; onChange: (value: OutputLanguage) => void; disabled: boolean }> = ({ value, onChange, disabled }) => (
  <div className="rounded-full p-1 flex gap-1" style={{ background: '#F1F2F6', border: '1px solid #E5E7EB' }}>
    {(['fr', 'en'] as OutputLanguage[]).map(lang => (
      <button
        key={lang}
        type="button"
        disabled={disabled}
        onClick={() => onChange(lang)}
        className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
        style={{ background: value === lang ? '#FFFFFF' : 'transparent', color: value === lang ? ACCENT.violet : '#6B7280', boxShadow: value === lang ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
      >
        {lang === 'fr' ? 'FR' : 'EN'}
      </button>
    ))}
  </div>
);

const FilePreview: React.FC<{ mediaFile: MediaFile; onClear: () => void; disabled: boolean }> = ({ mediaFile, onClear, disabled }) => (
  <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: `${ACCENT.violet}40`, background: '#F9FAFB' }}>
    {mediaFile.isAudioOnly ? (
      <div className="flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg,${ACCENT.violet}1A,${ACCENT.violetLight}1A)`, border: `1px solid ${ACCENT.violet}30` }}>
          <Music className="w-8 h-8" style={{ color: ACCENT.violet }} />
        </div>
        <audio src={mediaFile.previewUrl} className="w-full" controls />
      </div>
    ) : <video src={mediaFile.previewUrl} className="w-full max-h-52 object-contain bg-black" controls />}
    <button type="button" onClick={onClear} disabled={disabled} className="absolute top-2 right-2 p-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <X className="w-3.5 h-3.5 text-white" />
    </button>
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
      <p className="text-[11px] text-slate-300 truncate font-mono px-1">{mediaFile.file.name}</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails>({ title: '', date: new Date().toISOString().split('T')[0] });
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocxTemplateId>('briefing');
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('fr');
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        try { setHasApiKey(await window.aistudio.hasSelectedApiKey()); } catch { /* noop */ }
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  useEffect(() => () => { if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl); }, [mediaFile]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      try { await window.aistudio.openSelectKey(); setHasApiKey(true); } catch { /* noop */ }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeetingDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.m4a');
    if (!isVideo && !isAudio) { setError('Format non supporté.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Fichier trop volumineux (max 200 Mo).'); return; }
    setError(null);
    setMediaFile({ file, previewUrl: URL.createObjectURL(file), isAudioOnly: isAudio && !isVideo });
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setUsage(null);
  };

  const clearFile = () => {
    if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl);
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setUsage(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || !meetingDetails.title || !meetingDetails.date) return;
    setStatus(AnalysisStatus.PROCESSING);
    setError(null);
    try {
      const analysis = await analyzeMeetingVideo(mediaFile.file, meetingDetails.title, meetingDetails.date, outputLanguage, s => setStatus(s as AnalysisStatus));
      setResult(analysis);
      setUsage(analysis.usage || null);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'analyse.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleManualExport = async () => {
    if (!result) return;
    setIsExporting(true);
    await generateAndDownloadDocx(result, meetingDetails, selectedTemplate);
    setIsExporting(false);
  };

  const isProcessing = isProcessingStatus(status);
  const isDone = status === AnalysisStatus.COMPLETED;
  const isDisabled = !isDone && status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR;
  const progressStep = ({ [AnalysisStatus.EXTRACTING_AUDIO]: 1, [AnalysisStatus.UPLOADING]: 2, [AnalysisStatus.TRANSCRIBING]: 3, [AnalysisStatus.PROCESSING]: 4 } as Partial<Record<AnalysisStatus, number>>)[status] || 0;
  const getStatusLabel = () => {
    switch (status) {
      case AnalysisStatus.EXTRACTING_AUDIO: return 'Extraction audio...';
      case AnalysisStatus.UPLOADING: return 'Envoi vers Deepgram...';
      case AnalysisStatus.TRANSCRIBING: return 'Transcription...';
      case AnalysisStatus.PROCESSING: return 'Analyse MiniMax M3...';
      case AnalysisStatus.COMPLETED: return 'Analyse terminée';
      case AnalysisStatus.ERROR: return 'Erreur';
      default: return 'Prêt';
    }
  };

  // Common input style override (light theme) — wraps the existing Input component's classes
  const inputClassOverride =
    '!bg-[#F9FAFB] !border-[#E5E7EB] !text-[#1A1A1A] !placeholder-[#9CA3AF] ' +
    'focus:!border-[#635BFF] focus:!ring-[#635BFF] focus:!ring-1 focus:!outline-none ' +
    'disabled:!bg-[#F3F4F6] disabled:!text-[#9CA3AF] !rounded-2xl !shadow-none ' +
    '!px-4 !py-3 !text-sm !font-medium';
  const labelClassOverride = '!text-[11px] !font-bold !uppercase !tracking-wider !text-[#374151] !mb-2';

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: ACCENT.pageBg, color: ACCENT.text }}>
      <header className="relative z-10 border-b" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#E5E7EB' }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: '#FFFFFF', border: `1px solid ${ACCENT.border}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetLight})` }}>
                <Video className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight" style={{ color: ACCENT.text }}>MeetingMind</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full text-[10px] font-semibold" style={{ background: '#F3F4F6', border: `1px solid ${ACCENT.border}`, color: '#374151' }}>
              <Zap className="w-2.5 h-2.5" style={{ color: ACCENT.violet }} />Powered by MiniMax M3
            </div>
          </div>
          <div className="flex items-center gap-4"><TokenTracker usage={usage} status={status} /></div>
        </div>
      </header>

      {isProcessing && (
        <div className="relative z-10 border-b py-3 px-5" style={{ background: 'rgba(255,255,255,0.85)', borderColor: ACCENT.border }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: ACCENT.violet }}>{getStatusLabel()}</span>
              <span className="text-[10px] font-mono text-stone-500">{meetingDetails.title || 'Sans titre'}</span>
            </div>
            <PipelineStepper status={status} />
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-5 py-8 w-full">
        {!hasApiKey && !isCheckingKey ? (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center max-w-md rounded-3xl p-12 bg-white" style={{ border: `1px solid ${ACCENT.border}`, boxShadow: '0 24px 48px -12px rgba(99,91,255,0.10)' }}>
              <div className="w-14 h-14 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetLight})` }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-3 tracking-tight">Configuration requise</h2>
              <p className="text-stone-500 mb-8 leading-relaxed text-sm">Ajoutez votre clé API MiniMax pour démarrer.</p>
              <button onClick={handleOpenKeyDialog} className="px-6 py-3 rounded-full text-sm font-bold text-white active:scale-95 transition-all" style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetDeep})`, boxShadow: `0 8px 24px ${ACCENT.violet}40` }}>Sélectionner une clé API</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* LEFT: form card (matches reference design ~30% width) */}
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
              <div className="rounded-3xl p-6 sm:p-7 bg-white flex flex-col gap-5" style={{ border: `1px solid ${ACCENT.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: ACCENT.text }}>Nouvelle Réunion</h2>
                  <LanguageToggle value={outputLanguage} onChange={setOutputLanguage} disabled={isDisabled} />
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Override the Input component's dark classes via className prop */}
                  <div>
                    <label htmlFor="title" className={labelClassOverride}>Titre</label>
                    <input
                      id="title"
                      name="title"
                      placeholder="Planification du lancement - Projet Orion"
                      value={meetingDetails.title}
                      onChange={handleInputChange}
                      required
                      disabled={isDisabled}
                      className={`block w-full border ${inputClassOverride}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className={labelClassOverride}>Date</label>
                    <input
                      id="date"
                      type="date"
                      name="date"
                      value={meetingDetails.date}
                      onChange={handleInputChange}
                      required
                      disabled={isDisabled}
                      className={`block w-full border ${inputClassOverride}`}
                    />
                  </div>
                  <div>
                    <label className={labelClassOverride}>Enregistrement</label>
                    {!mediaFile ? (
                      <div
                        className="rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all group hover:!bg-[#635BFF08]"
                        style={{
                          borderColor: isDisabled ? '#E5E7EB' : `${ACCENT.violet}55`,
                          background: isDisabled ? '#F9FAFB' : '#F9FAFB',
                        }}
                        onClick={() => !isDisabled && fileInputRef.current?.click()}
                      >
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*,audio/x-m4a,audio/mp4,audio/m4a,.m4a" className="hidden" />
                        <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: '#FFFFFF', border: `1px solid ${ACCENT.border}` }}>
                          <UploadCloud className="w-5 h-5" style={{ color: ACCENT.violet }} />
                        </div>
                        <p className="text-sm font-bold" style={{ color: ACCENT.text }}>Glisser-déposer ou cliquer</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mt-1">Vidéo ou M4A · Max 200 Mo</p>
                      </div>
                    ) : <FilePreview mediaFile={mediaFile} onClear={clearFile} disabled={isDisabled} />}
                  </div>
                  {error && (
                    <div className="p-3 rounded-2xl flex items-start gap-2 text-xs" style={{ background: `${ACCENT.violet}08`, border: `1px solid ${ACCENT.violet}25` }}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT.violet }} />
                      <span style={{ color: '#6B21A8' }}>{error}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!mediaFile || !meetingDetails.title || !meetingDetails.date || isProcessing}
                    className="w-full px-4 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.05em] text-white whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{
                      background: (!mediaFile || !meetingDetails.title || isProcessing)
                        ? '#E5E7EB'
                        : `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetDeep})`,
                      boxShadow: (!mediaFile || !meetingDetails.title || isProcessing)
                        ? 'none'
                        : `0 10px 24px ${ACCENT.violet}40`,
                    }}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isProcessing ? 'Analyse en cours...' : 'Générer le compte rendu'}
                  </button>
                </form>
              </div>

              {/* Export info card */}
              <div className="rounded-3xl p-5 bg-white" style={{ border: `1px solid ${ACCENT.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.04)' }}>
                <h4 className="text-[11px] font-black uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: ACCENT.violet }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />Export
                </h4>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-[11px] text-stone-500"><span style={{ color: ACCENT.violet }}>•</span><span>Langue: {outputLanguage === 'fr' ? 'Français' : 'English'}</span></li>
                  <li className="flex items-center gap-2 text-[11px] text-stone-500"><span style={{ color: ACCENT.violet }}>•</span><span>Template par défaut: Anthropic</span></li>
                  <li className="flex items-center gap-2 text-[11px] text-stone-500"><span style={{ color: ACCENT.violet }}>•</span><span>Tables DOCX compactes et lisibles</span></li>
                </ul>
              </div>
            </div>

            {/* RIGHT: results / status panel */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[520px]">
              {result ? (
                <div className="flex-1 flex flex-col rounded-3xl overflow-hidden bg-white" style={{ border: `1px solid ${ACCENT.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.04)' }}>
                  <div className="px-6 py-5 space-y-5" style={{ borderBottom: `1px solid ${ACCENT.border}` }}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: ACCENT.emerald }} />
                          <h2 className="text-lg font-black tracking-tight" style={{ color: ACCENT.text }}>{meetingDetails.title}</h2>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-500 ml-4">
                          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{new Date(meetingDetails.date).toLocaleDateString(outputLanguage === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {usage && <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{Math.round(usage.audioSeconds / 60)} min · {usage.charCount.toLocaleString()} chars</span>}
                        </div>
                      </div>
                      <button
                        onClick={handleManualExport}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap disabled:opacity-60"
                        style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetDeep})`, boxShadow: `0 8px 24px ${ACCENT.violet}40` }}
                      >
                        {isExporting ? <><Loader2 className="w-4 h-4 animate-spin" />Export...</> : <><Download className="w-4 h-4" />Exporter DOCX</>}
                      </button>
                    </div>
                    <TemplatePicker selected={selectedTemplate} onChange={setSelectedTemplate} />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-4xl mx-auto p-8">
                      <div className="flex items-center gap-2 mb-6 text-stone-500">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Compte rendu</span>
                        {isDone && <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${ACCENT.emerald}15`, color: ACCENT.emerald }}>Terminé</span>}
                      </div>
                      <MarkdownRenderer content={result.minutes} template={selectedTemplate} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center rounded-3xl text-center bg-white p-8 sm:p-12" style={{ border: `1px solid ${ACCENT.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.04)' }}>
                  {isProcessing ? (
                    <div className="max-w-sm">
                      <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetLight})`, boxShadow: `0 12px 32px ${ACCENT.violet}40` }}>
                        <Loader2 className="w-7 h-7 animate-spin text-white" />
                      </div>
                      <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: ACCENT.text }}>{getStatusLabel()}</h3>
                      <p className="text-stone-500 text-sm mb-8">MiniMax M3 analyse votre réunion.</p>
                      <ProgressBar step={progressStep} total={4} />
                    </div>
                  ) : (
                    <div className="max-w-md w-full flex flex-col items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT.violet}, ${ACCENT.violetLight})`, boxShadow: `0 16px 40px ${ACCENT.violet}40` }}>
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: ACCENT.text }}>Prêt à analyser</h3>
                      <p className="text-sm text-stone-500 leading-relaxed max-w-sm">Uploadez une vidéo ou un fichier audio pour générer un compte rendu structuré et exploitable par vos équipes.</p>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: '#F3F4F6', color: '#374151', border: `1px solid ${ACCENT.border}` }}>
                          <Sparkles className="w-3 h-3" style={{ color: ACCENT.violet }} />Anthropic DOCX
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: '#F3F4F6', color: '#374151', border: `1px solid ${ACCENT.border}` }}>
                          <span className="w-3 h-3 rounded-full" style={{ background: ACCENT.violet }} />FR/EN
                        </span>
                      </div>
                      <div className="w-full h-px my-2" style={{ background: ACCENT.border }} />
                      <ul className="text-left w-full space-y-2 text-xs text-stone-500">
                        {(outputLanguage === 'fr'
                          ? [
                              "Résumé exécutif en moins de 60 secondes",
                              'Décisions, actions et owners extraits automatiquement',
                              'Export DOCX prêt à partager',
                            ]
                          : [
                              'Executive summary in under 60 seconds',
                              'Decisions, actions and owners extracted automatically',
                              'Ready-to-share DOCX export',
                            ]
                        ).map((line) => (
                          <li key={line} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: ACCENT.violet }} />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
