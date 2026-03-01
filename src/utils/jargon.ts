export const JARGON: Record<string, string> = {
  Hurst:
    'Math indicator measuring whether price bounces between levels (mean-reverting) or trends. Below 0.45 = bouncing, above 0.55 = trending.',
  'Z-Score':
    'How many standard deviations price is from its average. High = overbought, low = oversold. Think "how stretched is the rubber band."',
  'OI Delta':
    'Open Interest change — measures new money flowing into or out of the market.',
  'Mean-Reverting':
    'Price tends to bounce back to average. This is when our signals work best.',
  'Funding Rate':
    'Fee between long and short traders. Extreme rates often signal reversals.',
  'R:R':
    'Reward-to-Risk ratio. 3:1 means potential profit is 3x potential loss. We want 2:1 or better.',
  Liquidation:
    'Price where the exchange force-closes your position. Higher leverage = closer liquidation.',
  ATR:
    'Average True Range — how much price typically moves per candle. Used for stop distances.',
  'Sigma (σ)':
    'Standard deviation. 1σ = one standard deviation from average.',
  Composite:
    'Combined score from all signals (-1 to +1). Positive = bullish, negative = bearish.',
  'Entry Geometry':
    'How far price has stretched from average. Ideal entry zone: 1.25–2.4σ from the mean.',
  Stretch:
    'How far price has deviated from its rolling mean, measured in standard deviations.',
  Regime:
    'The current market behavior type — mean-reverting (bouncy), trending, or choppy. Determines whether signals are reliable.',
}
