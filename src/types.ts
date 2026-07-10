export type ArtVariantType = string;

export interface ArtVariant {
  type: ArtVariantType;
  imageUrl: string;
  artist?: string;
  artistLink?: string;
}

export type CardType = "Unit" | "Pilot" | "Command" | "Base" | "Unit Token";

export interface GundamCard {
  id: string;
  name: string;
  set: string;
  cardNumber: string;
  type: CardType[];
  color: "Red" | "Blue" | "Green" | "White" | "Purple" | "Colorless";
  rarity: "C" | "U" | "R" | "LR";
  cost: string | number;
  level?: string | number;
  ap?: string | number;
  hp?: string | number;
  ability: string;
  imageUrl: string;
  link?: string;
  baseArtist?: string;
  baseArtistLink?: string;
  altImageUrl?: string;
  altArtist?: string;
  altArtistLink?: string;
  variants?: ArtVariant[];
  traits?: string[];
  zones?: string[];
  relatedCards?: string[];
  doublePlus?: boolean;
  championshipParticipation?: boolean;
  faq?: { question: string; answer: string }[];
  variantType?: ArtVariantType;
  parentId?: string;
  isVariant?: boolean;
}

export const ALL_SETS = [
  "GD05",
  "EB01",
  "GD04",
  "GD03",
  "GD02",
  "GD01",
  "ST10",
  "ST09",
  "ST08",
  "ST07",
  "ST06",
  "ST05",
  "ST04",
  "ST03",
  "ST02",
  "ST01"
];

export interface DeckItem {
  card: GundamCard;
  count: number;
  artType: ArtVariantType;
}

export interface Deck {
  id: string;
  name: string;
  items: DeckItem[];
  lastModified: number;
  coverImageUrl?: string;
  folderId?: string | null;
}

export interface DeckFolder {
  id: string;
  uid: string;
  name: string;
  icon?: string;
  createdAt: number;
}

export interface TournamentEvent {
  id: string;
  name: string;
  season: string;
  date: string;
  type: 'Organized Event';
  totalPlayers?: number;
  source?: string;
}

export type EventType = 'Shop Battle' | 'Newtype challenge' | 'Organized Event' | 'Release event';
export type Country = 'Global' | 'Singapore';
export type Placement = string;
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface DeckSubmission {
  id: string;
  uid: string;
  deckId: string;
  deckName: string;
  deckItems: DeckItem[];
  coverImageUrl?: string;
  playerName: string;
  email?: string;
  season: string;
  country: Country;
  eventType: EventType;
  tournamentId?: string; 
  tournamentName?: string;
  totalPlayers?: number;
  date: string;
  placement: Placement;
  decklistText?: string;
  coverCardName?: string;
  archetype?: string;
  createdAt: number;
  status: SubmissionStatus;
}

export type FeedbackCategory = 
  | 'Incorrect ability effect' 
  | 'Incorrect color' 
  | 'Incorrect/Missing links' 
  | 'Incorrect stats' 
  | 'Incorrect ID number' 
  | 'Incorrect trait' 
  | 'Other'
  | 'Bug' 
  | 'Feature Request' 
  | 'General';

export type FeedbackStatus = 'New' | 'In Progress' | 'Resolved' | 'Closed';

export interface Feedback {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  category: FeedbackCategory;
  message: string;
  cardId?: string;
  cardName?: string;
  createdAt: number;
  status: FeedbackStatus;
  _collection?: 'feedback' | 'card_feedback';
}

export interface ProductFeaturedCard {
  cardId: string;
  count: number;
}

export interface Product {
  id: string;
  name: string;
  releaseDate: string;
  msrp: string;
  whereToBuy: string[];
  featuredCards: ProductFeaturedCard[];
  contents: string[];
  imageUrl: string;
  category: "Starter Deck" | "Booster box" | "Other";
}

export interface Archetype {
  id: string;
  name: string;
  createdAt: number;
}
