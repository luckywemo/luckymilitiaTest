import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import { decode, encode, decodeAudioData } from '../utils/audio-utils';

const FRAME_RATE = 2; // Low frame rate for optimization
const JPEG_QUALITY = 0.5;

const supplyDropFunctionDeclaration: FunctionDeclaration = {
  name: 'request_supply_drop',
  parameters: {
    type: Type.OBJECT,
    description: 'Requests a tactical supply drop (Luck Box) at the player position.',
    properties: {
      type: {
        type: Type.STRING,
        description: 'The type of support requested (e.g., ammo, health, weapon)',
        enum: ['ammo', 'health', 'weapon', 'shield']
      }
    },
    required: ['type'],
  },
};

const VibeAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string, sources?: any[] }[]>([
    { role: 'bot', text: 'HQ to Lucky Militia. Comms Band Secured. Standing by for tactical intel.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputAudioCtx = useRef<AudioContext | null>(null);
  const outputAudioCtx = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const liveSession = useRef<any>(null);
  const frameIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const sendQuery = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userMsg,
        config: {
          systemInstruction: "You are the Lucky Militia Command AI. Use tactical military jargon. Be professional, direct, and concise. Your goal is to provide intel on battlefield conditions, operators, or equipment.",
          tools: [{ googleSearch: {} }]
        }
      });

      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      setMessages(prev => [...prev, { role: 'bot', text: response.text || "COMM_SILENCE: SIGNAL LOSS", sources: grounding }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'bot', text: "SECURE_FAIL: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleLive = async () => {
    if (isLive) {
      if (liveSession.current) {
        liveSession.current.close();
        liveSession.current = null;
      }
      if (frameIntervalRef.current) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsLive(false);
      return;
    }

    setIsLive(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    if (!inputAudioCtx.current) inputAudioCtx.current = new AudioContext({ sampleRate: 16000 });
    if (!outputAudioCtx.current) outputAudioCtx.current = new AudioContext({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log('Tactical Link established.');
          startCapture(sessionPromise);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle Tool Calls (AI Support)
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              if (fc.name === 'request_supply_drop') {
                window.dispatchEvent(new CustomEvent('ai_event', { detail: { type: 'supply_drop', ammoType: fc.args.type } }));
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "Supply drop initiated at your location." } }
                }));
              }
            }
          }

          // Handle Audio output
          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64EncodedAudioString && outputAudioCtx.current) {
            nextStartTime.current = Math.max(nextStartTime.current, outputAudioCtx.current.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioCtx.current, 24000, 1);
            const source = outputAudioCtx.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioCtx.current.destination);
            source.addEventListener('ended', () => { sources.current.delete(source); });
            source.start(nextStartTime.current);
            nextStartTime.current += audioBuffer.duration;
            sources.current.add(source);
          }
          if (message.serverContent?.interrupted) {
            for (const s of sources.current.values()) s.stop();
            sources.current.clear();
            nextStartTime.current = 0;
          }
        },
        onerror: (e) => console.error('Comms Error:', e),
        onclose: () => {
          setIsLive(false);
          if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        tools: [{ functionDeclarations: [supplyDropFunctionDeclaration] }],
        systemInstruction: "You are HQ Command. You are seeing the player's pilot feed. Call request_supply_drop if the player seems in danger or low on resources."
      }
    });

    sessionPromise.then(s => { liveSession.current = s; });
  };

  const startCapture = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 320, height: 240 } });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Audio Capture
      const sourceNode = inputAudioCtx.current!.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioCtx.current!.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
        const base64Pcm = encode(new Uint8Array(int16.buffer));
        sessionPromise.then(session => session.sendRealtimeInput({ media: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } }));
      };
      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioCtx.current!.destination);

      // Video Frame Capture - FIX for drawImage null context error
      frameIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !isLive) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
              };
            }
          }, 'image/jpeg', JPEG_QUALITY);
        }
      }, 1000 / FRAME_RATE);

    } catch (err) {
      console.error('Media Access Denied:', err);
      setIsLive(false);
    }
  };

  return (
    <div className="fixed bottom-16 right-3 z-[1000] flex flex-col items-end font-mono pointer-events-auto">
      {isOpen && (
        <div className="mb-4 w-[calc(100vw-1.5rem)] max-w-[400px] h-[60vh] max-h-[600px] tactical-panel flex flex-col bg-stone-900 border border-stone-800 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-3 sm:p-6 bg-stone-950 flex justify-between items-center border-b border-stone-800">
             <div className="flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-600 animate-pulse' : 'bg-stone-700'}`}></div>
               <h3 className="font-black text-orange-500 text-[10px] tracking-widest uppercase">HQ_DIRECT_COMM_LINK</h3>
             </div>
            <button onClick={toggleLive} className={`p-2 rounded-lg transition-all ${isLive ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-stone-800 text-stone-500'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          </div>
          
          <div className="relative bg-black flex-1 flex flex-col overflow-hidden">
             {isLive && (
               <div className="w-full aspect-video bg-black relative border-b border-stone-800 overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover opacity-60 grayscale blur-[1px]" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_2px,rgba(0,0,0,0.5)_4px)] pointer-events-none"></div>
                  <div className="absolute top-4 left-4 text-[8px] font-black text-white/40 tracking-widest flex items-center gap-2">
                     <span className="animate-pulse">●</span> LIVE_FEED_01 // Pilot_Cam
                  </div>
               </div>
             )}
             
             <div ref={scrollRef} className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4 bg-black/40 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 text-[10px] font-bold tracking-tight leading-relaxed ${m.role === 'user' ? 'bg-white text-black stencil-cutout' : 'bg-stone-800 text-stone-300 border-l-4 border-orange-500'}`}>
                    {m.text}
                    {m.sources?.map((s: any, si: number) => (
                      <a key={si} href={s.web?.uri || s.maps?.uri} target="_blank" className="block mt-2 text-[8px] text-orange-400 hover:underline border-t border-stone-700 pt-2">&gt; SOURCE: {s.web?.title || 'Tactical_Archive'}</a>
                    ))}
                  </div>
                </div>
              ))}
              {loading && <div className="text-orange-500/50 text-[10px] animate-pulse">&gt; Decrypting_Packet...</div>}
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-stone-950 border-t border-stone-800 flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value.toUpperCase())} 
              onKeyDown={e => e.key === 'Enter' && sendQuery()} 
              className="flex-1 bg-black border border-stone-800 p-3 text-[10px] text-white outline-none focus:border-orange-500 font-mono" 
              placeholder="ENTER_COMMAND..." 
            />
            <button onClick={sendQuery} className="bg-orange-600 px-4 text-white font-black text-[10px] uppercase shadow-lg hover:bg-orange-500 active:scale-95 transition-all">Transmit</button>
          </div>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all duration-500 border-2 ${isOpen ? 'bg-white border-stone-950 rotate-90' : 'bg-stone-900 border-stone-800 hover:border-orange-500'}`}
      >
        <span className="text-xl sm:text-2xl">{isOpen ? '✖' : '📡'}</span>
        {isLive && !isOpen && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-2 border-black animate-ping"></div>}
      </button>
    </div>
  );
};

export default VibeAssistant;
