import { PlayingCard } from './PlayingCard';
import type { BonusHit, Card } from '../api';

interface CardRowProps {
  cards: Card[];
  stacked: boolean;
  activeBonuses: BonusHit[];
  newCardIndex: number | null;
}

function highlightFor(index: number, cards: Card[], bonuses: BonusHit[]): 'straight' | 'flush' | 'straightFlush' | null {
  if (bonuses.some((b) => b.kind === 'StraightFlush')) {
    // light up cards that participate in same-suit straight segments of length >= 3
    if (inStraightFlushRun(cards, index)) return 'straightFlush';
  }
  if (bonuses.some((b) => b.kind === 'Flush') && inFlushRun(cards, index)) return 'flush';
  if (bonuses.some((b) => b.kind === 'Straight') && inStraightRun(cards, index)) return 'straight';
  return null;
}

function inFlushRun(cards: Card[], index: number): boolean {
  const suit = cards[index].suit;
  let left = index;
  while (left > 0 && cards[left - 1].suit === suit) left--;
  let right = index;
  while (right < cards.length - 1 && cards[right + 1].suit === suit) right++;
  return right - left + 1 >= 3;
}

function compareVal(c: Card): number {
  return c.rank === 1 ? 14 : c.rank;
}

function inStraightRun(cards: Card[], index: number): boolean {
  return longestStraightTouching(cards, index, false) >= 3;
}

function inStraightFlushRun(cards: Card[], index: number): boolean {
  return longestStraightTouching(cards, index, true) >= 3;
}

function longestStraightTouching(cards: Card[], index: number, sameSuit: boolean): number {
  const tryEncode = (aceHigh: boolean) => {
    const val = (c: Card) => (aceHigh ? compareVal(c) : c.rank);
    let best = 1;

    // expand ascending
    let l = index;
    let r = index;
    while (
      l > 0 &&
      val(cards[l]) === val(cards[l - 1]) + 1 &&
      (!sameSuit || cards[l].suit === cards[l - 1].suit)
    ) {
      l--;
    }
    while (
      r < cards.length - 1 &&
      val(cards[r + 1]) === val(cards[r]) + 1 &&
      (!sameSuit || cards[r].suit === cards[r + 1].suit)
    ) {
      r++;
    }
    best = Math.max(best, r - l + 1);

    // expand descending
    l = index;
    r = index;
    while (
      l > 0 &&
      val(cards[l]) === val(cards[l - 1]) - 1 &&
      (!sameSuit || cards[l].suit === cards[l - 1].suit)
    ) {
      l--;
    }
    while (
      r < cards.length - 1 &&
      val(cards[r + 1]) === val(cards[r]) - 1 &&
      (!sameSuit || cards[r].suit === cards[r + 1].suit)
    ) {
      r++;
    }
    return Math.max(best, r - l + 1);
  };

  return Math.max(tryEncode(true), tryEncode(false));
}

export function CardRow({ cards, stacked, activeBonuses, newCardIndex }: CardRowProps) {
  const stackedWidth =
    cards.length <= 1
      ? 'var(--card-w)'
      : `calc(var(--card-w) + ${(cards.length - 1)} * var(--card-w) * 0.66)`;

  return (
    <div
      className={`card-row ${stacked ? 'is-stacked' : 'is-spread'}`}
      style={stacked ? { width: stackedWidth } : undefined}
    >
      {cards.map((card, i) => (
        <PlayingCard
          key={`${i}-${card.rank}-${card.suit}`}
          card={card}
          index={i}
          stacked={stacked}
          highlight={highlightFor(i, cards, activeBonuses)}
          isNew={newCardIndex === i}
        />
      ))}
    </div>
  );
}
