import { createContext, useContext, ReactNode } from "react";
/* VAIA's face is served from `public/`, not bundled. There used to be a second,
   byte-identical copy under `oneevent/assets/` and only the public one was ever committed,
   which broke a clean build (found by Max, 13 Aug 2026). One file, one path — the same
   `/vaia-avatar-v5.png` that `VaiaFace` in the shell already defaults to. */
const vaiaAvatar = "/vaia-avatar-v5.png";

/** Recovered from the live OneSocial source (2026-07-09 backup). OneEvent is
 *  single-persona: VAIA only. The default context is fully populated, so
 *  useAiAssistant() works with or without a provider — no main.tsx change
 *  required. avatar = the real vaia-avatar-v5.png (white female android,
 *  green eyes, headset). */
interface AiAssistantContextValue {
  avatar: string;
  name: string;
  fullName: string;
}

const AiAssistantContext = createContext<AiAssistantContextValue>({
  avatar: vaiaAvatar,
  name: "VAIA",
  fullName: "Virtual Artificial Intelligence Assistant",
});

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  return (
    <AiAssistantContext.Provider
      value={{
        avatar: vaiaAvatar,
        name: "VAIA",
        fullName: "Virtual Artificial Intelligence Assistant",
      }}
    >
      {children}
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  return useContext(AiAssistantContext);
}
