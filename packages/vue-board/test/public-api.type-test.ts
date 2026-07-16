import { BoardRoot, useBoardEngine } from '../src'

useBoardEngine
BoardRoot

// @ts-expect-error Root viewport syncing is internal to BoardRoot.
import { useViewportSize } from '../src'
// @ts-expect-error Grid prop resolution is internal to BoardRoot.
import { useResolvedGrid } from '../src'
// @ts-expect-error LOD culling is internal to BoardRoot.
import { useLodCulling } from '../src'
// @ts-expect-error Keyboard wiring is internal to BoardRoot.
import { useKeyboardShortcuts } from '../src'
// @ts-expect-error Pointer gesture wiring is internal to BoardRoot.
import { usePointerInteraction } from '../src'
