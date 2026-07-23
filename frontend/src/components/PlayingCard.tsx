import { motion } from 'framer-motion';
import { isRed, rankLabel, suitSymbol, type Card } from '../api';

interface PlayingCardProps {
  card: Card;
  index: number;
  stacked: boolean;
  highlight?: 'straight' | 'flush' | 'straightFlush' | null;
  isNew?: boolean;
}

export function PlayingCard({ card, index, stacked, highlight, isNew }: PlayingCardProps) {
  const red = isRed(card.suit);
  const label = card.rankLabel || rankLabel(card.rank);
  const symbol = card.suitSymbol || suitSymbol(card.suit);

  return (
    <motion.div
      className={`playing-card ${stacked ? 'stacked' : 'spread'} ${highlight ? `hl-${highlight}` : ''}`}
      style={{ zIndex: index + 1, ['--i' as string]: index }}
      initial={isNew ? { rotateY: -90, opacity: 0, x: 40 } : false}
      animate={{ rotateY: 0, opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: isNew ? 0.05 : 0 }}
    >
      <div className="card-face">
        <div className={`card-corner top ${red ? 'red' : 'black'}`}>
          <span>{label}</span>
          <span>{symbol}</span>
        </div>
        <div className={`card-pip ${red ? 'red' : 'black'}`}>{symbol}</div>
        <div className={`card-corner bottom ${red ? 'red' : 'black'}`}>
          <span>{label}</span>
          <span>{symbol}</span>
        </div>
      </div>
    </motion.div>
  );
}
