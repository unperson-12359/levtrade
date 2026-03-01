import { JARGON } from '../../utils/jargon'
import { Tooltip } from './Tooltip'

interface JargonTermProps {
  term: string
  children?: React.ReactNode
}

export function JargonTerm({ term, children }: JargonTermProps) {
  const definition = JARGON[term]
  if (!definition) return <>{children ?? term}</>

  return (
    <Tooltip content={definition}>
      <span className="jargon-term">{children ?? term}</span>
    </Tooltip>
  )
}
