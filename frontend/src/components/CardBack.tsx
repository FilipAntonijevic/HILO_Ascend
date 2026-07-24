import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function CardBack() {
  return (
    <div className="playing-card card-back" aria-hidden>
      <div className="card-back-face">
        <div className="card-back-pattern" />
        <span className="card-back-mark">HILO</span>
      </div>
    </div>
  );
}

/** Flip in place (Start: pending face-down → face-up). */
export function FlippingCard({
  children,
  isNew,
}: {
  children: ReactNode;
  isNew?: boolean;
}) {
  return (
    <motion.div
      className="flip-wrap"
      initial={isNew ? { rotateY: 180 } : false}
      animate={{ rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="flip-face flip-front">{children}</div>
      <div className="flip-face flip-back">
        <CardBack />
      </div>
    </motion.div>
  );
}

/** Arrive from the side + flip at once (Higher/Lower deals). */
export function DealingCard({
  children,
  isNew,
}: {
  children: ReactNode;
  isNew?: boolean;
}) {
  return (
    <motion.div
      className="flip-wrap"
      initial={isNew ? { rotateY: 180, x: 40, opacity: 0, scale: 0.92 } : false}
      animate={{ rotateY: 0, x: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    >
      <div className="flip-face flip-front">{children}</div>
      <div className="flip-face flip-back">
        <CardBack />
      </div>
    </motion.div>
  );
}
