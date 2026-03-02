export const JARGON = {
  Hurst:
    'Math indicator measuring whether price tends to bounce back toward average or keep trending. Lower is better for mean-reversion.',
  'Z-Score':
    'How far price is from its average, measured in standard deviations. Think: how stretched is the rubber band?',
  'OI Delta':
    'Open interest change. It shows whether new money is entering or leaving the market.',
  'Mean-Reverting':
    'Price tends to bounce back toward its average. This is when this dashboard works best.',
  'Funding Rate':
    'Fee paid between long and short traders. Extreme readings can signal crowded positioning.',
  'R:R':
    'Reward-to-risk ratio. A 3:1 setup means the target is three times larger than the planned loss.',
  Liquidation:
    'The price where the exchange force-closes your leveraged position.',
  ATR:
    'Average true range. It estimates how much price normally moves per candle.',
  Composite:
    'The combined score from the dashboard signals. Positive leans bullish, negative leans bearish.',
  'Entry Geometry':
    'How stretched price is relative to its average and whether the move still has room to mean-revert.',
  Stretch:
    'How far price has moved away from its rolling mean.',
  Regime:
    'The current market behavior: mean-reverting, trending, or choppy. This decides whether the strategy is trustworthy.',
  'Reversion Potential':
    'How much room price still has to snap back toward its average. Higher is better for a fresh mean-reversion entry.',
  'Chase Risk':
    'How likely it is that the bounce is already underway and you are arriving late to the trade.',
} as const

export type JargonKey = keyof typeof JARGON
