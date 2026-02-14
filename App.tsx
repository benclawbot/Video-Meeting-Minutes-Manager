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
  Download
} from 'lucide-react';
import { MeetingDetails, AnalysisStatus, AnalysisResult, VideoFile } from './types';
import { analyzeMeetingVideo } from './services/geminiService';
import { generateAndDownloadDocx } from './services/docxService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { MarkdownRenderer } from './components/MarkdownRenderer';

const App: React.FC = () => {
  // State
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails>({
    title: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (videoFile?.previewUrl) {
        URL.revokeObjectURL(videoFile.previewUrl);
      }
    };
  }, [videoFile]);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMeetingDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic validation
      if (!file.type.startsWith('video/')) {
        setError("Please upload a valid video file.");
        return;
      }

      // Max size warning (client-side processing limit)
      if (file.size > 200 * 1024 * 1024) {
        setError("File is large (>200MB). Browser may struggle to process it.");
      } else {
        setError(null);
      }

      const previewUrl = URL.createObjectURL(file);
      setVideoFile({ file, previewUrl });
      setStatus(AnalysisStatus.IDLE);
      setResult(null);
    }
  };

  const clearFile = () => {
    if (videoFile?.previewUrl) {
      URL.revokeObjectURL(videoFile.previewUrl);
    }
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setStatus(AnalysisStatus.IDLE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile || !meetingDetails.title || !meetingDetails.date) return;

    setStatus(AnalysisStatus.PROCESSING);
    setError(null);

    try {
      const analysis = await analyzeMeetingVideo(
        videoFile.file,
        meetingDetails.title,
        meetingDetails.date
      );
      setResult(analysis);
      setStatus(AnalysisStatus.COMPLETED);
      
      // Automatic export
      setIsExporting(true);
      await generateAndDownloadDocx(analysis, meetingDetails);
      setIsExporting(false);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while analyzing the video. Please check your API key and try again.");
      setStatus(AnalysisStatus.ERROR);
      setIsExporting(false);
    }
  };

  const handleManualExport = async () => {
    if (result) {
      setIsExporting(true);
      await generateAndDownloadDocx(result, meetingDetails);
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-500/10 p-2 rounded-lg border border-primary-500/20">
              <Video className="w-6 h-6 text-primary-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">MeetingMind</h1>
          </div>
          <div className="text-sm text-slate-400 hidden sm:block">
            Powered by Gemini 3 Pro
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Input Form */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl shadow-xl shadow-black/20 border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-6 flex items-center">
                <UploadCloud className="w-5 h-5 mr-2 text-primary-400" />
                Upload Meeting
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Meeting Title"
                  name="title"
                  placeholder="e.g. Stratégie Marketing Q4"
                  value={meetingDetails.title}
                  onChange={handleInputChange}
                  required
                  disabled={status === AnalysisStatus.PROCESSING}
                />
                
                <Input
                  label="Date"
                  type="date"
                  name="date"
                  value={meetingDetails.date}
                  onChange={handleInputChange}
                  required
                  disabled={status === AnalysisStatus.PROCESSING}
                />

                {/* Video Upload Area */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">Video Recording</label>
                  
                  {!videoFile ? (
                    <div 
                      className={`
                        border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer group
                        ${status === AnalysisStatus.PROCESSING 
                          ? 'opacity-50 cursor-not-allowed border-slate-700' 
                          : 'hover:bg-slate-800/50 hover:border-primary-500/50 border-slate-700 bg-slate-800/30'}
                      `}
                      onClick={() => !status.includes('PROCESSING') && fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="video/*" 
                        className="hidden" 
                        disabled={status === AnalysisStatus.PROCESSING}
                      />
                      <div className="mx-auto bg-slate-800 group-hover:bg-slate-700 w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors">
                        <FileVideo className="w-6 h-6 text-primary-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-300">Click to upload video</p>
                      <p className="text-xs text-slate-500 mt-1">MP4, WebM, MOV up to 200MB</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black shadow-lg">
                      <video 
                        ref={videoPreviewRef}
                        src={videoFile.previewUrl} 
                        className="w-full h-48 object-contain bg-black"
                        controls
                      />
                      <button
                        type="button"
                        onClick={clearFile}
                        disabled={status === AnalysisStatus.PROCESSING}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors disabled:opacity-0 backdrop-blur-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-xs text-slate-300 truncate px-1 font-mono">{videoFile.file.name}</p>
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
                  isLoading={status === AnalysisStatus.PROCESSING}
                  disabled={!videoFile || !meetingDetails.title || !meetingDetails.date}
                  icon={<PlayCircle className="w-4 h-4" />}
                >
                  {status === AnalysisStatus.PROCESSING ? 'Analyzing Video...' : 'Générer Compte Rendu'}
                </Button>
              </form>
            </div>
            
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
              <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-primary-500" />
                Capabilities
              </h4>
              <ul className="text-sm text-slate-400 space-y-2 ml-1">
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Compte rendu automatique (FR)</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Synthèse des points clés</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Extraction des décisions</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2.5"></span>Export DOCX</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
            {result ? (
              <div className="bg-slate-900 rounded-2xl shadow-xl shadow-black/20 border border-slate-800 flex flex-col h-full overflow-hidden">
                {/* Result Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 sticky top-0 z-20">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{meetingDetails.title}</h2>
                    <div className="flex items-center text-sm text-slate-400 mt-1">
                      <Calendar className="w-4 h-4 mr-1.5" />
                      {new Date(meetingDetails.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleManualExport}
                      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-lg shadow-sm transition-colors"
                      title="Download DOCX"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger DOCX
                    </button>
                  </div>
                </div>

                {/* Result Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-950/50 custom-scrollbar">
                  <div className="max-w-3xl mx-auto bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-800 min-h-full relative">
                    {/* Badge for auto-download notification */}
                    {isExporting && (
                      <div className="absolute top-4 right-4 bg-green-900/50 text-green-300 text-xs px-3 py-1 rounded-full border border-green-800 flex items-center animate-pulse">
                        <Download className="w-3 h-3 mr-1.5" />
                        Exporting...
                      </div>
                    )}
                    
                    <div className="prose prose-invert prose-slate max-w-none">
                       <div className="flex items-center mb-6 text-primary-400 border-b border-slate-800 pb-4">
                         <FileText className="w-5 h-5 mr-2" />
                         <span className="font-semibold uppercase tracking-wider text-xs">Compte Rendu</span>
                       </div>
                       <MarkdownRenderer content={result.minutes} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Empty State
              <div className="bg-slate-900 rounded-2xl shadow-xl shadow-black/20 border border-slate-800 h-full flex flex-col items-center justify-center p-12 text-center">
                {status === AnalysisStatus.PROCESSING ? (
                  <div className="max-w-md w-full animate-pulse">
                     <div className="w-16 h-16 bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/20">
                        <Video className="w-8 h-8 text-primary-400 animate-bounce" />
                     </div>
                     <h3 className="text-xl font-semibold text-slate-100 mb-2">Analyzing Meeting Video</h3>
                     <p className="text-slate-400 mb-8">
                       Gemini is watching the video, identifying speakers, and extracting key points.
                     </p>
                     
                     <div className="space-y-3">
                       <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-primary-500 rounded-full w-2/3 animate-[shimmer_2s_infinite]"></div>
                       </div>
                       <div className="flex justify-between text-xs text-slate-500">
                         <span>Uploading...</span>
                         <span>Processing...</span>
                         <span>Generating...</span>
                       </div>
                     </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
                      <FileText className="w-10 h-10 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">Ready to Transcribe</h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      Upload a meeting recording to generate formatted minutes in French automatically using Gemini AI.
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