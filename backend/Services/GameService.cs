using System.Collections.Concurrent;
using HILO.Api.Models;

namespace HILO.Api.Services;

public class GameService
{
    public const int MaxCards = 8;

    /// <summary>Fixed round multipliers m1…m7 (cards 2…8). Last step jumps to ×2.</summary>
    public static readonly decimal[] RoundMult =
        [1.1m, 1.2m, 1.3m, 1.4m, 1.5m, 1.6m, 2.0m];

    /// <summary>f1…f8 for flush lengths 3…10: 1.5, 3, 4.5, … (+1.5 each).</summary>
    public static readonly decimal[] FlushMult =
        [1.5m, 3m, 4.5m, 6m, 7.5m, 9m, 10.5m, 12m];

    /// <summary>s1…s8 for straight lengths 3…10: 3, 6, 9, … (+3 each).</summary>
    public static readonly decimal[] StraightMult =
        [3m, 6m, 9m, 12m, 15m, 18m, 21m, 24m];

    /// <summary>Straight flush = flush × straight.</summary>
    public static readonly decimal[] StraightFlushMult =
        [4.5m, 18m, 40.5m, 72m, 112.5m, 162m, 220.5m, 288m];

    private readonly ConcurrentDictionary<string, GameSession> _sessions = new();

    public GameState GetOrCreate(string sessionId)
    {
        var session = _sessions.GetOrAdd(sessionId, id => new GameSession(id));
        return session.ToState();
    }

    public GameState SetBalance(string sessionId, decimal balance)
    {
        if (balance < 0) throw new InvalidOperationException("Balance cannot be negative.");
        var session = _sessions.GetOrAdd(sessionId, id => new GameSession(id));
        if (session.Phase is GamePhase.Playing or GamePhase.CanCashOut)
            throw new InvalidOperationException("Cannot change balance during an active game.");
        session.Balance = Math.Round(balance, 2);
        session.Message = "Balance updated.";
        return session.ToState();
    }

    public GameState Start(string sessionId, decimal bet)
    {
        var session = _sessions.GetOrAdd(sessionId, id => new GameSession(id));
        if (session.Phase is GamePhase.Playing or GamePhase.CanCashOut)
            throw new InvalidOperationException("Game already in progress.");
        if (bet <= 0) throw new InvalidOperationException("Bet must be positive.");
        if (bet > session.Balance)
            throw new InvalidOperationException("Bet cannot exceed balance.");

        session.ResetRound();
        session.Bet = Math.Round(bet, 2);
        session.Balance = Math.Round(session.Balance - session.Bet, 2);
        session.Pot = session.Bet;
        session.CurrentMultiplier = 1m;
        session.Deck = BuildShuffledDeck();
        session.Cards.Add(Draw(session));
        session.Phase = GamePhase.Playing;
        session.Message = "Guess Higher or Lower.";
        session.LastBonuses = [];
        session.ActiveBonuses = [];
        return session.ToState();
    }

    public GameState MakeGuess(string sessionId, Guess direction)
    {
        var session = RequireActive(sessionId);
        if (session.Cards.Count >= MaxCards)
            throw new InvalidOperationException("Maximum cards reached.");

        var previous = session.Cards[^1];
        var next = Draw(session);
        session.Cards.Add(next);

        var cmp = next.CompareValue.CompareTo(previous.CompareValue);
        var win = direction == Models.Guess.Higher ? cmp > 0 : cmp < 0;

        if (!win)
        {
            session.Pot = 0;
            session.CurrentMultiplier = 0;
            session.Phase = GamePhase.Lost;
            session.Message = cmp == 0
                ? "Same rank — you lose. Strict Higher/Lower only."
                : "Wrong guess — pot lost.";
            session.LastBonuses = [];
            // Losing card must not create/show flush/straight special mults.
            session.ActiveBonuses = DetectBonuses(session.Cards.Take(session.Cards.Count - 1).ToList());
            return session.ToState();
        }

        var roundIndex = session.SuccessfulGuesses; // 0 → m1
        var roundMult = RoundMult[roundIndex];
        session.SuccessfulGuesses++;
        session.Pot = Math.Round(session.Pot * roundMult, 2);
        session.CurrentMultiplier = Math.Round(session.CurrentMultiplier * roundMult, 4);

        var bonuses = DetectBonuses(session.Cards);
        session.ActiveBonuses = bonuses;

        // Apply only bonuses that are newly achieved / upgraded vs previous card count
        var previousBonuses = DetectBonuses(session.Cards.Take(session.Cards.Count - 1).ToList());
        var applied = SelectNewBonuses(previousBonuses, bonuses);
        session.LastBonuses = applied;

        foreach (var bonus in applied)
        {
            session.Pot = Math.Round(session.Pot * bonus.Multiplier, 2);
            session.CurrentMultiplier = Math.Round(session.CurrentMultiplier * bonus.Multiplier, 4);
            session.HadBonus = true;
        }

        if (session.Cards.Count >= MaxCards)
        {
            session.Balance = Math.Round(session.Balance + session.Pot, 2);
            session.Phase = GamePhase.MaxReached;
            session.Message = applied.Count > 0
                ? $"Max cards! Bonus hit + cashed {session.Pot:0.00}."
                : $"Max cards reached! You win {session.Pot:0.00}.";
        }
        else
        {
            session.Phase = GamePhase.CanCashOut;
            session.Message = applied.Count > 0
                ? "Bonus! Cash out or continue."
                : "Correct! Cash out or continue.";
        }

        return session.ToState();
    }

    public GameState CashOut(string sessionId)
    {
        var session = _sessions.GetOrAdd(sessionId, id => new GameSession(id));
        if (session.Phase != GamePhase.CanCashOut)
            throw new InvalidOperationException("Cannot cash out now.");

        session.Balance = Math.Round(session.Balance + session.Pot, 2);
        session.Phase = GamePhase.Won;
        session.Message = $"Cashed out {session.Pot:0.00}.";
        return session.ToState();
    }

    public object GetConfig() => new
    {
        maxCards = MaxCards,
        roundMultipliers = RoundMult,
        flushMultipliers = FlushMult,
        straightMultipliers = StraightMult,
        straightFlushMultipliers = StraightFlushMult
    };

    private GameSession RequireActive(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
            throw new InvalidOperationException("Session not found.");
        if (session.Phase is not (GamePhase.Playing or GamePhase.CanCashOut))
            throw new InvalidOperationException("No active round.");
        return session;
    }

    private static List<Card> BuildShuffledDeck()
    {
        var deck = new List<Card>(52);
        foreach (Suit suit in Enum.GetValues<Suit>())
        {
            for (var rank = 1; rank <= 13; rank++)
                deck.Add(new Card(rank, suit));
        }

        // Fisher–Yates
        for (var i = deck.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (deck[i], deck[j]) = (deck[j], deck[i]);
        }

        return deck;
    }

    private static Card Draw(GameSession session)
    {
        // Single 52-card deck per round; reshuffled only on Start.
        if (session.Deck.Count == 0)
            throw new InvalidOperationException("Deck exhausted.");
        var card = session.Deck[0];
        session.Deck.RemoveAt(0);
        return card;
    }

    /// <summary>
    /// Detect flush / straight / straight-flush on consecutive cards.
    /// Ace is always low (A-2-3 counts; Q-K-A does not).
    /// Straight flush segments get SF mult; a longer plain straight beyond SF
    /// still counts (e.g. 1234♥ + 5♠ → SF4 + S5).
    /// </summary>
    public static List<BonusHit> DetectBonuses(IReadOnlyList<Card> cards)
    {
        if (cards.Count < 3) return [];

        var bestSf = LongestStraightFlush(cards);
        var bestFlush = LongestFlush(cards);
        var bestStraight = LongestStraight(cards);

        var hits = new List<BonusHit>();

        if (bestSf >= 3)
            hits.Add(MakeBonus(BonusKind.StraightFlush, bestSf, StraightFlushMult));

        // Flush only if longer than any SF (otherwise SF already covers those cards)
        if (bestFlush >= 3 && bestFlush > bestSf)
            hits.Add(MakeBonus(BonusKind.Flush, bestFlush, FlushMult));

        // Straight if longer than SF — the extra cards still count
        if (bestStraight >= 3 && bestStraight > bestSf)
            hits.Add(MakeBonus(BonusKind.Straight, bestStraight, StraightMult));
        else if (bestStraight >= 3 && bestSf < 3)
            hits.Add(MakeBonus(BonusKind.Straight, bestStraight, StraightMult));

        return hits;
    }

    private static List<BonusHit> SelectNewBonuses(List<BonusHit> previous, List<BonusHit> current)
    {
        var applied = new List<BonusHit>();
        foreach (var hit in current)
        {
            var prev = previous.FirstOrDefault(p => p.Kind == hit.Kind);
            if (prev is null || hit.Length > prev.Length)
                applied.Add(hit);
        }
        return applied;
    }

    private static BonusHit MakeBonus(BonusKind kind, int length, decimal[] table)
    {
        var tier = Math.Clamp(length - 2, 1, table.Length); // length 3 → tier 1
        var mult = table[tier - 1];
        return new BonusHit(kind, length, tier, mult);
    }

    private static int LongestFlush(IReadOnlyList<Card> cards)
    {
        var best = 1;
        var run = 1;
        for (var i = 1; i < cards.Count; i++)
        {
            if (cards[i].Suit == cards[i - 1].Suit) run++;
            else run = 1;
            best = Math.Max(best, run);
        }
        return best;
    }

    private static int LongestStraight(IReadOnlyList<Card> cards)
    {
        var values = cards.Select(c => c.Rank).ToArray();
        return LongestMonotonicRun(values);
    }

    private static int LongestMonotonicRun(int[] values)
    {
        if (values.Length == 0) return 0;
        var best = 1;
        var up = 1;
        var down = 1;
        for (var i = 1; i < values.Length; i++)
        {
            if (values[i] == values[i - 1] + 1) { up++; down = 1; }
            else if (values[i] == values[i - 1] - 1) { down++; up = 1; }
            else { up = 1; down = 1; }
            best = Math.Max(best, Math.Max(up, down));
        }
        return best;
    }

    private static int LongestStraightFlush(IReadOnlyList<Card> cards)
    {
        var best = 1;
        var i = 0;
        while (i < cards.Count)
        {
            var j = i + 1;
            while (j < cards.Count && cards[j].Suit == cards[i].Suit) j++;
            var segment = cards.Skip(i).Take(j - i).ToList();
            if (segment.Count >= 2)
            {
                var ranks = segment.Select(c => c.Rank).ToArray();
                best = Math.Max(best, LongestMonotonicRun(ranks));
            }
            i = j;
        }
        return best;
    }

    private sealed class GameSession(string sessionId)
    {
        public string SessionId { get; } = sessionId;
        public decimal Balance { get; set; } = 1000m;
        public decimal Bet { get; set; }
        public decimal Pot { get; set; }
        public decimal CurrentMultiplier { get; set; } = 1m;
        public GamePhase Phase { get; set; } = GamePhase.Idle;
        public List<Card> Cards { get; set; } = [];
        public List<Card> Deck { get; set; } = [];
        public List<BonusHit> LastBonuses { get; set; } = [];
        public List<BonusHit> ActiveBonuses { get; set; } = [];
        public int SuccessfulGuesses { get; set; }
        public bool HadBonus { get; set; }
        public string? Message { get; set; }

        public void ResetRound()
        {
            Bet = 0;
            Pot = 0;
            CurrentMultiplier = 1m;
            Cards = [];
            Deck = [];
            LastBonuses = [];
            ActiveBonuses = [];
            SuccessfulGuesses = 0;
            HadBonus = false;
            Message = null;
        }

        public GameState ToState()
        {
            double? higher = null;
            double? lower = null;
            if (Phase is GamePhase.Playing or GamePhase.CanCashOut
                && Cards.Count > 0
                && Cards.Count < MaxCards
                && Deck.Count > 0)
            {
                var current = Cards[^1];
                var h = 0;
                var l = 0;
                foreach (var c in Deck)
                {
                    if (c.Rank > current.Rank) h++;
                    else if (c.Rank < current.Rank) l++;
                }

                var rem = Deck.Count;
                higher = (double)h / rem;
                lower = (double)l / rem;
            }

            return new GameState
            {
                SessionId = SessionId,
                Balance = Balance,
                Bet = Bet,
                Pot = Pot,
                CurrentMultiplier = CurrentMultiplier,
                Phase = Phase,
                Cards = Cards.ToList(),
                LastBonuses = LastBonuses.ToList(),
                ActiveBonuses = ActiveBonuses.ToList(),
                SuccessfulGuesses = SuccessfulGuesses,
                Message = Message,
                HigherProbability = higher,
                LowerProbability = lower
            };
        }
    }
}
