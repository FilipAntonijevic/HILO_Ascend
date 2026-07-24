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
  showNextSlot: boolean;
}

type Highlight = 'straight' | 'flush' | 'straightFlush' | 'pair' | null;

const HAND_HIGHLIGHT: Record<string, Highlight> = {
  Pair: 'pair',
  TwoPair: 'pair',
  ThreeOfAKind: 'pair',
  FullHouse: 'pair',
  FourOfAKind: 'pair',
  Straight: 'straight',
  Flush: 'flush',
  StraightFlush: 'straightFlush',
  RoyalFlush: 'straightFlush',
};

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

/** Longer / stronger hand → faster bounce. Tier 1→~420ms, tier 9→~140ms. */
function bounceDurationMs(tier: number): number {
  const t = Math.min(Math.max(tier, 1), 9);
  return Math.round(420 - (t - 1) * 35);
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
  const hand = activeBonuses[0] ?? null;
  const hot = new Set(hand?.cardIndexes ?? []);
  const hlKind = hand ? (HAND_HIGHLIGHT[hand.kind] ?? 'pair') : null;
  const bounceMs = hand ? bounceDurationMs(hand.tier) : undefined;
  const nextIndex = cards.length;
  const showPending = pendingSlot === 0 && cards.length === 0;
  const itemCount = showPending ? 1 : cards.length + (showNextSlot ? 1 : 0);

  const captionLeft =
    hand && hand.cardIndexes.length > 0
      ? Math.min(...hand.cardIndexes)
      : 0;
  const captionRight =
    hand && hand.cardIndexes.length > 0
      ? Math.max(...hand.cardIndexes)
      : 0;

  return (
    <div
      className="slots-board cascade-board"
      style={{ ['--cascade-count' as string]: Math.max(itemCount, 1) }}
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
                <div key={i} className="cascade-item filled" style={{ zIndex: i + 1 }}>
                  <div className="slot-frame">
                    {newCardIndex === i && i > 0 ? (
                      <DealingCard isNew>
                        <PlayingCard
                          card={card}
                          index={i}
                          highlight={inHand ? hlKind : null}
                          bounceMs={inHand ? bounceMs : undefined}
                        />
                      </DealingCard>
                    ) : (
                      <FlippingCard isNew={newCardIndex === i}>
                        <PlayingCard
                          card={card}
                          index={i}
                          highlight={inHand ? hlKind : null}
                          bounceMs={inHand ? bounceMs : undefined}
                        />
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

      {hand && (
        <div className="bonus-captions cascade-bonuses" aria-live="polite">
          <div
            className={`bonus-caption bonus-caption-${hand.kind}`}
            style={{
              left: `calc(${captionLeft} * var(--card-w) * 0.5)`,
              width: `calc(${captionRight - captionLeft} * var(--card-w) * 0.5 + var(--card-w))`,
            }}
          >
            {formatBonusMult(hand.multiplier)}
          </div>
        </div>
      )}
    </div>
  );
}
