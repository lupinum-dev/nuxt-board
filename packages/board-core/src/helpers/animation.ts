interface AnimationFrameDriver {
  raf: (cb: FrameRequestCallback) => number
  caf: (handle: number) => void
}

export function getAnimationFrameDriver(): AnimationFrameDriver {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis)
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis)
  if (typeof raf === 'function' && typeof caf === 'function') {
    return { raf, caf }
  }
  return {
    raf: (cb: FrameRequestCallback) =>
      globalThis.setTimeout(() => cb(Date.now()), 16) as unknown as number,
    caf: (handle: number) => globalThis.clearTimeout(handle),
  }
}

export class AnimationCancelled extends Error {
  constructor() {
    super('Animation cancelled')
    this.name = 'AnimationCancelled'
  }
}
