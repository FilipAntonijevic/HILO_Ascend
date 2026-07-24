#!/usr/bin/env python3
"""Simulate HILO Ascend ROI: hit only when best side >= 60%, else cash out."""

from __future__ import annotations

import random
from collections import Counter
from itertools import combinations

N_GAMES = 5_000_000
THRESHOLD = 0.60
MAX_CARDS = 7
ROUND_MULT = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6]
HAND_MULT = {
    "Pair": 1.15,
    "TwoPair": 1.65,
    "ThreeOfAKind": 4.0,
    "Straight": 4.0,
    "Flush": 4.0,
    "FullHouse": 7.0,
    "FourOfAKind": 16.0,
    "StraightFlush": 16.0,
    "RoyalFlush": 16.0,
}
HAND_TIER = {
    "Pair": 1,
    "TwoPair": 2,
    "ThreeOfAKind": 3,
    "Straight": 4,
    "Flush": 5,
    "FullHouse": 6,
    "FourOfAKind": 7,
    "StraightFlush": 8,
    "RoyalFlush": 9,
}


def cv(rank: int) -> int:
    return 14 if rank == 1 else rank


def is_straight(vals_desc: list[int]) -> bool:
    uniq = sorted(set(vals_desc), reverse=True)
    if len(uniq) != 5:
        return False
    return (
        uniq[0] - uniq[4] == 4
        and uniq[0] - uniq[1] == 1
        and uniq[1] - uniq[2] == 1
        and uniq[2] - uniq[3] == 1
        and uniq[3] - uniq[4] == 1
    )


def score_five(five: list[tuple[int, int]]) -> tuple[str, int] | None:
    vals = [cv(r) for r, _ in five]
    suits = [s for _, s in five]
    flush = len(set(suits)) == 1
    vals_sorted = sorted(vals, reverse=True)
    straight = is_straight(vals_sorted)
    royal = flush and straight and 14 in vals and 10 in vals

    by_rank: dict[int, int] = Counter(vals)
    counts = sorted(by_rank.values(), reverse=True)

    if royal:
        return "RoyalFlush", HAND_TIER["RoyalFlush"]
    if flush and straight:
        return "StraightFlush", HAND_TIER["StraightFlush"]
    if counts[0] == 4:
        return "FourOfAKind", HAND_TIER["FourOfAKind"]
    if counts[0] == 3 and len(counts) > 1 and counts[1] == 2:
        return "FullHouse", HAND_TIER["FullHouse"]
    if flush:
        return "Flush", HAND_TIER["Flush"]
    if straight:
        return "Straight", HAND_TIER["Straight"]
    if counts[0] == 3:
        return "ThreeOfAKind", HAND_TIER["ThreeOfAKind"]
    if counts[0] == 2 and len(counts) > 1 and counts[1] == 2:
        return "TwoPair", HAND_TIER["TwoPair"]
    if counts[0] == 2:
        return "Pair", HAND_TIER["Pair"]
    return None


def score_partial(cards: list[tuple[int, int]]) -> tuple[str, int] | None:
    vals = [cv(r) for r, _ in cards]
    by_rank = Counter(vals)
    counts = sorted(by_rank.values(), reverse=True)
    if not counts:
        return None
    if counts[0] >= 4:
        return "FourOfAKind", HAND_TIER["FourOfAKind"]
    if counts[0] >= 3:
        return "ThreeOfAKind", HAND_TIER["ThreeOfAKind"]
    if counts[0] >= 2 and len(counts) > 1 and counts[1] >= 2:
        return "TwoPair", HAND_TIER["TwoPair"]
    if counts[0] >= 2:
        return "Pair", HAND_TIER["Pair"]
    return None


def best_hand(cards: list[tuple[int, int]]) -> tuple[str, int] | None:
    n = len(cards)
    if n < 2:
        return None
    best: tuple[str, int] | None = None
    if n >= 5:
        for combo in combinations(cards, 5):
            scored = score_five(list(combo))
            if scored and (best is None or scored[1] > best[1]):
                best = scored
    else:
        best = score_partial(cards)
    return best


def probs(cards: list[tuple[int, int]], remaining: list[tuple[int, int]]) -> tuple[float, float]:
    cur = cv(cards[-1][0])
    rem = len(remaining)
    if rem == 0:
        return 0.0, 0.0
    h = sum(1 for r, _ in remaining if cv(r) > cur)
    l = sum(1 for r, _ in remaining if cv(r) < cur)
    return h / rem, l / rem


def play_one(rng: random.Random) -> float:
    """Return payout multiple of bet (0 if lost)."""
    deck = [(r, s) for s in range(4) for r in range(1, 14)]
    rng.shuffle(deck)
    cards = [deck.pop()]
    pot = 1.0
    successes = 0
    prev_hand: tuple[str, int] | None = None
    can_cash = False

    while len(cards) < MAX_CARDS:
        ph, pl = probs(cards, deck)
        go_higher = ph >= pl
        p = ph if go_higher else pl

        # After first successful guess, cash out when below threshold.
        if can_cash and p < THRESHOLD:
            return pot

        # Otherwise must (or choose to) hit best side.
        nxt = deck.pop()
        cards.append(nxt)
        cmp = cv(nxt[0]) - cv(cards[-2][0])
        won = cmp > 0 if go_higher else cmp < 0
        if not won:
            return 0.0

        pot *= ROUND_MULT[successes]
        successes += 1

        hand = best_hand(cards)
        if hand and (prev_hand is None or hand[1] > prev_hand[1]):
            pot *= HAND_MULT[hand[0]]
            prev_hand = hand
        elif hand:
            prev_hand = hand  # same or worse tier still tracks current best display
            # only upgrade applies mult; keep prev_hand as max tier seen for upgrade check
            # Actually ActiveBonuses is current best; SelectNewBonuses compares tiers.
            # If new hand tier <= old, no mult. Update prev to current best for next compare:
            # previousBonuses = hand before this card; we already compared correctly.
            # After apply, session.ActiveBonuses = current. So prev_hand for NEXT round
            # should be current best hand after this card.
            prev_hand = hand
        else:
            prev_hand = None

        # Fix: SelectNewBonuses uses previous cards' best vs current cards' best.
        # My loop applied upgrade vs prev_hand which I set to previous best — good on first branch.
        # But in elif I shouldn't change upgrade logic. Let me restructure.

        can_cash = True

    return pot


def play_one_fixed(rng: random.Random) -> float:
    deck = [(r, s) for s in range(4) for r in range(1, 14)]
    rng.shuffle(deck)
    cards = [deck.pop()]
    pot = 1.0
    successes = 0
    can_cash = False

    while len(cards) < MAX_CARDS:
        ph, pl = probs(cards, deck)
        go_higher = ph >= pl
        p = ph if go_higher else pl

        if can_cash and p < THRESHOLD:
            return pot

        nxt = deck.pop()
        prev = cards[-1]
        cards.append(nxt)
        cmp = cv(nxt[0]) - cv(prev[0])
        won = cmp > 0 if go_higher else cmp < 0
        if not won:
            return 0.0

        pot *= ROUND_MULT[successes]
        successes += 1

        before = best_hand(cards[:-1])
        after = best_hand(cards)
        if after and (before is None or after[1] > before[1]):
            pot *= HAND_MULT[after[0]]

        can_cash = True

    return pot


def main() -> None:
    rng = random.Random(42)
    total_return = 0.0
    wins = 0
    losses = 0
    cashouts = 0
    maxed = 0
    hist = Counter()

    # Track outcomes roughly via return buckets
    for i in range(N_GAMES):
        ret = play_one_fixed(rng)
        total_return += ret
        if ret <= 0:
            losses += 1
        else:
            wins += 1
            if ret == 1.0:
                # shouldn't happen often (cash after at least one mult)
                hist["ret_1"] += 1
        if (i + 1) % 500_000 == 0:
            roi = total_return / (i + 1) - 1
            print(f"... {i+1:,} games  RTP={total_return/(i+1):.6f}  ROI={roi*100:.3f}%", flush=True)

    n = N_GAMES
    rtp = total_return / n
    roi = rtp - 1.0
    print()
    print(f"Games: {n:,}")
    print(f"Strategy: hit best side only if p >= {THRESHOLD:.0%}; else cash out (first guess always)")
    print(f"Round mults: {ROUND_MULT}")
    print(f"Hand mults: {HAND_MULT}")
    print(f"Total wagered: {n:,}")
    print(f"Total returned: {total_return:,.2f}")
    print(f"RTP: {rtp*100:.4f}%")
    print(f"ROI: {roi*100:.4f}%")
    print(f"Win rate (any return > 0): {wins/n*100:.2f}%")
    print(f"Loss rate: {losses/n*100:.2f}%")


if __name__ == "__main__":
    main()
