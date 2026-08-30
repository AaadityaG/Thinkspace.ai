import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  r: number
  depth: number
  tw: number
  ph: number
}

/**
 * ShaderBackground — a full-bleed animated starfield with a soft nebula glow.
 * Pure canvas 2D (self-contained, respects prefers-reduced-motion). The
 * "shader" feel comes from layered depth + drifting, twinkling stars over a
 * dark radial glow, so it reads as generative light rather than static noise.
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

    let stars: Star[] = []
    let raf = 0
    let w = 0
    let h = 0

    const spawn = () => {
      const count = Math.min(220, Math.floor((w * h) / 9000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
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

    const bgR = 0.02 + Math.random() * 0.012
    const bgG = 0.01 + Math.random() * 0.012
    const bgB = 0.055 + Math.random() * 0.012

    const draw = (t: number) => {
      ctx.fillStyle = `rgba(${Math.round(bgR * 255)}, ${Math.round(
        bgG * 255,
      )}, ${Math.round(bgB * 255)}, 1)`
      ctx.fillRect(0, 0, w, h)

      const cx = w * 0.72
      const cy = h * 0.3
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7)
      nebula.addColorStop(0, 'rgba(190, 200, 255, 0.10)')
      nebula.addColorStop(0.5, 'rgba(122, 120, 235, 0.05)')
      nebula.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = nebula
      ctx.fillRect(0, 0, w, h)

      for (const s of stars) {
        const a = 0.25 + s.depth * 0.5 + (reduce ? 0 : Math.sin(t / 1000 * s.tw + s.ph) * 0.2 * s.depth)
        const drift = reduce ? 0 : (t / 60000) * (s.depth * 9)
        const y = (s.y + drift) % h
        ctx.globalAlpha = Math.max(0.05, Math.min(1, a))
        ctx.fillStyle = s.depth > 0.7 ? '#ccd7ff' : '#9fb0e8'
        ctx.beginPath()
        ctx.arc(s.x, y, s.r * devicePixelRatio * s.depth, 0, Math.PI * 2)
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
