
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

interface Props {
  onBack: () => void;
  setAvatar: (url: string) => void;
}

const CreativeSuite: React.FC<Props> = ({ onBack, setAvatar }) => {
  const [tab, setTab] = useState<'generate' | 'edit' | 'video'>('generate');
  const [prompt, setPrompt] = useState('');
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9');
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [thoughts, setThoughts] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setSourceImg(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addThought = (msg: string) => {
    setThoughts(prev => [...prev.slice(-4), msg]);
  };

  const processAI = async () => {
    if (!(window as any).aistudio?.hasSelectedApiKey()) {
      await (window as any).aistudio?.openSelectKey();
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setThoughts([]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (tab === 'generate') {
        setStatus('Synthesizing Bio-Metrics...');
        addThought("Initializing Pro-Image Engine...");
        addThought("Calibrating semantic vectors...");
        
        const res = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: { 
            imageConfig: { imageSize: imgSize, aspectRatio: "1:1" }
          }
        });
        
        const candidate = res.candidates?.[0];
        const parts = candidate?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData);

        if (imagePart) {
          setResult(`data:image/png;base64,${imagePart.inlineData.data}`);
          addThought("Pixel synthesis complete.");
        } else {
          throw new Error("Target data not found in candidate output.");
        }
      } 
      else if (tab === 'edit') {
        if (!sourceImg) throw new Error("Hardware Asset Required.");
        setStatus('Applying Augmentations...');
        addThought("Loading reference raster...");
        const base64 = sourceImg.split(',')[1];
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64, mimeType: sourceImg.split(';')[0].split(':')[1] } },
              { text: prompt }
            ]
          }
        });
        const candidate = res.candidates?.[0];
        const parts = candidate?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData);

        if (imagePart) {
          setResult(`data:image/png;base64,${imagePart.inlineData.data}`);
        } else {
          throw new Error("No edited data returned.");
        }
      }
      else if (tab === 'video') {
        if (!sourceImg) throw new Error("Keyframe Asset Required.");
        setStatus('Simulating Kinematics...');
        addThought("Spinning up Veo Engine...");
        
        const base64 = sourceImg.split(',')[1];
        const mimeType = sourceImg.split(';')[0].split(':')[1];

        let op = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: prompt,
          image: { imageBytes: base64, mimeType: mimeType },
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspect }
        });

        while (!op.done) {
          addThought(`Computing temporal frame ${Math.floor(Math.random() * 60)}...`);
          await new Promise(r => setTimeout(r, 6000));
          op = await ai.operations.getVideosOperation({ operation: op });
        }

        const link = op.response?.generatedVideos?.[0]?.video?.uri;
        if (link) {
          const vRes = await fetch(`${link}&key=${process.env.API_KEY}`);
          const blob = await vRes.blob();
          setResult(URL.createObjectURL(blob));
        } else {
          throw new Error("Temporal simulation failed.");
        }
      }
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found")) {
        setError("AUTH_FAILURE: Select Project Key.");
        await (window as any).aistudio?.openSelectKey();
      } else {
        setError("SYS_EXCEPTION: " + e.message);
      }
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-10 animate-in fade-in duration-500 font-mono overflow-y-auto overflow-x-hidden bg-black">
      <style>{`
        @keyframes csTypeIn { 0% { opacity: 0; transform: translateX(-10px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes csScaleBurst { 0% { opacity: 0; transform: scale(0.8); } 60% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes csGlowBurst { 0% { box-shadow: 0 0 0px rgba(249,115,22,0); } 50% { box-shadow: 0 0 30px rgba(249,115,22,0.4); } 100% { box-shadow: 0 0 0px rgba(249,115,22,0); } }
        @keyframes csFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
      `}</style>
      <div className="w-full max-w-[1300px] grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-8">
        
        {/* LEFT CONTROL PANEL */}
        <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-6">
          <div className="tactical-panel p-3 lg:p-8 bg-stone-900/90 border border-stone-800 rounded-xl relative overflow-hidden group">
             <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-white transition-all text-[8px] lg:text-[11px] font-black tracking-widest uppercase mb-2 lg:mb-4 group/btn">
                <span>←</span> <span className="hidden sm:inline">BACK_TO_COMMAND</span><span className="sm:hidden">BACK</span>
             </button>
             <h1 className="font-stencil text-xl lg:text-5xl font-black text-white leading-none uppercase mb-1 drop-shadow-[0_2px_15px_rgba(249,115,22,0.3)]">
               BIO<span className="text-orange-500">FORGE</span>
             </h1>
             <div className="text-[7px] lg:text-[10px] font-black text-stone-600 tracking-[0.2em] lg:tracking-[0.5em] uppercase">Synthesis_Terminal</div>
          </div>

          <div className="tactical-panel flex-1 p-3 lg:p-8 bg-stone-900/60 rounded-xl lg:rounded-3xl border border-stone-800 flex flex-col gap-3 lg:gap-6 shadow-2xl relative">
             <div className="flex gap-1 bg-black/60 p-1 rounded-lg border border-stone-800 shadow-inner">
               {(['generate', 'edit', 'video'] as const).map(t => (
                 <button 
                   key={t}
                   onClick={() => { setTab(t); setResult(null); }}
                   className={`flex-1 py-2 lg:py-4 text-[7px] lg:text-[10px] font-black uppercase tracking-widest transition-all rounded ${tab === t ? 'bg-orange-600 text-white shadow-lg' : 'text-stone-600 hover:text-stone-300'}`}
                 >
                   {t}
                 </button>
               ))}
             </div>

             <div className="flex flex-col gap-3 lg:gap-8 py-1">
                {(tab === 'edit' || tab === 'video') && (
                  <div className="space-y-1">
                    <label className="text-[7px] lg:text-[10px] font-black text-stone-500 uppercase tracking-widest px-1 block">Hardware_Asset</label>
                    {!sourceImg ? (
                      <div className="relative aspect-video bg-black/40 border border-dashed border-stone-800 rounded flex flex-col items-center justify-center hover:border-orange-500 transition-all cursor-pointer group shadow-inner overflow-hidden">
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <span className="text-xl lg:text-4xl mb-1 opacity-30 group-hover:opacity-100 transition-all">📸</span>
                        <span className="text-[6px] lg:text-[9px] text-stone-700 font-black uppercase tracking-widest">Mount_Vector</span>
                      </div>
                    ) : (
                      <div className="relative group rounded-xl overflow-hidden border border-stone-800 shadow-2xl">
                        <img src={sourceImg} className="w-full aspect-video object-cover brightness-90 group-hover:brightness-110 transition-all" alt="Asset" />
                        <button onClick={() => setSourceImg(null)} className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 p-1 rounded transition-all z-20">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[7px] lg:text-[10px] font-black text-stone-500 uppercase tracking-widest px-1 block">Neural_Command</label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-black/60 border border-stone-800 p-2 lg:p-4 text-[9px] lg:text-[12px] text-stone-100 h-20 lg:h-40 focus:border-orange-500 outline-none transition-all resize-none font-bold placeholder:text-stone-800 uppercase tracking-widest shadow-inner rounded"
                    placeholder="DESCRIBE PARAMETERS..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {tab === 'generate' && (
                    <div className="flex gap-1 bg-stone-950 p-1 rounded border border-stone-800">
                      {(['1K', '2K', '4K'] as const).map(s => (
                        <button key={s} onClick={() => setImgSize(s)} className={`flex-1 py-1.5 text-[7px] lg:text-[10px] font-black transition-all rounded border ${imgSize === s ? 'bg-white border-white text-stone-950 shadow-lg' : 'bg-transparent border-transparent text-stone-600 hover:text-stone-400'}`}>{s}</button>
                      ))}
                    </div>
                  )}

                  {tab === 'video' && (
                    <div className="flex gap-1 bg-stone-950 p-1 rounded border border-stone-800">
                      {(['16:9', '9:16'] as const).map(a => (
                        <button key={a} onClick={() => setAspect(a)} className={`flex-1 py-1.5 text-[7px] lg:text-[10px] font-black transition-all rounded border ${aspect === a ? 'bg-white border-white text-stone-950 shadow-lg' : 'bg-transparent border-transparent text-stone-600 hover:text-stone-400'}`}>{a}</button>
                      ))}
                    </div>
                  )}
                </div>
             </div>

             <button 
                onClick={processAI}
                disabled={loading}
                className={`w-full py-3 lg:py-8 font-black uppercase tracking-widest transition-all text-[9px] lg:text-[12px] rounded-xl lg:rounded-3xl shadow-2xl active:translate-y-1 ${loading ? 'bg-stone-900 text-stone-700 cursor-not-allowed border-stone-800' : 'bg-orange-600 hover:bg-orange-500 text-white border-b-4 lg:border-b-[8px] border-orange-800'}`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 border border-stone-500 border-t-white rounded-full animate-spin"></div>
                    <span className="text-[6px] lg:text-[9px] animate-pulse">{status}</span>
                  </div>
                ) : `INITIATE_SYNTHESIS`}
              </button>
          </div>
        </div>

        {/* RIGHT VIEWPORT PANEL */}
        <div className="lg:col-span-8 flex flex-col gap-3 lg:gap-6">
           <div className="tactical-panel flex-1 bg-stone-950/90 border border-stone-800 rounded-2xl lg:rounded-[3rem] p-2 lg:p-4 flex flex-col shadow-2xl relative overflow-hidden min-h-[300px] lg:min-h-[720px]">
              {result ? (
                <div className="h-full flex flex-col" style={{ animation: 'csScaleBurst 0.6s ease-out' }}>
                   <div className="flex-1 bg-black rounded-xl lg:rounded-[2.5rem] overflow-hidden shadow-inner border border-white/5 relative group" style={{ animation: 'csGlowBurst 1s ease-out' }}>
                      <div className="absolute top-3 left-3 lg:top-10 lg:left-10 text-[6px] lg:text-[10px] font-black text-white/30 tracking-widest uppercase">VIEWPORT_OUTPUT</div>
                      {tab === 'video' ? (
                        <video src={result} controls autoPlay loop className="w-full h-full object-contain" />
                      ) : (
                        <img src={result} className="w-full h-full object-contain brightness-110 contrast-110" alt="Output" />
                      )}
                   </div>
                   
                   <div className="p-3 lg:p-8 flex gap-2 lg:gap-6 mt-2">
                      {tab !== 'video' && (
                        <button 
                          onClick={() => { setAvatar(result); onBack(); }}
                          className="flex-1 bg-white hover:bg-orange-600 text-stone-950 hover:text-white font-black py-3 lg:py-8 rounded-lg lg:rounded-[2rem] text-[9px] lg:text-[14px] uppercase tracking-widest transition-all shadow-2xl"
                        >
                          DEPLOY_OPERATOR
                        </button>
                      )}
                      <button 
                        onClick={() => setResult(null)}
                        className="px-4 lg:px-12 bg-stone-900 text-stone-500 hover:text-white rounded-lg lg:rounded-[2rem] font-black text-[8px] lg:text-[11px] uppercase tracking-widest transition-all border border-stone-800"
                      >
                        RESET
                      </button>
                   </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 lg:space-y-10 group">
                   <div className="relative">
                      <div className="w-16 h-16 lg:w-48 lg:h-48 border-2 lg:border-4 border-stone-900 rounded-full flex items-center justify-center opacity-40 group-hover:rotate-[360deg] transition-all duration-1000">
                         <div className="text-2xl lg:text-8xl grayscale opacity-50 group-hover:opacity-100 transition-all">⚙️</div>
                      </div>
                      <div className="absolute inset-0 border-t-2 border-orange-500/20 rounded-full animate-spin"></div>
                   </div>
                   <p className="font-black uppercase tracking-[0.4em] lg:tracking-[1em] text-[8px] lg:text-[14px] text-stone-700">AWAITING_LINK</p>
                   
                   {loading && thoughts.length > 0 && (
                     <div className="max-w-xs lg:max-w-md w-full p-3 lg:p-8 bg-black/60 rounded-xl lg:rounded-3xl border border-stone-900 animate-in slide-in-from-bottom-6 duration-700 shadow-2xl">
                        <div className="text-[6px] lg:text-[10px] font-black text-orange-500/50 uppercase tracking-widest mb-2 lg:mb-6 pb-2 border-b border-stone-900 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                           ANALYTICS_FEED
                        </div>
                        <div className="space-y-1.5 lg:space-y-3">
                           {thoughts.map((t, i) => (
                             <div key={i} className="text-[6px] lg:text-[10px] text-stone-600 uppercase font-black tracking-widest" style={{ animation: 'csTypeIn 0.3s ease-out', animationDelay: `${i * 0.1}s`, opacity: 0, animationFillMode: 'forwards' }}>
                                <span className="text-orange-500 mr-2 lg:mr-3 opacity-30">▶</span> {t}
                                <span className="inline-block w-2 h-3 bg-orange-500/50 ml-1 animate-pulse" />
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
                   {error && (
                     <div className="p-3 bg-red-600/10 border border-red-600/30 rounded text-red-500 text-[8px] lg:text-xs font-black uppercase tracking-widest animate-bounce">
                        {error}
                     </div>
                   )}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreativeSuite;
