"""Find biggest buyers of a Hyperliquid spot asset over a recent time window.

Default target: spot market index 254 (KNTQ), last 2 hours.

Uses the Hyperliquid public info API (no auth required):
  POST https://api.hyperliquid.xyz/info  body: {"type": "recentTrades", "coin": "@254"}

Each trade has shape:
  {"coin": "@254", "side": "B"|"A", "px": "..", "sz": "..",
   "time": <ms>, "hash": "..", "tid": <int>, "users": [taker, maker]}

When side == "B" the taker bought (taker = users[0]). When side == "A" the
taker sold, so the maker was the buyer (maker = users[1]). We aggregate buy
size / notional per address.
"""

from __future__ import annotations

import json
import time
import urllib.request
from collections import defaultdict

API_URL = "https://api.hyperliquid.xyz/info"
COIN = "@254"
WINDOW_MS = 2 * 60 * 60 * 1000  # 2 hours


def post(body: dict) -> object:
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def spot_meta_name(coin: str) -> str:
    """Resolve @<idx> to the human-readable token name via spotMeta."""
    if not coin.startswith("@"):
        return coin
    try:
        idx = int(coin[1:])
        meta = post({"type": "spotMeta"})
        universe = meta.get("universe", [])
        tokens = meta.get("tokens", [])
        for pair in universe:
            if pair.get("index") == idx:
                base = pair["tokens"][0]
                return tokens[base].get("name", coin)
    except Exception:
        pass
    return coin


def fetch_recent_trades(coin: str) -> list[dict]:
    return post({"type": "recentTrades", "coin": coin})


def main() -> None:
    name = spot_meta_name(COIN)
    print(f"Fetching recent trades for {COIN} ({name})...")
    trades = fetch_recent_trades(COIN)
    if not isinstance(trades, list):
        print("Unexpected response:", trades)
        return

    now_ms = int(time.time() * 1000)
    cutoff = now_ms - WINDOW_MS

    in_window = [t for t in trades if t.get("time", 0) >= cutoff]
    if not in_window:
        print("No trades in the last 2 hours.")
        oldest = min((t["time"] for t in trades), default=None)
        newest = max((t["time"] for t in trades), default=None)
        if oldest is not None:
            print(f"  recentTrades window: {oldest} .. {newest} ({len(trades)} trades)")
        return

    oldest = min(t["time"] for t in in_window)
    print(
        f"{len(in_window)} trades in last 2h "
        f"(oldest {(now_ms - oldest)/1000/60:.1f} min ago, "
        f"recentTrades returned {len(trades)} total)."
    )
    if oldest > cutoff + 60_000 and len(trades) >= 500:
        print(
            "  WARNING: recentTrades is capped; data may not cover the full 2h. "
            "Aggregations reflect only what the API returned."
        )

    size_by_buyer: dict[str, float] = defaultdict(float)
    notional_by_buyer: dict[str, float] = defaultdict(float)
    fills_by_buyer: dict[str, int] = defaultdict(int)

    for t in in_window:
        try:
            sz = float(t["sz"])
            px = float(t["px"])
        except (KeyError, ValueError):
            continue
        users = t.get("users") or []
        if len(users) < 2:
            continue
        side = t.get("side")
        if side == "B":
            buyer = users[0]  # taker bought
        elif side == "A":
            buyer = users[1]  # taker sold => maker bought
        else:
            continue
        size_by_buyer[buyer] += sz
        notional_by_buyer[buyer] += sz * px
        fills_by_buyer[buyer] += 1

    if not size_by_buyer:
        print("No buy-side activity attributable to addresses.")
        return

    ranked = sorted(notional_by_buyer.items(), key=lambda kv: kv[1], reverse=True)
    total_notional = sum(notional_by_buyer.values())
    total_size = sum(size_by_buyer.values())

    print(
        f"\nTotal buy volume in window: {total_size:,.4f} {name} "
        f"(~${total_notional:,.2f})\n"
    )
    print(f"Top buyers of {name} (spot {COIN}) in last 2h:")
    print(f"{'#':>3}  {'address':42}  {'size':>16}  {'notional ($)':>16}  {'fills':>6}  {'%':>6}")
    for i, (addr, notional) in enumerate(ranked[:20], 1):
        sz = size_by_buyer[addr]
        pct = 100.0 * notional / total_notional if total_notional else 0.0
        print(
            f"{i:>3}  {addr:42}  {sz:>16,.4f}  {notional:>16,.2f}  "
            f"{fills_by_buyer[addr]:>6}  {pct:>5.1f}%"
        )


if __name__ == "__main__":
    main()
