import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  FileText, 
  Calendar, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle,
  FileVideo,
  X,
  PlayCircle,
  Download,
  Loader2,
  Music,
  Layout,
  Palette
} from 'lucide-react';
import { MeetingDetails, AnalysisStatus, AnalysisResult, MediaFile, DocxTemplateId } from './types';
import { analyzeMeetingVideo } from './services/geminiService';
import { generateAndDownloadDocx } from './services/docxService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { MarkdownRenderer } from './components/MarkdownRenderer';

const App: React.FC = () => {
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails>({
    title: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocxTemplateId>('corporate');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaFile?.previewUrl) {
        URL.revokeObjectURL(mediaFile.previewUrl);
      }
    };
  }, [mediaFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMeetingDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.m4a');
      
      if (!isVideo && !isAudio) {
        setError("Veuillez télécharger un fichier vidéo ou audio (M4A) valide.");
        return;
      }
      
      if (file.size > 200 * 1024 * 1024) {
        setError("Le fichier dépasse la limite de 200Mo.");
        return;
      }
      
      setError(null);
      const previewUrl = URL.createObjectURL(file);
      setMediaFile({ file, previewUrl, isAudioOnly: isAudio && !isVideo });
      setStatus(AnalysisStatus.IDLE);
      setResult(null);
    }
  };

  const clearFile = () => {
    if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl);
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || !meetingDetails.title || !meetingDetails.date) return;

    setStatus(AnalysisStatus.PROCESSING);
    setError(null);

    try {
      const analysis = await analyzeMeetingVideo(
        mediaFile.file,
        meetingDetails.title,
        meetingDetails.date,
        (newStatus) => setStatus(newStatus as AnalysisStatus)
      );
      setResult(analysis);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de l'analyse.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleManualExport = async () => {
    if (result) {
      setIsExporting(true);
      await generateAndDownloadDocx(result, meetingDetails, selectedTemplate);
      setIsExporting(false);
    }
  };

  const getStatusMessage = () => {
    switch(status) {
      case AnalysisStatus.EXTRACTING_AUDIO: return "Extraction de l'audio...";
      case AnalysisStatus.UPLOADING: return "Transmission à l'IA...";
      case AnalysisStatus.PROCESSING: return "Analyse du contenu...";
      default: return "Traitement en cours...";
    }
  };

  const templates: {id: DocxTemplateId, name: string, color: string}[] = [
    { id: 'corporate', name: 'Corporate', color: 'bg-slate-600' },
    { id: 'modern', name: 'Modern', color: 'bg-sky-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-500/10 p-2 rounded-lg border border-primary-500/20">
              <Video className="w-6 h-6 text-primary-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">MeetingMind</h1>
          </div>
          <div className="text-sm text-slate-400 hidden sm:block">
            Vidéo & Audio (M4A) • Gemini 3 Pro
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-6 flex items-center">
                <UploadCloud className="w-5 h-5 mr-2 text-primary-400" />
                Nouvelle Réunion
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Titre de la réunion"
                  name="title"
                  placeholder="ex: Réunion de Direction"
                  value={meetingDetails.title}
                  onChange={handleInputChange}
                  required
                  disabled={status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED}
                />
                
                <Input
                  label="Date"
                  type="date"
                  name="date"
                  value={meetingDetails.date}
                  onChange={handleInputChange}
                  required
                  disabled={status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED}
                />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">Enregistrement (Vidéo ou M4A)</label>
                  {!mediaFile ? (
                    <div 
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer group ${status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED ? 'opacity-50 cursor-not-allowed border-slate-700' : 'hover:bg-slate-800/50 hover:border-primary-500/50 border-slate-700 bg-slate-800/30'}`}
                      onClick={() => (status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR || status === AnalysisStatus.COMPLETED) && fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="video/*,audio/x-m4a,audio/mp4,audio/m4a,.m4a" 
                        className="hidden" 
                      />
                      <div className="mx-auto bg-slate-800 group-hover:bg-slate-700 w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors">
                        <UploadCloud className="w-6 h-6 text-primary-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-300">Ajouter un fichier</p>
                      <p className="text-xs text-slate-500 mt-1">Vidéo ou Audio (Max 200 Mo)</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black shadow-lg">
                      {mediaFile.isAudioOnly ? (
                        <div className="w-full h-48 bg-slate-800 flex flex-col items-center justify-center p-4">
                           <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mb-4">
                             <Music className="w-8 h-8 text-primary-400" />
                           </div>
                           <audio src={mediaFile.previewUrl} className="w-full" controls />
                        </div>
                      ) : (
                        <video src={mediaFile.previewUrl} className="w-full h-48 object-contain bg-black" controls />
                      )}
                      <button 
                        type="button" 
                        onClick={clearFile} 
                        disabled={status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED} 
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors disabled:opacity-0 backdrop-blur-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-xs text-slate-300 truncate px-1 font-mono">{mediaFile.file.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0 mr-2" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  isLoading={status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED}
                  disabled={!mediaFile || !meetingDetails.title || !meetingDetails.date}
                  icon={<PlayCircle className="w-4 h-4" />}
                >
                  {status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED ? 'Analyse en cours...' : 'Générer Compte Rendu'}
                </Button>
              </form>
            </div>
            
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
              <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-primary-500" />
                Formats Supportés
              </h4>
              <ul className="text-xs text-slate-400 space-y-2 ml-1">
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Vidéo (MP4, WebM, MOV)</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Audio Zoom (M4A)</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Extraction audio locale haute-fidélité</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
            {result ? (
              <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 flex flex-col h-full overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 sticky top-0 z-20">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{meetingDetails.title}</h2>
                    <div className="flex items-center text-sm text-slate-400 mt-1">
                      <Calendar className="w-4 h-4 mr-1.5" />
                      {new Date(meetingDetails.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleManualExport} 
                      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-lg shadow-sm transition-colors ring-1 ring-primary-500" 
                      title="Télécharger DOCX"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2" />}
                      Exporter en DOCX
                    </button>
                  </div>
                </div>

                {/* Template Selector Section */}
                <div className="bg-slate-900 border-b border-slate-800 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="w-4 h-4 text-primary-400" />
                    <span className="text-sm font-medium text-slate-200">Choisir le style d'export</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`
                          relative group flex flex-col items-center p-2 rounded-lg border transition-all duration-200
                          ${selectedTemplate === tpl.id 
                            ? 'bg-slate-800 border-primary-500 ring-1 ring-primary-500' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                          }
                        `}
                      >
                        <div className={`w-full h-8 rounded mb-2 ${tpl.color} shadow-sm border border-black/10`}></div>
                        <span className={`text-xs font-medium ${selectedTemplate === tpl.id ? 'text-primary-400' : 'text-slate-400'}`}>
                          {tpl.name}
                        </span>
                        {selectedTemplate === tpl.id && (
                          <div className="absolute top-1 right-1">
                            <CheckCircle2 className="w-3 h-3 text-primary-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-950/50 custom-scrollbar">
                  <div className="max-w-4xl mx-auto min-h-full">
                     <div className="flex items-center mb-4 text-slate-400 px-2">
                         <FileText className="w-4 h-4 mr-2" />
                         <span className="text-xs uppercase tracking-wider font-semibold">Aperçu du document</span>
                     </div>
                     <MarkdownRenderer content={result.minutes} template={selectedTemplate} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 h-full flex flex-col items-center justify-center p-12 text-center">
                {status !== AnalysisStatus.IDLE && status !== AnalysisStatus.ERROR && status !== AnalysisStatus.COMPLETED ? (
                  <div className="max-w-md w-full">
                     <div className="w-16 h-16 bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/20">
                        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                     </div>
                     <h3 className="text-xl font-semibold text-slate-100 mb-2">{getStatusMessage()}</h3>
                     <p className="text-slate-400 mb-8">
                       L'IA traite votre réunion pour identifier les points clés et structurer votre compte rendu. 
                       Cela peut prendre 1 à 2 minutes selon la durée.
                     </p>
                     <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-primary-500 rounded-full w-full animate-[shimmer_2s_infinite]"></div>
                     </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
                      <FileText className="w-10 h-10 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">Prêt pour l'analyse</h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      Téléchargez un enregistrement vidéo ou audio Zoom (jusqu'à 200 Mo) pour générer un compte rendu structuré en français via Gemini.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;