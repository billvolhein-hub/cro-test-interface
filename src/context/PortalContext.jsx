import { createContext, useContext } from "react";

export const PortalContext = createContext({ isPortal: false, portalClientId: null });

export function usePortal() {
  return useContext(PortalContext);
}
