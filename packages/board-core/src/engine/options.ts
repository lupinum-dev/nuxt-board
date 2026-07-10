import { BoardInputError } from '../errors.js'
import type {
  BoardEngineOptions,
  BoardPlugin,
  BoxSelectBehavior,
  Camera,
  GridSettings,
  NodeConstraints,
  ZoomSettings,
} from '../types.js'

interface ResolvedBoardConfiguration {
  camera: Camera
  zoom: ZoomSettings
  grid: GridSettings
  nodeConstraints: NodeConstraints
  plugins: readonly BoardPlugin[]
  diagnostics: BoardEngineOptions['diagnostics']
  boxSelectBehavior: BoxSelectBehavior
}

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new BoardInputError(`${name} must be a finite number.`)
  }
}

function requirePositive(name: string, value: number): void {
  requireFinite(name, value)
  if (value <= 0) {
    throw new BoardInputError(`${name} must be greater than 0.`)
  }
}

/** Validate the complete runtime grid contract used by constructor and updates. */
export function validateGridSettings(grid: GridSettings): void {
  requirePositive('grid.size', grid.size)
  requirePositive('grid.majorEvery', grid.majorEvery)
  requirePositive('grid.edgeSnapThreshold', grid.edgeSnapThreshold)
  if (!Number.isInteger(grid.majorEvery)) {
    throw new BoardInputError('grid.majorEvery must be an integer.')
  }
  if (typeof grid.snap !== 'boolean' || typeof grid.edgeSnap !== 'boolean') {
    throw new BoardInputError('grid snap settings must be boolean values.')
  }
  if (!['dot', 'line', 'cross', 'none'].includes(grid.pattern)) {
    throw new BoardInputError(
      `Grid pattern "${String(grid.pattern)}" is unsupported.`,
    )
  }
}

/** Validate resolved constructor options before the engine allocates mutable resources. */
export function validateBoardConfiguration(
  config: ResolvedBoardConfiguration,
): void {
  requireFinite('camera.x', config.camera.x)
  requireFinite('camera.y', config.camera.y)
  requirePositive('camera.z', config.camera.z)

  requirePositive('zoom.min', config.zoom.min)
  requirePositive('zoom.max', config.zoom.max)
  if (config.zoom.min > config.zoom.max) {
    throw new BoardInputError(
      'zoom.min must be less than or equal to zoom.max.',
    )
  }

  validateGridSettings(config.grid)

  if (!['autocad', 'contain', 'intersect'].includes(config.boxSelectBehavior)) {
    throw new BoardInputError(
      `Box-select behavior "${String(config.boxSelectBehavior)}" is unsupported.`,
    )
  }

  requirePositive('nodes.minWidth', config.nodeConstraints.minWidth)
  requirePositive('nodes.minHeight', config.nodeConstraints.minHeight)
  requirePositive('nodes.defaultWidth', config.nodeConstraints.defaultWidth)
  requirePositive('nodes.defaultHeight', config.nodeConstraints.defaultHeight)
  if (config.nodeConstraints.defaultWidth < config.nodeConstraints.minWidth) {
    throw new BoardInputError(
      'nodes.defaultWidth must be greater than or equal to nodes.minWidth.',
    )
  }
  if (config.nodeConstraints.defaultHeight < config.nodeConstraints.minHeight) {
    throw new BoardInputError(
      'nodes.defaultHeight must be greater than or equal to nodes.minHeight.',
    )
  }

  if (typeof config.diagnostics === 'object') {
    const limit = config.diagnostics.traceLimit
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new BoardInputError(
        'diagnostics.traceLimit must be a non-negative integer.',
      )
    }
  }

  const extensionNames = new Set<string>()
  for (const extension of config.plugins) {
    if (extensionNames.has(extension.name)) {
      throw new BoardInputError(
        `Board extension name "${extension.name}" is registered more than once.`,
      )
    }
    extensionNames.add(extension.name)
  }
}
