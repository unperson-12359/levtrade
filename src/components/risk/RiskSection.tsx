import { StepLabel } from '../methodology/StepLabel'
import { RiskForm } from './RiskForm'
import { RiskResults } from './RiskResults'

export function RiskSection() {
  return (
    <aside className="risk-stack">
      <section className="panel-shell">
        <StepLabel step={3} />
        <h2 className="panel-title" style={{ marginTop: '0.25rem' }}>Size the trade</h2>
        <RiskForm />
        <RiskResults />
      </section>
    </aside>
  )
}
