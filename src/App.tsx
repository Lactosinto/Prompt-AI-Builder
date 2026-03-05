import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Wand2, 
  Type as TypeIcon,
  RotateCcw,
  Languages,
  Info,
  Image as ImageIcon,
  Upload,
  X,
  MessageSquare,
  Terminal,
  Activity,
  Cpu,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeAndOptimizePrompt, generatePromptFromImage, getRealtimeAssistance, type PromptAnalysis, type AnalysisMode, type RealtimeAssistance } from './services/geminiService';
import { analyzePromptStrength, type StrengthResult } from './utils/promptAnalyzer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [input, setInput] = useState('');
  const [additionalIdea, setAdditionalIdea] = useState('');
  const [mode, setMode] = useState<AnalysisMode>('translator');
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [realtimeAssistance, setRealtimeAssistance] = useState<RealtimeAssistance | null>(null);
  const [isRealtimeLoading, setIsRealtimeLoading] = useState(false);
  const [strength, setStrength] = useState<StrengthResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'optimized' | 'translated'>('optimized');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedImage({
        data: base64String,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (mode === 'vision') {
      if (!selectedImage) return;
      setIsAnalyzing(true);
      try {
        const result = await generatePromptFromImage(selectedImage.data, selectedImage.mimeType, additionalIdea);
        setAnalysis(result);
        setStrength(analyzePromptStrength(result.optimizedPrompt));
        setActiveTab('optimized');
      } catch (error) {
        console.error("Vision analysis failed:", error);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    if (!input.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeAndOptimizePrompt(input, mode, additionalIdea);
      setAnalysis(result);
      setStrength(analyzePromptStrength(result.optimizedPrompt));
      setActiveTab('optimized');
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoFix = () => {
    if (!analysis) return;
    let fixed = analysis.translatedPrompt;
    analysis.typos.forEach(typo => {
      const regex = new RegExp(`\\b${typo.original}\\b`, 'gi');
      fixed = fixed.replace(regex, typo.correction);
    });
    setAnalysis({
      ...analysis,
      translatedPrompt: fixed,
      typos: []
    });
    setStrength(analyzePromptStrength(fixed));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setInput('');
    setAdditionalIdea('');
    setSelectedImage(null);
    setAnalysis(null);
    setStrength(null);
    setRealtimeAssistance(null);
  };

  const lastProcessedInput = React.useRef('');

  // Real-time assistance debouncing
  useEffect(() => {
    if (mode === 'vision' || !input.trim() || input.length < 5 || input === lastProcessedInput.current) {
      if (!input.trim() || input.length < 5) setRealtimeAssistance(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsRealtimeLoading(true);
      try {
        const result = await getRealtimeAssistance(input);
        setRealtimeAssistance(result);
        lastProcessedInput.current = input;
      } catch (error) {
        console.error("Realtime assistance failed:", error);
      } finally {
        setIsRealtimeLoading(false);
      }
    }, 500); // 500ms debounce for snappier feel

    return () => clearTimeout(timer);
  }, [input, mode]);

  // Handle paste events for images in vision mode
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (mode !== 'vision') return;
      
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64String = (e.target?.result as string).split(',')[1];
              setSelectedImage({
                data: base64String,
                mimeType: file.type
              });
            };
            reader.readAsDataURL(file);
          }
          break; // Only handle the first image
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [mode]);

  const applyRecommendation = (rec: string) => {
    setInput(prev => {
      const trimmedPrev = prev.trimEnd();
      const lowerPrev = trimmedPrev.toLowerCase();
      const lowerRec = rec.toLowerCase().trim();

      // If the recommendation is already there at the end, don't add it again
      if (lowerPrev.endsWith(lowerRec)) return prev;

      // If the recommendation starts with the current input, it's a completion
      // e.g. "standing on the" -> "standing on the beach"
      if (lowerRec.startsWith(lowerPrev) && lowerPrev.length > 0) {
        return rec;
      }

      // Determine separator: use comma only if the input already ends with one
      if (trimmedPrev.endsWith(',')) {
        return trimmedPrev + ' ' + rec;
      }

      // Otherwise use a space for natural continuation
      // This fixes the issue where a comma was being added in the middle of a phrase
      const separator = (prev.length > 0 && !prev.endsWith(' ')) ? ' ' : '';
      return prev + separator + rec;
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] py-12 px-4 sm:px-8 font-sans selection:bg-[#FACC15] selection:text-black transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* System Header / Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-6 bg-[#141414] p-3 rounded-2xl border border-[#2A2A2A] sticky top-6 z-50">
          <div className="flex items-center gap-6 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FACC15] rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-black" />
              </div>
              <span className="font-bold tracking-tight text-xl text-white">PROMPT_LAB</span>
            </div>
            <div className="h-6 w-px bg-[#2A2A2A] hidden md:block" />
            <div className="hidden md:flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#9CA3AF] uppercase font-bold tracking-widest">Engine</span>
              <span className="text-[10px] font-mono font-bold bg-[#1A1A1A] px-2 py-1 rounded-lg text-white border border-[#2A2A2A]">GEMINI_3.1_PRO</span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide p-1 bg-[#0B0B0B] rounded-xl border border-[#2A2A2A]">
            <button onClick={() => setMode('translator')} className={cn("pill-tab", mode === 'translator' && "active")}>
              <Languages size={15} /> 
              <span className="hidden sm:inline">Translator</span>
            </button>
            <button onClick={() => setMode('auditor')} className={cn("pill-tab", mode === 'auditor' && "active")}>
              <AlertCircle size={15} /> 
              <span className="hidden sm:inline">Auditor</span>
            </button>
            <button onClick={() => setMode('vision')} className={cn("pill-tab", mode === 'vision' && "active")}>
              <ImageIcon size={15} /> 
              <span className="hidden sm:inline">Vision</span>
            </button>
            <button onClick={() => setMode('troubleshooter')} className={cn("pill-tab", mode === 'troubleshooter' && "active")}>
              <MessageSquare size={15} /> 
              <span className="hidden sm:inline">Consult</span>
            </button>
          </div>

          <div className="flex items-center gap-4 px-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse" />
              <span className="text-[10px] font-mono text-[#9CA3AF] uppercase font-bold tracking-widest">System_Online</span>
            </div>
            <div className="h-6 w-px bg-[#2A2A2A] hidden sm:block" />
            
            <div className="flex items-center gap-2">
              <button onClick={reset} className="p-2.5 text-[#9CA3AF] hover:text-white transition-colors bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Workspace Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <div className="tech-card">
              <div className="tech-header">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center border border-[#2A2A2A]">
                    <TypeIcon size={14} className="#9CA3AF" />
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-white block leading-none">Source_Buffer.txt</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-wider">RAW</span>
                      <span className="w-1 h-1 bg-[#2A2A2A] rounded-full" />
                      <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-wider">{mode}</span>
                    </div>
                  </div>
                </div>
                {isRealtimeLoading && (
                  <div className="w-4 h-4 border-2 border-[#2A2A2A] border-t-[#FACC15] rounded-full animate-spin" />
                )}
              </div>

              {mode === 'vision' ? (
                <div className="p-6 bg-[#0B0B0B]/30">
                  <div className={cn(
                    "h-[320px] border border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center transition-all relative group overflow-hidden bg-[#141414]",
                    !selectedImage && "border-dashed hover:border-[#404040]"
                  )}>
                    {selectedImage ? (
                      <>
                        <img 
                          src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                          alt="Selected" 
                          className="w-full h-full object-contain p-6"
                        />
                        <button 
                          onClick={() => setSelectedImage(null)}
                          className="absolute top-6 right-6 p-2.5 bg-[#1A1A1A]/90 backdrop-blur border border-[#2A2A2A] rounded-xl text-[#9CA3AF] hover:text-rose-500 transition-all z-10"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                        <Upload size={28} className="text-[#2A2A2A] mb-4" />
                        <p className="text-sm font-semibold text-[#9CA3AF]">Drop or Paste reference image</p>
                        <p className="text-[11px] text-[#404040] mt-2">MAX 10MB • PNG/JPG • CTRL+V</p>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter raw prompt or idea..."
                    className="tech-input h-[320px] border-b border-[#2A2A2A]"
                  />
                  
                  {/* Real-time Recommendations Overlay */}
                  <AnimatePresence>
                    {realtimeAssistance && realtimeAssistance.recommendations.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute bottom-6 left-6 right-6 flex flex-wrap gap-2 p-3 bg-[#1A1A1A]/95 backdrop-blur border border-[#2A2A2A] rounded-xl"
                      >
                        {realtimeAssistance.recommendations.map((rec, idx) => (
                          <button
                            key={idx}
                            onClick={() => applyRecommendation(rec)}
                            className="px-3 py-1.5 bg-[#0B0B0B] border border-[#2A2A2A] rounded-lg text-[11px] font-medium text-[#9CA3AF] hover:bg-white hover:text-black transition-all"
                          >
                            + {rec}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="p-6 bg-[#1A1A1A]/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="tech-label">Context_Modifiers</span>
                </div>
                <textarea
                  value={additionalIdea}
                  onChange={(e) => setAdditionalIdea(e.target.value)}
                  placeholder="Add technical modifiers, lighting, or specific styles..."
                  className="w-full p-4 bg-[#141414] border border-[#2A2A2A] rounded-2xl text-[13px] font-mono focus:border-[#404040] outline-none transition-all h-24 resize-none text-white placeholder:text-[#404040]"
                />
              </div>

              <div className="p-6 bg-[#141414] border-t border-[#2A2A2A] flex justify-end">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (mode === 'vision' ? !selectedImage : !input.trim())}
                  className="btn-tech w-full sm:w-auto min-w-[180px]"
                >
                  {isAnalyzing ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Wand2 size={16} />
                      Execute Analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-6">
              <div className="tech-card p-4">
                <span className="tech-label block mb-2">Length</span>
                <span className="text-lg font-mono font-bold text-white">{input.length}</span>
              </div>
              <div className="tech-card p-4">
                <span className="tech-label block mb-2">Words</span>
                <span className="text-lg font-mono font-bold text-white">{input.trim() ? input.trim().split(/\s+/).length : 0}</span>
              </div>
              <div className="tech-card p-4">
                <span className="tech-label block mb-2">Status</span>
                <span className="text-[11px] font-bold text-[#FACC15] uppercase tracking-widest">Active</span>
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            <div className="tech-card min-h-[420px] flex flex-col">
              <div className="tech-header">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#FACC15] rounded-lg flex items-center justify-center">
                    <Wand2 size={14} className="text-black" />
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-white block leading-none">Optimized_Result.sd</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-wider">V2.0</span>
                      <span className="w-1 h-1 bg-[#2A2A2A] rounded-full" />
                      <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-wider">STABLE_DIFFUSION</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('optimized')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                      activeTab === 'optimized' 
                        ? "bg-white text-black border-white" 
                        : "text-[#9CA3AF] border-[#2A2A2A] hover:border-[#404040]"
                    )}
                  >
                    OPTIMIZED
                  </button>
                  <button
                    onClick={() => setActiveTab('translated')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                      activeTab === 'translated' 
                        ? "bg-white text-black border-white" 
                        : "text-[#9CA3AF] border-[#2A2A2A] hover:border-[#404040]"
                    )}
                  >
                    RAW
                  </button>
                </div>
              </div>

              <div className="flex-1 p-8 font-mono text-[14px] text-[#9CA3AF] leading-relaxed break-words bg-[#0B0B0B]/20 relative group border-b border-[#2A2A2A]">
                {analysis ? (
                  <div className="space-y-8">
                    <div className="p-6 bg-[#141414] border border-[#2A2A2A] rounded-2xl">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={14} className="text-[#FACC15]" />
                        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">AI Summary</span>
                      </div>
                      <p className="whitespace-pre-wrap text-white">
                        {activeTab === 'optimized' ? analysis.optimizedPrompt : analysis.translatedPrompt}
                      </p>
                    </div>
                    
                    {analysis.suggestions.length > 0 && (
                      <div className="space-y-4">
                        <span className="tech-label block">Recommended_Tokens</span>
                        <div className="flex flex-wrap gap-2">
                          {analysis.suggestions.map((s, idx) => (
                            <button 
                              key={idx} 
                              onClick={() => copyToClipboard(s.tokens)}
                              className="px-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[11px] font-medium text-[#9CA3AF] hover:border-white hover:text-white transition-all"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#404040] py-24">
                    <div className="w-20 h-20 border border-[#2A2A2A] rounded-2xl flex items-center justify-center mb-6 relative group">
                      <div className="absolute inset-0 bg-[#FACC15]/5 rounded-2xl animate-pulse" />
                      <Terminal size={32} className="text-[#2A2A2A] group-hover:text-[#FACC15] transition-colors" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-mono font-bold tracking-[0.3em] text-[#2A2A2A] uppercase">System_Idle</span>
                      <span className="text-[10px] font-mono text-[#404040] uppercase tracking-widest">Awaiting_Input_Buffer...</span>
                    </div>
                  </div>
                )}

                {analysis && (
                  <button
                    onClick={() => copyToClipboard(activeTab === 'optimized' ? analysis.optimizedPrompt : analysis.translatedPrompt)}
                    className="absolute top-6 right-6 p-2.5 bg-[#1A1A1A]/90 backdrop-blur border border-[#2A2A2A] rounded-xl text-[#9CA3AF] hover:text-white transition-all"
                  >
                    {copied ? <Check size={18} className="text-[#FACC15]" /> : <Copy size={18} />}
                  </button>
                )}
              </div>

              {strength && (
                <div className="p-6 bg-[#1A1A1A]/50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="tech-label">Prompt_Integrity_Index</span>
                    <span className="text-xs font-mono font-bold text-white">{strength.score}%</span>
                  </div>
                  <div className="w-full bg-[#0B0B0B] h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${strength.score}%` }}
                      className={cn("h-full transition-all duration-1000", strength.color.replace('text-', 'bg-'))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Technical Feedback Card */}
            <AnimatePresence>
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="tech-card p-6 space-y-6 bg-[#141414] border-[#2A2A2A]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FACC15]" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-white">Analysis_Report</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#404040]">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {analysis.typos.length > 0 && (
                      <div className="text-[12px] font-mono p-4 bg-[#0B0B0B] rounded-2xl border border-[#2A2A2A]">
                        <span className="text-[#FACC15] font-bold block mb-3">ERR_TYPO_DETECTED:</span>
                        <div className="space-y-2">
                          {analysis.typos.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="text-[#404040] line-through">{t.original}</span>
                              <ArrowRight size={12} className="text-[#2A2A2A]" />
                              <span className="text-white font-bold">{t.correction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.redundancies && analysis.redundancies.length > 0 && (
                      <div className="text-[12px] font-mono p-4 bg-[#0B0B0B] rounded-2xl border border-[#2A2A2A]">
                        <span className="text-rose-500 font-bold block mb-3">ERR_REDUNDANCY:</span>
                        <div className="flex flex-wrap gap-2">
                          {analysis.redundancies.map((r, idx) => (
                            <span key={idx} className="bg-[#1A1A1A] px-2 py-1 rounded-lg border border-rose-900/30 text-rose-400">[{r}]</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.troubleshooting && (
                      <div className="text-[12px] font-mono p-4 bg-[#0B0B0B] rounded-2xl border border-[#2A2A2A]">
                        <span className="text-emerald-500 font-bold block mb-3">AI_OPTIMIZATION_LOG:</span>
                        <p className="text-[#9CA3AF] leading-relaxed italic">
                          "{analysis.troubleshooting}"
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="pt-16 pb-8 text-center">
          <p className="text-[11px] font-bold text-[#404040] uppercase tracking-[0.4em]">
            PromptCraft SD • Technical Dashboard • v2.1.0
          </p>
        </footer>
      </div>
    </div>
  );
}
