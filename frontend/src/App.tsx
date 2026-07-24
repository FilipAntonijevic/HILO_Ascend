import { useEffect, useState } from 'react';
import { api, type GameConfig, type GameState } from './api';
import { BonusOverlay } from './components/BonusOverlay';
import { CardSlots } from './components/CardSlots';
import './App.css';

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return mobile;
}

function formatProb(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

export default function App() {
  const mobile = useIsMobile();
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [balanceInput, setBalanceInput] = useState('1000');
  const [betInput, setBetInput] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashBonuses, setFlashBonuses] = useState<GameState['lastBonuses']>([]);
  const [newCardIndex, setNewCardIndex] = useState<number | null>(null);

  const inRound = state?.phase === 'Playing' || state?.phase === 'CanCashOut';
  const canGuess = state?.phase === 'Playing' || state?.phase === 'CanCashOut';
  const canCashOut = state?.phase === 'CanCashOut';
  const canStart = !inRound;

  useEffect(() => {
    void (async () => {
      try {
        const [s, c] = await Promise.all([api.state(), api.config()]);
        setState(s);
        setConfig(c);
        setBalanceInput(String(s.balance));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, []);

  useEffect(() => {
    if (!flashBonuses.length) return;
    const t = window.setTimeout(() => setFlashBonuses([]), 2200);
    return () => window.clearTimeout(t);
  }, [flashBonuses]);

  async function run<T>(fn: () => Promise<T>, after?: (v: T) => void) {
    setBusy(true);
    setError(null);
    try {
      const v = await fn();
      after?.(v);
      return v;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function applyState(next: GameState, animateCard: boolean) {
    setState(next);
    setBalanceInput(String(next.balance));
    if (animateCard && next.cards.length > 0) {
      setNewCardIndex(next.cards.length - 1);
      window.setTimeout(() => setNewCardIndex(null), 900);
    }
    // Only flash special mult toasts when the guess actually won.
    if (next.phase !== 'Lost' && next.lastBonuses?.length) {
      setFlashBonuses(next.lastBonuses);
    } else if (next.phase === 'Lost') {
      setFlashBonuses([]);
    }
  }

  async function commitBalance() {
    if (inRound || busy) return;
    const balance = Number(balanceInput);
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Enter a valid balance.');
      return;
    }
    if (state && balance === state.balance) return;
    await run(() => api.setBalance(balance), (s) => applyState(s, false));
  }

  async function onStart() {
    const bet = Number(betInput);
    if (!Number.isFinite(bet) || bet <= 0) {
      setError('Enter a valid bet.');
      return;
    }
    if (state && bet > state.balance) {
      setError('Bet cannot exceed balance.');
      return;
    }
    await run(() => api.start(bet), (s) => applyState(s, true));
  }

  async function onGuess(guess: 'Higher' | 'Lower') {
    await run(() => api.guess(guess), (s) => applyState(s, true));
  }

  async function onCashOut() {
    await run(() => api.cashOut(), (s) => applyState(s, false));
  }

  const sessionMult = state?.currentMultiplier ?? 1;
  const sessionReturn = state?.pot ?? 0;
  const cardCount = state?.cards.length ?? 0;
  const maxCards = config?.maxCards ?? 8;
  const roundMults = config?.roundMultipliers ?? [];

  /** Face-down only while waiting for the first Start. */
  const pendingSlot = canStart && cardCount === 0 ? 0 : null;
  /** Only the next empty seat (to the right), hidden while a new card is sliding in. */
  const showNextSlot = inRound && cardCount > 0 && cardCount < maxCards && newCardIndex === null;

  return (
    <div className={`app-shell ${mobile ? 'mobile' : 'desktop'}`}>
      <header className="top-brand">
        <h1 className="brand">HILO Ascend</h1>
        <p className="tagline">Strict higher or lower — climb to eight.</p>
      </header>

      <div className="balance-banner">
        <span className="balance-label">Balance</span>
        <input
          className="balance-input"
          type="number"
          min={0}
          step={1}
          aria-label="Balance"
          value={balanceInput}
          disabled={busy || inRound}
          onChange={(e) => setBalanceInput(e.target.value)}
          onBlur={() => void commitBalance()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <section className="table">
        <div className="cards-progress">
          {cardCount}/{maxCards}
        </div>
        <BonusOverlay bonuses={flashBonuses} />
        <CardSlots
          cards={state?.cards ?? []}
          activeBonuses={state?.activeBonuses ?? []}
          newCardIndex={newCardIndex}
          roundMultipliers={roundMults}
          maxCards={maxCards}
          pendingSlot={pendingSlot}
          showNextSlot={showNextSlot}
        />
        {state?.message && inRound && <p className="table-msg">{state.message}</p>}
        {error && <p className="error-msg">{error}</p>}
      </section>

      <div className="session-row" aria-label="Session stake">
        <div className="session-cell bet-cell">
          <input
            className="bet-inline"
            type="number"
            min={0.01}
            step={1}
            aria-label="Bet"
            value={inRound ? String(state?.bet ?? betInput) : betInput}
            disabled={busy || inRound}
            onChange={(e) => setBetInput(e.target.value)}
          />
        </div>
        <div className="session-divider" aria-hidden />
        <div className="session-cell">
          <span className="stat-label">Mult</span>
          <span className="stat-value">×{sessionMult.toFixed(2)}</span>
        </div>
        <div className="session-divider" aria-hidden />
        <div className="session-cell return-cell">
          <span className="stat-label">Return</span>
          <span className="return-value">{sessionReturn.toFixed(2)}</span>
        </div>
      </div>

      <footer className={mobile ? 'mobile-dock' : 'desktop-actions'}>
        {canStart && (
          <button type="button" className="btn primary start-btn" disabled={busy} onClick={() => void onStart()}>
            Start
          </button>
        )}

        {canGuess && (
          <div className="action-bar">
            <button type="button" className="btn lower" disabled={busy} onClick={() => void onGuess('Lower')}>
              Lower
              <small>{formatProb(state?.lowerProbability)}</small>
            </button>
            <button type="button" className="btn higher" disabled={busy} onClick={() => void onGuess('Higher')}>
              Higher
              <small>{formatProb(state?.higherProbability)}</small>
            </button>
            <button
              type="button"
              className={`btn cashout ${canCashOut ? 'is-visible' : 'is-hidden'}`}
              disabled={busy || !canCashOut}
              tabIndex={canCashOut ? 0 : -1}
              aria-hidden={!canCashOut}
              onClick={() => void onCashOut()}
            >
              Cash Out
            </button>
          </div>
        )}

        {(state?.phase === 'Lost' || state?.phase === 'Won' || state?.phase === 'MaxReached' || state?.phase === 'Idle') &&
          !inRound &&
          state?.message && <p className="hint-msg">{state.message}</p>}
      </footer>
    </div>
  );
}
