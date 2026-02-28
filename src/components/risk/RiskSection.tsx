import { CollapsibleSection } from '../shared/CollapsibleSection'
import { RiskForm } from './RiskForm'
import { RiskResults } from './RiskResults'

export function RiskSection() {
  return (
    <CollapsibleSection
      id="risk"
      title="Risk Calculator"
      subtitle="What happens if I'm wrong?"
      defaultExpanded
    >
      <div className="grid grid-cols-2 gap-6">
        <RiskForm />
        <RiskResults />
      </div>
    </CollapsibleSection>
  )
}
