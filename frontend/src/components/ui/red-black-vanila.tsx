import { useEffect, useRef } from 'react'

type Ember = {
  x: number
  y: number
  r: number
  depth: number
  tw: number
  ph: number
}

/**
 * ShaderBackground (red/black) — a full-bleed animated ember field with a
 * warm red glow over a near-black base. Pure canvas 2D, self-contained,
 * respects prefers-reduced-motion. Reads as drifting heat-light against
 * charcoal rather than static noise.
 */
export function ShaderBackground({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let embers: Ember[] = []
    let raf = 0
    let w = 0
    let h = 0

    const spawn = () => {
      const count = Math.min(200, Math.floor((w * h) / 10500))
      embers = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.5,
        depth: 0.25 + Math.random() * 0.75,
        tw: 1 + Math.random() * 3,
        ph: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio
      h = canvas.height = canvas.offsetHeight * devicePixelRatio
      spawn()
    }

    const bgR = 0.05 + Math.random() * 0.012
    const bgG = 0.012 + Math.random() * 0.008
    const bgB = 0.018 + Math.random() * 0.01

    const draw = (t: number) => {
      ctx.fillStyle = `rgba(${Math.round(bgR * 255)}, ${Math.round(
        bgG * 255,
      )}, ${Math.round(bgB * 255)}, 1)`
      ctx.fillRect(0, 0, w, h)

      const cx = w * 0.5
      const cy = h * 0.42
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65)
      glow.addColorStop(0, 'rgba(255, 70, 45, 0.14)')
      glow.addColorStop(0.5, 'rgba(200, 35, 25, 0.06)')
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      for (const e of embers) {
        const a = 0.18 + e.depth * 0.45 + (reduce ? 0 : Math.sin(t / 1000 * e.tw + e.ph) * 0.18 * e.depth)
        const drift = reduce ? 0 : (t / 60000) * (e.depth * 9)
        const y = (e.y + drift) % h
        ctx.globalAlpha = Math.max(0.04, Math.min(1, a))
        ctx.fillStyle = e.depth > 0.7 ? '#ffb3a0' : '#ff6a4d'
        ctx.beginPath()
        ctx.arc(e.x, y, e.r * devicePixelRatio * e.depth, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (!reduce) raf = requestAnimationFrame(draw)
    }

    resize()
    draw(0)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
