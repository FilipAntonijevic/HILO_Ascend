namespace HILO.Api.Models;

public enum Suit
{
    Hearts = 0,
    Diamonds = 1,
    Clubs = 2,
    Spades = 3
}

/// <summary>Rank 1 = Ace (highest) … 13 = King. Ace compares as 14.</summary>
public record Card(int Rank, Suit Suit)
{
    public int CompareValue => Rank == 1 ? 14 : Rank;

    public string RankLabel => Rank switch
    {
        1 => "A",
        11 => "J",
        12 => "Q",
        13 => "K",
        _ => Rank.ToString()
    };

    public string SuitSymbol => Suit switch
    {
        Suit.Hearts => "♥",
        Suit.Diamonds => "♦",
        Suit.Clubs => "♣",
        Suit.Spades => "♠",
        _ => "?"
    };

    public bool IsRed => Suit is Suit.Hearts or Suit.Diamonds;
}

public enum BonusKind
{
    Pair = 1,
    TwoPair = 2,
    ThreeOfAKind = 3,
    Straight = 4,
    Flush = 5,
    FullHouse = 6,
    FourOfAKind = 7,
    StraightFlush = 8,
    RoyalFlush = 9
}

public record BonusHit(
    BonusKind Kind,
    int Length,
    int Tier,
    decimal Multiplier,
    List<int> CardIndexes
);

public enum Guess
{
    Higher,
    Lower
}

public enum GamePhase
{
    Idle,
    Playing,
    CanCashOut,
    Won,
    Lost,
    MaxReached
}

public record MultiplierConfig(
    decimal[] RoundMultipliers,
    IReadOnlyDictionary<string, decimal> HandMultipliers
);

public class GameState
{
    public string SessionId { get; set; } = "";
    public decimal Balance { get; set; }
    public decimal Bet { get; set; }
    public decimal Pot { get; set; }
    public decimal CurrentMultiplier { get; set; } = 1m;
    public GamePhase Phase { get; set; } = GamePhase.Idle;
    public List<Card> Cards { get; set; } = [];
    public List<BonusHit> LastBonuses { get; set; } = [];
    public List<BonusHit> ActiveBonuses { get; set; } = [];
    public int SuccessfulGuesses { get; set; }
    public string? Message { get; set; }
    /// <summary>P(next &gt; current) from remaining deck, or null if not guessing.</summary>
    public double? HigherProbability { get; set; }
    /// <summary>P(next &lt; current) from remaining deck, or null if not guessing.</summary>
    public double? LowerProbability { get; set; }
    public const int MaxCards = 7;
}

public record SetBalanceRequest(decimal Balance);
public record StartGameRequest(decimal Bet);
public record GuessRequest(Guess Guess);
