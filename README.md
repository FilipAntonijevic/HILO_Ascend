# HILO Ascend

Online Higher/Lower casino game — ASP.NET Core API + React (Vite).

## Run

Terminal 1 — API:

```bash
export PATH="$HOME/.dotnet:$PATH"
cd backend
dotnet run --launch-profile http
```

Terminal 2 — UI:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Rules

- Bet from balance (editable textbox), then **Start** reveals the first card.
- Guess **Higher** or **Lower** (same rank = lose).
- Correct guess multiplies the pot by `m1`…`m6`.
- After the first win you may **Cash Out** or continue, up to **7 cards**.
- Bonuses use the **best poker hand** from up to 5 of the played cards (Ace high):
  - Pair ×1.15 · Two pair ×1.65 · Three of a kind / Straight / Flush ×4
  - Full house ×7 · Four of a kind / Straight flush / Royal flush ×16
  - Tuned for ~97% RTP with a ≥60% hit / otherwise cash-out strategy
- Bonus mult applies when the hand **upgrades**; losing on a card does not award a new hand.
