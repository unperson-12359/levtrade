import { useEffect } from 'react'
import type { TrackedCoin } from '../../types/market'
import {
  OBSERVATORY_CATEGORY_EXPLANATIONS,
  OBSERVATORY_DAILY_WORKFLOW,
  OBSERVATORY_LIVE_STATUS_NOTES,
  OBSERVATORY_PAGE_PURPOSES,
  OBSERVATORY_READING_STEPS,
} from './methodologyContent'

interface MethodologyPageProps {
  coin: TrackedCoin
  timeframe: '1d'
  open: boolean
  onClose: () => void
  onOpenObservatory: () => void
  onOpenAnalytics: () => void
}

export function MethodologyPage({
  coin,
  timeframe,
  open,
  onClose,
  onOpenObservatory,
  onOpenAnalytics,
}: MethodologyPageProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const scrollToSection = (sectionId: string) => () => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCloseAndOpen = (action: () => void) => () => {
    onClose()
    action()
  }

  return (
    <div className="obs-methodology-modal" data-testid="obs-methodology-modal">
      <div className="obs-methodology-modal__backdrop" onClick={onClose} />
      <div className="obs-methodology-modal__panel">
        <button type="button" className="obs-methodology-modal__close" onClick={onClose}>Close</button>
        <section className="obs-methodology" data-testid="obs-methodology-page">
          <div className="obs-panel obs-panel--methodology-hero">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Methodology</div>
                <h2 className="obs-panel__title">How to read LevTrade Observatory</h2>
              </div>
              <p className="obs-panel__hint">Built for a serious user who wants the page to teach market-reading order, not just expose raw tools.</p>
            </div>

            <div className="obs-methodology__intro">
              <p className="obs-methodology__lead">
                Start with market state, then read pressure, then explain the candle, then validate with deep-dive tools.
                The app is strongest when you follow that order instead of jumping straight into the densest page.
              </p>
              <div className="obs-methodology__context">
                <span>Current live context</span>
                <strong>{coin} / {timeframe}</strong>
              </div>
            </div>

            <div className="obs-methodology__cta-row">
              <button
                type="button"
                className="obs-panel__action"
                onClick={handleCloseAndOpen(onOpenObservatory)}
                data-testid="obs-methodology-open-observatory"
              >
                Open live observatory
              </button>
              <button type="button" className="obs-panel__action obs-panel__action--secondary" onClick={handleCloseAndOpen(onOpenAnalytics)}>
                Open analytics
              </button>
            </div>
          </div>

          <div className="obs-methodology__anchor-row">
            <button type="button" onClick={scrollToSection('obs-methodology-flow')}>Reading flow</button>
            <button type="button" onClick={scrollToSection('obs-methodology-pages')}>Pages</button>
            <button type="button" onClick={scrollToSection('obs-methodology-categories')}>Categories</button>
            <button type="button" onClick={scrollToSection('obs-methodology-live')}>Live mode</button>
            <button type="button" onClick={scrollToSection('obs-methodology-workflow')}>Daily workflow</button>
          </div>

          <section id="obs-methodology-flow" className="obs-panel" data-testid="obs-methodology-flow">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Reading flow</div>
                <h2 className="obs-panel__title">The order the app wants you to read</h2>
              </div>
            </div>
            <div className="obs-methodology__flow-grid">
              {OBSERVATORY_READING_STEPS.map((step) => (
                <article key={step.id} className="obs-methodology__flow-card">
                  <div className="obs-methodology__flow-step">Step {step.step}</div>
                  <h3>{step.title}</h3>
                  <p>{step.question}</p>
                  <div className="obs-methodology__flow-next">{step.readNext}</div>
                  <button
                    type="button"
                    className="obs-panel__action obs-methodology__try-cta"
                    onClick={handleCloseAndOpen(onOpenObservatory)}
                  >
                    Try it now &rarr;
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section id="obs-methodology-pages" className="obs-panel" data-testid="obs-methodology-pages">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Page roles</div>
                <h2 className="obs-panel__title">What each page is for</h2>
              </div>
            </div>
            <div className="obs-methodology__page-grid">
              {OBSERVATORY_PAGE_PURPOSES.map((page) => (
                <article key={page.title} className="obs-methodology__page-card">
                  <h3>{page.title}</h3>
                  <p>{page.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="obs-methodology-categories" className="obs-panel" data-testid="obs-methodology-categories">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Indicator categories</div>
                <h2 className="obs-panel__title">What the five categories mean</h2>
              </div>
            </div>
            <div className="obs-methodology__category-grid">
              {OBSERVATORY_CATEGORY_EXPLANATIONS.map((entry) => (
                <article key={entry.category} className="obs-methodology__category-card">
                  <h3>{entry.category}</h3>
                  <p>{entry.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="obs-methodology-live" className="obs-panel" data-testid="obs-methodology-live">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Live mode</div>
                <h2 className="obs-panel__title">What the shell is telling you right now</h2>
              </div>
            </div>
            <div className="obs-methodology__trust-list">
              {OBSERVATORY_LIVE_STATUS_NOTES.map((entry) => (
                <div key={entry.label} className="obs-methodology__trust-row">
                  <strong>{entry.label}</strong>
                  <span>{entry.meaning}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="obs-methodology-workflow" className="obs-panel" data-testid="obs-methodology-workflow">
            <div className="obs-panel__title-row">
              <div>
                <div className="obs-panel__eyebrow">Practical usage</div>
                <h2 className="obs-panel__title">A sane daily workflow</h2>
              </div>
            </div>
            <ol className="obs-methodology__workflow-list">
              {OBSERVATORY_DAILY_WORKFLOW.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </div>
  )
}
