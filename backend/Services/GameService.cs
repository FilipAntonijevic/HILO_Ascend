using System.Collections.Concurrent;
using HILO.Api.Models;

namespace HILO.Api.Services;

public class GameService
{
    public const int MaxCards = 7;

    /// <summary>Fixed round multipliers m1…m6 (cards 2…7). Last step jumps to ×2.</summary>
    public static readonly decimal[] RoundMult =
        [1.1m, 1.2m, 1.3m, 1.4m, 1.5m, 2.0m];

    /// <summary>Best 5-card poker hand multipliers (non-royal straight flush uses ×100).</summary>
    public static readonly IReadOnlyDictionary<BonusKind, decimal> HandMult =
        new Dictionary<BonusKind, decimal>
        {
            [BonusKind.Pair] = 2m,
            [BonusKind.TwoPair] = 5m,
            [BonusKind.ThreeOfAKind] = 10m,
            [BonusKind.Straight] = 20m,
            [BonusKind.Flush] = 25m,
            [BonusKind.FullHouse] = 50m,
            [BonusKind.FourOfAKind] = 250m,
            [BonusKind.StraightFlush] = 100m,
            [BonusKind.RoyalFlush] = 500m,
        };

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
        session.Message = "Guess Same-or-Higher or Same-or-Lower.";
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
        // Ties always win: Same-or-Higher / Same-or-Lower.
        var win = direction == Models.Guess.Higher ? cmp >= 0 : cmp <= 0;

        if (!win)
        {
            session.Pot = 0;
            session.CurrentMultiplier = 0;
            session.Phase = GamePhase.Lost;
            session.Message = "Wrong guess — pot lost.";
            session.LastBonuses = [];
            // Losing card must not create/show poker hand bonuses.
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
        handMultipliers = HandMult.ToDictionary(
            kv => kv.Key.ToString(),
            kv => kv.Value)
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

        for (var i = deck.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (deck[i], deck[j]) = (deck[j], deck[i]);
        }

        return deck;
    }

    private static Card Draw(GameSession session)
    {
        if (session.Deck.Count == 0)
            throw new InvalidOperationException("Deck exhausted.");
        var card = session.Deck[0];
        session.Deck.RemoveAt(0);
        return card;
    }

    /// <summary>
    /// Best poker hand using up to 5 cards from the played set (Ace high).
    /// </summary>
    public static List<BonusHit> DetectBonuses(IReadOnlyList<Card> cards)
    {
        var hit = EvaluateBestHand(cards);
        return hit is null ? [] : [hit];
    }

    private static List<BonusHit> SelectNewBonuses(List<BonusHit> previous, List<BonusHit> current)
    {
        if (current.Count == 0) return [];
        var next = current[0];
        if (previous.Count == 0) return [next];
        var prev = previous[0];
        // Upgrade only when the hand category improves.
        return next.Tier > prev.Tier ? [next] : [];
    }

    private static BonusHit? EvaluateBestHand(IReadOnlyList<Card> cards)
    {
        if (cards.Count < 2) return null;

        BonusHit? best = null;
        if (cards.Count >= 5)
        {
            foreach (var pick in Combinations(cards.Count, 5))
            {
                var scored = ScoreFive(
                    pick.Select(i => cards[i]).ToList(),
                    pick.ToList());
                if (scored is not null && (best is null || scored.Tier > best.Tier))
                    best = scored;
            }
        }
        else
        {
            // Fewer than 5 cards: only pair / two pair / trips / quads possible.
            best = ScorePartial(cards);
        }

        return best;
    }

    private static BonusHit? ScorePartial(IReadOnlyList<Card> cards)
    {
        var indexed = cards.Select((c, i) => (c, i)).ToList();
        var byRank = indexed.GroupBy(x => x.c.CompareValue)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Key)
            .ToList();

        var counts = byRank.Select(g => g.Count()).ToList();
        if (counts[0] >= 4)
        {
            var idxs = byRank[0].Select(x => x.i).Take(4).ToList();
            return Make(BonusKind.FourOfAKind, idxs);
        }

        if (counts[0] >= 3)
        {
            var idxs = byRank[0].Select(x => x.i).Take(3).ToList();
            return Make(BonusKind.ThreeOfAKind, idxs);
        }

        if (counts[0] >= 2 && counts.Count > 1 && counts[1] >= 2)
        {
            var idxs = byRank[0].Select(x => x.i).Take(2)
                .Concat(byRank[1].Select(x => x.i).Take(2))
                .ToList();
            return Make(BonusKind.TwoPair, idxs);
        }

        if (counts[0] >= 2)
        {
            var idxs = byRank[0].Select(x => x.i).Take(2).ToList();
            return Make(BonusKind.Pair, idxs);
        }

        return null;
    }

    private static BonusHit? ScoreFive(IReadOnlyList<Card> five, List<int> indexes)
    {
        var vals = five.Select(c => c.CompareValue).OrderByDescending(v => v).ToArray();
        var isFlush = five.All(c => c.Suit == five[0].Suit);
        var isStraight = IsStraight(vals);
        var isRoyal = isFlush && isStraight && vals.Contains(14) && vals.Contains(10);

        var byRank = five.Select((c, i) => (c, idx: indexes[i]))
            .GroupBy(x => x.c.CompareValue)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Key)
            .ToList();
        var counts = byRank.Select(g => g.Count()).ToArray();

        // Only highlight cards that define the hand (no kickers).
        List<int> Essential(params int[] takeCounts)
        {
            var list = new List<int>();
            for (var i = 0; i < takeCounts.Length; i++)
                list.AddRange(byRank[i].Select(x => x.idx).Take(takeCounts[i]));
            return list;
        }

        if (isRoyal)
            return Make(BonusKind.RoyalFlush, indexes);
        if (isFlush && isStraight)
            return Make(BonusKind.StraightFlush, indexes);
        if (counts[0] == 4)
            return Make(BonusKind.FourOfAKind, Essential(4));
        if (counts[0] == 3 && counts.Length > 1 && counts[1] == 2)
            return Make(BonusKind.FullHouse, Essential(3, 2));
        if (isFlush)
            return Make(BonusKind.Flush, indexes);
        if (isStraight)
            return Make(BonusKind.Straight, indexes);
        if (counts[0] == 3)
            return Make(BonusKind.ThreeOfAKind, Essential(3));
        if (counts[0] == 2 && counts.Length > 1 && counts[1] == 2)
            return Make(BonusKind.TwoPair, Essential(2, 2));
        if (counts[0] == 2)
            return Make(BonusKind.Pair, Essential(2));
        return null;
    }

    /// <summary>Ace-high only: 10-J-Q-K-A yes, A-2-3-4-5 no.</summary>
    private static bool IsStraight(int[] descendingUniqueOrNot)
    {
        var uniq = descendingUniqueOrNot.Distinct().OrderByDescending(v => v).ToArray();
        if (uniq.Length != 5) return false;
        return uniq[0] - uniq[4] == 4
               && uniq[0] - uniq[1] == 1
               && uniq[1] - uniq[2] == 1
               && uniq[2] - uniq[3] == 1
               && uniq[3] - uniq[4] == 1;
    }

    private static BonusHit Make(BonusKind kind, List<int> indexes)
    {
        var mult = HandMult[kind];
        var tier = (int)kind;
        return new BonusHit(kind, indexes.Count, tier, mult, indexes.OrderBy(i => i).ToList());
    }

    private static IEnumerable<int[]> Combinations(int n, int k)
    {
        var comb = new int[k];
        for (var i = 0; i < k; i++) comb[i] = i;
        while (true)
        {
            yield return (int[])comb.Clone();
            var t = k - 1;
            while (t >= 0 && comb[t] == n - k + t) t--;
            if (t < 0) yield break;
            comb[t]++;
            for (var i = t + 1; i < k; i++)
                comb[i] = comb[i - 1] + 1;
        }
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
            if ((Phase is GamePhase.Playing or GamePhase.CanCashOut)
                && Cards.Count > 0
                && Cards.Count < MaxCards
                && Deck.Count > 0)
            {
                var current = Cards[^1];
                var h = 0;
                var l = 0;
                var eq = 0;
                foreach (var c in Deck)
                {
                    var cmp = c.CompareValue.CompareTo(current.CompareValue);
                    if (cmp > 0) h++;
                    else if (cmp < 0) l++;
                    else eq++;
                }

                var rem = Deck.Count;
                // Same-or-Higher / Same-or-Lower include ties.
                higher = (double)(h + eq) / rem;
                lower = (double)(l + eq) / rem;
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
