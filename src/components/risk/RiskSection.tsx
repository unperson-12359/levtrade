import { StepLabel } from '../methodology/StepLabel'
import { RiskForm } from './RiskForm'
import { RiskResults } from './RiskResults'

export function RiskSection() {
  return (
    <aside className="risk-stack">
      <section className="panel-shell">
        <StepLabel step={3} />
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Step 3</div>
            <h2 className="panel-title">If you take it, how big should the trade be?</h2>
          </div>
        </div>
        <p className="panel-copy">Verify size, leverage, and liquidation before entering.</p>
        <RiskForm />
      </section>
      <RiskResults />
    </aside>
  )
}
