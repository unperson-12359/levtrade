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
              While this browser tab is open, the dashboard also polls every 60 seconds for:
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
            <p>
              External context panels add sentiment, macro, and cross-exchange confirmation from
              three additional sources: the Fear &amp; Greed Index (alternative.me), CoinGecko global
              market data, and Binance Futures funding/OI. These inform Step 1 context but do not
              change setup math or risk sizing directly.
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

          <Section title="Step 3 - Position Composition">
            <p>
              The position composition panel turns the current suggested setup into an execution plan for your capital.
              You only input account size. LevTrade then derives:
            </p>
            <ul className="guide-list">
              <li><strong>Capital used</strong> - margin allocated from your account size</li>
              <li><strong>Suggested leverage</strong> - leverage derived from the setup geometry and ATR</li>
              <li><strong>Notional size</strong> - effective position size after leverage</li>
              <li><strong>Account hit at stop</strong> - what percent of your account is lost if the setup fails</li>
              <li><strong>Liquidation price and distance</strong> - how far price must move against you to liquidate</li>
              <li><strong>Trade grade</strong> - overall assessment of the final account-sized composition</li>
            </ul>
            <p>
              If Step 2 does not identify a valid setup, Step 3 stays disabled. There is no manual fallback form.
            </p>
          </Section>

          <Section title="How setups are captured">
            <p>
              This is how the dashboard builds a track record of its own suggestions so
              you can measure strategy accuracy over time.
            </p>
            <div className="guide-callout">
              <div className="guide-callout__title">Collector cadence: every 5 minutes on the server, with 60-second local refresh while this tab is open</div>
              <ol className="guide-list guide-list--numbered">
                <li>Signals are recomputed from the latest candles and market data</li>
                <li>If the decision for a coin is LONG or SHORT (not WAIT/AVOID), a suggested setup is generated</li>
                <li>The setup records coin, direction, entry price, stop, target, confidence tier, R:R, and timestamp</li>
                <li>A dedup check prevents duplicates: same coin + direction within 4 hours with entry price within 2% is skipped</li>
                <li>The setup is saved with three empty outcome slots: 4h, 24h, and 72h</li>
              </ol>
            </div>
            <p>
              The Oracle collector runs this for <strong>all coins simultaneously</strong> even when your browser is
              closed. When the site is open, the local dashboard still mirrors the same logic for live review.
            </p>
          </Section>

          <Section title="How outcomes are scored">
            <p>
              Each setup has three independent scoring windows. The resolution engine runs
              continuously on the collector and the browser also refreshes resolutions whenever the site is open.
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
              LevTrade uses a server-authoritative model. Setup history and signal accuracy are collected on the Oracle-backed
              server collector and stored in Supabase. Browser-local state holds risk defaults, UI preferences, and a
              non-canonical fallback cache for local review if a server analytics endpoint is temporarily unavailable.
            </p>
            <ul className="guide-list">
              <li><strong>Server-collected:</strong> historical setup suggestions, canonical signal accuracy tracking, resolved 4h / 24h / 72h outcomes, and collector heartbeat</li>
              <li><strong>Browser-local:</strong> risk input defaults, UI state, imported setup history, and non-canonical fallback tracker history for this browser</li>
              <li><strong>Where it lives:</strong> server history lives in Supabase; local state stays under the app storage key in this browser</li>
              <li><strong>Canonical rule:</strong> when server setup history is available, history and performance use only the server dataset so counts match across devices</li>
              <li><strong>Fallback:</strong> only if canonical server history is unavailable does the dashboard temporarily show browser-local fallback history on this device and label it as fallback</li>
              <li><strong>Retention:</strong> 90 days. Older setups are pruned automatically</li>
            </ul>
          </Section>

          <Section title="Getting reliable results">
            <div className="guide-callout">
              <div className="guide-callout__title">For the most accurate track record:</div>
              <ul className="guide-list">
                <li><strong>Keep the collector healthy</strong> - the Oracle VM collector samples the market every 5 minutes and resolves outcomes without needing this browser open.</li>
                <li><strong>Open the site to review</strong> - the frontend hydrates server history on load, so you can inspect fresh setups and autopsies after time away.</li>
                <li><strong>Export occasionally</strong> - if you care about preserving imported setup history or browser cache, export JSON from the trust panel.</li>
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
