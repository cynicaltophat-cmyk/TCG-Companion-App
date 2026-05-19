import React from 'react';
import { motion } from 'motion/react';
import { Swords, ChevronRight, Zap, Layout, Info, Package } from 'lucide-react';

interface QuickStartScreenProps {
  onStartPlayMode: () => void;
  onViewProducts: () => void;
}

export const QuickStartScreen: React.FC<QuickStartScreenProps> = ({ 
  onStartPlayMode, 
  onViewProducts
}) => {
  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] min-h-screen">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#141414]/10 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black text-[#141414] tracking-tight uppercase">Home</h1>
          <Zap size={20} className="text-amber-500" />
        </div>
      </header>

      <div className="max-w-md mx-auto w-full p-6 space-y-6 pb-32">
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-100 flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500">
            <Swords size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#141414] tracking-tight uppercase">Quick Set Up</h2>
            <p className="text-stone-500 text-sm leading-relaxed">
              Start the game setup process to shuffle, draw cards, and set your starting resource.
            </p>
          </div>
          
          <button 
            onClick={onStartPlayMode}
            className="w-full py-4 bg-[#141414] text-white rounded-2xl flex items-center justify-between px-6 hover:bg-stone-800 transition-all active:scale-95 group shadow-lg shadow-black/10"
          >
            <span className="font-black uppercase tracking-widest text-xs">Launch Quick Set Up</span>
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={onViewProducts}
            className="bg-white rounded-2xl p-4 border border-stone-200 flex items-center gap-4 hover:border-amber-400 transition-all active:scale-95 group"
          >
            <div className="w-12 h-12 bg-[#C86891]/10 rounded-xl flex items-center justify-center text-[#C86891] group-hover:scale-110 transition-transform shrink-0">
              <Package size={24} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-[#141414] uppercase tracking-tighter">Product List</p>
              <p className="text-[10px] text-stone-400 font-medium leading-tight">Browse official sets & prices</p>
            </div>
            <ChevronRight size={16} className="text-stone-300 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-center gap-3">
          <Zap size={16} className="text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 font-medium">More tools and set up guides coming soon!</p>
        </div>
      </div>
    </div>
  );
};
