import { AnimatePresence, motion } from 'framer-motion';
import type { BonusHit } from '../api';

interface BonusOverlayProps {
  bonuses: BonusHit[];
}

const kindClass: Record<string, string> = {
  Straight: 'bonus-straight',
  Flush: 'bonus-flush',
  StraightFlush: 'bonus-straight-flush',
};

const kindLabel: Record<string, string> = {
  Straight: 'STRAIGHT',
  Flush: 'FLUSH',
  StraightFlush: 'STRAIGHT FLUSH',
};

export function BonusOverlay({ bonuses }: BonusOverlayProps) {
  return (
    <div className="bonus-layer" aria-live="polite">
      <AnimatePresence>
        {bonuses.map((b) => (
          <motion.div
            key={`${b.kind}-${b.length}-${b.tier}`}
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
              <span className="bonus-kind">
                {kindLabel[b.kind]} {b.length}
              </span>
              <span className="bonus-mult">×{b.multiplier.toFixed(2)}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
