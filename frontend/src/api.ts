export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades' | 0 | 1 | 2 | 3;

export interface Card {
  rank: number;
  suit: Suit;
  rankLabel: string;
  suitSymbol: string;
  isRed: boolean;
  compareValue: number;
}

export type BonusKind =
  | 'Pair'
  | 'TwoPair'
  | 'ThreeOfAKind'
  | 'Straight'
  | 'Flush'
  | 'FullHouse'
  | 'FourOfAKind'
  | 'StraightFlush'
  | 'RoyalFlush';

export interface BonusHit {
  kind: BonusKind;
  length: number;
  tier: number;
  multiplier: number;
  cardIndexes: number[];
}

export type GamePhase =
  | 'Idle'
  | 'Playing'
  | 'CanCashOut'
  | 'Won'
  | 'Lost'
  | 'MaxReached';

export interface GameState {
  sessionId: string;
  balance: number;
  bet: number;
  pot: number;
  currentMultiplier: number;
  phase: GamePhase;
  cards: Card[];
  lastBonuses: BonusHit[];
  activeBonuses: BonusHit[];
  successfulGuesses: number;
  message: string | null;
  higherProbability: number | null;
  lowerProbability: number | null;
}

export interface GameConfig {
  maxCards: number;
  roundMultipliers: number[];
  handMultipliers: Record<string, number>;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function sessionId(): string {
  const key = 'hilo_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId(),
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data as T;
}

export const api = {
  config: () => request<GameConfig>('/api/game/config'),
  state: () => request<GameState>('/api/game/state'),
  setBalance: (balance: number) =>
    request<GameState>('/api/game/balance', {
      method: 'POST',
      body: JSON.stringify({ balance }),
    }),
  start: (bet: number) =>
    request<GameState>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify({ bet }),
    }),
  guess: (guess: 'Higher' | 'Lower') =>
    request<GameState>('/api/game/guess', {
      method: 'POST',
      body: JSON.stringify({ guess }),
    }),
  cashOut: () =>
    request<GameState>('/api/game/cashout', { method: 'POST' }),
};

/** Normalize System.Text.Json enum output (number or string). */
export function suitName(suit: Suit): 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades' {
  if (typeof suit === 'number') {
    return (['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const)[suit];
  }
  return suit;
}

export function suitSymbol(suit: Suit): string {
  switch (suitName(suit)) {
    case 'Hearts':
      return '♥';
    case 'Diamonds':
      return '♦';
    case 'Clubs':
      return '♣';
    case 'Spades':
      return '♠';
  }
}

export function rankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(rank);
  }
}

export function isRed(suit: Suit): boolean {
  const s = suitName(suit);
  return s === 'Hearts' || s === 'Diamonds';
}
