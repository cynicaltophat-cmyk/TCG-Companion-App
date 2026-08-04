import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Deck, TournamentEvent, DeckSubmission, EventType, Placement, Country, GundamCard, Archetype } from '../types';
import { 
  X, 
  ChevronDown, 
  Calendar, 
  Trophy, 
  User, 
  Mail,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Layout,
  Globe,
  FileText,
  ImageIcon,
  Plus
} from 'lucide-react';
import { cn, parseDecklistText, handleFirestoreError, OperationType } from '../lib/utils';
import { ProgressiveImage } from './ProgressiveImage';

interface DeckSubmissionFormProps {
  deck: Deck;
  allCards: GundamCard[];
  initialSubmission?: DeckSubmission;
  onClose: () => void;
  onSuccess: () => void;
}

const SEASONS = [
  { id: "GD05", name: "GD05 - Freedom Ascension" },
  { id: "GD04", name: "GD04 - Phantom Aria" }
];

const EVENT_TYPES: EventType[] = ["Shop Battle", "Newtype challenge", "Organized Event", "Release event"];
const COUNTRIES: Country[] = ["Global", "Singapore"];
// Removed fixed PLACEMENTS constant to allow numeric range 1-32

export const DeckSubmissionForm: React.FC<DeckSubmissionFormProps> = ({ deck, allCards, initialSubmission, onClose, onSuccess }) => {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [archetypeSearch, setArchetypeSearch] = useState(initialSubmission?.archetype || "");
  const [showArchetypeSuggestions, setShowArchetypeSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCardSuggestions, setShowCardSuggestions] = useState(false);
  const [cardSuggestions, setCardSuggestions] = useState<GundamCard[]>([]);
  
  const isPresetTournament = !!initialSubmission?.tournamentId;
  
  const [formData, setFormData] = useState({
    deckName: initialSubmission?.deckName || deck.name || "",
    playerName: initialSubmission?.playerName || "",
    email: initialSubmission?.email || "",
    season: initialSubmission?.season || SEASONS[0].id,
    country: initialSubmission?.country || COUNTRIES[0] as Country,
    eventType: initialSubmission?.eventType || EVENT_TYPES[0] as EventType,
    tournamentId: initialSubmission?.tournamentId || "",
    date: initialSubmission?.date || new Date().toISOString().split('T')[0],
    placement: initialSubmission?.placement || "Top 1",
    decklistText: initialSubmission?.decklistText || deck.items
      .map(item => `${item.count} ${item.card.cardNumber} ${item.card.name}${item.card.traits?.[0] ? ` (${item.card.traits[0]})` : ''}`)
      .join('\n'),
    coverCardName: initialSubmission?.coverCardName || "",
    coverImageUrl: initialSubmission?.coverImageUrl || deck.coverImageUrl || "",
    archetype: initialSubmission?.archetype || ""
  });

  useEffect(() => {
    const q = query(collection(db, 'archetypes'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const archetypesData: Archetype[] = [];
      snapshot.forEach((doc) => {
        archetypesData.push(doc.data() as Archetype);
      });
      setArchetypes(archetypesData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'tournament_events'), 
      where('season', '==', formData.season),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData: TournamentEvent[] = [];
      snapshot.forEach((doc) => {
        eventsData.push(doc.data() as TournamentEvent);
      });
      setEvents(eventsData);
      
      // Select first event if available and it's an organized event
      if (eventsData.length > 0 && formData.eventType === 'Organized Event' && !formData.tournamentId) {
        setFormData(prev => ({ ...prev, tournamentId: eventsData[0].id }));
      }
    });

    return () => unsubscribe();
  }, [formData.season, formData.eventType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Please log in to submit a deck");
      return;
    }

    const parsedItems = parseDecklistText(formData.decklistText || "", allCards);
    const finalItems = parsedItems.length > 0 ? parsedItems : deck.items;

    const totalCards = finalItems.reduce((acc, item) => acc + item.count, 0);
    if (totalCards > 0 && totalCards !== 50) {
      alert("Please submit a 50 card decklist");
      return;
    }

    setSubmitting(true);
    const submissionId = initialSubmission?.id || `sub-${Date.now()}`;
    
    // Find tournament name if applicable
    const selectedTournament = events.find(e => e.id === formData.tournamentId);

    const submission: any = {
      id: submissionId,
      uid: initialSubmission?.uid || auth.currentUser.uid,
      deckId: deck.id || `deck-${Date.now()}`,
      deckName: formData.deckName || "Untitled Deck",
      deckItems: finalItems,
      playerName: formData.playerName,
      email: formData.email,
      season: formData.season,
      country: formData.country,
      eventType: formData.eventType,
      date: formData.date,
      placement: formData.placement,
      decklistText: formData.decklistText,
      coverCardName: formData.coverCardName,
      archetype: formData.archetype,
      createdAt: initialSubmission?.createdAt || Date.now(),
      updatedAt: Date.now(),
      status: initialSubmission?.status || 'pending'
    };

    let finalCoverUrl = formData.coverImageUrl;
    if (!finalCoverUrl && finalItems.length > 0) {
      const firstUnit = finalItems.find(i => i.card.type.includes('Unit')) || finalItems[0];
      if (firstUnit) {
        finalCoverUrl = firstUnit.card.imageUrl;
      }
    }
    if (finalCoverUrl) submission.coverImageUrl = finalCoverUrl;

    if (formData.eventType === 'Organized Event') {
      if (formData.tournamentId) submission.tournamentId = formData.tournamentId;
      if (selectedTournament?.name) {
        submission.tournamentName = selectedTournament.name;
      } else if (initialSubmission?.tournamentName) {
        submission.tournamentName = initialSubmission.tournamentName;
      }
      
      if (selectedTournament?.totalPlayers) {
        submission.totalPlayers = selectedTournament.totalPlayers;
      } else if (initialSubmission?.totalPlayers) {
        submission.totalPlayers = initialSubmission.totalPlayers;
      }
    }

    try {
      await setDoc(doc(db, 'deck_submissions', submissionId), submission);
      
      if (initialSubmission) {
        // Skip success screen for edits and return immediately
        onSuccess();
      } else {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Error submitting deck:", err);
      // Enhanced error reporting
      const errInfo = {
        error: err instanceof Error ? err.message : String(err),
        operationType: 'write',
        path: `deck_submissions/${submissionId}`,
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified
        }
      };
      console.error('Firestore Error details:', JSON.stringify(errInfo));
      alert("Failed to submit deck. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-6 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-2xl font-black text-stone-900 mb-2">Submission Successful!</h2>
        <p className="text-stone-500 max-w-xs">Your winning decklist has been submitted and is pending review by our admins.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right duration-300">
      <header className="px-4 py-4 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full">
          <ArrowLeft size={20} className="text-stone-600" />
        </button>
        <h2 className="text-lg font-black tracking-tight text-stone-900">
          {initialSubmission ? "Edit deck submission" : "Submit deck"}
        </h2>
        <div className="w-10 h-10" /> {/* Spacer */}
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Row 1: Season, country, event type, tournament organizer, date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-stone-50 border border-stone-100 p-5 rounded-[2rem]">
          {/* Season */}
          <section className="space-y-2">
            <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Season</label>
            <div className="relative">
              <select 
                disabled={isPresetTournament}
                value={formData.season}
                onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
                className={cn(
                  "w-full pl-4 pr-10 py-3 bg-white border border-stone-100 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-stone-200 transition-all",
                  isPresetTournament && "opacity-60 cursor-not-allowed bg-stone-200"
                )}
              >
                {SEASONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
            </div>
          </section>

          {/* Country */}
          <section className="space-y-2">
            <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Country</label>
            <div className="relative">
              <select 
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value as Country }))}
                className="w-full pl-4 pr-10 py-3 bg-white border border-stone-100 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-stone-200 transition-all"
              >
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
            </div>
          </section>

          {/* Event type */}
          <section className="space-y-2">
            <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Event type</label>
            <div className="relative">
              <select 
                disabled={isPresetTournament}
                value={formData.eventType}
                onChange={(e) => setFormData(prev => ({ ...prev, eventType: e.target.value as EventType }))}
                className={cn(
                  "w-full pl-4 pr-10 py-3 bg-white border border-stone-100 rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-stone-200 transition-all",
                  isPresetTournament && "opacity-60 cursor-not-allowed bg-stone-200"
                )}
              >
                {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
            </div>
          </section>

          {/* Tournament Organizer */}
          <section className="space-y-2">
            <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Organizer</label>
            <div className="relative">
              <select 
                disabled={isPresetTournament || formData.eventType !== 'Organized Event'}
                value={formData.tournamentId}
                onChange={(e) => setFormData(prev => ({ ...prev, tournamentId: e.target.value }))}
                className={cn(
                  "w-full pl-4 pr-10 py-3 bg-white border border-stone-100 rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-stone-200 transition-all",
                  (isPresetTournament || formData.eventType !== 'Organized Event') && "opacity-60 cursor-not-allowed bg-stone-200"
                )}
              >
                {events.length === 0 ? (
                  <option value="">No events</option>
                ) : (
                  events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
            </div>
          </section>

          {/* Date */}
          <section className="space-y-2">
            <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
              <input 
                type="date"
                disabled={isPresetTournament}
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={cn(
                  "w-full pl-9 pr-4 py-[9px] bg-white border border-stone-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none",
                  isPresetTournament && "opacity-60 cursor-not-allowed bg-stone-200"
                )}
              />
            </div>
          </section>
        </div>

        {/* Two-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COLUMN LEFT GOING DOWN: Deck name, Archetype, Player Name, Email, Placement */}
          <div className="space-y-5">
            {/* Deck Name */}
            <section className="space-y-2">
              <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Deck Name</label>
              <input 
                type="text"
                value={formData.deckName}
                onChange={(e) => setFormData(prev => ({ ...prev, deckName: e.target.value }))}
                placeholder="e.g. Red Unit Aggro"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                required
              />
            </section>

            {/* Deck Archetype */}
            <section className="space-y-2">
              <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Deck archetype</label>
              <div className="relative">
                <input 
                  type="text"
                  value={archetypeSearch}
                  onFocus={() => setShowArchetypeSuggestions(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setArchetypeSearch(val);
                    setFormData(prev => ({ ...prev, archetype: val }));
                    setShowArchetypeSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowArchetypeSuggestions(false), 200);
                  }}
                  placeholder="Search or select archetype..."
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                  <ChevronDown size={18} />
                </div>

                {showArchetypeSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto">
                    {(() => {
                      const trimmedSearch = archetypeSearch.trim();
                      const filtered = archetypes.filter(a => 
                        a.name.toLowerCase().includes(trimmedSearch.toLowerCase())
                      );
                      
                      const exactMatch = archetypes.find(a => a.name.toLowerCase() === trimmedSearch.toLowerCase());
                      
                      const handleAddArchetype = async (nameToAdd: string) => {
                        if (!nameToAdd) return;
                        const id = `archetype-${Date.now()}`;
                        try {
                          await setDoc(doc(db, 'archetypes', id), {
                            id,
                            name: nameToAdd,
                            createdAt: Date.now()
                          });
                          alert(`Successfully added archetype "${nameToAdd}" to database!`);
                          setArchetypeSearch(nameToAdd);
                          setFormData(prev => ({ ...prev, archetype: nameToAdd }));
                          setShowArchetypeSuggestions(false);
                        } catch (err) {
                          try {
                            handleFirestoreError(err, OperationType.WRITE, `archetypes/${id}`, auth);
                          } catch (formattedErr) {
                            console.error(formattedErr);
                          }
                          alert(`Failed to add archetype: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      };

                      return (
                        <div className="flex flex-col">
                          {filtered.length > 0 ? (
                            filtered.map(a => (
                              <button
                                key={a.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setArchetypeSearch(a.name);
                                  setFormData(prev => ({ ...prev, archetype: a.name }));
                                  setShowArchetypeSuggestions(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors flex items-center justify-between border-b border-stone-50 last:border-none"
                              >
                                <span className="text-sm font-bold text-stone-900">{a.name}</span>
                                {formData.archetype === a.name && <CheckCircle2 size={16} className="text-stone-900" />}
                              </button>
                            ))
                          ) : trimmedSearch.length > 0 ? (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setArchetypeSearch("Other");
                                setFormData(prev => ({ ...prev, archetype: "Other" }));
                                setShowArchetypeSuggestions(false);
                              }}
                              className="w-full px-4 py-4 text-left hover:bg-stone-50 transition-colors flex flex-col border-b border-stone-50"
                            >
                              <span className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">No matches found</span>
                              <span className="text-sm font-bold text-stone-900">Select "Other"</span>
                            </button>
                          ) : (
                            archetypes.map(a => (
                              <button
                                key={a.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setArchetypeSearch(a.name);
                                  setFormData(prev => ({ ...prev, archetype: a.name }));
                                  setShowArchetypeSuggestions(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors flex items-center justify-between border-b border-stone-50 last:border-none"
                              >
                                <span className="text-sm font-bold text-stone-900">{a.name}</span>
                                {formData.archetype === a.name && <CheckCircle2 size={16} className="text-stone-900" />}
                              </button>
                            ))
                          )}

                          {trimmedSearch.length > 0 && !exactMatch && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddArchetype(trimmedSearch);
                              }}
                              className="w-full px-4 py-4 text-left bg-amber-50/40 hover:bg-amber-50/70 transition-colors flex flex-col border-t border-stone-100 cursor-pointer"
                            >
                              <span className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">New Archetype</span>
                              <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                                <Plus size={16} className="text-amber-600" />
                                Add "{trimmedSearch}" to database
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </section>

            {/* Player Name */}
            <section className="space-y-2">
              <label className="text-xs font-black text-stone-900 uppercase tracking-widest pl-1">Player name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={18} />
                <input 
                  type="text"
                  value={formData.playerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, playerName: e.target.value }))}
                  placeholder="e.g. kaisenesse"
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                  required
                />
              </div>
            </section>

            {/* Email */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black text-stone-900 uppercase tracking-widest">Email (Optional)</label>
                <span className="text-[10px] text-stone-400 font-bold italic">For profile picture</span>
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={18} />
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                />
              </div>
            </section>

            {/* Placement */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black text-stone-900 uppercase tracking-widest">Placement</label>
                <span className="text-[10px] text-stone-400 font-bold">Only up till top 32</span>
              </div>
              <div className="relative">
                <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={18} />
                <input 
                  type="number"
                  min="1"
                  max="32"
                  value={formData.placement.replace('Top ', '')}
                  onChange={(e) => {
                    const val = Math.min(32, Math.max(1, parseInt(e.target.value) || 1));
                    setFormData(prev => ({ ...prev, placement: `Top ${val}` }));
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                />
              </div>
            </section>
          </div>

          {/* COLUMN RIGHT GOING DOWN: Cover-Image-Card Search & List Preview, and Text Decklist */}
          <div className="space-y-5">
            {/* Interactive Live Banner Preview */}
            <div className="relative h-28 bg-stone-100 rounded-[2rem] overflow-hidden border border-stone-100 shadow-md">
              {formData.coverImageUrl ? (
                <ProgressiveImage src={formData.coverImageUrl} imageClassName="w-full h-full object-cover animate-in fade-in duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <Layout size={32} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase font-black text-amber-400 tracking-wider mb-0.5">Deck list Preview</p>
                  <h3 className="text-white font-black text-lg drop-shadow-md truncate">
                    {formData.deckName || "New Deck"}
                  </h3>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/30 text-white text-[9px] font-black uppercase tracking-widest flex-shrink-0">
                  {deck.items.reduce((acc, i) => acc + i.count, 0)} cards
                </div>
              </div>
            </div>

            {/* Cover Image Card */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black text-stone-900 uppercase tracking-widest">Cover Image Card</label>
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tight italic">Select a card graphic</span>
              </div>
              <div className="relative">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={18} />
                <input 
                  type="text"
                  value={formData.coverCardName}
                  onFocus={() => {
                    if (formData.coverCardName.length >= 2) {
                      const filtered = allCards.filter(c => 
                        c.name.toLowerCase().includes(formData.coverCardName.toLowerCase())
                      ).slice(0, 5);
                      setCardSuggestions(filtered);
                      setShowCardSuggestions(filtered.length > 0);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, coverCardName: val }));
                    if (val.length >= 2) {
                      const filtered = allCards.filter(c => 
                        c.name.toLowerCase().includes(val.toLowerCase()) ||
                        c.cardNumber.toLowerCase().includes(val.toLowerCase())
                      ).slice(0, 5);
                      setCardSuggestions(filtered);
                      setShowCardSuggestions(filtered.length > 0);
                    } else {
                      setShowCardSuggestions(false);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCardSuggestions(false), 200);
                  }}
                  placeholder="Search and select card..."
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-stone-200 transition-all outline-none"
                  required
                />
                {showCardSuggestions && (
                  <div className="absolute z-50 bottom-full left-0 right-0 mb-2 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-64 overflow-y-auto">
                    <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Card Results</span>
                    </div>
                    {cardSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            coverCardName: c.name,
                            coverImageUrl: c.imageUrl
                          }));
                          setShowCardSuggestions(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors flex items-center gap-3 border-b border-stone-50 last:border-none"
                      >
                        <div className="w-8 h-12 bg-stone-100 rounded overflow-hidden flex-shrink-0">
                          <ProgressiveImage src={c.imageUrl} imageClassName="w-full h-full object-cover animate-in fade-in duration-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-stone-900 truncate">{c.name}</p>
                          <p className="text-[10px] text-stone-400 font-bold">{c.cardNumber}</p>
                        </div>
                        <Plus size={16} className="text-stone-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Decklist Text Format */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black text-stone-900 uppercase tracking-widest">Decklist (Text Format)</label>
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">Copy-pasteable</span>
              </div>
              <div className="relative">
                <FileText className="absolute left-4 top-5 text-stone-400 pointer-events-none" size={18} />
                <textarea 
                  value={formData.decklistText}
                  onChange={(e) => setFormData(prev => ({ ...prev, decklistText: e.target.value }))}
                  rows={6}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-stone-200 transition-all outline-none font-mono leading-relaxed"
                  placeholder="4 GD04-016 Zoloat (League Militaire)..."
                  required
                />
              </div>
            </section>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-4 pb-8">
          <button 
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-[#E5E5E0] hover:bg-[#DEDECB] text-stone-900 rounded-[2rem] font-black text-lg shadow-lg shadow-stone-200/50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                {initialSubmission ? "Updating..." : "Submitting..."}
              </>
            ) : (
              initialSubmission ? "UPDATE DECK" : "SUBMIT DECK"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
