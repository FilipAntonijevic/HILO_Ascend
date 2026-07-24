import { AnimatePresence, motion } from 'framer-motion';
import type { BonusHit } from '../api';

interface BonusOverlayProps {
  bonuses: BonusHit[];
}

const kindClass: Record<string, string> = {
  Pair: 'bonus-pair',
  TwoPair: 'bonus-two-pair',
  ThreeOfAKind: 'bonus-trips',
  Straight: 'bonus-straight',
  Flush: 'bonus-flush',
  FullHouse: 'bonus-full-house',
  FourOfAKind: 'bonus-quads',
  StraightFlush: 'bonus-straight-flush',
  RoyalFlush: 'bonus-royal',
};

const kindLabel: Record<string, string> = {
  Pair: 'PAIR',
  TwoPair: 'TWO PAIR',
  ThreeOfAKind: 'THREE OF A KIND',
  Straight: 'STRAIGHT',
  Flush: 'FLUSH',
  FullHouse: 'FULL HOUSE',
  FourOfAKind: 'POKER',
  StraightFlush: 'STRAIGHT FLUSH',
  RoyalFlush: 'ROYAL FLUSH',
};

export function BonusOverlay({ bonuses }: BonusOverlayProps) {
  return (
    <div className="bonus-layer" aria-live="polite">
      <AnimatePresence>
        {bonuses.map((b) => (
          <motion.div
            key={`${b.kind}-${b.tier}-${b.multiplier}`}
            className={`bonus-toast ${kindClass[b.kind] ?? ''}`}
            initial={{ opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: -40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <motion.div
              className="bonus-ring"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            <div className="bonus-text">
              <span className="bonus-kind">{kindLabel[b.kind] ?? b.kind}</span>
              <span className="bonus-mult">×{b.multiplier}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
