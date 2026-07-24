import { isRed, rankLabel, suitSymbol, type Card } from '../api';

interface PlayingCardProps {
  card: Card;
  index: number;
  highlight?: 'straight' | 'flush' | 'straightFlush' | 'pair' | null;
  /** Cycle duration for manic up/down jiggle when part of a bonus run. */
  bounceMs?: number;
}

type PipSlot = { x: number; y: number; flip?: boolean };

function pipLayout(rank: number): PipSlot[] {
  const L = 28;
  const R = 72;
  const C = 50;
  const T = 14;
  const T2 = 28;
  const M = 50;
  const B2 = 72;
  const B = 86;

  switch (rank) {
    case 1:
      return [{ x: C, y: M }];
    case 2:
      return [
        { x: C, y: T },
        { x: C, y: B, flip: true },
      ];
    case 3:
      return [
        { x: C, y: T },
        { x: C, y: M },
        { x: C, y: B, flip: true },
      ];
    case 4:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 5:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: M },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 6:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: M },
        { x: R, y: M },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 7:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: T2 },
        { x: L, y: M },
        { x: R, y: M },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 8:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: T2 },
        { x: L, y: M },
        { x: R, y: M },
        { x: C, y: B2, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 9:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: T2 + 4 },
        { x: R, y: T2 + 4 },
        { x: C, y: M },
        { x: L, y: B2 - 4, flip: true },
        { x: R, y: B2 - 4, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case 10:
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: 22 },
        { x: L, y: T2 + 6 },
        { x: R, y: T2 + 6 },
        { x: L, y: B2 - 6, flip: true },
        { x: R, y: B2 - 6, flip: true },
        { x: C, y: 78, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    default:
      return [];
  }
}

export function PlayingCard({ card, index, highlight, bounceMs }: PlayingCardProps) {
  const red = isRed(card.suit);
  const color = red ? 'red' : 'black';
  const label = card.rankLabel || rankLabel(card.rank);
  const symbol = card.suitSymbol || suitSymbol(card.suit);
  const isFace = card.rank >= 11;
  const isAce = card.rank === 1;
  const pips = pipLayout(card.rank);
  const bounce = Boolean(highlight && bounceMs);

  return (
    <div
      className={`playing-card ${highlight ? `hl-${highlight}` : ''} ${bounce ? 'hl-bounce' : ''}`}
      style={{
        zIndex: index + 1,
        ...(bounce
          ? {
              ['--bounce-ms' as string]: `${bounceMs}ms`,
              ['--bounce-delay' as string]: `${(index % 3) * 35}ms`,
            }
          : null),
      }}
    >
      <div className={`card-face ${color}`}>
        <div className="card-corner top">
          <span className="corner-rank">{label}</span>
          <span className="corner-suit">{symbol}</span>
        </div>

        {isFace ? (
          <div className="card-court">
            <span className="court-letter">{label}</span>
            <span className="court-suit">{symbol}</span>
          </div>
        ) : (
          <div className={`card-pips ${isAce ? 'ace' : ''}`}>
            {pips.map((pip, i) => (
              <span
                key={i}
                className={`pip ${pip.flip ? 'flip' : ''}`}
                style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
              >
                {symbol}
              </span>
            ))}
          </div>
        )}

        <div className="card-corner bottom">
          <span className="corner-rank">{label}</span>
          <span className="corner-suit">{symbol}</span>
        </div>
      </div>
    </div>
  );
}
