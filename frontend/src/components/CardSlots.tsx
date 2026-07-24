import { PlayingCard } from './PlayingCard';
import { CardBack, DealingCard, FlippingCard } from './CardBack';
import type { BonusHit, Card } from '../api';

interface CardSlotsProps {
  cards: Card[];
  activeBonuses: BonusHit[];
  newCardIndex: number | null;
  roundMultipliers: number[];
  maxCards?: number;
  pendingSlot: number | null;
}

type Highlight = 'straight' | 'flush' | 'straightFlush';

interface BonusRun {
  kind: Highlight;
  start: number;
  end: number;
  length: number;
  multiplier: number;
}

function compareVal(c: Card): number {
  return c.rank;
}

function flushRunContaining(cards: Card[], index: number): { start: number; end: number } {
  const suit = cards[index].suit;
  let left = index;
  while (left > 0 && cards[left - 1].suit === suit) left--;
  let right = index;
  while (right < cards.length - 1 && cards[right + 1].suit === suit) right++;
  return { start: left, end: right };
}

function straightRunContaining(
  cards: Card[],
  index: number,
  sameSuit = false,
): { start: number; end: number } {
  const val = (c: Card) => compareVal(c);
  let best = { start: index, end: index };

  for (const dir of [1, -1] as const) {
    let l = index;
    let r = index;
    while (
      l > 0 &&
      val(cards[l]) === val(cards[l - 1]) + dir &&
      (!sameSuit || cards[l].suit === cards[l - 1].suit)
    ) {
      l--;
    }
    while (
      r < cards.length - 1 &&
      val(cards[r + 1]) === val(cards[r]) + dir &&
      (!sameSuit || cards[r].suit === cards[r + 1].suit)
    ) {
      r++;
    }
    if (r - l > best.end - best.start) best = { start: l, end: r };
  }
  return best;
}

function findLongestFlushRun(cards: Card[]): { start: number; end: number; length: number } | null {
  let best: { start: number; end: number; length: number } | null = null;
  let i = 0;
  while (i < cards.length) {
    const { start, end } = flushRunContaining(cards, i);
    const length = end - start + 1;
    if (!best || length > best.length) best = { start, end, length };
    i = end + 1;
  }
  return best;
}

function findLongestStraightRun(
  cards: Card[],
  sameSuit = false,
): { start: number; end: number; length: number } | null {
  let best: { start: number; end: number; length: number } | null = null;
  for (let i = 0; i < cards.length; i++) {
    const { start, end } = straightRunContaining(cards, i, sameSuit);
    const length = end - start + 1;
    if (!best || length > best.length) best = { start, end, length };
  }
  return best;
}

function buildBonusRuns(cards: Card[], bonuses: BonusHit[]): BonusRun[] {
  const runs: BonusRun[] = [];
  for (const b of bonuses) {
    if (b.kind === 'StraightFlush') {
      const run = findLongestStraightRun(cards, true);
      if (run && run.length >= 3) {
        runs.push({
          kind: 'straightFlush',
          start: run.start,
          end: run.end,
          length: b.length,
          multiplier: b.multiplier,
        });
      }
    } else if (b.kind === 'Flush') {
      const run = findLongestFlushRun(cards);
      if (run && run.length >= 3) {
        runs.push({
          kind: 'flush',
          start: run.start,
          end: run.end,
          length: b.length,
          multiplier: b.multiplier,
        });
      }
    } else if (b.kind === 'Straight') {
      const run = findLongestStraightRun(cards, false);
      if (run && run.length >= 3) {
        runs.push({
          kind: 'straight',
          start: run.start,
          end: run.end,
          length: b.length,
          multiplier: b.multiplier,
        });
      }
    }
  }
  return runs;
}

function highlightFor(index: number, runs: BonusRun[]): Highlight | null {
  // Prefer SF > flush/straight if overlapping
  let hit: Highlight | null = null;
  for (const run of runs) {
    if (index < run.start || index > run.end) continue;
    if (run.kind === 'straightFlush') return 'straightFlush';
    if (!hit) hit = run.kind;
  }
  return hit;
}

function slotMultLabel(index: number, roundMultipliers: number[]): string {
  if (index === 0) return '—';
  const m = roundMultipliers[index - 1];
  if (m == null) return '—';
  return `×${Number(m.toFixed(4)).toString()}`;
}

function formatBonusMult(m: number): string {
  if (m >= 1000) return `×${m.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `×${Number(m.toFixed(2))}`;
}

/** Font scale: length 3 → 1, length 8 → ~2.1 */
function bonusFontSize(length: number): string {
  const t = Math.min(Math.max(length, 3), 8);
  const scale = 0.85 + (t - 3) * 0.22;
  return `${scale}rem`;
}

export function CardSlots({
  cards,
  activeBonuses,
  newCardIndex,
  roundMultipliers,
  maxCards = 8,
  pendingSlot,
}: CardSlotsProps) {
  const runs = buildBonusRuns(cards, activeBonuses);

  return (
    <div className="slots-board" style={{ ['--slots' as string]: maxCards }}>
      <div className="card-slots">
        {Array.from({ length: maxCards }, (_, i) => {
          const card = cards[i];
          const filled = Boolean(card);
          const isPending = pendingSlot === i;
          const isNext = !filled && i === (pendingSlot ?? cards.length);
          const hl = highlightFor(i, runs);

          return (
            <div
              key={i}
              className={`card-slot ${filled ? 'filled' : ''} ${isPending ? 'pending' : ''} ${isNext && !filled ? 'next' : ''}`}
            >
              <div className="slot-frame">
                {card ? (
                  newCardIndex === i && i > 0 ? (
                    <DealingCard isNew>
                      <PlayingCard card={card} index={i} highlight={hl} />
                    </DealingCard>
                  ) : (
                    <FlippingCard isNew={newCardIndex === i}>
                      <PlayingCard card={card} index={i} highlight={hl} />
                    </FlippingCard>
                  )
                ) : isPending ? (
                  <CardBack />
                ) : (
                  <div className={`slot-empty ${i === maxCards - 1 ? 'slot-empty-final' : ''}`}>
                    <span className={`slot-mult-in ${i === maxCards - 1 ? 'slot-mult-final' : ''}`}>
                      {slotMultLabel(i, roundMultipliers)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bonus-captions" aria-live="polite">
        {runs.map((run) => (
          <div
            key={`${run.kind}-${run.start}-${run.end}`}
            className={`bonus-caption bonus-caption-${run.kind}`}
            style={{
              gridColumn: `${run.start + 1} / ${run.end + 2}`,
              fontSize: bonusFontSize(run.length),
            }}
          >
            {formatBonusMult(run.multiplier)}
          </div>
        ))}
      </div>
    </div>
  );
}
