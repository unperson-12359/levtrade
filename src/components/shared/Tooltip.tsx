import { type ReactNode, useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (show && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      const padding = 8
      if (rect.left < padding) {
        setOffset(padding - rect.left)
      } else if (rect.right > window.innerWidth - padding) {
        setOffset(window.innerWidth - padding - rect.right)
      } else {
        setOffset(0)
      }
    }
  }, [show])

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => { setShow(false); setOffset(0) }}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-1/2 mb-2 px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-sm text-text-secondary max-w-xs whitespace-normal shadow-lg"
          style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border-subtle" />
        </div>
      )}
    </span>
  )
}
