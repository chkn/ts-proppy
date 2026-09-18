import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/**
 * Renders a catalog group's `icon` key, e.g. a provider logo. Icons are the
 * host's to interpret: ts-proppy only passes the key along.
 */
export type CatalogIconRenderer = (icon: string | undefined, size: number) => ReactNode

/** Supplies the {@link CatalogIconRenderer} for every catalog editor beneath it. */
export const CatalogIconContext = createContext<CatalogIconRenderer | undefined>(undefined)

/** The icon renderer in scope, if a host supplied one. */
export function useCatalogIcon(): CatalogIconRenderer | undefined {
  return useContext(CatalogIconContext)
}
