import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getColorBg(color: string) {
  switch (color) {
    case 'Red': return 'bg-red-500';
    case 'Blue': return 'bg-blue-500';
    case 'Green': return 'bg-emerald-500';
    case 'White': return 'bg-stone-200';
    case 'Purple': return 'bg-purple-500';
    case 'Colorless': return 'bg-stone-300';
    default: return 'bg-stone-200';
  }
}

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

export function getYYTLink(cardNumber: string): string {
  // Pattern based on user provided correct links: https://yuyu-tei.jp/sell/gcg/s/search
  // The previously used /game/gundam/ was likely causing 404s.
  return `https://yuyu-tei.jp/sell/gcg/s/search?search_word=${encodeURIComponent(cardNumber)}`;
}

export function parseDecklistText(text: string, allCards: any[]): any[] {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: any[] = [];

  for (const line of lines) {
    // Expected format: "4 GD04-016 Zoloat (League Militaire)"
    // or "4x ST01-001"
    // Regex matches leading spaces, quantity, optionally 'x' or spaces, and card number/ID
    const match = line.match(/^\s*(\d+)[x\s]+([A-Z0-9-]{4,15})/i);
    if (match) {
      const count = parseInt(match[1]);
      const cardIdOrNumber = match[2].trim().toUpperCase();
      
      // Try to find the card by card number (most common in text lists)
      const card = allCards.find(c => 
        c.cardNumber.toUpperCase() === cardIdOrNumber
      );
      
      if (card) {
        items.push({ 
          count: Math.min(count, 4), 
          card,
          artType: "Base art"
        });
      }
    }
  }
  return items;
}
