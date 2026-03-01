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
            <div className="panel-kicker">Risk Console</div>
            <h2 className="panel-title">Size your position and check risk</h2>
          </div>
        </div>
        <RiskForm />
      </section>
      <RiskResults />
    </aside>
  )
}
