import { createContext, useContext, ReactNode } from "react";

/** Recovered from the live OneSocial source (2026-07-09 backup). OneEvent is
 *  single-persona: VAIA only. The default context is fully populated, so
 *  useAiAssistant() works with or without a provider — no main.tsx change
 *  required. avatar = the real vaia-avatar-v5.png (white female android,
 *  green eyes, headset). */

/**
 * VAIA'S FACE LIVES IN /public ON PURPOSE — DO NOT `import` IT FROM src/assets.
 *
 * THE BUG THIS FIXES (Lee, Jul 26 2026): "my VAIA assets for faces disappeared... wherever VAIA is
 * supposed to be, she's not there." Every header and every VAIA modal showed a broken-image icon
 * with the alt text "VAIA".
 *
 * Cause: the avatar used to be `import vaiaAvatar from "@job/assets/vaia-avatar-v5.png"`. Vite turns an
 * imported asset into a CONTENT-HASHED file — `vaia-avatar-v5-DmDhMdWy.png` — which means the
 * filename is a build artefact that has to be re-uploaded alongside the JS. OneJob deploys by hand
 * through GitHub's "Upload files" page, where the routine is index.html + 404.html + the JS + the
 * CSS. A 342 KB hashed PNG that silently becomes a required fifth upload is a trap, and it caught us:
 * the bundle asked for a hash that had never been uploaded, so the request 404'd on every page.
 *
 * A file in `public/` is copied through VERBATIM. `/onejob/vaia-avatar-v5.png` is a stable URL that
 * survives every future JS-only deploy and only ever needs uploading once. The class of bug is gone,
 * not just this instance of it.
 *
 * BASE_URL rather than a hardcoded "/onejob/" so this still resolves under a dev server at "/".
 */
export const VAIA_AVATAR = `${import.meta.env.BASE_URL}vaia-avatar-v5.png`;

interface AiAssistantContextValue {
  avatar: string;
  name: string;
  fullName: string;
}

const AiAssistantContext = createContext<AiAssistantContextValue>({
  avatar: VAIA_AVATAR,
  name: "VAIA",
  fullName: "Virtual Artificial Intelligence Assistant",
});

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  return (
    <AiAssistantContext.Provider
      value={{
        avatar: VAIA_AVATAR,
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
