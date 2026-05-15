import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  X, 
  Trash2, 
  Edit2, 
  Upload, 
  Save, 
  ChevronRight, 
  Search,
  Zap,
  Tag,
  Calendar,
  DollarSign,
  ShoppingCart,
  Layout,
  ExternalLink,
  Loader2,
  PlusCircle,
  List,
  Minus
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { Product, ProductFeaturedCard, GundamCard } from '../types';
import { cn } from '../lib/utils';

interface AdminProductManagerProps {
  cards: GundamCard[];
}

export const AdminProductManager: React.FC<AdminProductManagerProps> = ({ cards }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredCardSearch, setFeaturedCardSearch] = useState("");
  const [showCardSuggestions, setShowCardSuggestions] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('releaseDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveProduct = async () => {
    if (!editingProduct?.name || !editingProduct?.id) {
      alert("Name and ID are required");
      return;
    }

    try {
      const productRef = doc(db, 'products', editingProduct.id);
      await setDoc(productRef, {
        ...editingProduct,
        whereToBuy: editingProduct.whereToBuy || [],
        featuredCards: editingProduct.featuredCards || [],
        contents: editingProduct.contents || [],
        category: editingProduct.category || "Starter Deck"
      });
      setShowForm(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const addFeaturedCard = (card: GundamCard) => {
    const current = editingProduct?.featuredCards || [];
    if (current.some(c => c.cardId === card.id)) return;
    
    setEditingProduct({
      ...editingProduct,
      featuredCards: [...current, { cardId: card.id, count: 1 }]
    });
    setFeaturedCardSearch("");
    setShowCardSuggestions(false);
  };

  const updateFeaturedCardCount = (cardId: string, count: number) => {
    const current = editingProduct?.featuredCards || [];
    setEditingProduct({
      ...editingProduct,
      featuredCards: current.map(c => c.cardId === cardId ? { ...c, count: Math.max(1, count) } : c)
    });
  };

  const removeFeaturedCard = (cardId: string) => {
    const current = editingProduct?.featuredCards || [];
    setEditingProduct({
      ...editingProduct,
      featuredCards: current.filter(c => c.cardId !== cardId)
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        <Loader2 className="animate-spin mr-2" />
        Loading Products...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-100 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingProduct({
              id: `prod-${Date.now()}`,
              name: "",
              releaseDate: new Date().toISOString().split('T')[0],
              msrp: "",
              whereToBuy: [],
              featuredCards: [],
              contents: [],
              imageUrl: "",
              category: "Starter Deck"
            });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-[#141414] text-white rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-stone-800 transition-all"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white border border-stone-200 rounded-3xl p-4 flex gap-4 group">
            <div className="w-24 h-32 bg-stone-50 rounded-2xl overflow-hidden flex-shrink-0 border border-stone-100">
              <img src={product.imageUrl} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h3 className="font-black text-[#141414] leading-tight line-clamp-2">{product.name}</h3>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">{product.category}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">{product.releaseDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setEditingProduct(product);
                    setShowForm(true);
                  }}
                  className="p-2 text-stone-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteProduct(product.id)}
                  className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
            className="absolute inset-0 bg-[#141414]/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-[#F5F5F0] w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 bg-white border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                  <Package size={20} />
                </div>
                <h2 className="text-xl font-black text-[#141414]">
                  {editingProduct?.id ? "Edit Product" : "New Product"}
                </h2>
              </div>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <Tag size={12} /> ID & Name
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={editingProduct?.id || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, id: e.target.value })}
                        placeholder="ID (e.g. st01)"
                        className="w-1/3 bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                      <input 
                        value={editingProduct?.name || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        placeholder="Product Name"
                        className="flex-1 bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                        <Calendar size={12} /> Release Date
                      </label>
                      <input 
                        type="date"
                        value={editingProduct?.releaseDate || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, releaseDate: e.target.value })}
                        className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                        <DollarSign size={12} /> MSRP
                      </label>
                      <input 
                        value={editingProduct?.msrp || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, msrp: e.target.value })}
                        placeholder="$15.99 USD"
                        className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <Layout size={12} /> Category
                    </label>
                    <div className="flex gap-2">
                      {["Starter Deck", "Booster box", "Other"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setEditingProduct({ ...editingProduct, category: cat as any })}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border",
                            editingProduct?.category === cat 
                              ? "bg-[#141414] text-white border-[#141414]" 
                              : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <Upload size={12} /> Image URL
                    </label>
                    <input 
                      value={editingProduct?.imageUrl || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <ShoppingCart size={12} /> Where to Buy (one per line)
                    </label>
                    <textarea 
                      value={(editingProduct?.whereToBuy || []).join('\n')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, whereToBuy: e.target.value.split('\n').filter(l => l.trim() !== '') })}
                      placeholder="Local game stores&#10;Carousell&#10;Whatsapp marketplace"
                      className="w-full h-32 bg-white border border-stone-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Content & Featured Cards */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <List size={12} /> Contents (one per line)
                    </label>
                    <textarea 
                      value={(editingProduct?.contents || []).join('\n')}
                      onChange={(e) => setEditingProduct({ ...editingProduct, contents: e.target.value.split('\n').filter(l => l.trim() !== '') })}
                      placeholder="x1 Ready-to-play 50-card deck&#10;x10 Resource Cards"
                      className="w-full h-32 bg-white border border-stone-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <Zap size={12} /> Featured Cards
                    </label>
                    
                    <div className="relative">
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
                          <input 
                            value={featuredCardSearch}
                            onChange={(e) => {
                              setFeaturedCardSearch(e.target.value);
                              setShowCardSuggestions(e.target.value.length >= 2);
                            }}
                            placeholder="Find card to feature..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 transition-all"
                          />
                        </div>
                      </div>

                      {showCardSuggestions && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                          {cards
                            .filter(c => 
                              c.name.toLowerCase().includes(featuredCardSearch.toLowerCase()) || 
                              c.cardNumber.toLowerCase().includes(featuredCardSearch.toLowerCase())
                            )
                            .slice(0, 10)
                            .map(card => (
                              <button
                                key={card.id}
                                onClick={() => addFeaturedCard(card)}
                                className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 border-b border-stone-100 last:border-none transition-colors"
                              >
                                <img src={card.imageUrl} className="w-6 h-9 object-fill rounded shadow-sm" alt="" />
                                <div>
                                  <p className="text-xs font-bold text-[#141414] leading-tight">{card.name}</p>
                                  <p className="text-[9px] text-stone-400 font-mono mt-0.5">{card.cardNumber}</p>
                                </div>
                                <PlusCircle size={14} className="ml-auto text-stone-300" />
                              </button>
                            ))
                          }
                          {cards.filter(c => c.name.toLowerCase().includes(featuredCardSearch.toLowerCase())).length === 0 && (
                            <div className="px-4 py-6 text-center text-stone-400 text-xs italic">No cards found</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       {editingProduct?.featuredCards?.map(fc => {
                         const card = cards.find(c => c.id === fc.cardId);
                         return (
                           <div key={fc.cardId} className="flex items-center gap-3 bg-white border border-stone-200 p-2 rounded-2xl group/fc transition-all hover:border-stone-300">
                             <div className="w-8 h-11 bg-stone-50 rounded-lg overflow-hidden shrink-0 border border-stone-100">
                               <img src={card?.imageUrl} className="w-full h-full object-fill" alt="" />
                             </div>
                             <div className="flex-1 min-w-0 pr-2">
                               <p className="text-[10px] font-bold text-[#141414] truncate">{card?.name || "Unknown Card"}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <button 
                                   onClick={() => updateFeaturedCardCount(fc.cardId, fc.count - 1)}
                                   className="w-5 h-5 bg-stone-100 rounded flex items-center justify-center text-stone-500 hover:bg-stone-200"
                                 >
                                   <Minus size={10} />
                                 </button>
                                 <span className="text-[10px] font-black w-4 text-center">X{fc.count}</span>
                                 <button 
                                   onClick={() => updateFeaturedCardCount(fc.cardId, fc.count + 1)}
                                   className="w-5 h-5 bg-stone-100 rounded flex items-center justify-center text-stone-500 hover:bg-stone-200"
                                 >
                                   <Plus size={10} />
                                 </button>
                               </div>
                             </div>
                             <button 
                               onClick={() => removeFeaturedCard(fc.cardId)}
                               className="opacity-0 group-hover/fc:opacity-100 p-1.5 text-stone-300 hover:text-red-500 transition-all"
                             >
                               <Trash2 size={12} />
                             </button>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-stone-200 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowForm(false)}
                className="px-6 py-3 text-stone-500 font-bold hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProduct}
                className="px-8 py-3 bg-[#141414] text-white rounded-2xl font-black flex items-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 active:scale-95"
              >
                <Save size={18} />
                Save Product
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
