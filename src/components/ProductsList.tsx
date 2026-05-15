import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink, 
  Info, 
  Zap, 
  ShoppingCart, 
  Calendar,
  DollarSign,
  Tag,
  HelpCircle,
  Bookmark
} from 'lucide-react';
import { Product, GundamCard } from '../types';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface ProductsListProps {
  prices?: Record<string, { price: string, url: string }>;
  onSelectSet?: (setName: string) => void;
  onClose?: () => void;
}

export const ProductsList: React.FC<ProductsListProps> = ({ prices, onSelectSet, onClose }) => {
  const [cards, setCards] = useState<GundamCard[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'cards'), orderBy('cardNumber'));
    return onSnapshot(q, (snapshot) => {
      setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GundamCard)));
    });
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('releaseDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // Deduplicate by name and normalize names for specific sets
      const seen = new Set();
      const consolidated = productData.filter(p => {
        const normalizedName = (p.name === 'GD01' || p.name === 'GD01-Newtype rising') 
          ? 'GD01-Newtype rising' 
          : p.name;
        if (seen.has(normalizedName)) return false;
        seen.add(normalizedName);
        return true;
      }).map(p => {
        if (p.name === 'GD01') return { ...p, name: 'GD01-Newtype rising' };
        return p;
      });

      setProducts(consolidated);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "ALL") return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const categories = ["ALL", "Starter Deck", "Booster box"];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-400">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading Products...</p>
      </div>
    );
  }

  if (selectedProduct) {
    return (
      <div className="flex-1 flex flex-col bg-white min-h-screen pb-32 animate-in fade-in slide-in-from-right-4 duration-300">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => setSelectedProduct(null)} 
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-[#141414] tracking-tight">{selectedProduct.name}</h1>
          <button className="p-2 text-stone-300">
            <Bookmark size={24} />
          </button>
        </header>

        <div className="px-6 py-4 space-y-8">
          <div className="aspect-[4/5] bg-stone-50 rounded-[40px] overflow-hidden border border-stone-100 shadow-xl shadow-stone-200/50 flex items-center justify-center p-8">
            <img 
              src={selectedProduct.imageUrl} 
              alt={selectedProduct.name} 
              className="w-full h-full object-contain drop-shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-[#141414] leading-tight">{selectedProduct.name}</h2>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400">Release date</span>
                <span className="text-xs font-bold text-stone-600">{selectedProduct.releaseDate}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">MSRP</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-[#141414]">{selectedProduct.msrp}</span>
                  <HelpCircle size={14} className="text-stone-300" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Where to buy</span>
                <HelpCircle size={14} className="text-stone-300" />
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.whereToBuy.map((store, i) => (
                  <div 
                    key={i}
                    className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-full text-[10px] font-black text-stone-600 uppercase tracking-wider"
                  >
                    {store}
                  </div>
                ))}
              </div>
            </div>

            {selectedProduct.featuredCards.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Featured cards</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {selectedProduct.featuredCards.map((fc, i) => {
                    const card = cards.find(c => c.id === fc.cardId);
                    return (
                      <div key={i} className="flex gap-4 group">
                        <div className="w-20 aspect-[2/3] bg-stone-100 rounded-xl overflow-hidden shadow-sm shrink-0">
                          <img src={card?.imageUrl} alt={card?.name} className="w-full h-full object-fill" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 py-1 flex flex-col justify-center">
                          <p className="text-sm font-black text-[#141414]">{card?.name}</p>
                          <p className="text-[10px] text-stone-400 font-mono mt-0.5">{card?.cardNumber}</p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-black rounded-lg">
                              X{fc.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-stone-100">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Contents</h3>
              <ul className="space-y-1">
                {selectedProduct.contents.map((item, i) => (
                  <li key={i} className="text-xs font-medium text-stone-500 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] min-h-screen pb-32 animate-in fade-in duration-300">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-4 flex items-center justify-between">
        <button 
          onClick={onClose} 
          className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black text-[#141414] uppercase tracking-tighter">Product list</h1>
        <div className="w-10 h-10 flex items-center justify-center text-stone-400">
          <Package size={20} />
        </div>
      </header>

      <div className="px-4 py-6 space-y-8">
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Filter by category</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border",
                  selectedCategory === cat 
                    ? "bg-[#141414] text-white border-[#141414] shadow-lg shadow-black/10" 
                    : "bg-white text-stone-400 border-stone-200 hover:border-stone-400"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div 
              key={product.id} 
              onClick={() => setSelectedProduct(product)}
              className="flex flex-col gap-3 group cursor-pointer"
            >
              <div className="aspect-[4/5] bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all p-4 flex items-center justify-center">
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-contain drop-shadow-md" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="px-2 space-y-1">
                <h3 className="text-sm font-black text-[#141414] leading-tight line-clamp-2">{product.name}</h3>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                  MSRP: {product.msrp}
                </p>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 bg-white/50 rounded-3xl border border-dashed border-stone-300">
              <Package size={48} className="mx-auto text-stone-200" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-sm">No products found in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
