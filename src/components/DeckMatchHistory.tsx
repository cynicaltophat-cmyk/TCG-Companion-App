import React, { useState, useMemo } from 'react';
import { Play, Search, X, Trash2, ArrowLeft, Plus, Check, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Deck, DeckMatchEvent, MatchRecord, GundamCard } from '../types';

interface DeckMatchHistoryProps {
  deck: Deck;
  allCards?: GundamCard[];
  onSaveMatchEvents?: (events: DeckMatchEvent[]) => void;
}

const COLOR_OPTIONS = [
  { name: 'Red', bg: 'bg-red-500', ring: 'ring-red-500', text: 'text-red-500' },
  { name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500', text: 'text-blue-500' },
  { name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500', text: 'text-emerald-500' },
  { name: 'White', bg: 'bg-stone-100 border border-stone-400', ring: 'ring-stone-400', text: 'text-stone-700' },
  { name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500', text: 'text-purple-500' },
];

export const DeckMatchHistory: React.FC<DeckMatchHistoryProps> = ({
  deck,
  allCards = [],
  onSaveMatchEvents,
}) => {
  const [subTab, setSubTab] = useState<'events' | 'stats'>('events');
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'event_details' | 'opponent_details' | 'match_details' | 'results' | 'view_event'>('landing');

  // Viewing specific event details state
  const [viewingEvent, setViewingEvent] = useState<DeckMatchEvent | null>(null);

  // Active event setup state
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [matchFormat, setMatchFormat] = useState<'Best of 1' | 'Best of 3'>('Best of 1');
  const [eventDeckName, setEventDeckName] = useState<string>(deck.name || 'Deck');
  const [eventDeckVersion, setEventDeckVersion] = useState<string>(deck.activeVariationId ? `Ver ${deck.activeVariationId}` : 'Ver 1');
  const [eventRoundsLogged, setEventRoundsLogged] = useState<MatchRecord[]>([]);

  // Round / Opponent state
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentKeycard, setOpponentKeycard] = useState<GundamCard | null>(null);
  const [keycardSearchQuery, setKeycardSearchQuery] = useState<string>('');
  const [showKeycardSearch, setShowKeycardSearch] = useState<boolean>(false);
  const [opponentColors, setOpponentColors] = useState<string[]>([]);

  // Round Details state
  const [diceRoll, setDiceRoll] = useState<'Won roll' | 'Lost roll' | undefined>(undefined);
  const [playOrder, setPlayOrder] = useState<'First' | 'Second'>('First');

  // Round Result state
  const [result, setResult] = useState<'win' | 'loss' | 'draw'>('win');
  const [notes, setNotes] = useState<string>('');

  // Advance Stats controls
  const [statsGroupMode, setStatsGroupMode] = useState<'keycard' | 'color'>('keycard');
  const [statsSortOrder, setStatsSortOrder] = useState<'desc' | 'asc'>('desc');

  // Helper to get color background class
  const getColorBadge = (colorName: string) => {
    const match = COLOR_OPTIONS.find(c => c.name.toLowerCase() === colorName.toLowerCase());
    if (match) return match.bg;
    return 'bg-stone-400';
  };

  // Calculate global win rate & game records
  const events: DeckMatchEvent[] = deck.matchEvents || [];
  
  let wins = 0;
  let losses = 0;
  
  events.forEach(evt => {
    (evt.matches || []).forEach(match => {
      if (match.result === 'win') wins++;
      if (match.result === 'loss') losses++;
    });
  });

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Flatten all match records across all events
  const allMatches = useMemo(() => {
    const matches: MatchRecord[] = [];
    events.forEach(evt => {
      if (evt.matches) {
        matches.push(...evt.matches);
      }
    });
    return matches;
  }, [events]);

  // Grouped matchup statistics for Advance Stats
  const matchStats = useMemo(() => {
    if (allMatches.length === 0) return [];

    interface GroupedStat {
      id: string;
      name: string;
      imageUrl?: string;
      colors?: string[];
      wins: number;
      losses: number;
      draws: number;
      total: number;
      winRate: number;
    }

    const groups: { [key: string]: GroupedStat } = {};

    if (statsGroupMode === 'keycard') {
      allMatches.forEach(m => {
        const cardName = m.opponentKeycardName || 'Unspecified Card';
        const key = m.opponentKeycardId || cardName;

        if (!groups[key]) {
          groups[key] = {
            id: key,
            name: cardName,
            imageUrl: m.opponentKeycardImage,
            colors: m.opponentColors || [],
            wins: 0,
            losses: 0,
            draws: 0,
            total: 0,
            winRate: 0,
          };
        }

        if (!groups[key].imageUrl && m.opponentKeycardImage) {
          groups[key].imageUrl = m.opponentKeycardImage;
        }

        // Fallback image lookup from allCards
        if (!groups[key].imageUrl && allCards && allCards.length > 0) {
          const matchedCard = allCards.find(c => c.id === key || c.name.toLowerCase() === cardName.toLowerCase());
          if (matchedCard?.imageUrl) {
            groups[key].imageUrl = matchedCard.imageUrl;
          }
        }

        if ((!groups[key].colors || groups[key].colors?.length === 0) && m.opponentColors) {
          groups[key].colors = m.opponentColors;
        }

        if (m.result === 'win') groups[key].wins++;
        else if (m.result === 'loss') groups[key].losses++;
        else if (m.result === 'draw') groups[key].draws++;
      });
    } else {
      // Group by color combination
      allMatches.forEach(m => {
        const rawColors = m.opponentColors || [];
        const sortedColors = [...rawColors].sort();
        const colorKey = sortedColors.length > 0 ? sortedColors.join(' / ') : 'No Color';

        if (!groups[colorKey]) {
          groups[colorKey] = {
            id: colorKey,
            name: colorKey,
            imageUrl: m.opponentKeycardImage,
            colors: sortedColors,
            wins: 0,
            losses: 0,
            draws: 0,
            total: 0,
            winRate: 0,
          };
        }

        if (!groups[colorKey].imageUrl && m.opponentKeycardImage) {
          groups[colorKey].imageUrl = m.opponentKeycardImage;
        }

        if (m.result === 'win') groups[colorKey].wins++;
        else if (m.result === 'loss') groups[colorKey].losses++;
        else if (m.result === 'draw') groups[colorKey].draws++;
      });
    }

    const list = Object.values(groups).map(g => {
      const total = g.wins + g.losses + g.draws;
      const winRate = total > 0 ? Math.round((g.wins / total) * 100) : 0;
      return { ...g, total, winRate };
    });

    list.sort((a, b) => {
      if (statsSortOrder === 'desc') {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.total - a.total;
      } else {
        if (a.winRate !== b.winRate) return a.winRate - b.winRate;
        return a.total - b.total;
      }
    });

    return list;
  }, [allMatches, statsGroupMode, statsSortOrder, allCards]);

  // Cover image for deck
  const deckCoverImage = useMemo(() => {
    if (deck.coverImageUrl) return deck.coverImageUrl;
    if (deck.items && deck.items.length > 0) {
      return deck.items[0].card.imageUrl;
    }
    return '';
  }, [deck]);

  // Fuzzy card search results for keycard selection
  const searchResults = useMemo(() => {
    if (!keycardSearchQuery.trim()) return [];
    const q = keycardSearchQuery.toLowerCase();
    return allCards
      .filter(c => c.name.toLowerCase().includes(q) || c.cardNumber?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [keycardSearchQuery, allCards]);

  // Dynamic available variations from current deck
  const availableVariations = useMemo(() => {
    if (deck.variations && deck.variations.length > 0) {
      return deck.variations.map(v => v.name);
    }
    return ['Ver A', 'Ver B', 'Ver C'];
  }, [deck.variations]);

  const defaultDeckVersion = useMemo(() => {
    if (deck.variations && deck.variations.length > 0) {
      const active = deck.variations.find(v => v.id === deck.activeVariationId);
      if (active) return active.name;
      return deck.variations[0].name;
    }
    return 'Ver A';
  }, [deck.variations, deck.activeVariationId]);

  // Start new event flow
  const handleStartNewEvent = () => {
    const newId = `event_${Date.now()}`;
    setActiveEventId(newId);
    setEventName('');
    setMatchFormat('Best of 1');
    setEventDeckName(deck.name || 'Deck');
    setEventDeckVersion(defaultDeckVersion);
    setEventRoundsLogged([]);

    // Reset round state
    setOpponentName('');
    setOpponentKeycard(null);
    setKeycardSearchQuery('');
    setOpponentColors([]);
    setDiceRoll(undefined);
    setPlayOrder('First');
    setResult('win');
    setNotes('');

    setCurrentScreen('event_details');
  };

  // Toggle Color Selection (up to 2 colors allowed)
  const toggleColor = (colorName: string) => {
    if (opponentColors.includes(colorName)) {
      setOpponentColors(opponentColors.filter(c => c !== colorName));
    } else {
      if (opponentColors.length < 2) {
        setOpponentColors([...opponentColors, colorName]);
      }
    }
  };

  // Log Round button click handler
  const handleLogRound = () => {
    const newRecord: MatchRecord = {
      id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      playOrder,
      result,
      timestamp: Date.now(),
    };
    if (opponentName.trim()) newRecord.opponentName = opponentName.trim();
    if (opponentKeycard?.id) newRecord.opponentKeycardId = opponentKeycard.id;
    if (opponentKeycard?.name) newRecord.opponentKeycardName = opponentKeycard.name;
    if (opponentKeycard?.imageUrl) newRecord.opponentKeycardImage = opponentKeycard.imageUrl;
    if (opponentColors && opponentColors.length > 0) newRecord.opponentColors = opponentColors;
    if (diceRoll) newRecord.diceRoll = diceRoll;
    if (notes.trim()) newRecord.notes = notes.trim();

    const updatedMatches = [...eventRoundsLogged, newRecord];
    setEventRoundsLogged(updatedMatches);

    const now = new Date();
    const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

    const updatedEvent: DeckMatchEvent = {
      id: activeEventId || `event_${Date.now()}`,
      name: eventName.trim() || `Event #${events.length + 1}`,
      format: matchFormat,
      deckName: eventDeckName,
      deckVersion: eventDeckVersion,
      date: formattedDate,
      matches: updatedMatches,
      createdAt: Date.now(),
    };

    const existingIndex = events.findIndex(e => e.id === updatedEvent.id);
    let newEvents: DeckMatchEvent[];
    if (existingIndex >= 0) {
      newEvents = events.map((e, idx) => idx === existingIndex ? updatedEvent : e);
    } else {
      newEvents = [updatedEvent, ...events];
    }

    onSaveMatchEvents?.(newEvents);

    // Reset opponent / round fields for next round
    setOpponentName('');
    setOpponentKeycard(null);
    setKeycardSearchQuery('');
    setOpponentColors([]);
    setDiceRoll(undefined);
    setPlayOrder('First');
    setResult('win');
    setNotes('');

    // Circle back to match details to restart cycle!
    setCurrentScreen('match_details');
  };

  // Delete event handler
  const handleDeleteEvent = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this event?")) {
      const newEvents = events.filter(evt => evt.id !== eventId);
      onSaveMatchEvents?.(newEvents);
      if (viewingEvent?.id === eventId) {
        setViewingEvent(null);
        setCurrentScreen('landing');
      }
    }
  };

  // Render VS Header Component
  const renderVSHeader = () => {
    return (
      <div className="flex items-center justify-center gap-4 sm:gap-8 pt-2 pb-6 select-none">
        {/* You */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">You</span>
          <div className="w-24 sm:w-28 aspect-[2/3] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 relative shadow-sm flex flex-col items-center justify-center text-center p-1">
            {deckCoverImage ? (
              <img src={deckCoverImage} alt="Your Deck" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-[10px] font-bold text-stone-400 p-2">Tap to choose cover image</span>
            )}
          </div>
          <span className="text-xs font-black text-[#141414] mt-2 truncate max-w-[100px] sm:max-w-[120px]">
            {eventDeckName}
          </span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-lg">
              {eventDeckVersion}
            </span>
          </div>
        </div>

        {/* VS Divider */}
        <div className="text-xl sm:text-2xl font-black text-stone-300 italic px-2 pt-2">
          VS
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Opponent</span>
          <div className="w-24 sm:w-28 aspect-[2/3] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 relative shadow-sm flex flex-col items-center justify-center text-center p-1">
            {opponentKeycard ? (
              <img src={opponentKeycard.imageUrl} alt={opponentKeycard.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-[10px] font-bold text-stone-400 p-2 text-center">Opponent Keycard</span>
            )}
          </div>
          <span className="text-xs font-black text-[#141414] mt-2 truncate max-w-[100px] sm:max-w-[120px]">
            {opponentKeycard ? opponentKeycard.name : "Keycard name"}
          </span>
          <div className="flex items-center gap-1.5 mt-1 min-h-[16px]">
            {opponentColors.length > 0 ? (
              opponentColors.map(cName => {
                const opt = COLOR_OPTIONS.find(o => o.name === cName);
                return (
                  <span key={cName} className={`w-3.5 h-3.5 rounded-md shadow-xs ${opt?.bg || 'bg-stone-400'}`} />
                );
              })
            ) : (
              <span className="text-[10px] font-semibold text-stone-400">No color selected</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 pt-1 pb-10 px-2 sm:px-4 select-none">
      {/* Landing Screen */}
      {currentScreen === 'landing' && (
        <>
          {/* Sub-navigation Tabs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSubTab('events')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'events'
                    ? 'bg-[#141414] text-white shadow-md'
                    : 'bg-white border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                Event history
              </button>
              <button
                type="button"
                onClick={() => setSubTab('stats')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subTab === 'stats'
                    ? 'bg-[#141414] text-white shadow-md'
                    : 'bg-white border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                Advance stats
              </button>
            </div>
            <div className="flex-1 h-[1px] bg-stone-200" />
          </div>

          {subTab === 'events' ? (
            <div className="space-y-6">
              {/* Win Rate & Game Records Header */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-[#141414] tracking-tight leading-none">
                    {winRate}%
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-stone-400 mt-2">
                    Win rate
                  </div>
                </div>

                <div className="w-[1px] h-10 bg-stone-200" />

                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-[#141414] tracking-tight leading-none">
                    {wins} - {losses}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-stone-400 mt-2">
                    Game records
                  </div>
                </div>
              </div>

              {/* Create new event button */}
              <div>
                <button
                  type="button"
                  onClick={handleStartNewEvent}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest py-3.5 px-6 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md shadow-orange-500/20"
                >
                  <span>Create new event</span>
                  <Play size={14} className="fill-white text-white ml-0.5" />
                </button>
              </div>

              {/* Event Details Section Divider */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
                  Event Details
                </span>
                <div className="flex-1 h-[1px] bg-stone-200" />
              </div>

              {/* Events list / empty container */}
              {events.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs font-medium bg-white rounded-2xl border border-stone-200 p-8 shadow-xs">
                  No events recorded yet. Click "Create new event" to start.
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {events.map((evt) => {
                    const evtWins = (evt.matches || []).filter(m => m.result === 'win').length;
                    const evtLosses = (evt.matches || []).filter(m => m.result === 'loss').length;
                    const evtTotal = (evt.matches || []).length;

                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setViewingEvent(evt);
                          setCurrentScreen('view_event');
                        }}
                        className="bg-white hover:bg-stone-50/80 border border-stone-200 rounded-2xl p-4 transition-all flex items-center justify-between cursor-pointer shadow-xs hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-16 bg-stone-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-stone-200">
                            {deckCoverImage ? (
                              <img src={deckCoverImage} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] text-stone-400 font-bold p-1 text-center">Cover</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[#141414] text-sm">{evt.name}</span>
                              <span className="text-xs text-stone-500 font-bold">
                                {evt.deckName} {evt.deckVersion && `(${evt.deckVersion})`}
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 font-medium mt-0.5">{evt.date}</p>
                            <p className="text-xs font-black text-[#141414] mt-1">
                              {evtWins} - {evtLosses} &nbsp;&nbsp;
                              <span className="font-semibold text-stone-500">{evtTotal} {evtTotal === 1 ? 'game' : 'games'}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteEvent(evt.id, e)}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Win Rate & Game Records Header */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-[#141414] tracking-tight leading-none">
                    {winRate}%
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-stone-400 mt-2">
                    Win rate
                  </div>
                </div>

                <div className="w-[1px] h-10 bg-stone-200" />

                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-[#141414] tracking-tight leading-none">
                    {wins} - {losses}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-stone-400 mt-2">
                    Game records
                  </div>
                </div>
              </div>

              {/* Matchup win rates section header & controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-800 shrink-0">
                    Match up win rates
                  </span>
                  <div className="flex-1 h-[1px] bg-stone-200" />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-stone-400">Sort by</span>
                  <div className="relative">
                    <select
                      value={statsGroupMode}
                      onChange={(e) => setStatsGroupMode(e.target.value as 'keycard' | 'color')}
                      className="appearance-none bg-white border border-stone-200 text-[#141414] text-xs font-black uppercase tracking-wider py-2 pl-3 pr-8 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-xs"
                    >
                      <option value="keycard">Main card</option>
                      <option value="color">Color combination</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  </div>

                  {/* Round toggle button for ascending/descending order */}
                  <button
                    type="button"
                    onClick={() => setStatsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    title={statsSortOrder === 'desc' ? 'Descending order' : 'Ascending order'}
                    className="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-50 active:scale-95 text-[#141414] flex items-center justify-center cursor-pointer transition-all shadow-xs"
                  >
                    {statsSortOrder === 'desc' ? (
                      <ArrowDown size={14} className="text-[#141414]" />
                    ) : (
                      <ArrowUp size={14} className="text-[#141414]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Matchup results list */}
              {matchStats.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs font-medium bg-white rounded-2xl border border-stone-200 p-8 shadow-xs">
                  No match up data recorded yet. Record matches under "Event history" to view statistics.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {matchStats.map((item) => {
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm"
                      >
                        {/* Square rounded corner image */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-100 rounded-2xl overflow-hidden shrink-0 border border-stone-200/80 shadow-xs relative flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-center">
                              {item.colors && item.colors.length > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                  {item.colors.map((c, i) => (
                                    <span
                                      key={i}
                                      className={`w-3.5 h-3.5 rounded-full ${getColorBadge(c)} border border-black/10 shadow-xs`}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-400 font-bold uppercase">No Image</span>
                              )}
                            </div>
                          )}

                          {/* Color dots overlay if image exists and colors are present */}
                          {item.imageUrl && item.colors && item.colors.length > 0 && (
                            <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-full border border-white/20">
                              {item.colors.map((c, i) => (
                                <span
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full ${getColorBadge(c)} border border-white/40`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Details and win/lose bar */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Top row: Name, game record, win rate */}
                          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-black text-[#141414] text-sm sm:text-base truncate">
                                {item.name}
                              </span>
                              <span className="text-xs font-black tracking-wide shrink-0">
                                <span className="text-emerald-500">{item.wins}</span>
                                <span className="text-stone-400 mx-1">-</span>
                                <span className="text-red-500">{item.losses}</span>
                                {item.draws > 0 && (
                                  <span className="text-stone-400 text-[11px] font-normal ml-1">({item.draws}D)</span>
                                )}
                              </span>
                            </div>

                            <span className="text-xs sm:text-sm font-black text-[#141414] shrink-0">
                              {item.winRate}% win rate
                            </span>
                          </div>

                          {/* Win Lose Bar */}
                          <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden flex border border-stone-200/60 p-[1px] shadow-inner">
                            {item.wins > 0 && (
                              <div
                                style={{ width: `${(item.wins / item.total) * 100}%` }}
                                className={`bg-emerald-500 h-full transition-all duration-300 ${
                                  item.losses === 0 && item.draws === 0 ? 'rounded-full' : 'rounded-l-full'
                                }`}
                                title={`${item.wins} Wins`}
                              />
                            )}
                            {item.draws > 0 && (
                              <div
                                style={{ width: `${(item.draws / item.total) * 100}%` }}
                                className="bg-amber-400 h-full transition-all duration-300"
                                title={`${item.draws} Draws`}
                              />
                            )}
                            {item.losses > 0 && (
                              <div
                                style={{ width: `${(item.losses / item.total) * 100}%` }}
                                className={`bg-red-500 h-full transition-all duration-300 ${
                                  item.wins === 0 ? 'rounded-l-full' : ''
                                } rounded-r-full`}
                                title={`${item.losses} Losses`}
                              />
                            )}
                            {item.total === 0 && (
                              <div className="w-full h-full bg-stone-200 rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Screen 1: Event Details */}
      {currentScreen === 'event_details' && (
        <div className="space-y-6 pt-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
              Event details
            </span>
            <div className="flex-1 h-[1px] bg-stone-200" />
          </div>

          <div className="space-y-4">
            {/* Event Name Input */}
            <div>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event name (Optional)"
                className="w-full bg-white border border-stone-200 text-[#141414] font-semibold py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-stone-400 placeholder:font-normal shadow-xs"
              />
            </div>

            {/* Match Format */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Match Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMatchFormat('Best of 1')}
                  className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    matchFormat === 'Best of 1'
                      ? 'bg-[#141414] text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Best of 1
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFormat('Best of 3')}
                  className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    matchFormat === 'Best of 3'
                      ? 'bg-[#141414] text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Best of 3
                </button>
              </div>
            </div>

            {/* Your Deck Name */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Your deck name</label>
              <input
                type="text"
                value={eventDeckName}
                onChange={(e) => setEventDeckName(e.target.value)}
                placeholder="Deck name"
                className="w-full bg-white border border-stone-200 text-[#141414] font-semibold py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-xs"
              />
            </div>

            {/* Your Deck Version */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Your deck version</label>
              <div className="flex items-center gap-2 flex-wrap">
                {availableVariations.map((ver) => (
                  <button
                    key={ver}
                    type="button"
                    onClick={() => setEventDeckVersion(ver)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      eventDeckVersion === ver
                        ? 'bg-[#141414] text-white shadow-md'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {ver}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setCurrentScreen('landing')}
              className="px-5 py-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-black uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen('match_details')}
              className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/20"
            >
              <span>Start match up</span>
              <Play size={12} className="fill-white text-white ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Screen 2: Match Details */}
      {currentScreen === 'match_details' && (
        <div className="space-y-5 pt-1">
          {/* VS Header Card */}
          {renderVSHeader()}

          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
              Details
            </span>
            <div className="flex-1 h-[1px] bg-stone-200" />
          </div>

          <div className="space-y-4">
            {/* Dice roll (optional) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Dice roll (optional)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDiceRoll(diceRoll === 'Won roll' ? undefined : 'Won roll')}
                  className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    diceRoll === 'Won roll'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Won roll
                </button>
                <button
                  type="button"
                  onClick={() => setDiceRoll(diceRoll === 'Lost roll' ? undefined : 'Lost roll')}
                  className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    diceRoll === 'Lost roll'
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Lost roll
                </button>
              </div>
            </div>

            {/* Play order */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Play order</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlayOrder('First')}
                  className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    playOrder === 'First'
                      ? 'bg-[#141414] text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setPlayOrder('Second')}
                  className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    playOrder === 'Second'
                      ? 'bg-[#141414] text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Second
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center gap-3 pt-6">
            {eventRoundsLogged.length === 0 ? (
              <button
                type="button"
                onClick={() => setCurrentScreen('event_details')}
                className="px-5 py-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-black uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('landing');
                }}
                className="px-5 py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-black uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>End</span>
              </button>
            )}

            {(() => {
              const isMatchValid = playOrder === 'First' || playOrder === 'Second';
              return (
                <button
                  type="button"
                  disabled={!isMatchValid}
                  onClick={() => setCurrentScreen('opponent_details')}
                  className={`flex-1 py-3.5 font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2 ${
                    isMatchValid
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white cursor-pointer shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span>Next</span>
                  <Play size={12} className={isMatchValid ? 'fill-white text-white ml-0.5' : 'fill-stone-400 text-stone-400 ml-0.5'} />
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Screen 3: Opponent Deck Details */}
      {currentScreen === 'opponent_details' && (
        <div className="space-y-5 pt-1">
          {/* VS Header Card */}
          {renderVSHeader()}

          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
              Opponent deck
            </span>
            <div className="flex-1 h-[1px] bg-stone-200" />
          </div>

          <div className="space-y-4">
            {/* Opponent Name */}
            <div>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="Opponent name (optional)"
                className="w-full bg-white border border-stone-200 text-[#141414] font-semibold py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-stone-400 placeholder:font-normal shadow-xs"
              />
            </div>

            {/* Select Opponent Keycard (Search field) */}
            <div className="relative">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={opponentKeycard ? opponentKeycard.name : keycardSearchQuery}
                  onChange={(e) => {
                    setKeycardSearchQuery(e.target.value);
                    if (opponentKeycard) setOpponentKeycard(null);
                    setShowKeycardSearch(true);
                  }}
                  onFocus={() => setShowKeycardSearch(true)}
                  placeholder="Select opponent keycard"
                  className="w-full bg-white border border-stone-200 text-[#141414] font-semibold py-3 pr-10 pl-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-stone-400 placeholder:font-normal shadow-xs"
                />
                {opponentKeycard ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpponentKeycard(null);
                      setKeycardSearchQuery('');
                    }}
                    className="absolute right-3 text-stone-400 hover:text-[#141414] p-1 cursor-pointer transition-colors"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <Search size={16} className="absolute right-3 text-stone-400 pointer-events-none" />
                )}
              </div>

              {/* Search Dropdown Results */}
              {showKeycardSearch && !opponentKeycard && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-stone-200 shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-stone-100">
                  {searchResults.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => {
                        setOpponentKeycard(card);
                        setShowKeycardSearch(false);
                      }}
                      className="p-3 flex items-center gap-3 hover:bg-amber-50/50 cursor-pointer transition-colors"
                    >
                      <img src={card.imageUrl} alt={card.name} className="w-8 h-11 object-cover rounded-lg shrink-0 bg-stone-100 border border-stone-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-[#141414] truncate">{card.name}</p>
                        <p className="text-[10px] font-semibold text-stone-500">{card.cardNumber} • {card.color}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Select Color (Up to two) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-stone-500">Select color (Up to two)</label>
                {opponentColors.length > 2 && (
                  <span className="text-[10px] font-bold text-red-500">* Select max 2 colors</span>
                )}
                {opponentColors.length === 0 && (
                  <span className="text-[10px] font-bold text-amber-600">* Select at least 1 color</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {COLOR_OPTIONS.map((col) => {
                  const isSelected = opponentColors.includes(col.name);
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => toggleColor(col.name)}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${col.bg} ${
                        isSelected ? `ring-2 ring-offset-2 ${col.ring} scale-105 shadow-md` : 'opacity-80 hover:opacity-100'
                      }`}
                      title={col.name}
                    >
                      {isSelected && (
                        <Check size={18} className={col.name === 'White' ? 'text-[#141414]' : 'text-white'} strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setCurrentScreen('match_details')}
              className="px-5 py-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-black uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            {(() => {
              const isOpponentValid = opponentColors.length >= 1 && opponentColors.length <= 2;
              return (
                <button
                  type="button"
                  disabled={!isOpponentValid}
                  onClick={() => setCurrentScreen('results')}
                  className={`flex-1 py-3.5 font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2 ${
                    isOpponentValid
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white cursor-pointer shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span>Next</span>
                  <Play size={12} className={isOpponentValid ? 'fill-white text-white ml-0.5' : 'fill-stone-400 text-stone-400 ml-0.5'} />
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Screen 4: Results */}
      {currentScreen === 'results' && (
        <div className="space-y-5 pt-1">
          {/* VS Header Card */}
          {renderVSHeader()}

          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
              Results
            </span>
            <div className="flex-1 h-[1px] bg-stone-200" />
          </div>

          <div className="space-y-4">
            {/* Outcome Selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResult('win')}
                className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                  result === 'win'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Won
              </button>
              <button
                type="button"
                onClick={() => setResult('loss')}
                className={`py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                  result === 'loss'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Lost
              </button>
            </div>

            {/* Notes */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (Optional)"
                className="w-full bg-white border border-stone-200 text-[#141414] font-semibold py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-stone-400 placeholder:font-normal shadow-xs"
              />
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setCurrentScreen('opponent_details')}
              className="px-5 py-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-black uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            {(() => {
              const isResultValid = result === 'win' || result === 'loss';
              return (
                <button
                  type="button"
                  disabled={!isResultValid}
                  onClick={handleLogRound}
                  className={`flex-1 py-3.5 font-black uppercase tracking-widest rounded-2xl text-xs transition-all flex items-center justify-center gap-2 ${
                    isResultValid
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white cursor-pointer shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span>Log round</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Screen 5: View / Edit Event Details */}
      {currentScreen === 'view_event' && viewingEvent && (
        <div className="space-y-6 pt-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewingEvent(null);
                  setCurrentScreen('landing');
                }}
                className="p-1.5 hover:bg-stone-200/60 rounded-xl text-[#141414] transition-colors cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <h3 className="text-base font-black text-[#141414]">{viewingEvent.name}</h3>
            </div>
            <span className="text-xs font-bold text-stone-500">{viewingEvent.date}</span>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-[#141414]">
              <span>Deck: {viewingEvent.deckName} ({viewingEvent.deckVersion})</span>
              <span className="text-stone-500">Format: {viewingEvent.format}</span>
            </div>
            <div className="text-xs font-black text-[#141414]">
              Total Games Logged: {(viewingEvent.matches || []).length}
            </div>
          </div>

          {/* Add more rounds button (above logged rounds) */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveEventId(viewingEvent.id);
                setEventName(viewingEvent.name);
                setMatchFormat(viewingEvent.format);
                setEventDeckName(viewingEvent.deckName);
                setEventDeckVersion(viewingEvent.deckVersion);
                setEventRoundsLogged(viewingEvent.matches || []);
                
                // Reset opponent state
                setOpponentName('');
                setOpponentKeycard(null);
                setOpponentColors([]);
                setDiceRoll(undefined);
                setPlayOrder('First');
                setResult('win');
                setNotes('');

                setCurrentScreen('match_details');
              }}
              className="w-full py-3.5 bg-[#141414] hover:bg-stone-800 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-black/10"
            >
              <Plus size={16} />
              <span>Add more rounds to this event</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-stone-500 shrink-0">
                Logged Rounds
              </span>
              <div className="flex-1 h-[1px] bg-stone-200" />
            </div>

            {(!viewingEvent.matches || viewingEvent.matches.length === 0) ? (
              <div className="text-center text-xs text-stone-400 py-8 bg-white border border-stone-200 rounded-2xl shadow-xs">
                No rounds logged in this event yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {viewingEvent.matches.map((m, idx) => (
                  <div key={m.id || idx} className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-12 bg-stone-100 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                        {m.opponentKeycardImage ? (
                          <img src={m.opponentKeycardImage} alt="Keycard" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-stone-400 font-bold p-1 text-center">
                            No Card
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#141414]">
                            Round {idx + 1}: {m.opponentName || 'Opponent'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            m.result === 'win' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {m.result}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                          {m.opponentKeycardName && `Keycard: ${m.opponentKeycardName} • `}
                          {m.playOrder && `${m.playOrder} `}
                          {m.diceRoll && `(${m.diceRoll})`}
                        </p>
                        {m.notes && <p className="text-[10px] text-stone-400 italic mt-0.5">"{m.notes}"</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
