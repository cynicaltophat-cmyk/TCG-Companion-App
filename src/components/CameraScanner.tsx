import React, { useRef, useEffect } from 'react';
import { X, Camera, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { GundamCard } from '../types';
import { IdentifiedCard } from '../services/geminiService';
import { ProgressiveImage } from './ProgressiveImage';

interface CameraScannerProps {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  onSelectCard: (result: IdentifiedCard) => void;
  onRetry: () => void;
  isAnalyzing: boolean;
  status: string;
  results: IdentifiedCard[];
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ 
  onCapture, 
  onCancel, 
  onSelectCard,
  onRetry,
  isAnalyzing, 
  status,
  results
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Live camera stream is disabled. Photo upload handles image scanning.
  }, []);

  const [flash, setFlash] = React.useState(false);

  const handleCapture = React.useCallback(() => {
    if (!videoRef.current || isAnalyzing) return;
    
    // Visual flash
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) onCapture(blob);
      }, 'image/jpeg', 0.85);
    }
  }, [isAnalyzing, onCapture]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col font-sans overflow-hidden">
      {/* Video Feed */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="w-full h-full object-cover"
        />

        {/* Flash Effect */}
        <AnimatePresence>
          {flash && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white z-[60] pointer-events-none"
            />
          )}
        </AnimatePresence>
        
        {/* Scanning Overlay UI */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          {/* Viewfinder Frame */}
          <div className="relative w-[85%] aspect-[2/3] max-w-[320px]">
            {/* Corners */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-2xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-2xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-2xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-2xl" />
            
            {/* Animated Scan Line or Analysis Pulse */}
            {isAnalyzing ? (
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  borderColor: ['rgba(245,158,11,0.5)', 'rgba(245,158,11,1)', 'rgba(245,158,11,0.5)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 border-2 border-amber-500 rounded-2xl z-10"
              />
            ) : (
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 bg-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10"
              />
            )}
          </div>
          
          <div className="mt-8 px-6 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
            <Sparkles size={12} className={isAnalyzing ? "text-amber-500" : "text-amber-500 animate-pulse"} />
            <p className="text-white text-[10px] font-black uppercase tracking-[0.2em]">
              {isAnalyzing ? status : "Align card & tap button to scan"}
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar / Results Toast */}
      <div className="relative h-40 bg-[#141414] border-t border-white/5">
        <AnimatePresence mode="wait">
          {results.length > 0 ? (
            <motion.div 
              key="results"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-x-0 bottom-0 bg-white rounded-t-[2.5rem] p-6 pb-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[70] flex flex-col gap-6"
            >
              <div className="flex items-center justify-between px-2">
                <div className="space-y-1">
                  <h3 className="text-[#141414] font-black uppercase tracking-widest text-sm">Scan Results</h3>
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Select the correct card</p>
                </div>
                <button 
                  onClick={onRetry}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#141414] rounded-full text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Sparkles size={12} />
                  Try again
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x">
                {results.map((result, idx) => (
                  <motion.button
                    key={result.card.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => onSelectCard(result)}
                    className="flex-shrink-0 w-32 snap-start group"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border-2 border-transparent group-hover:border-amber-500 transition-colors shadow-lg">
                      <ProgressiveImage src={result.card.imageUrl} imageClassName="w-full h-full object-cover" />
                      {result.isAlt && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-black text-[7px] font-black uppercase tracking-widest rounded-md shadow-lg">
                          Alt Art
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                    <p className="mt-2 text-[9px] font-black text-[#141414] uppercase truncate tracking-tight">{result.card.name}</p>
                    <p className="text-[8px] font-bold text-stone-400">{result.card.cardNumber}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full px-8 flex items-center justify-between"
            >
              <button 
                onClick={onCancel}
                className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
              >
                <X size={24} />
              </button>

              <div className="relative">
                <button 
                  onClick={handleCapture}
                  disabled={isAnalyzing}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl transition-all active:scale-90 disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-stone-100 flex items-center justify-center">
                    <Camera size={32} className="text-[#141414]" />
                  </div>
                </button>
                {isAnalyzing && (
                  <div className="absolute -inset-2 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                )}
              </div>

              <div className="w-14" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
