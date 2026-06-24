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
import { Input } from './components/Input';
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

const ACCENT = { violet: '#7c3aed', cyan: '#06b6d4', emerald: '#10b981', amber: '#f59e0b', clay: '#b9402d' };

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
      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT.violet}, ${ACCENT.cyan})` }} />
      </div>
      <span className="text-[10px] font-mono text-slate-500 tabular-nums">{pct}%</span>
    </div>
  );
};

const PipelineStepper: React.FC<{ status: AnalysisStatus }> = ({ status }) => {
  const isProcessing = isProcessingStatus(status);
  const stepOrder = [AnalysisStatus.EXTRACTING_AUDIO, AnalysisStatus.UPLOADING, AnalysisStatus.TRANSCRIBING, AnalysisStatus.PROCESSING];
  const currentIdx = isProcessing ? stepOrder.indexOf(status) : -1;
  const labels = ['Audio', 'Upload', 'Transcription', 'Analyse'];
  const icons = [Clock, UploadCloud, Mic2, BrainCircuit];
  const accents = [ACCENT.amber, ACCENT.cyan, ACCENT.cyan, ACCENT.violet];

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
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: done ? `${ACCENT.emerald}20` : `${accent}15`, border: `1.5px solid ${done ? ACCENT.emerald : active ? accent : 'rgba(148,163,184,0.2)'}` }}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: ACCENT.emerald }} /> : <Icon className="w-3.5 h-3.5" style={{ color: active ? accent : '#475569' }} />}
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: active ? accent : done ? ACCENT.emerald : '#475569' }}>{label}</span>
            </div>
            {idx < labels.length - 1 && <div className="flex-1 h-px mx-1 mb-4 bg-slate-800" />}
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
        className="flex-1 min-w-[86px] flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: selected === tpl.id ? 'rgba(185,64,45,0.10)' : 'rgba(15,23,42,0.5)', borderColor: selected === tpl.id ? `${ACCENT.clay}90` : tpl.border, boxShadow: selected === tpl.id ? `0 0 16px ${ACCENT.clay}20` : 'none' }}
      >
        <div className={`w-full h-7 rounded-lg bg-gradient-to-br ${tpl.gradient}`} style={{ border: '1px solid rgba(0,0,0,0.2)' }} />
        <span className="text-[11px] font-medium" style={{ color: selected === tpl.id ? ACCENT.clay : '#64748b' }}>{tpl.name}</span>
      </button>
    ))}
  </div>
);

const LanguageToggle: React.FC<{ value: OutputLanguage; onChange: (value: OutputLanguage) => void; disabled: boolean }> = ({ value, onChange, disabled }) => (
  <div className="rounded-xl p-1 flex gap-1" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.35)' }}>
    {(['fr', 'en'] as OutputLanguage[]).map(lang => (
      <button
        key={lang}
        type="button"
        disabled={disabled}
        onClick={() => onChange(lang)}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50"
        style={{ background: value === lang ? '#f3efe6' : 'transparent', color: value === lang ? '#1d1b16' : '#94a3b8' }}
      >
        {lang === 'fr' ? 'Français' : 'English'}
      </button>
    ))}
  </div>
);

const FilePreview: React.FC<{ mediaFile: MediaFile; onClear: () => void; disabled: boolean }> = ({ mediaFile, onClear, disabled }) => (
  <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(0,0,0,0.4)' }}>
    {mediaFile.isAudioOnly ? (
      <div className="flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.2),rgba(124,58,237,0.2))', border: '1px solid rgba(6,182,212,0.3)' }}>
          <Music className="w-8 h-8 text-cyan-400" />
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

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#06080f', color: '#e2e8f0' }}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full" style={{ background: 'radial-gradient(ellipse,rgba(124,58,237,0.12) 0%,transparent 70%)' }} />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(ellipse,rgba(6,182,212,0.07) 0%,transparent 70%)' }} />
      </div>

      <header className="relative z-10 border-b" style={{ background: 'rgba(6,8,15,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(124,58,237,0.15)' }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <Video className="w-5 h-5" style={{ color: ACCENT.violet }} />
              <span className="text-sm font-bold text-slate-100 tracking-tight">MeetingMind</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-[10px] font-mono" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: ACCENT.cyan }}>
              <Zap className="w-2.5 h-2.5" />Powered by MiniMax M3
            </div>
          </div>
          <div className="flex items-center gap-4"><TokenTracker usage={usage} status={status} /></div>
        </div>
      </header>

      {isProcessing && (
        <div className="relative z-10 border-b py-3 px-5" style={{ background: 'rgba(6,8,15,0.7)', borderColor: 'rgba(124,58,237,0.1)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: ACCENT.violet }}>{getStatusLabel()}</span>
              <span className="text-[10px] text-slate-500 font-mono">{meetingDetails.title || 'Sans titre'}</span>
            </div>
            <PipelineStepper status={status} />
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-5 py-8 w-full">
        {!hasApiKey && !isCheckingKey ? (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center max-w-md rounded-3xl p-12" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <Sparkles className="w-8 h-8 mx-auto mb-6" style={{ color: ACCENT.violet }} />
              <h2 className="text-2xl font-bold text-slate-100 mb-3">Configuration requise</h2>
              <p className="text-slate-400 mb-8 leading-relaxed text-sm">Ajoutez votre clé API MiniMax pour démarrer.</p>
              <button onClick={handleOpenKeyDialog} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg,${ACCENT.violet},#5b21b6)` }}>Sélectionner une clé API</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
              <div className="rounded-2xl p-5" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h2 className="text-[11px] font-semibold text-slate-200 uppercase tracking-widest">Nouvelle Réunion</h2>
                  <LanguageToggle value={outputLanguage} onChange={setOutputLanguage} disabled={isDisabled} />
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input label="Titre" name="title" placeholder="Planification du lancement - Projet Orion" value={meetingDetails.title} onChange={handleInputChange} required disabled={isDisabled} />
                  <Input label="Date" type="date" name="date" value={meetingDetails.date} onChange={handleInputChange} required disabled={isDisabled} />
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Enregistrement</label>
                    {!mediaFile ? (
                      <div className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all group" style={{ borderColor: isDisabled ? 'rgba(71,85,105,0.3)' : 'rgba(124,58,237,0.3)', background: isDisabled ? 'rgba(15,23,42,0.3)' : 'rgba(124,58,237,0.03)' }} onClick={() => !isDisabled && fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*,audio/x-m4a,audio/mp4,audio/m4a,.m4a" className="hidden" />
                        <UploadCloud className="w-6 h-6 mx-auto mb-3" style={{ color: ACCENT.violet }} />
                        <p className="text-xs font-medium text-slate-300">Glisser-déposer ou cliquer</p>
                        <p className="text-[11px] text-slate-600 mt-1">Vidéo ou M4A - Max 200 Mo</p>
                      </div>
                    ) : <FilePreview mediaFile={mediaFile} onClear={clearFile} disabled={isDisabled} />}
                  </div>
                  {error && <div className="p-3 rounded-xl flex items-start gap-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><span className="text-red-300">{error}</span></div>}
                  <button type="submit" disabled={!mediaFile || !meetingDetails.title || !meetingDetails.date || isProcessing} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: (!mediaFile || !meetingDetails.title || isProcessing) ? 'rgba(71,85,105,0.3)' : `linear-gradient(135deg,${ACCENT.violet},#5b21b6)` }}>
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Analyse en cours...</> : <><PlayCircle className="w-4 h-4" />Générer le compte rendu</>}
                  </button>
                </form>
              </div>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(71,85,105,0.2)' }}>
                <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: ACCENT.emerald }} />Export</h4>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-[11px] text-slate-500"><span>•</span><span>Langue: {outputLanguage === 'fr' ? 'Français' : 'English'}</span></li>
                  <li className="flex items-center gap-2 text-[11px] text-slate-500"><span>•</span><span>Template par défaut: Anthropic</span></li>
                  <li className="flex items-center gap-2 text-[11px] text-slate-500"><span>•</span><span>Tables DOCX compactes et lisibles</span></li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[520px]">
              {result ? (
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.25)' }}>
                  <div className="px-6 py-4 space-y-4" style={{ borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1"><div className="w-2 h-2 rounded-full" style={{ background: ACCENT.emerald }} /><h2 className="text-base font-semibold text-slate-100">{meetingDetails.title}</h2></div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 ml-4">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(meetingDetails.date).toLocaleDateString(outputLanguage === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {usage && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(usage.audioSeconds / 60)} min - {usage.charCount.toLocaleString()} chars</span>}
                        </div>
                      </div>
                      <button onClick={handleManualExport} disabled={isExporting} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap disabled:opacity-60" style={{ background: `linear-gradient(135deg,${ACCENT.clay},${ACCENT.cyan})`, boxShadow: `0 4px 20px ${ACCENT.clay}35` }}>
                        {isExporting ? <><Loader2 className="w-4 h-4 animate-spin" />Export...</> : <><Download className="w-4 h-4" />Exporter DOCX</>}
                      </button>
                    </div>
                    <TemplatePicker selected={selectedTemplate} onChange={setSelectedTemplate} />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-4xl mx-auto p-8">
                      <div className="flex items-center gap-2 mb-6 text-slate-500"><FileText className="w-4 h-4" /><span className="text-[10px] uppercase tracking-widest font-bold">Compte rendu</span>{isDone && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${ACCENT.emerald}15`, color: ACCENT.emerald }}>Terminé</span>}</div>
                      <MarkdownRenderer content={result.minutes} template={selectedTemplate} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center rounded-2xl text-center" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(71,85,105,0.2)' }}>
                  {isProcessing ? (
                    <div className="max-w-sm"><Loader2 className="w-12 h-12 animate-spin mx-auto mb-8" style={{ color: ACCENT.violet }} /><h3 className="text-lg font-semibold text-slate-200 mb-2">{getStatusLabel()}</h3><p className="text-slate-500 text-sm mb-6">MiniMax M3 analyse votre réunion.</p><ProgressBar step={progressStep} total={4} /></div>
                  ) : (
                    <><FileText className="w-16 h-16 text-slate-600 mb-8" /><h3 className="text-2xl font-bold text-slate-200 mb-3">Prêt à analyser</h3><p className="text-slate-500 max-w-xs mx-auto text-sm mb-8">Uploadez une vidéo ou un fichier audio pour générer un compte rendu structuré.</p><div className="flex flex-wrap justify-center gap-2"><span className="px-3 py-1.5 rounded-full text-xs font-mono" style={{ background: `${ACCENT.clay}12`, color: ACCENT.clay, border: `1px solid ${ACCENT.clay}35` }}>Anthropic DOCX</span><span className="px-3 py-1.5 rounded-full text-xs font-mono" style={{ background: `${ACCENT.cyan}12`, color: ACCENT.cyan, border: `1px solid ${ACCENT.cyan}35` }}>FR/EN</span></div></>
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
