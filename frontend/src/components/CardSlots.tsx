import { PlayingCard } from './PlayingCard';
import { CardBack, DealingCard, FlippingCard } from './CardBack';
import type { BonusHit, BonusKind, Card } from '../api';

interface CardSlotsProps {
  cards: Card[];
  activeBonuses: BonusHit[];
  newCardIndex: number | null;
  roundMultipliers: number[];
  maxCards?: number;
  pendingSlot: number | null;
  showNextSlot: boolean;
}

const KIND_BY_TIER: Record<number, BonusKind> = {
  1: 'Pair',
  2: 'TwoPair',
  3: 'ThreeOfAKind',
  4: 'Straight',
  5: 'Flush',
  6: 'FullHouse',
  7: 'FourOfAKind',
  8: 'StraightFlush',
  9: 'RoyalFlush',
};

const HAND_KINDS = new Set<string>(Object.values(KIND_BY_TIER));

function normalizeKind(kind: BonusHit['kind'] | number): BonusKind | null {
  if (typeof kind === 'number') return KIND_BY_TIER[kind] ?? null;
  if (typeof kind === 'string' && HAND_KINDS.has(kind)) return kind as BonusKind;
  return null;
}

function readIndexes(hand: BonusHit): number[] {
  const raw =
    hand.cardIndexes ??
    (hand as BonusHit & { CardIndexes?: number[] }).CardIndexes ??
    [];
  return Array.isArray(raw) ? raw.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
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

export function CardSlots({
  cards,
  activeBonuses,
  newCardIndex,
  roundMultipliers,
  maxCards = 7,
  pendingSlot,
  showNextSlot,
}: CardSlotsProps) {
  const raw = activeBonuses[0] ?? null;
  const kind = raw ? normalizeKind(raw.kind as BonusHit['kind'] | number) : null;
  const indexes = raw ? readIndexes(raw) : [];
  const hot = new Set(indexes);
  const nextIndex = cards.length;
  const showPending = pendingSlot === 0 && cards.length === 0;

  const captionLeft = indexes.length > 0 ? Math.min(...indexes) : 0;
  const captionRight = indexes.length > 0 ? Math.max(...indexes) : 0;

  return (
    <div
      className="slots-board cascade-board"
      style={{ ['--cascade-count' as string]: maxCards }}
    >
      <div className="card-cascade" aria-label="Played cards">
        {showPending ? (
          <div className="cascade-item pending" style={{ zIndex: 1 }}>
            <div className="slot-frame">
              <CardBack />
            </div>
          </div>
        ) : (
          <>
            {cards.map((card, i) => {
              const inHand = hot.has(i);
              return (
                <div
                  key={i}
                  className={`cascade-item filled ${inHand ? 'hand-hot' : ''}`}
                  style={{ zIndex: i + 1 }}
                >
                  <div className="slot-frame">
                    {newCardIndex === i && i > 0 ? (
                      <DealingCard isNew>
                        <PlayingCard card={card} index={i} highlight={inHand ? kind : null} />
                      </DealingCard>
                    ) : (
                      <FlippingCard isNew={newCardIndex === i}>
                        <PlayingCard card={card} index={i} highlight={inHand ? kind : null} />
                      </FlippingCard>
                    )}
                  </div>
                </div>
              );
            })}

            {showNextSlot && nextIndex < maxCards && (
              <div className="cascade-item next" style={{ zIndex: nextIndex + 1 }}>
                <div className="slot-frame">
                  <div className={`slot-empty ${nextIndex === maxCards - 1 ? 'slot-empty-final' : ''}`}>
                    <span className={`slot-mult-in ${nextIndex === maxCards - 1 ? 'slot-mult-final' : ''}`}>
                      {slotMultLabel(nextIndex, roundMultipliers)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {kind && indexes.length > 0 && raw && (
        <div className="bonus-captions cascade-bonuses" aria-live="polite">
          <div
            className={`bonus-caption bonus-caption-${kind}`}
            style={{
              left: `calc(${captionLeft} * var(--cascade-step))`,
              width: `calc(${captionRight - captionLeft} * var(--cascade-step) + var(--card-w))`,
            }}
          >
            {formatBonusMult(raw.multiplier)}
          </div>
        </div>
      )}
    </div>
  );
}
