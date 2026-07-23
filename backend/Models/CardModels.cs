namespace HILO.Api.Models;

public enum Suit
{
    Hearts = 0,
    Diamonds = 1,
    Clubs = 2,
    Spades = 3
}

/// <summary>Rank 1 = Ace … 13 = King. Ace is high (14) for Higher/Lower comparisons.</summary>
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
    Flush,
    Straight,
    StraightFlush
}

public record BonusHit(BonusKind Kind, int Length, int Tier, decimal Multiplier);

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
    decimal[] FlushMultipliers,
    decimal[] StraightMultipliers,
    decimal[] StraightFlushMultipliers
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
    public const int MaxCards = 8;
}

public record SetBalanceRequest(decimal Balance);
public record StartGameRequest(decimal Bet);
public record GuessRequest(Guess Guess);
