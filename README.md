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
- Bonuses on consecutive cards:
  - **Flush** (3+) → `f1`…`f8` (orange)
  - **Straight** up/down (3+) → `s1`…`s8` (light blue)
  - **Straight flush** → `sf` multipliers (both colors); a longer plain straight beyond the SF still counts (e.g. `1234♥` + `5♠` → SF4 + S5).
