import { createContext, useContext } from "react";

export const AgencyContext = createContext(null);

export function useAgency() {
  return useContext(AgencyContext)?.agency ?? null;
}

export function useAgencyUpdater() {
  return useContext(AgencyContext)?.onUpdateAgency ?? null;
}

// Returns a function that prefixes any path with /:agencySlug
export function useAgencyPath() {
  const agency = useContext(AgencyContext)?.agency;
  return (path) => (agency ? `/${agency.slug}${path}` : path);
}
