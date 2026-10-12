/**
 * OVERLAY 48 (6 Oct 2026) — this file used to hold its OWN copy of the microphone code.
 * ============================================================================================
 * That copy listened for Spanish from Spain only, and for every other flag it listened in the
 * PHONE's language — so a German speaker on a Colombian phone was heard as Spanish. One experience,
 * one code: every app now uses the shell's microphone, which writes down the language it actually
 * hears. The button and recording overlay that also lived here were imported by nothing and are gone.
 * This file only keeps the old import path working.
 */
export { useVoiceTranscription } from "@oneworld/shell";
