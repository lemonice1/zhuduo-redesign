"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createSiteArchitecture } from "../../lib/site-architecture";
import type { ProductCategoryDefinition } from "../../lib/product-categories";

const ArchitectureContext = createContext(createSiteArchitecture());
export const useSiteArchitecture = () => useContext(ArchitectureContext);
export function ArchitectureProvider({ categories, children }: { categories?: ProductCategoryDefinition[]; children: ReactNode }) {
  const value = useMemo(() => createSiteArchitecture(categories), [categories]);
  return <ArchitectureContext.Provider value={value}>{children}</ArchitectureContext.Provider>;
}
