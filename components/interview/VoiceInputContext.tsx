"use client";

import { createContext, useContext } from "react";

const VoiceInputContext = createContext(false);

export function VoiceInputProvider({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  return <VoiceInputContext.Provider value={allowed}>{children}</VoiceInputContext.Provider>;
}

export function useVoiceInputAllowed() {
  return useContext(VoiceInputContext);
}
