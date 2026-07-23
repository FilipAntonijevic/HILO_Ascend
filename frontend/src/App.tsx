import { useEffect, useMemo, useState } from 'react';
import { api, type GameConfig, type GameState } from './api';
import { BonusOverlay } from './components/BonusOverlay';
import { CardRow } from './components/CardRow';
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

  const inRound =
    state?.phase === 'Playing' ||
    state?.phase === 'CanCashOut';

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

  const nextRoundMult = useMemo(() => {
    if (!config || !state) return null;
    const i = state.successfulGuesses;
    if (i >= config.roundMultipliers.length) return null;
    return config.roundMultipliers[i];
  }, [config, state]);

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
      window.setTimeout(() => setNewCardIndex(null), 700);
    }
    if (next.lastBonuses?.length) {
      setFlashBonuses(next.lastBonuses);
    }
  }

  async function onSaveBalance() {
    const balance = Number(balanceInput);
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Enter a valid balance.');
      return;
    }
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

  const stats = (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-label">Balance</span>
        <span className="stat-value">{state ? state.balance.toFixed(2) : '—'}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Pot</span>
        <span className="stat-value accent">{state ? state.pot.toFixed(2) : '0.00'}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Mult</span>
        <span className="stat-value">
          ×{state ? state.currentMultiplier.toFixed(2) : '1.00'}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Cards</span>
        <span className="stat-value">
          {state?.cards.length ?? 0}/{config?.maxCards ?? 8}
        </span>
      </div>
    </div>
  );

  const setupControls = (
    <div className="setup-panel">
      <label className="field">
        <span>Balance</span>
        <div className="field-row">
          <input
            type="number"
            min={0}
            step={1}
            value={balanceInput}
            disabled={busy || inRound}
            onChange={(e) => setBalanceInput(e.target.value)}
          />
          <button type="button" className="btn ghost" disabled={busy || inRound} onClick={() => void onSaveBalance()}>
            Set
          </button>
        </div>
      </label>
      <label className="field">
        <span>Bet</span>
        <input
          type="number"
          min={0.01}
          step={1}
          value={betInput}
          disabled={busy || inRound}
          onChange={(e) => setBetInput(e.target.value)}
        />
      </label>
      {canStart && (
        <button type="button" className="btn primary start-btn" disabled={busy} onClick={() => void onStart()}>
          Start
        </button>
      )}
    </div>
  );

  const actionButtons = (
    <div className="action-bar">
      {canGuess && (
        <>
          <button
            type="button"
            className="btn lower"
            disabled={busy}
            onClick={() => void onGuess('Lower')}
          >
            Lower
            {nextRoundMult != null && <small>×{nextRoundMult.toFixed(2)}</small>}
          </button>
          <button
            type="button"
            className="btn higher"
            disabled={busy}
            onClick={() => void onGuess('Higher')}
          >
            Higher
            {nextRoundMult != null && <small>×{nextRoundMult.toFixed(2)}</small>}
          </button>
        </>
      )}
      {canCashOut && (
        <button type="button" className="btn cashout" disabled={busy} onClick={() => void onCashOut()}>
          Cash Out
        </button>
      )}
      {(state?.phase === 'Lost' || state?.phase === 'Won' || state?.phase === 'MaxReached' || state?.phase === 'Idle') &&
        !inRound && (
          <p className="hint-msg">{state?.message}</p>
        )}
    </div>
  );

  return (
    <div className={`app-shell ${mobile ? 'mobile' : 'desktop'}`}>
      <header className="top-brand">
        <h1 className="brand">HILO Ascend</h1>
        <p className="tagline">Strict higher or lower — climb to eight.</p>
      </header>

      {mobile && stats}

      <main className="stage">
        {!mobile && (
          <aside className="side-panel">
            {stats}
            {setupControls}
            {config && (
              <div className="mult-legend">
                <h3>Bonuses</h3>
                <p>
                  <span className="swatch straight" /> Straight s1–s8
                </p>
                <p>
                  <span className="swatch flush" /> Flush f1–f8
                </p>
                <p>
                  <span className="swatch sf" /> Straight flush
                </p>
              </div>
            )}
          </aside>
        )}

        <section className="table">
          <BonusOverlay bonuses={flashBonuses} />
          {state && state.cards.length > 0 ? (
            <CardRow
              cards={state.cards}
              stacked={mobile}
              activeBonuses={state.activeBonuses}
              newCardIndex={newCardIndex}
            />
          ) : (
            <div className="empty-table">Place a bet and press Start</div>
          )}
          {state?.message && inRound && <p className="table-msg">{state.message}</p>}
          {error && <p className="error-msg">{error}</p>}
        </section>
      </main>

      {mobile ? (
        <footer className="mobile-dock">
          {!inRound && setupControls}
          {actionButtons}
        </footer>
      ) : (
        <footer className="desktop-actions">{actionButtons}</footer>
      )}
    </div>
  );
}
