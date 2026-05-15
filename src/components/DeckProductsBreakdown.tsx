import React from 'react';
import { motion } from 'motion/react';
import { Package, ExternalLink, AlertCircle, HelpCircle, ArrowUpRight } from 'lucide-react';
import { DeckItem } from '../types';
import { cn, getYYTLink } from '../lib/utils';

// Mapping of Set IDs to Names
const SET_NAMES: Record<string, string> = {
  'GD04': 'Battle for the Throne',
  'GD03': 'Prophecy of Justice',
  'GD02': 'Shadow of the Moon',
  'GD01-Newtype rising': 'Newtype rising',
  'ST09': 'Starter Deck 09',
  'ST08': 'Starter Deck 08',
  'ST07': 'Starter Deck 07',
  'ST06': 'Starter Deck 06',
  'ST05': 'Starter Deck 05',
  'ST04': 'Starter Deck 04',
  'ST03': 'Starter Deck 03',
  'ST02': 'Starter Deck 02',
  'ST01': 'Starter Deck 01',
};

interface DeckProductsBreakdownProps {
  items: DeckItem[];
  prices: Record<string, { price: string, url: string }>;
}

export const DeckProductsBreakdown: React.FC<DeckProductsBreakdownProps> = ({ items, prices }) => {
  const groupedBySet = React.useMemo(() => {
    const groups: Record<string, { 
      items: DeckItem[], 
      totalCost: number, 
      cardCount: number,
      setName: string
    }> = {};

    items.forEach((item) => {
      let setId = item.card.set || 'Unknown';
      if (setId === 'GD01' || setId === 'GD01-Newtype rising') {
        setId = 'GD01-Newtype rising';
      }

      const priceStr = prices[item.card.cardNumber.toUpperCase() + "_" + item.card.rarity.toUpperCase()]?.price || 
                       prices[item.card.cardNumber.toUpperCase()]?.price || "0";
      const price = parseInt(priceStr);
      
      if (!groups[setId]) {
        groups[setId] = {
          items: [],
          totalCost: 0,
          cardCount: 0,
          setName: SET_NAMES[setId] || setId
        };
      }
      
      groups[setId].items.push(item);
      groups[setId].totalCost += price * item.count;
      groups[setId].cardCount += item.count;
    });

    return Object.entries(groups).sort((a, b) => b[1].totalCost - a[1].totalCost);
  }, [items, prices]);

  const totalDeckCost = groupedBySet.reduce((acc, [_, group]) => acc + group.totalCost, 0);

  const hasMissingPrices = React.useMemo(() => {
    return items.some(item => {
      const cardKey = item.card.cardNumber.toUpperCase() + "_" + item.card.rarity.toUpperCase();
      return !prices[cardKey] && !prices[item.card.cardNumber.toUpperCase()];
    });
  }, [items, prices]);

  return (
    <div className="flex flex-col gap-6 p-4 bg-[#F5F5F0] min-h-full">
      {/* Total Cost Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-stone-900">Total cost:</span>
            <span className="text-base font-black text-stone-900">$SGD {totalDeckCost.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="bg-stone-200/80 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-black/5">
              <span className="text-[10px] font-black text-stone-600 tracking-tight">SGD/YYT 120</span>
            </div>
            <HelpCircle size={14} className="text-stone-300" />
          </div>
        </div>

        {hasMissingPrices && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-amber-900">Unable to fetch YYT price</span>
              <button 
                onClick={() => window.open('https://yuyu-tei.jp/game/gundam', '_blank')}
                className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1 hover:underline text-left"
              >
                Go to Yu-Yu-Tei site <ExternalLink size={10} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Set List */}
      <div className="flex flex-col gap-10">
        {groupedBySet.map(([setId, group]) => {
          const cardKey = group.items[0]?.card.cardNumber.toUpperCase();
          const firstItemUrl = prices[cardKey]?.url || (group.items[0] ? getYYTLink(group.items[0].card.cardNumber) : null);
          
          return (
            <div key={setId} className="flex flex-col gap-3">
              {/* Set Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[13px] text-[#141414] uppercase tracking-tight">
                    {setId} - {group.setName}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-stone-300">$SGD {group.totalCost}</span>
                    <span className="text-[11px] font-bold text-stone-300">{group.cardCount} cards</span>
                    {(setId === 'ST04' || setId === 'ST02') && (
                      <AlertCircle size={16} className="text-amber-500 fill-amber-500/10" strokeWidth={3} />
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => firstItemUrl && window.open(firstItemUrl, '_blank')}
                  className="flex items-center gap-1.5 text-stone-900 hover:text-amber-600 transition-colors"
                >
                  <span className="text-[10px] font-bold tracking-tight">See product</span>
                  <div className="w-5 h-5 bg-black rounded flex items-center justify-center text-white">
                    <ArrowUpRight size={12} strokeWidth={3} />
                  </div>
                </button>
              </div>

              {/* Card Carousel/Grid */}
              <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-4 px-4 scroll-smooth">
                {group.items.map((item) => {
                  const cardKey = item.card.cardNumber.toUpperCase() + "_" + item.card.rarity.toUpperCase();
                  const priceInfo = prices[cardKey] || prices[item.card.cardNumber.toUpperCase()];
                  const price = parseInt(priceInfo?.price || "0");
                  const hasPrice = !!priceInfo;
                  
                  return (
                    <div key={`${item.card.id}-${item.artType}`} className="shrink-0 flex flex-col gap-2">
                      <div className="relative w-28 aspect-[5/7] bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200">
                        <img 
                          src={item.card.imageUrl} 
                          alt={item.card.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur shadow-sm rounded px-1.5 py-0.5 border border-black/5">
                          <span className="text-[10px] font-black italic">X{item.count}</span>
                        </div>
                        {!hasPrice && (
                          <button 
                            onClick={() => window.open(priceInfo?.url || getYYTLink(item.card.cardNumber), '_blank')}
                            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex flex-col items-center justify-center border-none p-2 text-center group/card"
                          >
                             <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-1 group-hover/card:scale-110 transition-transform">
                               <ExternalLink size={14} className="text-white" />
                             </div>
                             <span className="text-[7px] font-black text-white uppercase tracking-tighter leading-tight drop-shadow-sm">Price Missing<br/>Check YYT</span>
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest pl-1">
                        {hasPrice ? `$SGD ${price}` : 'Unavailable'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with YYT Hyperlink */}
      <div className="mt-4 pt-8 pb-12 border-t border-stone-200 flex flex-col items-center gap-3">
         <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Market data provided by</span>
         <button 
           onClick={() => window.open('https://yuyu-tei.jp/game/gundam', '_blank')}
           className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all group group-active:scale-95"
         >
           <span className="text-[11px] font-black text-[#141414] uppercase tracking-tight">Visit Yu-Yu-Tei Official Site</span>
           <ExternalLink size={12} className="text-stone-300 group-hover:text-amber-500 transition-colors" />
         </button>
         <div className="flex items-center gap-1.5 text-stone-400">
           <HelpCircle size={10} />
           <span className="text-[9px] font-medium italic">Prices are estimated based on latest market availability.</span>
         </div>
      </div>
    </div>
  );
};
