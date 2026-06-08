import React, { useState, useRef, useEffect } from 'react';
import {
  Video, FileText, Calendar, UploadCloud, CheckCircle2, AlertCircle, X,
  PlayCircle, Download, Loader2, Music, Sparkles, Mic2, BrainCircuit,
  Zap, Clock
} from 'lucide-react';
import { MeetingDetails, AnalysisStatus, AnalysisResult, MediaFile, DocxTemplateId, UsageMetrics } from './types';
import { analyzeMeetingVideo } from './services/geminiService';
import { generateAndDownloadDocx } from './services/docxService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { TokenTracker } from './components/TokenTracker';

declare global { interface Window { aistudio: { hasSelectedApiKey: () => Promise<boolean>; openSelectKey: () => Promise<void>; }; } }

const ACCENT = { violet: '#7c3aed', cyan: '#06b6d4', emerald: '#10b981', amber: '#f59e0b' };

const TEMPLATES = [
  { id: 'corporate' as DocxTemplateId, name: 'Corporate', gradient: 'from-slate-700 to-slate-800', border: 'rgba(100,116,139,0.4)' },
  { id: 'modern'    as DocxTemplateId, name: 'Modern',    gradient: 'from-cyan-600 to-blue-700',   border: 'rgba(6,182,212,0.4)' },
  { id: 'executive' as DocxTemplateId, name: 'Executive',  gradient: 'from-slate-800 to-black',     border: 'rgba(71,85,105,0.4)' },
];

interface ProgressBarProps { step: number; total: number; }
const ProgressBar: React.FC<ProgressBarProps> = ({ step, total }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: total===0?"0%":Math.round((step/total)*100)+"%", background: "linear-gradient(90deg, "+ACCENT.violet+", "+ACCENT.cyan+")", boxShadow: "0 0 8px "+ACCENT.violet+"60" }} />
    </div>
    <span className="text-[10px] font-mono text-slate-500 tabular-nums">{Math.round(total===0?0:(step/total)*100)}%</span>
  </div>
);

interface PipelineStepperProps { status: AnalysisStatus; }
const PipelineStepper: React.FC<PipelineStepperProps> = ({ status }) => {
  const isProcessing = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED;
  const stepOrder = [AnalysisStatus.EXTRACTING_AUDIO, AnalysisStatus.UPLOADING, AnalysisStatus.TRANSCRIBING, AnalysisStatus.PROCESSING];
  const currentIdx = isProcessing ? stepOrder.indexOf(status) : -1;
  const labels = ['Audio', 'Upload', 'Transcription', 'Analyse'];
  const icons = [Clock, UploadCloud, Mic2, BrainCircuit];
  const accents = [ACCENT.amber, ACCENT.cyan, ACCENT.cyan, ACCENT.violet];
  const getState = (idx: number): 'done'|'active'|'pending' => {
    if (!isProcessing) return 'pending';
    if (currentIdx > idx) return 'done';
    if (currentIdx === idx) return 'active';
    return 'pending';
  };
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, idx) => {
        const Icon = icons[idx];
        const accent = accents[idx];
        const state = getState(idx);
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300"
              style={{ background: state==="active"?accent+"15":state==="done"?"rgba(16,185,129,0.08)":"transparent", border: state!=="pending"?"1px solid "+accent+"40":"1px solid transparent", opacity: state==="pending"&&isProcessing?0.4:1 }}>
              <div className="relative">
                {state==="done" ? (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background:ACCENT.emerald+"20",border:"1.5px solid "+ACCENT.emerald }}>
                    <CheckCircle2 className="w-3.5 h-3.5" style={{color:ACCENT.emerald}} />
                  </div>
                ) : state==="active" ? (
                  <><div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{background:accent}} /><div className="relative w-7 h-7 rounded-full flex items-center justify-center" style={{background:accent+"20",border:"1.5px solid "+accent}}>
                    <Icon className="w-3.5 h-3.5" style={{color:accent}} /></div></>
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{background:"rgba(148,163,184,0.1)",border:"1.5px solid rgba(148,163,184,0.2)"}}>
                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap" style={{color:state==="active"?accent:state==="done"?ACCENT.emerald:"#475569"}}>{label}</span>
            </div>
            {idx < labels.length - 1 && <div className="flex-1 h-px mx-1 mb-4" style={{background:currentIdx>idx?"linear-gradient(90deg,"+ACCENT.emerald+","+ACCENT.cyan+")":"#1e293b"}} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface FilePreviewProps { mediaFile: MediaFile; onClear: () => void; disabled: boolean; }
const FilePreview: React.FC<FilePreviewProps> = ({ mediaFile, onClear, disabled }) => (
  <div className="relative rounded-2xl overflow-hidden border" style={{borderColor:"rgba(124,58,237,0.25)",background:"rgba(0,0,0,0.4)"}}>
    {mediaFile.isAudioOnly ? (
      <div className="flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float" style={{background:"linear-gradient(135deg,rgba(6,182,212,0.2),rgba(124,58,237,0.2))",border:"1px solid rgba(6,182,212,0.3)"}}>
          <Music className="w-8 h-8 text-cyan-400" />
        </div>
        <audio src={mediaFile.previewUrl} className="w-full" controls />
      </div>
    ) : <video src={mediaFile.previewUrl} className="w-full max-h-52 object-contain bg-black" controls />}
    <button type="button" onClick={onClear} disabled={disabled}
      className="absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-30"
      style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(255,255,255,0.1)"}}>
      <X className="w-3.5 h-3.5 text-white" />
    </button>
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
      <p className="text-[11px] text-slate-300 truncate font-mono px-1">{mediaFile.file.name}</p>
    </div>
  </div>
);

interface TemplatePickerProps { selected: DocxTemplateId; onChange: (id: DocxTemplateId) => void; }
const TemplatePicker: React.FC<TemplatePickerProps> = ({ selected, onChange }) => (
  <div className="flex gap-2">
    {TEMPLATES.map(tpl => (
      <button key={tpl.id} onClick={() => onChange(tpl.id)}
        className="flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        style={{background:selected===tpl.id?"rgba(124,58,237,0.08)":"rgba(15,23,42,0.5)",borderColor:selected===tpl.id?ACCENT.violet+"80":tpl.border,boxShadow:selected===tpl.id?"0 0 16px "+ACCENT.violet+"20":"none"}}>
        <div className={"w-full h-7 rounded-lg bg-gradient-to-br "+tpl.gradient} style={{border:"1px solid rgba(0,0,0,0.2)"}} />
        <span className="text-[11px] font-medium" style={{color:selected===tpl.id?ACCENT.violet:"#64748b"}}>{tpl.name}</span>
      </button>
    ))}
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
  const [selectedTemplate, setSelectedTemplate] = useState<DocxTemplateId>('corporate');
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const ck = async () => { if (window.aistudio?.hasSelectedApiKey) { try { setHasApiKey(await window.aistudio.hasSelectedApiKey()); } catch(e) {} } }; ck(); setIsCheckingKey(false); }, []);
  const handleOpenKeyDialog = async () => { if (window.aistudio?.openSelectKey) { try { await window.aistudio.openSelectKey(); setHasApiKey(true); } catch(e) {} } };
  useEffect(() => { return () => { if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl); }; }, [mediaFile]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setMeetingDetails(p => ({ ...p, [e.target.name]: e.target.value })); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.m4a');
      if (!isVideo && !isAudio) { setError('Format non supporte.'); return; }
      if (file.size > 200*1024*1024) { setError('Fichier trop volumineux (max 200 Mo).'); return; }
      setError(null); setMediaFile({ file, previewUrl: URL.createObjectURL(file), isAudioOnly: isAudio && !isVideo });
      setStatus(AnalysisStatus.IDLE); setResult(null); setUsage(null);
    }
  };
  const clearFile = () => { if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl); setMediaFile(null); if (fileInputRef.current) fileInputRef.current.value=''; setStatus(AnalysisStatus.IDLE); setResult(null); setUsage(null); setError(null); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || !meetingDetails.title || !meetingDetails.date) return;
    setStatus(AnalysisStatus.PROCESSING); setError(null);
    try { const a = await analyzeMeetingVideo(mediaFile.file, meetingDetails.title, meetingDetails.date, s => setStatus(s as AnalysisStatus)); setResult(a); setUsage((a.usage ? a.usage : null)); setStatus(AnalysisStatus.COMPLETED); }
    catch(err: any) { console.error(err); setError(err.message||"Erreur lors de l'analyse."); setStatus(AnalysisStatus.ERROR); }
  };
  const handleManualExport = async () => { if (result) { setIsExporting(true); await generateAndDownloadDocx(result, meetingDetails, selectedTemplate); setIsExporting(false); } };
  const isProcessing = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED;
  const isDone = status === AnalysisStatus.COMPLETED;
  const isDisabled = !isDone && status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR;
  const getStatusLabel = () => { switch(status){ case AnalysisStatus.EXTRACTING_AUDIO: return 'Extraction audio...'; case AnalysisStatus.UPLOADING: return 'Envoi vers Deepgram...'; case AnalysisStatus.TRANSCRIBING: return 'Transcription...'; case AnalysisStatus.PROCESSING: return 'Analyse MiniMax M3...'; case AnalysisStatus.COMPLETED: return 'Analyse terminee'; case AnalysisStatus.ERROR: return 'Erreur'; default: return 'Pret'; } };
  const progressStep = {[AnalysisStatus.EXTRACTING_AUDIO]:1,[AnalysisStatus.UPLOADING]:2,[AnalysisStatus.TRANSCRIBING]:3,[AnalysisStatus.PROCESSING]:4}[status] !== undefined ? [status] : 0;

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{background:"#06080f",color:"#e2e8f0"}}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full" style={{background:"radial-gradient(ellipse,rgba(124,58,237,0.12) 0%,transparent 70%)"}} />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full" style={{background:"radial-gradient(ellipse,rgba(6,182,212,0.07) 0%,transparent 70%)"}} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] rounded-full" style={{background:"radial-gradient(ellipse,rgba(16,185,129,0.05) 0%,transparent 70%)"}} />
      </div>

      <header className="relative z-10 border-b" style={{background:"rgba(6,8,15,0.85)",backdropFilter:"blur(20px)",borderColor:"rgba(124,58,237,0.15)"}}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-lg opacity-50" style={{background:"linear-gradient(135deg,"+ACCENT.violet+","+ACCENT.cyan+")",filter:"blur(12px)"}} />
              <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.25)"}}>
                <Video className="w-5 h-5" style={{color:ACCENT.violet}} />
                <span className="text-sm font-bold text-slate-100 tracking-tight">MeetingMind</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-[10px] font-mono" style={{background:"rgba(6,182,212,0.08)",border:"1px solid rgba(6,182,212,0.2)",color:ACCENT.cyan}}>
              <Zap className="w-2.5 h-2.5" />Powered by MiniMax M3
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5"><Mic2 className="w-3 h-3" style={{color:ACCENT.cyan}} />Deepgram Nova-2</span>
              <span>-&gt;</span>
              <span className="flex items-center gap-1.5"><BrainCircuit className="w-3 h-3" style={{color:ACCENT.violet}} />MiniMax M3</span>
              <span>-&gt;</span>
              <span className="flex items-center gap-1.5"><FileDoc className="w-3 h-3" style={{color:ACCENT.emerald}} />DOCX</span>
            </div>
            <div className="w-px h-5 bg-slate-800" />
            <TokenTracker usage={usage} status={status} />
          </div>
        </div>
      </header>

      {isProcessing && (
        <div className="relative z-10 border-b py-3 px-5" style={{background:"rgba(6,8,15,0.7)",backdropFilter:"blur(12px)",borderColor:"rgba(124,58,237,0.1)"}}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{color:ACCENT.violet}}>{getStatusLabel()}</span>
              <span className="text-[10px] text-slate-500 font-mono">{meetingDetails.title||"Sans titre"}</span>
            </div>
            <PipelineStepper status={status} />
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-5 py-8 w-full">
        {!hasApiKey && !isCheckingKey ? (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center max-w-md rounded-3xl p-12" style={{background:"rgba(15,23,42,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(124,58,237,0.2)"}}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{background:"linear-gradient(135deg,"+ACCENT.violet+"20,"+ACCENT.cyan+"20)",border:"1px solid "+ACCENT.violet+"30"}}>
                <Sparkles className="w-8 h-8" style={{color:ACCENT.violet}} />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3">Configuration requise</h2>
              <p className="text-slate-400 mb-8 leading-relaxed text-sm">Ajoutez <code style={{color:ACCENT.cyan}}>MINIMAX_API_KEY</code> dans votre fichier <code style={{color:ACCENT.cyan}}>.env.local</code> pour demarrer avec MiniMax M3.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleOpenKeyDialog} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{background:"linear-gradient(135deg,"+ACCENT.violet+",#5b21b6)",boxShadow:"0 4px 20px "+ACCENT.violet+"40"}}>Selectionner une Cle API</button>
                <a href="https://www.minimaxi.com/document/guides" target="_blank" rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 border transition-all hover:text-white hover:border-slate-600"
                  style={{borderColor:"rgba(71,85,105,0.4)"}}>Documentation</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
              <div className="rounded-2xl p-5" style={{background:"rgba(15,23,42,0.6)",backdropFilter:"blur(16px)",border:"1px solid rgba(71,85,105,0.3)"}}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-5 rounded-full" style={{background:"linear-gradient(180deg,"+ACCENT.violet+","+ACCENT.cyan+")"}} />
                  <h2 className="text-[11px] font-semibold text-slate-200 uppercase tracking-widest">Nouvelle Reunion</h2>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input label="Titre" name="title" placeholder="Reunion de direction Q3" value={meetingDetails.title} onChange={handleInputChange} required disabled={isDisabled} />
                  <Input label="Date" type="date" name="date" value={meetingDetails.date} onChange={handleInputChange} required disabled={isDisabled} />
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Enregistrement</label>
                    {!mediaFile ? (
                      <div className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-300 group"
                        style={{borderColor:isDisabled?"rgba(71,85,105,0.3)":"rgba(124,58,237,0.3)",background:isDisabled?"rgba(15,23,42,0.3)":"rgba(124,58,237,0.03)"}}
                        onClick={() => !isDisabled && fileInputRef.current?.click()}
                        onMouseEnter={e => { if(!isDisabled){ (e.currentTarget as HTMLDivElement).style.borderColor=ACCENT.violet+"80"; (e.currentTarget as HTMLDivElement).style.background="rgba(124,58,237,0.06)"; }}}
                        onMouseLeave={e => { if(!isDisabled){ (e.currentTarget as HTMLDivElement).style.borderColor="rgba(124,58,237,0.3)"; (e.currentTarget as HTMLDivElement).style.background="rgba(124,58,237,0.03)"; }}}>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*,audio/x-m4a,audio/mp4,audio/m4a,.m4a" className="hidden" />
                        <div className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{background:"rgba(124,58,237,0.1)"}}>
                          <UploadCloud className="w-5 h-5" style={{color:ACCENT.violet}} />
                        </div>
                        <p className="text-xs font-medium text-slate-300">Glisser-deposer ou cliquer</p>
                        <p className="text-[11px] text-slate-600 mt-1">Video ou M4A - Max 200 Mo</p>
                      </div>
                    ) : <FilePreview mediaFile={mediaFile} onClear={clearFile} disabled={isDisabled} />}
                  </div>
                  {error && <div className="p-3 rounded-xl flex items-start gap-2 text-xs" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><span className="text-red-300">{error}</span>
                  </div>}
                  <button type="submit" disabled={!mediaFile || !meetingDetails.title || !meetingDetails.date || isProcessing}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{background:(!mediaFile||!meetingDetails.title||isProcessing)?"rgba(71,85,105,0.3)":"linear-gradient(135deg,"+ACCENT.violet+",#5b21b6)",boxShadow:(!mediaFile||!meetingDetails.title||isProcessing)?"none":"0 4px 24px "+ACCENT.violet+"40"}}>
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</> : <><PlayCircle className="w-4 h-4" /> Generer le compte rendu</>}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl p-4" style={{background:"rgba(15,23,42,0.4)",backdropFilter:"blur(12px)",border:"1px solid rgba(71,85,105,0.2)"}}>
                <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" style={{color:ACCENT.emerald}} />Formats supportes</h4>
                <ul className="space-y-1.5">
                  {[{icon:"🎬",label:"Video MP4, WebM, MOV"},{icon:"🎙",label:"Audio Zoom M4A"},{icon:"🔊",label:"Extraction audio locale"}].map(item => (
                    <li key={item.label} className="flex items-center gap-2 text-[11px] text-slate-500"><span>{item.icon}</span><span>{item.label}</span></li>
                  ))}
                </ul>
                <div className="mt-4 pt-3" style={{borderTop:"1px solid rgba(71,85,105,0.15)"}}>
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Pipeline</p>
                  <div className="flex items-center gap-1.5">
                    {([["Deepgram",ACCENT.cyan],["M3",ACCENT.violet],["DOCX",ACCENT.emerald]] as [string,string][]).map(([label,color]) => (
                      <React.Fragment key={label}>
                        <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,"+color+"60,"+color+"30)"}} />
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{background:color+"12",color,border:"1px solid "+color+"30"}}>{label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[520px]">
              {result ? (
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{background:"rgba(15,23,42,0.5)",backdropFilter:"blur(16px)",border:"1px solid rgba(71,85,105,0.25)"}}>
                  <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid rgba(71,85,105,0.2)"}}>
                    <div>
                      <div className="flex items-center gap-2.5 mb-1"><div className="w-2 h-2 rounded-full animate-pulse" style={{background:ACCENT.emerald}} /><h2 className="text-base font-semibold text-slate-100">{meetingDetails.title}</h2></div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 ml-4">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(meetingDetails.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</span>
                        {usage && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(usage.audioSeconds/60)} min - {usage.charCount.toLocaleString()} chars</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block w-52"><TemplatePicker selected={selectedTemplate} onChange={setSelectedTemplate} /></div>
                      <button onClick={handleManualExport}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                        style={{background:"linear-gradient(135deg,"+ACCENT.violet+","+ACCENT.cyan+")",boxShadow:"0 4px 20px "+ACCENT.violet+"40"}}>
                        {isExporting ? <><Loader2 className="w-4 h-4 animate-spin" />Export...</> : <><Download className="w-4 h-4" />Exporter DOCX</>}
                      </button>
                    </div>
                  </div>
                  <div className="sm:hidden px-6 py-3" style={{borderBottom:"1px solid rgba(71,85,105,0.15)"}}><TemplatePicker selected={selectedTemplate} onChange={setSelectedTemplate} /></div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-4xl mx-auto p-8">
                      <div className="flex items-center gap-2 mb-6 text-slate-500">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{letterSpacing:"0.1em"}}>Compte rendu</span>
                        {isDone && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{background:ACCENT.emerald+"15",color:ACCENT.emerald,border:"1px solid "+ACCENT.emerald+"30"}}>Termine</span>}
                      </div>
                      <MarkdownRenderer content={result.minutes} template={selectedTemplate} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center rounded-2xl text-center" style={{background:"rgba(15,23,42,0.4)",backdropFilter:"blur(12px)",border:"1px solid rgba(71,85,105,0.2)"}}>
                  {isProcessing ? (
                    <div className="max-w-sm">
                      <div className="relative w-20 h-20 mx-auto mb-8">
                        <div className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{background:ACCENT.violet}} />
                        <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center" style={{background:"linear-gradient(135deg,"+ACCENT.violet+"20,"+ACCENT.cyan+"20)",border:"1px solid "+ACCENT.violet+"40"}}>
                          <Loader2 className="w-9 h-9 animate-spin" style={{color:ACCENT.violet}} />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-200 mb-2">{getStatusLabel()}</h3>
                      <p className="text-slate-500 text-sm mb-6 leading-relaxed">MiniMax M3 analyse votre reunion pour en extraire les points cles et decisions.</p>
                      <div className="max-w-xs mx-auto"><ProgressBar step={progressStep} total={4} /></div>
                      <p className="mt-3 text-xs text-slate-600">1 a 2 minutes selon la duree</p>
                    </div>
                  ) : (
                    <>
                      <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 rounded-3xl blur-2xl opacity-30" style={{background:"linear-gradient(135deg,"+ACCENT.violet+","+ACCENT.cyan+")"}} />
                        <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center" style={{background:"rgba(15,23,42,0.8)",border:"1px solid "+ACCENT.violet+"30"}}>
                          <FileText className="w-12 h-12 text-slate-600" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-slate-200 mb-3 tracking-tight">Pret a analyser</h3>
                      <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed mb-8">Uploadez une video ou un fichier audio pour generer un compte rendu structure en francais.</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {([["Deepgram Nova-2",ACCENT.cyan],["MiniMax M3",ACCENT.violet],["Export DOCX",ACCENT.emerald]] as [string,string][]).map(([label,color]) => (
                          <span key={label} className="px-3 py-1.5 rounded-full text-xs font-mono font-medium"
                            style={{background:color+"12",color,border:"1px solid "+color+"35",boxShadow:"0 0 12px "+color+"15"}}>{label}</span>
                        ))}
                      </div>
                    </>
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