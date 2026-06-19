import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TournamentEvent, DeckSubmission, ALL_SETS, GundamCard } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Calendar, 
  Trophy, 
  User, 
  Layout, 
  ArrowRight,
  Layers,
  MapPin,
  Clock,
  X,
  Filter,
  MoreHorizontal,
  Copy,
  Download,
  Check,
  Globe,
  PieChart,
  List,
  Hash,
  Search,
  CheckCircle2,
  Link as LinkIcon
} from 'lucide-react';
import { cn, parseDecklistText } from '../lib/utils';
import { ProgressiveImage } from './ProgressiveImage';
import CryptoJS from 'crypto-js';

const getGravatarUrl = (email?: string) => {
  if (!email) return null;
  const hash = CryptoJS.MD5(email.trim().toLowerCase()).toString();
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=150`;
};

interface EventCoverageProps {
  allCards?: GundamCard[];
  onSelectSubmission?: (submission: DeckSubmission) => void;
  onBack?: () => void;
}

const SEASONS = [
  { id: "GD04", name: "GD04 Phantom Aria" }
];

const cleanPlacement = (placement: string) => {
  if (!placement) return "";
  let p = placement.trim();
  p = p.replace(/^Top\s+/i, '');
  
  // If it's a number, add ordinal suffix
  const num = parseInt(p);
  if (!isNaN(num)) {
    const s = ["th", "st", "nd", "rd"];
    const v = num % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${num}${suffix}`;
  }
  
  return p;
};

const getPlacementRank = (placement: string): number => {
  const p = placement.toLowerCase().trim();
  
  // Handle direct numbers (e.g. "1", "2", "3", "4")
  if (p === '1') return 1;
  if (p === '2') return 2;
  if (p === '3') return 3;
  if (p === '4') return 4;
  if (p === '8') return 8;
  if (p === '16') return 16;
  if (p === '32') return 32;

  // Specific Winner rankings
  if (p.includes('winner') || p.includes('1st') || p.includes('champion') || p.includes('champ')) return 1;
  if (p.includes('finalist') || p.includes('runner up') || p.includes('2nd')) return 2;
  
  // 3rd place
  if (p.includes('3rd')) return 3;
  
  // 4th place or Top 4
  if (p.includes('4th') || p.includes('top 4')) return 4;
  
  // Top 8
  if (p.includes('top 8') || p.includes('8th') || p.includes('quarter')) return 8;
  
  // Top 16
  if (p.includes('top 16') || p.includes('16th')) return 16;
  
  // Top 32
  if (p.includes('top 32') || p.includes('32nd')) return 32;
  
  // Try to parse any number in the string
  const allNumbers = p.match(/\d+/g);
  if (allNumbers && allNumbers.length > 0) {
    return parseInt(allNumbers[0]);
  }
  
  return 100; // Fallback
};

const getColorBg = (color: string) => {
  switch (color) {
    case 'Red': return 'bg-red-500';
    case 'Blue': return 'bg-blue-500';
    case 'Green': return 'bg-emerald-500';
    case 'White': return 'bg-white border-stone-200';
    case 'Purple': return 'bg-purple-500';
    case 'Yellow': return 'bg-amber-400';
    default: return 'bg-stone-500';
  }
};

const getSubmissionColors = (sub: DeckSubmission, allCards: GundamCard[]) => {
  let items = sub.deckItems || [];
  if (items.length === 0 && sub.decklistText && allCards.length > 0) {
    items = parseDecklistText(sub.decklistText, allCards);
  }
  const colors = Array.from(new Set(items.map(i => i.card.color))) as string[];
  
  // Manual override for Felix C's deck which should be green and white
  if (sub.playerName && (sub.playerName.startsWith('Felix C') || sub.playerName.toLowerCase().includes('felix c'))) {
    return ['Green', 'White'];
  }
  
  // Manual override for Okie Parker's Destiny Blocker deck which should be purple and white
  if (sub.playerName === 'Okie Parker' && (sub.deckName?.toLowerCase().includes('destiny blocker') || sub.archetype?.toLowerCase().includes('destiny blocker'))) {
    return ['Purple', 'White'];
  }
  
  // Manual override for Brian S.'s Felix C. wing zero deck which should be white and green only
  if (sub.playerName === 'Brian S.' && sub.deckName?.toLowerCase().includes('wing zero')) {
    return colors.filter(c => c !== 'Blue');
  }
  
  return colors;
};

const getDeckColors = (items: DeckSubmission['deckItems']) => {
  return Array.from(new Set((items || []).map(i => i.card.color)));
};

const getRankStyle = (rank: number) => {
  if (rank === 1) return "from-[#F5A623] to-[#F8D800] text-white";
  if (rank === 2) return "from-[#A4B9D2] to-[#BDCEDB] text-white";
  if (rank === 3) return "from-[#D98B4B] to-[#E6A97A] text-white";
  return "from-[#C4C4C4] to-[#D8D8D8] text-white";
};

export const EventCoverage: React.FC<EventCoverageProps> = ({ allCards = [], onSelectSubmission, onBack }) => {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [submissions, setSubmissions] = useState<DeckSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(SEASONS[0].id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [countryFilter, setCountryFilter] = useState<'Global' | 'Singapore'>('Global');
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [showSeasonMenu, setShowSeasonMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [exactColorMatch, setExactColorMatch] = useState(false);
  const [metaView, setMetaView] = useState<'chart' | 'text'>('chart');
  const [metaCategory, setMetaCategory] = useState<'archetypes' | 'colors'>('archetypes');
  const [showMetaMenu, setShowMetaMenu] = useState(false);
  const [maxPlacement, setMaxPlacement] = useState<number>(32);
  const [tempMaxPlacement, setTempMaxPlacement] = useState<number>(32);
  const [showPlacementMenu, setShowPlacementMenu] = useState(false);
  const [selectedMainCardId, setSelectedMainCardId] = useState<string | null>(null);
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [archetypeSearch, setArchetypeSearch] = useState("");
  
  const dragX = useMotionValue(0);
  const isDragging = useRef(false);
  
  const [focusedEvent, setFocusedEvent] = useState<TournamentEvent | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string>('all');
  const [subView, setSubView] = useState<'home' | 'event' | 'all'>('home');

  const selectedCard = useMemo(() => {
    if (!selectedMainCardId || !allCards) return null;
    return allCards.find(c => c.cardNumber === selectedMainCardId);
  }, [selectedMainCardId, allCards]);

  const hasActiveFilters = !!(searchQuery || selectedColors.length > 0 || maxPlacement < 32 || selectedMainCardId || selectedArchetypes.length > 0);

  const filteredByControls = useMemo(() => {
    return submissions.filter(sub => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        sub.deckName.toLowerCase().includes(searchLower) ||
        (sub.archetype && sub.archetype.toLowerCase().includes(searchLower)) ||
        sub.deckItems?.some(item => item.card.name.toLowerCase().includes(searchLower));
      
      if (!matchesSearch) return false;

      // Color filter
      const deckColors = getSubmissionColors(sub, allCards);
      const matchesColors = selectedColors.length === 0 || (
        exactColorMatch 
          ? selectedColors.length === deckColors.length && selectedColors.every(color => deckColors.includes(color))
          : selectedColors.some(color => deckColors.includes(color))
      );
      
      if (!matchesColors) return false;
      
      // Placement filter
      const rank = getPlacementRank(sub.placement);
      if (rank > maxPlacement) return false;
      
      // Main Card filter
      if (selectedMainCardId && !sub.deckItems?.some(item => item.card.cardNumber === selectedMainCardId)) {
        return false;
      }

      // Archetype filter
      if (selectedArchetypes.length > 0) {
        const archetype = sub.archetype || "Unknown Archetype";
        if (!selectedArchetypes.includes(archetype)) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, searchQuery, selectedColors, exactColorMatch, maxPlacement, selectedMainCardId, selectedArchetypes, allCards]);

  // Decoupled submissions for Meta Analysis (ignores Search/Archetype filters, but respects selected main card filter as requested)
  const metaSubmissions = useMemo(() => {
    const activeEvent = events.find(e => e.id === activeFilterId);
    const activeEventName = activeEvent?.name?.toLowerCase().trim();
    
    return submissions.filter(sub => {
      // Event Selection
      const subEventName = sub.tournamentName?.toLowerCase().trim();
      const matchesEvent = activeFilterId === 'all' || 
        sub.tournamentId === activeFilterId || 
        (activeEventName && subEventName === activeEventName);
      
      if (!matchesEvent) return false;

      // Color filter (categorical drill-down)
      const deckColors = getSubmissionColors(sub, allCards);
      const matchesColors = selectedColors.length === 0 || (
        exactColorMatch 
          ? selectedColors.length === deckColors.length && selectedColors.every(color => deckColors.includes(color))
          : selectedColors.some(color => deckColors.includes(color))
      );
      
      if (!matchesColors) return false;

      // Main Card filter
      if (selectedMainCardId && !sub.deckItems?.some(item => item.card.cardNumber === selectedMainCardId)) {
        return false;
      }
      
      return true;
    });
  }, [submissions, activeFilterId, events, selectedColors, exactColorMatch, allCards, selectedMainCardId]);

  // submissions that ignore selected colors for Top Colors pie chart
  const metaSubmissionsWithoutColors = useMemo(() => {
    const activeEvent = events.find(e => e.id === activeFilterId);
    const activeEventName = activeEvent?.name?.toLowerCase().trim();
    
    return submissions.filter(sub => {
      // Event Selection
      const subEventName = sub.tournamentName?.toLowerCase().trim();
      const matchesEvent = activeFilterId === 'all' || 
        sub.tournamentId === activeFilterId || 
        (activeEventName && subEventName === activeEventName);
      
      if (!matchesEvent) return false;

      // Main Card filter
      if (selectedMainCardId && !sub.deckItems?.some(item => item.card.cardNumber === selectedMainCardId)) {
        return false;
      }
      
      return true;
    });
  }, [submissions, activeFilterId, events, selectedMainCardId]);

  const activeEventSubmissions = useMemo(() => {
    const currentFilterEvent = events.find(e => e.id === activeFilterId);
    return activeFilterId === 'all' 
      ? filteredByControls 
      : filteredByControls.filter(s => s.tournamentId === activeFilterId || (s.tournamentName && s.tournamentName === currentFilterEvent?.name));
  }, [filteredByControls, activeFilterId, events]);

  const metaTopRange = useMemo(() => {
    if (activeFilterId === 'all') return 16;
    const activeEvent = events.find(e => e.id === activeFilterId);
    if (!activeEvent) return 16;
    
    const playerCount = Number(activeEvent.totalPlayers) || 0;
    if (playerCount >= 65) return 16;
    if (playerCount >= 25) return 8;
    if (playerCount >= 2) return 4;
    return 16; // Default
  }, [activeFilterId, events]);

  const recentTopDecks = useMemo(() => {
    // Filter for Top 4 performers from the already filtered list
    const topPerformers = filteredByControls.filter(s => {
      const rank = getPlacementRank(s.placement);
      return rank <= 4;
    });
    
    if (topPerformers.length === 0) return [];
    
    let result = [...topPerformers];
    // Duplicate for smooth infinite scroll if needed
    if (result.length < 10) {
      const base = [...result];
      while (result.length < 10) {
        const currentSet = base.map((item) => ({
          ...item,
          id: `${item.id}-v${Math.floor(result.length / base.length)}`
        }));
        result = [...result, ...currentSet];
      }
    }
    return result;
  }, [filteredByControls]);

  useEffect(() => {
    setSubView('home');
    setActiveFilterId('all');
  }, [selectedSeason]);

  useEffect(() => {
    if (recentTopDecks.length > 0 && activeIndex >= recentTopDecks.length) {
      setActiveIndex(0);
    }
  }, [recentTopDecks.length, activeIndex]);

  const handleResetFilters = () => {
    setTempMaxPlacement(32);
    setMaxPlacement(32);
    setSelectedArchetypes([]);
    setArchetypeSearch("");
    setShowPlacementMenu(false);
  };

  const handleMetaClick = (item: any) => {
    if (metaCategory === 'archetypes') {
      setSelectedArchetypes([item.name]);
      // Scroll to the decklist section
      const decklistHeader = document.querySelector('section.mt-8');
      if (decklistHeader) {
        decklistHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      setSelectedColors(item.colors);
      setExactColorMatch(true);
      setMetaCategory('archetypes');
    }
  };

  const archetypeOptions = useMemo(() => {
    const archetypes = new Set<string>();
    submissions.forEach(sub => {
      archetypes.add(sub.archetype || "Unknown Archetype");
    });
    return Array.from(archetypes).sort();
  }, [submissions]);

  const filteredArchetypeOptions = useMemo(() => {
    return archetypeOptions.filter(opt => 
      opt.toLowerCase().includes(archetypeSearch.toLowerCase())
    );
  }, [archetypeOptions, archetypeSearch]);

  const handleApplyFilters = () => {
    setMaxPlacement(tempMaxPlacement);
    setShowPlacementMenu(false);
  };

  useEffect(() => {
    setLoading(true);
    // Fetch all events for the selected season
    const qEvents = query(collection(db, 'tournament_events'), where('season', '==', selectedSeason), orderBy('date', 'desc'));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const eventsData: TournamentEvent[] = [];
      snapshot.forEach((doc) => {
        eventsData.push(doc.data() as TournamentEvent);
      });
      setEvents(eventsData);
    }, (err) => console.error(err));

    // Fetch approved submissions for the selected season
    const qSubmissions = query(
      collection(db, 'deck_submissions'), 
      where('status', '==', 'approved'),
      where('season', '==', selectedSeason),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeSubmissions = onSnapshot(qSubmissions, (snapshot) => {
      const subsData: DeckSubmission[] = [];
      snapshot.forEach((doc) => {
        subsData.push(doc.data() as DeckSubmission);
      });
      setSubmissions(subsData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeSubmissions();
    };
  }, [selectedSeason, countryFilter]);

  const popularMainCards = useMemo(() => {
    const counts: Record<string, { card: GundamCard; count: number }> = {};
    submissions.forEach(sub => {
      sub.deckItems?.forEach(item => {
        // Look for Unit LRs or Rs that might be "main" cards
        if (item.card.type.includes('Unit') && (item.card.rarity === 'LR' || item.card.rarity === 'R')) {
          const id = item.card.cardNumber;
          if (!counts[id]) {
            counts[id] = { card: item.card, count: 0 };
          }
          counts[id].count += item.count;
        }
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [submissions]);

  const topArchetypes = useMemo(() => {
    const counts: Record<string, { name: string; count: number; coverImageUrl: string; colors: string[]; bestRank: number }> = {};
    
    // Use submissions specifically for meta analysis
    metaSubmissions.forEach(sub => {
      const rank = getPlacementRank(sub.placement);
      if (rank <= metaTopRange) {
        // Strictly use the archetype field from the submission
        const name = sub.archetype || "Unknown Archetype";
        if (!counts[name]) {
          counts[name] = { 
            name, 
            count: 0, 
            coverImageUrl: sub.coverImageUrl || "", 
            colors: getSubmissionColors(sub, allCards),
            bestRank: rank
          };
        }
        counts[name].count += 1;
        if (rank < counts[name].bestRank) {
          counts[name].bestRank = rank;
        }
        // Update cover image if current one is missing
        if (!counts[name].coverImageUrl && sub.coverImageUrl) {
          counts[name].coverImageUrl = sub.coverImageUrl;
        }
      }
    });

    return Object.values(counts)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.bestRank - b.bestRank; // Tie-break with best rank (lower is better)
      })
      .slice(0, 12); // Increased slice to 12 archetypes for more coverage
  }, [metaSubmissions, allCards, metaTopRange]);

  const topColors = useMemo(() => {
    const counts: Record<string, { name: string; count: number; colors: string[]; coverImageUrl: string; bestRank: number }> = {};
    
    metaSubmissionsWithoutColors.forEach(sub => {
      const rank = getPlacementRank(sub.placement);
      if (rank <= metaTopRange) {
        const colors = getSubmissionColors(sub, allCards).sort();
        const name = colors.join(' / ');
        if (!counts[name]) {
          counts[name] = { 
            name, 
            count: 0, 
            colors,
            coverImageUrl: sub.coverImageUrl || "",
            bestRank: rank
          };
        }
        counts[name].count += 1;
        if (rank < counts[name].bestRank) {
          counts[name].bestRank = rank;
        }
        if (!counts[name].coverImageUrl && sub.coverImageUrl) {
          counts[name].coverImageUrl = sub.coverImageUrl;
        }
      }
    });

    return Object.values(counts)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.bestRank - b.bestRank; // Tie-break with best rank
      })
      .slice(0, 12);
  }, [metaSubmissionsWithoutColors, allCards, metaTopRange]);

  const metaData = useMemo(() => {
    return metaCategory === 'archetypes' ? topArchetypes : topColors;
  }, [metaCategory, topArchetypes, topColors]);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % recentTopDecks.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + recentTopDecks.length) % recentTopDecks.length);
  };

  const filteredDecks = (subView === 'all' || subView === 'home')
    ? filteredByControls 
    : subView === 'event' && focusedEvent 
      ? filteredByControls.filter(s => s.tournamentName === focusedEvent.name)
      : [];

  const sortedDecks = [...filteredDecks].sort((a, b) => {
    const rankA = getPlacementRank(a.placement);
    const rankB = getPlacementRank(b.placement);
    return rankA - rankB;
  });

  if (subView !== 'home') {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F9F9F7] animate-in slide-in-from-right duration-300 pb-24">
        <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSubView('home')}
              className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight text-stone-900 uppercase leading-none mb-1">
                {subView === 'all' ? 'All Decklists' : focusedEvent?.name}
              </h1>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">
                {selectedSeason} • {filteredDecks.length} Decks
              </p>
            </div>
          </div>
        </header>

        <div className="px-3 py-6 max-w-2xl mx-auto space-y-3">
          {sortedDecks.length > 0 ? (
            <div className="flex flex-col gap-2 sm:gap-3">
              {sortedDecks.map((deck, index) => {
                const deckColors = getSubmissionColors(deck, allCards);
                const rank = getPlacementRank(deck.placement);
                return (
                  <motion.div 
                    key={deck.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => onSelectSubmission?.(deck)}
                    className="relative flex items-center bg-white rounded-xl sm:rounded-[1.25rem] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-stone-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group h-16 sm:h-20"
                  >
                    {/* Rank Section with Slanted Edge */}
                    <div className={cn(
                      "w-12 sm:w-20 h-full flex items-center justify-center bg-gradient-to-br relative z-10 shrink-0",
                      getRankStyle(rank)
                    )}>
                      <span className="text-xl sm:text-4xl font-black italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                        {rank}
                      </span>
                      {/* The Slanted Edge */}
                      <div className="absolute top-0 -right-2 sm:-right-3 bottom-0 w-4 sm:w-6 bg-inherit z-[-1]" style={{ clipPath: 'polygon(0 0, 40% 0, 100% 100%, 0 100%)' }} />
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 flex items-center gap-2 sm:gap-5 px-1.5 sm:px-6 overflow-hidden">
                      {/* Deck Image */}
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-stone-50 ml-0.5">
                        {deck.coverImageUrl ? (
                          <ProgressiveImage 
                            src={deck.coverImageUrl} 
                            referrerPolicy="no-referrer"
                            imageClassName="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          />
                        ) : (
                          <div className="w-full h-full bg-stone-50 flex items-center justify-center text-stone-200">
                            <Layout size={16} />
                          </div>
                        )}
                      </div>

                      {/* Text Info */}
                      <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                        <h3 className="text-[11px] sm:text-base font-black text-stone-900 leading-tight uppercase tracking-tight truncate">
                          {deck.deckName}
                        </h3>
                        <div className="flex items-center gap-x-1.5 sm:gap-x-3 mt-0.5 overflow-hidden">
                          <div className="flex items-center gap-1 min-w-0">
                            {deck.email && (
                              <img 
                                src={getGravatarUrl(deck.email) || ""} 
                                alt="" 
                                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-stone-100 shrink-0" 
                              />
                            )}
                            <p className="text-[10px] sm:text-xs font-bold text-stone-400 capitalize truncate max-w-[70px] sm:max-w-[150px]">
                              {deck.playerName} {deck.country && <span className="text-[9px] opacity-70 ml-1">({deck.country})</span>}
                            </p>
                          </div>
                          <p className="text-[10px] sm:text-xs font-bold text-stone-300 shrink-0">
                            {new Date(deck.date).toLocaleDateString(undefined, { year: '2-digit', month: '2-digit', day: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Color Squares (Horizontal Layout) */}
                      <div className="flex items-center gap-0.5 sm:gap-1.5 ml-auto shrink-0 pl-1 pr-2 sm:px-4">
                        {deckColors.map(color => (
                          <div 
                            key={color} 
                            className={cn(
                              "w-3 h-3 sm:w-5 sm:h-5 rounded-sm sm:rounded-md shadow-inner border border-white/10 shrink-0",
                              getColorBg(color)
                            )} 
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Layout size={48} className="text-stone-100 mb-4" />
              <h3 className="font-black text-stone-900 mb-1 uppercase tracking-tight">No decklists found</h3>
              <p className="text-sm text-stone-400">There are no approved decklists to display for this selection.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9F9F7] animate-in fade-in duration-500 pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-stone-200 transition-all duration-300">
        <div className="w-full px-4 flex flex-col">
          <div className="flex items-center gap-2 w-full pt-3.5 pb-2">
            <div className="relative flex-1">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search main cards or deck name..."
                className="w-full pl-9 pr-10 py-2 bg-stone-100 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-stone-200 rounded-full text-stone-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => {
                  setTempMaxPlacement(maxPlacement);
                  setShowPlacementMenu(true);
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  maxPlacement < 32 ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                <Filter size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar pt-1 pb-3 px-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Quick filter</span>
              <div className="flex gap-1.5">
                {['Red', 'Blue', 'Green', 'White', 'Purple'].map(color => {
                  const isActive = selectedColors.includes(color);
                  return (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColors(prev => 
                          prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
                        );
                      }}
                      className={cn(
                        "w-5 h-5 rounded-md transition-all active:scale-90 shadow-sm relative overflow-hidden",
                        getColorBg(color),
                        color === 'White' && "border border-stone-300",
                        isActive ? "ring-2 ring-offset-1 ring-amber-500" : "opacity-80 hover:opacity-100"
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setExactColorMatch(!exactColorMatch)}
              className="flex items-center gap-2 group shrink-0"
            >
              <div className={cn(
                "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                exactColorMatch ? "bg-[#141414] border-[#141414]" : "bg-white border-stone-300 group-hover:border-stone-400"
              )}>
                {exactColorMatch && <Check size={10} className="text-white stroke-[3]" />}
              </div>
              <span className={cn(
                "text-[8px] font-bold transition-colors uppercase tracking-tight",
                exactColorMatch ? "text-stone-900" : "text-stone-400 group-hover:text-stone-600"
              )}>
                Exact color match
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showPlacementMenu && (
          <div className="fixed inset-0 z-[100] overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlacementMenu(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-[280px] bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest">Filters</h3>
                <button onClick={() => setShowPlacementMenu(false)} className="p-2 hover:bg-stone-50 rounded-full text-stone-400">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Placement Range</span>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">Top {tempMaxPlacement}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[1, 4, 8, 16, 32].map((p) => (
                      <button
                        key={p}
                        onClick={() => setTempMaxPlacement(p)}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-left text-xs font-bold uppercase tracking-tight transition-all flex items-center justify-between border-2",
                          tempMaxPlacement === p 
                            ? "bg-stone-900 text-white border-stone-900 shadow-md translate-x-1" 
                            : "bg-white text-stone-500 border-stone-100 hover:border-stone-200"
                        )}
                      >
                        Top {p === 1 ? '1 (Winner)' : p}
                        {tempMaxPlacement === p && <Check size={14} className="text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Deck Archetypes</span>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">
                      {selectedArchetypes.length} selected
                    </span>
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search archetypes..."
                      value={archetypeSearch}
                      onChange={(e) => setArchetypeSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xs"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={12} />
                  </div>

                  <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {filteredArchetypeOptions.length > 0 ? (
                      <>
                        <button
                          onClick={() => setSelectedArchetypes(prev => prev.length === archetypeOptions.length ? [] : [...archetypeOptions])}
                          className="text-left py-2 text-[10px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors border-b border-stone-50 mb-1"
                        >
                          {selectedArchetypes.length === archetypeOptions.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {filteredArchetypeOptions.map((archetype) => {
                          const isSelected = selectedArchetypes.includes(archetype);
                          return (
                            <button
                              key={archetype}
                              onClick={() => {
                                setSelectedArchetypes(prev => 
                                  prev.includes(archetype) 
                                    ? prev.filter(a => a !== archetype) 
                                    : [...prev, archetype]
                                );
                              }}
                              className={cn(
                                "w-full px-3 py-2.5 rounded-lg text-left text-[11px] font-bold uppercase tracking-tight transition-all flex items-center justify-between",
                                isSelected 
                                  ? "bg-stone-900 text-white shadow-sm" 
                                  : "bg-white text-stone-500 hover:bg-stone-50"
                              )}
                            >
                              <span className="truncate pr-4">{archetype}</span>
                              {isSelected && <Check size={12} className="text-white shrink-0" strokeWidth={3} />}
                            </button>
                          );
                        })}
                      </>
                    ) : (
                      <div className="py-8 text-center text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                        No archetypes found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 pb-24 border-t border-stone-100 bg-stone-50/50 flex gap-3">
                <button 
                  onClick={handleResetFilters}
                  className="flex-1 py-3 text-xs font-black text-stone-400 hover:text-stone-600 uppercase tracking-widest transition-colors"
                >
                  Reset
                </button>
                <button 
                  onClick={handleApplyFilters}
                  className={cn(
                    "flex-1 py-3 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    tempMaxPlacement !== maxPlacement ? "shadow-xl shadow-stone-200" : "opacity-80"
                  )}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meta Analysis Section */}
      <section className="mt-4 px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Meta analysis</h2>
            <div className="flex-1 h-px bg-stone-100" />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button 
              onClick={() => setMetaView('chart')}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                metaView === 'chart' ? "bg-stone-900 text-white shadow-md shadow-stone-200" : "bg-stone-100 text-stone-400 hover:bg-stone-200"
              )}
            >
              <PieChart size={14} />
            </button>
            <button 
              onClick={() => setMetaView('text')}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                metaView === 'text' ? "bg-stone-900 text-white shadow-md shadow-stone-200" : "bg-stone-100 text-stone-400 hover:bg-stone-200"
              )}
            >
              <List size={14} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowMetaMenu(!showMetaMenu)}
                className="flex items-center gap-2 px-3 py-1 bg-stone-200 text-stone-900 rounded-lg text-[8.5px] font-black uppercase tracking-widest shadow-sm hover:bg-stone-300 transition-colors"
              >
                {metaCategory === 'archetypes' ? `Top ${metaTopRange} archetypes` : `Top ${metaTopRange} colors`}
                <ChevronDown size={14} className={cn("transition-transform", showMetaMenu ? "rotate-180" : "")} />
              </button>

              <AnimatePresence>
                {showMetaMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMetaMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1.5 z-50 overflow-hidden"
                    >
                      <div className="px-3 py-1.5 mb-1 border-b border-stone-50">
                        <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest">Analysis Mode</span>
                      </div>
                      {[
                        { id: 'archetypes', label: `Top ${metaTopRange} archetypes` },
                        { id: 'colors', label: `Top ${metaTopRange} colors` }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setMetaCategory(item.id as any);
                            setShowMetaMenu(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-tight transition-colors flex items-center justify-between",
                            metaCategory === item.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
                          )}
                        >
                          {item.label}
                          {metaCategory === item.id && <Check size={12} />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="relative py-4">
          {metaData.length > 0 ? (
            <div className="flex items-center justify-center min-h-[300px]">
              {metaView === 'chart' ? (
                <div className="relative">
                  {/* Outer stroke decoration */}
                  <div className="absolute inset-0 -m-1 border-[6px] border-stone-900 rounded-full z-10 pointer-events-none" />
                  
                  <svg width="280" height="280" viewBox="0 0 280 280" className="overflow-visible rounded-full">
                    {(() => {
                      const total = metaData.reduce((sum, item) => sum + item.count, 0);
                      const size = 280;
                      const center = size / 2;
                      const radius = size / 2;
                      let currentAngle = 0;

                      return metaData.map((item, i) => {
                        const sliceAngle = Math.min(359.9, (item.count / total) * 360);
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + sliceAngle;
                        currentAngle += sliceAngle;

                        const x1 = center + radius * Math.cos((startAngle - 90) * (Math.PI / 180));
                        const y1 = center + radius * Math.sin((startAngle - 90) * (Math.PI / 180));
                        const x2 = center + radius * Math.cos((endAngle - 90) * (Math.PI / 180));
                        const y2 = center + radius * Math.sin((endAngle - 90) * (Math.PI / 180));

                        const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                        const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                        // Mid-angle for dot placement
                        const midAngle = startAngle + sliceAngle / 2;
                        const sliceFraction = item.count / total;
                        // Reduce the outer offset for large segments to avoid showing awkward blank/white space
                        const imgRadius = radius * Math.max(0, 0.7 * Math.pow(1 - sliceFraction, 1.5));
                        const dx = center + imgRadius * Math.cos((midAngle - 90) * (Math.PI / 180));
                        const dy = center + imgRadius * Math.sin((midAngle - 90) * (Math.PI / 180));

                        const dotsRadius = radius + 18;
                        const dotsX = center + dotsRadius * Math.cos((midAngle - 90) * (Math.PI / 180));
                        const dotsY = center + dotsRadius * Math.sin((midAngle - 90) * (Math.PI / 180));

                        const isColorView = metaCategory === 'colors';
                        const colors = item.colors && item.colors.length > 0 ? item.colors : ['Grey'];
                        
                        const getColorHex = (c: string) => {
                          switch (c) {
                            case 'Red': return '#ef4444';
                            case 'Blue': return '#3b82f6';
                            case 'Green': return '#10b981';
                            case 'White': return '#ffffff';
                            case 'Purple': return '#a855f7';
                            case 'Yellow': return '#fbbf24';
                            default: return '#78716c';
                          }
                        };

                        const gradId = `color-grad-${i}`;

                        return (
                          <g 
                            key={item.name} 
                            className="group cursor-pointer"
                            onClick={() => handleMetaClick(item)}
                          >
                            <defs>
                              {isColorView ? (
                                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                                  {colors.length === 1 ? (
                                    <>
                                      <stop offset="0%" stopColor={getColorHex(colors[0])} />
                                      <stop offset="100%" stopColor={getColorHex(colors[0])} />
                                    </>
                                  ) : colors.length === 2 ? (
                                    <>
                                      <stop offset="0%" stopColor={getColorHex(colors[0])} />
                                      <stop offset="100%" stopColor={getColorHex(colors[1])} />
                                    </>
                                  ) : (
                                    <>
                                      <stop offset="0%" stopColor={getColorHex(colors[0])} />
                                      <stop offset="50%" stopColor={getColorHex(colors[1])} />
                                      <stop offset="100%" stopColor={getColorHex(colors[2])} />
                                    </>
                                  )}
                                </linearGradient>
                              ) : (
                                <clipPath id={`clip-${i}`}>
                                  <path d={pathData} />
                                </clipPath>
                              )}
                            </defs>
                            {isColorView ? (
                              <path 
                                d={pathData}
                                fill={`url(#${gradId})`}
                                className="transition-all duration-300 group-hover:opacity-90 hover:brightness-105"
                              />
                            ) : (
                              <image
                                href={item.coverImageUrl}
                                x={dx - center}
                                y={Math.max(0, dy - center) * 0.8}
                                width={size}
                                height={size}
                                preserveAspectRatio="xMidYMin slice"
                                clipPath={`url(#clip-${i})`}
                                className="transition-all duration-500 group-hover:scale-105 origin-center"
                              />
                            )}
                            <path 
                              d={pathData} 
                              fill="none" 
                              stroke="black" 
                              strokeWidth="2"
                              className="pointer-events-none"
                            />
                            
                            {/* Status dots on slice - rendered outside the ring for both archetypes and colors */}
                            <g transform={`translate(${dotsX}, ${dotsY})`}>
                              {(item.colors || []).slice(0, 3).map((color, ci) => (
                                <circle 
                                  key={ci}
                                  cx={(ci - (Math.min((item.colors || []).length, 3) - 1) / 2) * 12}
                                  cy={0}
                                  r={5}
                                  fill={
                                    color === 'Red' ? '#ef4444' :
                                    color === 'Blue' ? '#3b82f6' :
                                    color === 'Green' ? '#10b981' :
                                    color === 'White' ? '#ffffff' :
                                    color === 'Purple' ? '#a855f7' :
                                    color === 'Yellow' ? '#fbbf24' : '#78716c'
                                  }
                                  stroke="black"
                                  strokeWidth="2"
                                />
                              ))}
                            </g>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  {(() => {
                    const total = metaData.reduce((sum, item) => sum + item.count, 0);
                    return metaData.map((item, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={item.name} 
                        onClick={() => handleMetaClick(item)}
                        className="flex items-center gap-4 bg-stone-50 p-3 rounded-2xl hover:bg-stone-100 transition-colors cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0">
                          <img src={item.coverImageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-[11px] font-black text-stone-900 uppercase tracking-tight truncate">{item.name}</h4>
                            <span className="text-[10px] font-black text-stone-400 whitespace-nowrap">{Math.round(item.count / total * 100)}% — {item.count} {item.count === 1 ? 'Deck' : 'Decks'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.colors.map((color, ci) => (
                              <div 
                                key={ci} 
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full border border-stone-200",
                                  color === 'Red' ? 'bg-red-500' :
                                  color === 'Blue' ? 'bg-blue-500' :
                                  color === 'Green' ? 'bg-green-500' :
                                  color === 'White' ? 'bg-white' :
                                  color === 'Purple' ? 'bg-purple-500' : 'bg-stone-400'
                                )}
                              />
                            ))}
                            <div className="flex-1 h-1.5 bg-stone-200 rounded-full ml-1 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.count / metaData[0].count) * 100}%` }}
                                className="h-full bg-stone-900"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 w-full text-center text-stone-300 font-bold uppercase text-[10px] tracking-widest bg-stone-50 rounded-3xl border border-dashed border-stone-100">
              Generating insights...
            </div>
          )}
        </div>

        {/* Filter Tags */}
        {hasActiveFilters && (
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-2">
            {searchQuery && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-600 uppercase tracking-tight">
                <span>Search: "{searchQuery}"</span>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="hover:text-amber-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {selectedCard && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full text-[10px] font-bold text-amber-700 uppercase tracking-tight border border-amber-200/50">
                <span>Main: {selectedCard.name}</span>
                <button 
                  onClick={() => setSelectedMainCardId(null)}
                  className="hover:text-amber-900 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {selectedColors.map(color => (
              <div 
                key={color}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight text-white",
                  color === 'Red' && 'bg-red-500',
                  color === 'Blue' && 'bg-blue-500',
                  color === 'Green' && 'bg-emerald-500',
                  color === 'White' && 'bg-slate-400',
                  color === 'Yellow' && 'bg-amber-400',
                  color === 'Purple' && 'bg-purple-500'
                )}
              >
                <span>{color}</span>
                <button 
                  onClick={() => setSelectedColors(prev => prev.filter(c => c !== color))}
                  className="hover:scale-110 transition-transform"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {selectedArchetypes.map(archetype => (
              <div 
                key={archetype}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-900 rounded-full text-[10px] font-bold text-white uppercase tracking-tight"
              >
                <span>{archetype}</span>
                <button 
                  onClick={() => setSelectedArchetypes(prev => prev.filter(a => a !== archetype))}
                  className="hover:text-amber-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {maxPlacement < 32 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full text-[10px] font-bold text-amber-900 uppercase tracking-tight border border-amber-200">
                <span>Top {maxPlacement}</span>
                <button 
                  onClick={() => setMaxPlacement(32)}
                  className="hover:text-amber-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {(searchQuery || selectedColors.length > 0 || selectedMainCardId || selectedArchetypes.length > 0 || maxPlacement < 32) && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedColors([]);
                  setExactColorMatch(true);
                  setSelectedMainCardId(null);
                  setSelectedArchetypes([]);
                  setMaxPlacement(32);
                }}
                className="px-3 py-1.5 text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-widest transition-colors flex items-center gap-1"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </section>



      {false && (
      <section className="mt-2 relative">
        <div className="px-6 flex items-center gap-4 mb-1">
          <h2 className="text-[11px] font-bold text-stone-400 uppercase whitespace-nowrap shrink-0 tracking-tight">Recent top performers</h2>
          <div className="flex-1 h-px bg-stone-100" />
          <div className="relative">
            <button 
              onClick={() => setShowCountryMenu(!showCountryMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg shadow-sm text-[10px] font-black text-stone-400 uppercase tracking-widest hover:border-stone-300 transition-all"
            >
              {countryFilter.toUpperCase()}
              <ChevronDown size={14} className={cn("transition-transform", showCountryMenu ? "rotate-180" : "")} />
            </button>
            
            <AnimatePresence>
              {showCountryMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCountryMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-50 overflow-hidden"
                  >
                    {['Global', 'Singapore'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCountryFilter(c as any);
                          setShowCountryMenu(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest transition-colors",
                          countryFilter === c ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {recentTopDecks.length > 0 ? (
          <div className="relative h-[400px] md:h-[450px] flex items-center justify-center -mt-6">
            <motion.div 
              className="absolute inset-0 z-30 cursor-grab active:cursor-grabbing touch-none"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.03}
              onDragStart={() => {
                isDragging.current = true;
              }}
              onDrag={(_, info) => {
                dragX.set(info.offset.x * 0.2);
              }}
              onDragEnd={(_, info) => {
                dragX.set(0);
                setTimeout(() => {
                  isDragging.current = false;
                }, 50);

                if (info.offset.x < -40) handleNext();
                else if (info.offset.x > 40) handlePrev();
              }}
              onTap={(_, info) => {
                if (isDragging.current) return;
                
                const width = window.innerWidth;
                const tapX = info.point.x;
                
                if (tapX < width * 0.25) {
                  handlePrev();
                } else if (tapX > width * 0.75) {
                  handleNext();
                } else {
                  onSelectSubmission?.(recentTopDecks[activeIndex]);
                }
              }}
            />

            <div className="relative w-full h-full overflow-visible flex items-center justify-center">
              <AnimatePresence initial={false}>
                {[-1, 0, 1].map((offset) => {
                  const itemsCount = recentTopDecks.length;
                  const index = (activeIndex + offset + itemsCount) % itemsCount;
                  const deck = recentTopDecks[index];
                  if (!deck) return null;
                  const deckColors = getSubmissionColors(deck, allCards);
                  const isCenter = offset === 0;

                  return (
                    <motion.div
                      key={deck.id}
                      initial={{ 
                        opacity: 0, 
                        scale: 0.8,
                        x: offset * 250,
                        zIndex: 0
                      }}
                      animate={{ 
                        opacity: isCenter ? 1 : 0.4, 
                        scale: isCenter ? 1 : 0.75,
                        zIndex: isCenter ? 20 : 10,
                        x: offset * 155
                      }}
                      style={{
                        x: isCenter ? dragX : offset * 155
                      }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0.8,
                        x: offset * 250,
                        zIndex: 0
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 300, 
                        damping: 30
                      }}
                      className="absolute w-[208px] md:w-[260px] transform-gpu will-change-transform"
                    >
                      <div className="bg-white rounded-[2rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.15)] border border-stone-100 overflow-hidden transition-all select-none pointer-events-none">
                        <div className="relative aspect-[4/5] overflow-hidden">
                          {deck.coverImageUrl ? (
                            <ProgressiveImage src={deck.coverImageUrl} referrerPolicy="no-referrer" imageClassName="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-300">
                              <Layout size={32} />
                            </div>
                          )}
                          
                          <div className={cn(
                            "absolute inset-x-0 bottom-0 p-3 pt-6 bg-gradient-to-t from-black/80 via-black/10 to-transparent transition-opacity",
                            isCenter ? "opacity-100" : "opacity-0"
                          )}>
                            <h3 className="text-white font-black text-[10px] md:text-xs leading-tight drop-shadow-md line-clamp-1 uppercase tracking-tight">{deck.deckName}</h3>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "p-3 bg-white flex items-center transition-all",
                          isCenter ? "opacity-100" : "opacity-40"
                        )}>
                          <div className="w-8 h-8 rounded-full border-2 border-stone-50 overflow-hidden shrink-0 shadow-sm bg-stone-100 flex items-center justify-center">
                            {deck.email ? (
                              <img 
                                src={getGravatarUrl(deck.email) || ""} 
                                alt="" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <User size={16} className="text-stone-300" />
                            )}
                          </div>
                          
                          <div className="flex-1 ml-2.5 min-w-0 text-left">
                            <p className="text-[8px] font-black text-[#A4B9D2] uppercase tracking-widest leading-none mb-1">Player name:</p>
                            <h4 className="text-[11px] font-black text-stone-900 uppercase tracking-tight truncate leading-none">
                              {deck.playerName}
                            </h4>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
              <Globe size={24} className="text-stone-200" />
            </div>
            <p className="text-sm font-bold text-stone-400">No decks uploaded for this country yet</p>
          </div>
        )}
      </section>
      )}

      {/* Main Content Filters */}
      <section className="mt-2 px-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex justify-start pr-3">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Event list</span>
          </div>
          <div className="flex-1 h-px bg-stone-100" />
          
          {/* Season Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowSeasonMenu(!showSeasonMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg shadow-sm text-[10px] font-black text-stone-400 uppercase tracking-widest hover:border-stone-300 transition-all"
            >
              {SEASONS.find(s => s.id === selectedSeason)?.name || selectedSeason}
              <ChevronDown size={14} className={cn("transition-transform", showSeasonMenu ? "rotate-180" : "")} />
            </button>
            
            <AnimatePresence>
              {showSeasonMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSeasonMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-2 min-w-[160px] bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-50 overflow-hidden"
                  >
                    {SEASONS.map((season) => (
                      <button
                        key={season.id}
                        onClick={() => {
                          setSelectedSeason(season.id);
                          setShowSeasonMenu(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest transition-colors",
                          selectedSeason === season.id ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"
                        )}
                      >
                        {season.name}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Horizontal Event Filter */}
        <div className="flex gap-2.5 mb-6 overflow-x-auto no-scrollbar pb-2 items-stretch">
          <button
            onClick={() => setActiveFilterId('all')}
            className={cn(
              "px-5 py-2.5 rounded-2xl flex flex-col items-start justify-center transition-all border min-w-[145px] shrink-0 text-left cursor-pointer",
              activeFilterId === 'all'
                ? "bg-stone-900 border-stone-900 shadow-md"
                : "bg-white border-stone-200 hover:border-stone-300 shadow-sm"
            )}
          >
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
              activeFilterId === 'all' ? "text-white" : "text-stone-900"
            )}>
              All Events
            </span>
            <span className={cn(
              "text-[8.5px] font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap",
              activeFilterId === 'all' ? "text-stone-300/80" : "text-stone-400"
            )}>
              All Decklists
            </span>
          </button>
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => setActiveFilterId(event.id)}
              className={cn(
                "px-5 py-2.5 rounded-2xl flex flex-col items-start justify-center transition-all border min-w-[145px] shrink-0 text-left cursor-pointer",
                activeFilterId === event.id
                  ? "bg-stone-900 border-stone-900 shadow-md"
                  : "bg-white border-stone-200 hover:border-stone-300 shadow-sm"
              )}
            >
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                activeFilterId === event.id ? "text-white" : "text-stone-900"
              )}>
                {event.name}
              </span>
              <span className={cn(
                "text-[8.5px] font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap flex items-center gap-1",
                activeFilterId === event.id ? "text-stone-300/80" : "text-stone-400"
              )}>
                <span>{event.totalPlayers ? `${event.totalPlayers} Players` : "— Players"}</span>
                {event.source && (
                  <>
                    <span className="opacity-40 select-none">•</span>
                    <span className="truncate max-w-[110px]">
                      {event.source}
                    </span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(() => {
            const currentFilterEvent = events.find(e => e.id === activeFilterId);
            const filteredSubmissions = activeFilterId === 'all' 
              ? filteredDecks 
              : filteredDecks.filter(s => s.tournamentId === activeFilterId || (s.tournamentName && s.tournamentName === currentFilterEvent?.name));
            
            const tournamentDateMap = new Map<string, number>();
            events.forEach(e => tournamentDateMap.set(e.name, new Date(e.date).getTime()));

            const sortedDecks = [...filteredSubmissions].sort((a, b) => {
              // Group by tournament first
              if (a.tournamentName === b.tournamentName) {
                return getPlacementRank(a.placement) - getPlacementRank(b.placement);
              }

              // Different tournaments: Sort by tournament date
              const dateA = (a.tournamentName ? tournamentDateMap.get(a.tournamentName) : null) || 
                            (a.date ? new Date(a.date).getTime() : 0);
              const dateB = (b.tournamentName ? tournamentDateMap.get(b.tournamentName) : null) || 
                            (b.date ? new Date(b.date).getTime() : 0);

              if (dateB !== dateA) return dateB - dateA;

              // Fallback to upload time if dates are same
              const createdA = a.createdAt || 0;
              const createdB = b.createdAt || 0;
              if (createdB !== createdA) return createdB - createdA;

              return (a.tournamentName || '').localeCompare(b.tournamentName || '');
            });

            if (sortedDecks.length === 0 && !loading) {
              return (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-stone-200">
                  <Layout size={32} className="text-stone-100 mb-3" />
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">No decks found for this filter</p>
                </div>
              );
            }

            return sortedDecks.map((deck, index) => {
              const deckColors = getSubmissionColors(deck, allCards);
              const rank = getPlacementRank(deck.placement);
              return (
                <motion.div 
                  key={deck.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => onSelectSubmission?.(deck)}
                  className="relative flex items-center bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-stone-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group h-16 sm:h-20"
                >
                  {/* Rank Section */}
                  <div className={cn(
                    "w-12 sm:w-20 h-full flex items-center justify-center bg-gradient-to-br relative z-10 shrink-0",
                    getRankStyle(rank)
                  )}>
                    <span className="text-xl sm:text-4xl font-black italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                      {rank}
                    </span>
                    <div className="absolute top-0 -right-2 sm:-right-3 bottom-0 w-4 sm:w-6 bg-inherit z-[-1]" style={{ clipPath: 'polygon(0 0, 40% 0, 100% 100%, 0 100%)' }} />
                  </div>

                  <div className="flex-1 flex items-center gap-2 sm:gap-5 px-3 sm:px-6 overflow-hidden">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-stone-50">
                      {deck.coverImageUrl ? (
                        <ProgressiveImage 
                          src={deck.coverImageUrl} 
                          referrerPolicy="no-referrer"
                          imageClassName="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-50 flex items-center justify-center text-stone-200">
                          <Layout size={16} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-[11px] sm:text-base font-black text-stone-900 leading-tight uppercase tracking-tight truncate">
                        {deck.deckName}
                      </h3>
                      <div className="flex flex-col gap-0.5 min-w-0 mt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[9px] sm:text-xs font-bold text-stone-500 capitalize">
                            {deck.playerName} {deck.country && <span className="opacity-70">({deck.country})</span>}
                          </p>
                          <span className="hidden sm:inline text-stone-300">•</span>
                          <span className="text-[8px] sm:text-[10px] font-medium text-stone-400">
                            {new Date(deck.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {deck.tournamentName && (
                          <div className="flex items-center group/event">
                            <p className="text-[8px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-wider truncate">
                              {deck.tournamentName}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1.5 ml-auto shrink-0 pr-2">
                      {deckColors.map(color => (
                        <div 
                          key={color} 
                          className={cn(
                            "w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-[2px] sm:rounded shadow-inner border border-white/10 shrink-0",
                            getColorBg(color)
                          )} 
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Loading coverage...</p>
            </div>
          )}

          {!loading && events.length === 0 && submissions.length === 0 && (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-dashed border-stone-200">
              <Layout size={48} className="mx-auto text-stone-200 mb-4" />
              <h3 className="font-black text-stone-900 mb-1">No coverage data yet</h3>
              <p className="text-sm text-stone-400">Winning decklists for {selectedSeason} are yet to be submitted.</p>
            </div>
          )}
      </section>
    </div>
  );
};

export const TournamentDeckDetail: React.FC<{ submission: DeckSubmission; allCards?: GundamCard[]; onClose: () => void; onDuplicateDeck?: (deck: any) => void }> = ({ submission, allCards = [], onClose, onDuplicateDeck }) => {
  const [selectedCard, setSelectedCard] = useState<GundamCard | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [eventDetails, setEventDetails] = useState<TournamentEvent | null>(null);

  useEffect(() => {
    if (submission.tournamentId && !submission.totalPlayers) {
      const fetchEvent = async () => {
        try {
          const docRef = doc(db, 'tournament_events', submission.tournamentId!);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setEventDetails(docSnap.data() as TournamentEvent);
          }
        } catch (err) {
          console.error("Error fetching tournament event:", err);
        }
      };
      fetchEvent();
    }
  }, [submission.tournamentId, submission.totalPlayers]);

  // Parse text format if items are missing
  const deckItems = (submission.deckItems && submission.deckItems.length > 0)
    ? submission.deckItems
    : (submission.decklistText ? parseDecklistText(submission.decklistText, allCards) : []);

  const units = deckItems.filter(i => i.card.type.includes('Unit'));
  const pilots = deckItems.filter(i => i.card.type.includes('Pilot'));
  const commands = deckItems.filter(i => i.card.type.includes('Command'));
  const bases = deckItems.filter(i => i.card.type.includes('Base'));

  const handleDuplicate = async () => {
    if (onDuplicateDeck) {
      setDuplicating(true);
      try {
        const deckToDuplicate = {
          id: submission.id,
          name: submission.deckName,
          items: deckItems.map(item => ({
            card: item.card,
            count: item.count,
            artType: item.artType || "Base art"
          })),
          coverImageUrl: submission.coverImageUrl,
          lastModified: Date.now()
        };
        await onDuplicateDeck(deckToDuplicate);
        setShowMenu(false);
      } catch (err) {
        console.error("Error duplicating deck:", err);
      } finally {
        setDuplicating(false);
      }
      return;
    }

    if (!auth.currentUser) {
      alert("Please sign in to duplicate decks.");
      return;
    }
    
    setDuplicating(true);
    try {
      const userDecksRef = collection(db, 'user_decks');
      await addDoc(userDecksRef, {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'User',
        deckName: `${submission.deckName} (Copy)`,
        season: submission.season,
        deckItems: deckItems.map(item => ({
          card: item.card,
          count: item.count,
          artType: item.artType || "Base art"
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: false
      });
      alert("Deck successfully duplicated to your collection!");
      setShowMenu(false);
    } catch (err) {
      console.error("Error duplicating deck:", err);
      alert("Failed to duplicate deck.");
    } finally {
      setDuplicating(false);
    }
  };

  const renderSection = (title: string, items: typeof deckItems) => {
    if (items.length === 0) return null;
    const totalCount = items.reduce((acc, i) => acc + i.count, 0);
    
    const sortedItems = [...items].sort((a, b) => {
      const aLevel = Number(a.card.level) || 0;
      const bLevel = Number(b.card.level) || 0;
      return aLevel - bLevel;
    });

    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[10px] font-black tracking-widest text-stone-400 uppercase">{title}</h2>
          <div className="flex-1 h-px bg-stone-100" />
          <span className="text-[10px] font-black text-stone-300">{totalCount}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {sortedItems.map((item, idx) => (
            <div 
              key={`${item.card.cardNumber}-${idx}`} 
              onClick={() => setSelectedCard(item.card)}
              className="flex flex-col group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-sm border border-stone-100 bg-stone-50">
                <ProgressiveImage 
                  src={item.card.imageUrl} 
                  referrerPolicy="no-referrer"
                  imageClassName="w-full h-full object-cover" 
                />
                <div className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1 rounded-md bg-stone-900/90 backdrop-blur-sm text-white flex items-center justify-center text-[9px] font-black shadow-lg">
                  x{item.count}
                </div>
              </div>
              <div className="mt-2 text-center">
                <p className="text-[9px] font-black text-stone-800 leading-tight truncate uppercase tracking-tight">
                  {item.card.name}
                </p>
                <p className="text-[8px] font-bold text-stone-400">
                  {item.card.cardNumber}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Back button and Menu Bar */}
      <header className="bg-white border-b border-stone-100 px-4 py-3 flex items-center justify-between sticky top-0 z-[110]">
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full hover:bg-stone-50 flex items-center justify-center text-stone-600 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        
        <h2 className="text-xs sm:text-sm font-black tracking-tight text-stone-900 uppercase truncate px-2 text-center flex-1">
          {submission.deckName}
        </h2>

        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full hover:bg-stone-50 flex items-center justify-center text-stone-600 transition-colors"
          >
            <MoreHorizontal size={20} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setShowMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden z-[120]"
                >
                  <button 
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="w-full px-5 py-4 text-left text-sm font-black text-stone-900 uppercase tracking-tight hover:bg-stone-50 flex items-center gap-3 transition-colors disabled:opacity-50 border-b border-stone-50"
                  >
                    <Copy size={16} className="text-stone-400" />
                    {duplicating ? 'Duplicating...' : 'Duplicate Deck'}
                  </button>
                  <button 
                    onClick={() => {
                      const text = deckItems.map(i => `${i.count} ${i.card.cardNumber} ${i.card.name}`).join('\n');
                      setExportText(text);
                      setIsExportModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-5 py-4 text-left text-sm font-black text-stone-900 uppercase tracking-tight hover:bg-stone-50 flex items-center gap-3 transition-colors"
                  >
                    <Download size={16} className="text-stone-400" />
                    Export as Text
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-white">
        {/* Simplified Metadata */}
        <div className="px-6 py-6 border-b border-stone-50">
          <div className="flex items-center gap-2 text-[11px] font-black text-stone-400 uppercase tracking-widest mb-1.5 flex-wrap">
            <span>{submission.season}</span>
            <span className="w-1 h-1 rounded-full bg-stone-200" />
            <span className="text-stone-500">{submission.eventType}</span>
            {submission.tournamentName && (
              <>
                <span className="w-1 h-1 rounded-full bg-stone-200" />
                <span className="text-stone-500">{submission.tournamentName}</span>
              </>
            )}
            {(submission.totalPlayers || eventDetails?.totalPlayers) && (
              <>
                <span className="w-1 h-1 rounded-full bg-stone-200" />
                <span className="text-stone-500">{submission.totalPlayers || eventDetails?.totalPlayers} Players</span>
              </>
            )}
            {eventDetails?.source && (
              <>
                <span className="w-1 h-1 rounded-full bg-stone-200" />
                <span className="text-stone-500 flex items-center gap-0.5">
                  <LinkIcon size={10} className="text-stone-400 mr-0.5 shrink-0" />
                  {eventDetails.source}
                </span>
              </>
            )}
            <span className="w-1 h-1 rounded-full bg-stone-200" />
            <span>{new Date(submission.date).toLocaleDateString()}</span>
          </div>
          <p className="text-sm font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
            <span>Rank {cleanPlacement(submission.placement)}</span>
            <span className="text-stone-300 font-bold">/</span>
            <span className="flex items-center gap-1.5 text-stone-400 lowercase italic">
              {submission.email && (
                <img 
                  src={getGravatarUrl(submission.email) || ""} 
                  alt="" 
                  className="w-5 h-5 rounded-full border border-stone-100 shrink-0" 
                />
              )}
              by {submission.playerName} {submission.country && <span className="not-italic text-[10px] ml-1">({submission.country})</span>}
            </span>
          </p>
        </div>

        <main className="max-w-4xl mx-auto w-full px-4 py-8 pb-32">
          {deckItems.length > 0 ? (
            <>
              {renderSection('Units', units)}
              {renderSection('Pilots', pilots)}
              {renderSection('Commands', commands)}
              {renderSection('Bases', bases)}
            </>
          ) : submission.decklistText ? (
            <div className="bg-stone-50 border border-stone-100 rounded-3xl p-8 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-stone-400" />
                <h3 className="text-xs font-black text-stone-900 uppercase tracking-widest">Decklist Text (Unrecognized)</h3>
              </div>
              <pre className="text-sm font-mono text-stone-600 whitespace-pre-wrap leading-relaxed">
                {submission.decklistText}
              </pre>
              <p className="mt-4 text-[10px] font-bold text-stone-400 italic">
                Note: Could not automatically convert this decklist to images. Please check the format: "Count CardNumber Name"
              </p>
            </div>
          ) : (
            <div className="text-center py-24 bg-stone-50 rounded-[2.5rem] border border-dashed border-stone-200">
              <Layout size={48} className="mx-auto text-stone-100 mb-4" />
              <p className="text-sm font-black text-stone-400 uppercase tracking-widest">No decklist recorded</p>
            </div>
          )}
        </main>
      </div>

      {/* Card Detail Overlay */}
      <AnimatePresence>
        {selectedCard && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 sm:p-12">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCard(null)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg aspect-[2/3] z-[160] rounded-3xl overflow-hidden shadow-2xl border border-white/20"
            >
              <ProgressiveImage 
                src={selectedCard.imageUrl} 
                referrerPolicy="no-referrer"
                imageClassName="w-full h-full object-contain" 
              />
              <button 
                onClick={() => setSelectedCard(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                id="close-card-detail"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Deck Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl z-[210]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase tracking-tight">Export Deck</h3>
                  <button 
                    onClick={() => setIsExportModalOpen(false)}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">
                  Copy your deck list below to share it.
                </p>

                <textarea
                  readOnly
                  value={exportText}
                  className="w-full h-48 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono focus:outline-none resize-none"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy text'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
