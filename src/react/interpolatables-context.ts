import { createContext, useContext } from 'react'
import type { InterpolatableIdentifier } from '../types/prop-definition.js'

/**
 * The identifiers available for `${…}` interpolation to every slot below the
 * nearest editor that declared some.
 *
 * `interpolatables` live on the {@link PropDefinition} a host hands to the
 * top-level editor, but container editors build their children's definitions
 * from the type — which knows nothing of them. Carrying them in context is
 * what lets a string three levels into an object still get `${…}` completion,
 * and lets an {@link EditorPlugin} read them without being passed them.
 */
export const InterpolatablesContext = createContext<InterpolatableIdentifier[] | undefined>(undefined)

/** The interpolatables in scope for the slot being rendered, if any. */
export function useInterpolatables(): InterpolatableIdentifier[] | undefined {
  return useContext(InterpolatablesContext)
}
