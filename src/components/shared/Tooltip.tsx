import { type ReactNode, useState, useRef, useCallback, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

type Placement = 'above' | 'below'

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const [placement, setPlacement] = useState<Placement>('above')
  const [offset, setOffset] = useState(0)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const reposition = useCallback(() => {
    if (!tooltipRef.current || !triggerRef.current) return

    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const pad = 12

    // Vertical: prefer above, flip to below if clipped
    if (triggerRect.top - tooltipRect.height - 8 < pad) {
      setPlacement('below')
    } else {
      setPlacement('above')
    }

    // Horizontal: center, then nudge if clipped
    const tooltipCenter = triggerRect.left + triggerRect.width / 2
    const halfW = tooltipRect.width / 2
    let xOffset = 0

    if (tooltipCenter - halfW < pad) {
      xOffset = pad - (tooltipCenter - halfW)
    } else if (tooltipCenter + halfW > window.innerWidth - pad) {
      xOffset = (window.innerWidth - pad) - (tooltipCenter + halfW)
    }

    setOffset(xOffset)
  }, [])

  useEffect(() => {
    if (show) {
      requestAnimationFrame(reposition)
    }
  }, [show, reposition])

  const positionClasses = placement === 'above'
    ? 'bottom-full mb-2'
    : 'top-full mt-2'

  const arrowClasses = placement === 'above'
    ? 'top-full border-t-border-subtle border-b-transparent'
    : 'bottom-full border-b-border-subtle border-t-transparent'

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => { setShow(false); setOffset(0); setPlacement('above') }}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 left-1/2 ${positionClasses} px-4 py-3 rounded-lg bg-bg-card border border-border-subtle text-base text-text-secondary max-w-sm whitespace-normal shadow-lg leading-relaxed`}
          style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        >
          {content}
          <div
            className={`absolute left-1/2 -mt-px border-4 border-transparent ${arrowClasses}`}
            style={{ transform: `translateX(calc(-50% - ${offset}px))` }}
          />
        </div>
      )}
    </span>
  )
}
