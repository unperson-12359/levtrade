import { type ReactNode, useState, useRef, useCallback, useEffect, useId } from 'react'

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
  const tooltipId = useId()

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

  useEffect(() => {
    if (!show) return

    function handlePointerDown(event: PointerEvent) {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setShow(false)
        setOffset(0)
        setPlacement('above')
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [show])

  const closeTooltip = () => {
    setShow(false)
    setOffset(0)
    setPlacement('above')
  }

  const positionClasses = placement === 'above'
    ? 'bottom-full mb-2'
    : 'top-full mt-2'

  const arrowClasses = placement === 'above'
    ? 'top-full border-t-[#1e2a3a] border-b-transparent'
    : 'bottom-full border-b-[#1e2a3a] border-t-transparent'

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      tabIndex={0}
      aria-describedby={show ? tooltipId : undefined}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={closeTooltip}
      onFocus={() => setShow(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeTooltip()
        }
      }}
      onClick={() => setShow((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setShow((current) => !current)
        }

        if (event.key === 'Escape') {
          closeTooltip()
        }
      }}
    >
      {children}
      {show && (
        <div
          id={tooltipId}
          role="tooltip"
          ref={tooltipRef}
          className={`absolute z-50 left-1/2 ${positionClasses} max-w-[260px] rounded-lg border border-signal-blue/30 bg-[#1e2a3a] px-3 py-2 text-sm leading-relaxed text-text-primary shadow-[0_18px_40px_rgba(0,0,0,0.45)] whitespace-normal`}
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
