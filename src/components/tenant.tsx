"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  branches as demoBranches,
  organisation as demoOrganisation,
  type Branch,
  type Organisation,
} from "@/data/organisation";

export type TenantValue = {
  organisation: Organisation;
  branches: Branch[];
  currentBranch: Branch;
  signedInAs: string | null;
  isDemo: boolean;
  needsOnboarding: boolean;
};

const FALLBACK: TenantValue = {
  organisation: demoOrganisation,
  branches: demoBranches,
  currentBranch: demoBranches[0],
  signedInAs: null,
  isDemo: true,
  needsOnboarding: false,
};

const TenantContext = createContext<TenantValue>(FALLBACK);

/**
 * The active organisation, resolved on the server and handed to the client
 * once. Receipts, the register and the settings screen read it from here rather
 * than importing a hard-coded pharmacy, which is what makes this one product
 * instead of one pharmacy's install.
 */
export function TenantProvider({ value, children }: { value: TenantValue; children: ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
