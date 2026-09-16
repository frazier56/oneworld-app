/**
 * Shim: One World addresses come from the shell, never from a per-app copy.
 *
 * OneJob's own `oneWorld.ts` hard-coded `https://onejob.oneworldlabs.ai/...` for in-app links.
 * Under the single origin those are INTERNAL doorways — `appHome`/`appProfile` return
 * `/jobs/...` paths, and only links that get pasted OUTSIDE the app (hire link, contract link)
 * keep an absolute marketing host. Importing the shell's version is what keeps a OneJob screen
 * from walking a signed-in member out of their own installed app.
 */
export {
  appHome, appDoorway, appProfile, hireLink, contractLink, HUB, RETIRED_PATHS,
  CONSUMER_APPS, SERVICES, PRODUCT_BRAND, type AppKey,
} from "@oneworld/shell";
