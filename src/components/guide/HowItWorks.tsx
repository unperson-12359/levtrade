import type { ReactNode } from 'react'
import { useStore } from '../../store'

export function HowItWorks() {
  const open = useStore((s) => s.expandedSections['how-it-works'] ?? false)
  const toggle = useStore((s) => s.toggleSection)
  const close = () => {
    if (open) toggle('how-it-works')
  }

  return (
    <>
      {open && <div className="guide-backdrop" onClick={close} />}
      <div className={`guide-page ${open ? 'guide-page--open' : ''}`}>
        <div className="guide-page__header">
          <span className="guide-page__title">How LevTrade Works</span>
          <button type="button" onClick={close} className="signal-drawer__close" aria-label="Close">
            X
          </button>
        </div>

        <div className="guide-page__body guide-page__body--methodology">
          <Section title="What is this?">
            <p>
              LevTrade is a personal trading dashboard for Hyperliquid perpetual futures.
              It tracks BTC, ETH, SOL, and HYPE in real time and answers three questions
              before every trade:
            </p>
            <ol className="guide-list guide-list--numbered">
              <li><strong>Is the market favorable?</strong> - regime, volatility, funding, money flow</li>
              <li><strong>Is there an entry right now?</strong> - signal strength, stretch, agreement, setup geometry</li>
              <li><strong>How big should the trade be?</strong> - position size, leverage, stop, target, liquidation</li>
            </ol>
            <p>
              Everything is color-coded: <span className="text-signal-green">green</span> means favorable,{' '}
              <span className="text-signal-yellow">yellow</span> means caution,{' '}
              <span className="text-signal-red">red</span> means stay out. The summaries stay plain English so
              you can see what to do and why without parsing indicator jargon.
            </p>
          </Section>

          <Section title="Where the data comes from">
            <p>
              Prices stream in real time over a WebSocket connection to Hyperliquid.
              Every 60 seconds, the dashboard also polls for:
            </p>
            <ul className="guide-list">
              <li>1-hour candles (last 120 hours) for all 4 coins</li>
              <li>Open interest snapshots per coin</li>
              <li>Funding rate history (last 30 hours)</li>
              <li>Full asset context (mark price, OI, 24h volume)</li>
            </ul>
            <p>
              After each poll, signals are recomputed for <strong>all 4 coins simultaneously</strong>,
              regardless of which coin you are viewing. That is what feeds the setup tracker.
            </p>
          </Section>

          <Section title="Step 1 - Market Read">
            <p>
              The market panel answers: &quot;Is this a good environment to trade?&quot;
              It checks five dimensions:
            </p>
            <div className="guide-grid">
              <GridCard
                title="Hurst Exponent"
                detail="Measures whether price is trending or mean-reverting. H > 0.55 = trending, H < 0.45 = mean-reverting. Computed from autocorrelation of returns over 100 periods at your selected timeframe."
              />
              <GridCard
                title="Volatility"
                detail="Realized volatility annualized for 24/7 crypto, plus Average True Range. High volatility means wider stops and lower leverage."
              />
              <GridCard
                title="Funding Rate"
                detail="Current funding rate and its Z-Score vs. 30-hour history. Extreme funding signals crowded positioning and possible reversals."
              />
              <GridCard
                title="OI Delta"
                detail="Compares open interest change vs. price change. Divergences such as OI up + price down can signal squeezes."
              />
              <GridCard
                title="Composite Score"
                detail="Weighted combination of all signals. Shows overall agreement count (for example 4/5 signals aligned) and a normalized score."
              />
            </div>
          </Section>

          <Section title="Step 2 - Signal and Entry">
            <p>
              When the market reads favorably, Step 2 checks whether there is an actionable
              entry <em>right now</em>. The dashboard computes:
            </p>
            <div className="guide-grid">
              <GridCard
                title="Entry Geometry"
                detail="Where is price relative to the mean and bands? An ideal entry is near the band with price stretching back toward the mean. Extended means price is far from the mean and could snap back violently."
              />
              <GridCard
                title="Z-Score (Stretch)"
                detail="How many standard deviations price is from its mean. |Z| > 2 = extreme stretch. Negative Z plus long bias can create a strong mean-reversion entry."
              />
              <GridCard
                title="Direction Decision"
                detail="Combines composite direction, entry geometry bias, regime, and risk status into a single action: LONG, SHORT, WAIT, or AVOID."
              />
              <GridCard
                title="Suggested Setup"
                detail="When the decision is LONG or SHORT, the dashboard generates a full trade idea: entry, stop, target, R:R, confidence tier, suggested leverage, and size."
              />
            </div>
          </Section>

          <Section title="Step 3 - Risk Sizing">
            <p>
              The risk panel lets you verify position size, leverage, and liquidation
              before entering. You input your account size and the dashboard computes:
            </p>
            <ul className="guide-list">
              <li><strong>Account hit at stop</strong> - what percent of your account you lose if stopped out</li>
              <li><strong>R:R ratio</strong> - reward-to-risk. Green at 3:1+, yellow at 2:1+, red below</li>
              <li><strong>Liquidation price and distance</strong> - how far price must move against you to liquidate</li>
              <li><strong>Suggested leverage</strong> - the leverage that risks about 1% of your account at the stop</li>
              <li><strong>Trade grade</strong> - overall assessment combining signal quality and risk geometry</li>
            </ul>
          </Section>

          <Section title="How setups are captured">
            <p>
              This is how the dashboard builds a track record of its own suggestions so
              you can measure strategy accuracy over time.
            </p>
            <div className="guide-callout">
              <div className="guide-callout__title">Every 60 seconds, for all 4 coins:</div>
              <ol className="guide-list guide-list--numbered">
                <li>Signals are recomputed from the latest candles and market data</li>
                <li>If the decision for a coin is LONG or SHORT (not WAIT/AVOID), a suggested setup is generated</li>
                <li>The setup records coin, direction, entry price, stop, target, confidence tier, R:R, and timestamp</li>
                <li>A dedup check prevents duplicates: same coin + direction within 4 hours with entry price within 2% is skipped</li>
                <li>The setup is saved with three empty outcome slots: 4h, 24h, and 72h</li>
              </ol>
            </div>
            <p>
              This runs in the background for <strong>all coins simultaneously</strong>. You can be
              looking at BTC and the dashboard will still capture an ETH setup if ETH fires.
            </p>
          </Section>

          <Section title="How outcomes are scored">
            <p>
              Each setup has three independent scoring windows. The resolution engine runs
              every 60 seconds and also on app startup.
            </p>
            <div className="guide-grid">
              <GridCard
                title="4-hour window"
                detail="Did price hit the target or stop within 4 hours of the setup being generated? This measures short-term accuracy."
              />
              <GridCard
                title="24-hour window"
                detail="Same check over 24 hours. This is the primary scoring window shown in setup history by default."
              />
              <GridCard
                title="72-hour window"
                detail="Same check over 72 hours. Captures trades that need more time to play out."
              />
            </div>
            <h4 className="guide-h4">Resolution logic</h4>
            <p>
              The engine walks through every 1-hour candle from setup generation to the
              window boundary:
            </p>
            <ul className="guide-list">
              <li><strong>Target hit</strong> (candle high &gt;= target for longs, candle low &lt;= target for shorts) - <span className="text-signal-green">WIN</span></li>
              <li><strong>Stop hit</strong> (candle low &lt;= stop for longs, candle high &gt;= stop for shorts) - <span className="text-signal-red">LOSS</span></li>
              <li><strong>Both hit same candle</strong> - resolved by which was closer to candle open</li>
              <li><strong>Neither hit by window end</strong> - <span className="text-signal-yellow">EXPIRED</span>, scored by where price ended (can still be +R or -R)</li>
            </ul>
            <h4 className="guide-h4">What about gaps?</h4>
            <p>
              If the app was closed and candle data has a small gap, the outcome stays
              pending for up to 24 hours while waiting for data to become available.
              If a candle exists within 2 hours of the window boundary, it is used with
              partial coverage. Only after 24 hours with no usable data does an outcome
              become unresolvable.
            </p>
          </Section>

          <Section title="What the stats mean">
            <div className="guide-grid">
              <GridCard
                title="Win Rate"
                detail="Percentage of resolved setups where target was hit before stop. Only wins and losses count; expired and unresolvable outcomes are excluded."
              />
              <GridCard
                title="Average R"
                detail="Average R-multiple achieved. +1R means the trade gained exactly its risk amount. +2R means twice the risk as profit. Negative R means the trade lost."
              />
              <GridCard
                title="MFE (Max Favorable Excursion)"
                detail="How far price moved in your favor before the window closed. Helps you see if your targets are too tight."
              />
              <GridCard
                title="MAE (Max Adverse Excursion)"
                detail="How far price moved against you before the window closed. Helps you see if your stops are too tight."
              />
              <GridCard
                title="Confidence Tiers"
                detail="High / Medium / Low based on signal alignment and entry quality. Stats are broken down by tier so you can see whether high-confidence setups really perform better."
              />
              <GridCard
                title="Coverage Status"
                detail="Full = all candles available. Partial = some candles came from backfill. Insufficient = outcome is unresolvable."
              />
            </div>
          </Section>

          <Section title="Storage model">
            <p>
              State now stays local in this browser to avoid Vercel transfer limits. The dashboard keeps using live
              Hyperliquid market data, but your tracked setups, outcomes, and risk defaults are saved only in browser
              storage unless you export them.
            </p>
            <ul className="guide-list">
              <li><strong>What is stored:</strong> setup history, signal tracker records, outcomes, and risk input defaults</li>
              <li><strong>Where it lives:</strong> in this browser under the app storage key, so refreshes keep your data</li>
              <li><strong>Sharing:</strong> there is no automatic cross-device sync in this build; use Export JSON if you want a manual backup</li>
              <li><strong>Fallback:</strong> because the app is local-only, your history does not depend on a backend session staying alive</li>
              <li><strong>Retention:</strong> 90 days. Older setups are pruned automatically</li>
            </ul>
          </Section>

          <Section title="Getting reliable results">
            <div className="guide-callout">
              <div className="guide-callout__title">For the most accurate track record:</div>
              <ul className="guide-list">
                <li><strong>Keep the tab open</strong> - the dashboard captures setups and resolves outcomes while running. More uptime means fewer gaps.</li>
                <li><strong>Export occasionally</strong> - if you care about preserving your track record across browsers or devices, export JSON from the trust panel.</li>
                <li><strong>Wait a few days</strong> - a meaningful sample needs 20+ setups across different market conditions. The tier breakdown shows whether high-confidence setups outperform low-confidence ones.</li>
                <li><strong>Check all 3 windows</strong> - a setup that loses at 4h might win at 24h or 72h, which helps you judge timeframe fit.</li>
              </ul>
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="guide-section">
      <h3 className="guide-h3">{title}</h3>
      {children}
    </div>
  )
}

function GridCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="guide-card">
      <div className="guide-card__title">{title}</div>
      <div className="guide-card__detail">{detail}</div>
    </div>
  )
}
