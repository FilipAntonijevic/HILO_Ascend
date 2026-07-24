#!/usr/bin/env python3
"""
Fit dynamic-odds RTP factor R (mult = R / p_win) + bonus tables
so always-continue optimal-side RTP == 97%.

Without bonuses, E[return] = R^7.
Bonuses increase that; we solve for R.
"""

from __future__ import annotations

import random

TARGET = 0.97
MAX_CARDS = 8
GUESSES = MAX_CARDS - 1  # 7

FLUSH_RAW = [1.10, 1.18, 1.28, 1.42, 1.62, 1.90, 2.30, 2.90]
STRAIGHT_RAW = [1.12, 1.22, 1.35, 1.55, 1.85, 2.25, 2.85, 3.70]
SF_RAW = [1.25, 1.45, 1.75, 2.20, 2.90, 4.00, 5.60, 8.00]
BONUS_SCALE = 0.50


def log(m):
    print(m, flush=True)


def scale_juice(raw, s):
    return [1.0 + (x - 1.0) * s for x in raw]


def longest_mono(vals):
    best = up = down = 1
    for i in range(1, len(vals)):
        if vals[i] == vals[i - 1] + 1:
            up += 1
            down = 1
        elif vals[i] == vals[i - 1] - 1:
            down += 1
            up = 1
        else:
            up = down = 1
        best = max(best, up, down)
    return best


def longest_flush(suits):
    best = run = 1
    for i in range(1, len(suits)):
        run = run + 1 if suits[i] == suits[i - 1] else 1
        best = max(best, run)
    return best


def longest_sf(ranks, suits):
    best = 1
    i = 0
    n = len(ranks)
    while i < n:
        j = i + 1
        while j < n and suits[j] == suits[i]:
            j += 1
        if j - i >= 2:
            best = max(best, longest_mono(ranks[i:j]))
        i = j
    return best


def detect(ranks, suits, ft, st, sft):
    if len(ranks) < 3:
        return []
    sf = longest_sf(ranks, suits)
    fl = longest_flush(suits)
    sr = longest_mono(ranks)
    hits = []

    def add(kind, length, table):
        if length < 3:
            return
        tier = min(max(length - 2, 1), len(table))
        hits.append((kind, length, table[tier - 1]))

    if sf >= 3:
        add("SF", sf, sft)
    if fl >= 3 and fl > sf:
        add("F", fl, ft)
    if sr >= 3 and sr > sf:
        add("S", sr, st)
    elif sr >= 3 and sf < 3:
        add("S", sr, st)
    return hits


def select_new(prev, cur):
    out = []
    for h in cur:
        old = next((p for p in prev if p[0] == h[0]), None)
        if old is None or h[1] > old[1]:
            out.append(h)
    return out


def rtp_dynamic(R: float, bscale: float, n: int, seed: int) -> float:
    rnd = random.Random(seed)
    ft = scale_juice(FLUSH_RAW, bscale)
    st = scale_juice(STRAIGHT_RAW, bscale)
    sft = scale_juice(SF_RAW, bscale)
    base_deck = [(r, s) for s in range(4) for r in range(1, 14)]
    total = 0.0

    for _ in range(n):
        d = base_deck[:]
        rnd.shuffle(d)
        ranks = [d[0][0]]
        suits = [d[0][1]]
        rc = [0] * 14
        for r, _s in d[1:]:
            rc[r] += 1
        idx = 1
        pot = 1.0
        prev = []
        lost = False

        while len(ranks) < MAX_CARDS:
            cur = ranks[-1]
            higher = sum(rc[r] for r in range(cur + 1, 14))
            lower = sum(rc[r] for r in range(1, cur))
            rem = sum(rc[1:])
            go_h = higher >= lower
            p = (higher if go_h else lower) / rem
            # Dynamic fair-ish multiplier
            m = R / p if p > 0 else 0.0
            if p <= 0:
                # forced loss side — shouldn't pick; pick other if possible
                go_h = not go_h
                p = (higher if go_h else lower) / rem
                m = R / p if p > 0 else 0.0

            nxt_r, nxt_s = d[idx]
            idx += 1
            rc[nxt_r] -= 1
            ranks.append(nxt_r)
            suits.append(nxt_s)
            won = (nxt_r > cur) if go_h else (nxt_r < cur)
            if not won:
                lost = True
                break
            pot *= m
            cur_b = detect(ranks, suits, ft, st, sft)
            for b in select_new(prev, cur_b):
                pot *= b[2]
            prev = cur_b

        if not lost:
            total += pot
    return total / n


def main():
    log(f"No-bonus always-continue RTP = R^{GUESSES}")
    log(f"R for 97% without bonuses: {TARGET ** (1/GUESSES):.6f}")

    # Solve R with bonuses
    lo, hi = 0.90, 0.999
    log("Search R...")
    for it in range(14):
        mid = (lo + hi) / 2
        r = rtp_dynamic(mid, BONUS_SCALE, n=60_000, seed=42)
        log(f"  {it:02d} R={mid:.5f}  RTP={r*100:.3f}%")
        if r > TARGET:
            hi = mid
        else:
            lo = mid

    for it in range(8):
        mid = (lo + hi) / 2
        r = rtp_dynamic(mid, BONUS_SCALE, n=150_000, seed=200 + it)
        log(f"  refine {it}: R={mid:.5f}  RTP={r*100:.3f}%")
        if r > TARGET:
            hi = mid
        else:
            lo = mid

    R = (lo + hi) / 2
    final = rtp_dynamic(R, BONUS_SCALE, n=400_000, seed=1)
    # Also optimal cash-out after first win ≈ R (no bonus at 2 cards)
    log(f"RESULT R={R:.6f} bonus_scale={BONUS_SCALE} always-continue RTP={final*100:.4f}%")
    log(f"Approx optimal early-cash RTP ≈ {R*100:.2f}% (no bonus before 3 cards)")

    ft = scale_juice(FLUSH_RAW, BONUS_SCALE)
    st = scale_juice(STRAIGHT_RAW, BONUS_SCALE)
    sft = scale_juice(SF_RAW, BONUS_SCALE)

    def fmt(xs):
        return ", ".join(f"{x:.4f}m" for x in xs)

    log(f"TARGET_RTP_FACTOR = {R:.6f}m")
    log("FlushMult = [" + fmt(ft) + "];")
    log("StraightMult = [" + fmt(st) + "];")
    log("StraightFlushMult = [" + fmt(sft) + "];")

    log("\nExample first-card dynamic mults (R/p):")
    for rnk in range(1, 14):
        p = max((13 - rnk) * 4, (rnk - 1) * 4) / 51
        label = {1: "A", 11: "J", 12: "Q", 13: "K"}.get(rnk, str(rnk))
        log(f"  {label:>2}: p={p:.4f}  mult={R/p:.4f}")


if __name__ == "__main__":
    main()
