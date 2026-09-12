import ReservationMessageLink from "../components/ReservationMessageLink";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n, W } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { productHref } from "../routes";
import Avatar from "../components/Avatar";
import type { AppKey } from "../lib/oneWorld";
import { editMessage, MESSAGE_CHANGE_WINDOW_MS, recallMessage, sendMessage } from "../lib/conversations";
import MessageBody from "../components/MessageBody";

/**
 * THE THREAD — the missing half of Messages.
 * ============================================================================================
 * Lee, 11 Aug 2026, testing OneHome: *"on the messages, the messages did populate, but I can't
 * click on any messages… it just takes me to, like, a not found page."*
 *
 * ── WHAT WAS ACTUALLY WRONG ─────────────────────────────────────────────────────────────────
 * `MessagesScreen` has always rendered each row as `<Link to={productHref(product,
 * "/messages/" + t.id)}>`. No product mounts a `messages/:id` route, and no screen existed to put
 * behind one. So every tap on every conversation, in EVERY app — OneJob, OneScore, OneEvent,
 * OneSocial, OneAgent and OneHome — resolved to the catch-all and rendered Not found. There are
 * 475 real conversations and 318 real messages in the database and not one of them has ever been
 * openable. Lee found it in OneHome; it was never a OneHome bug.
 *
 * This is that screen, and it lives in the shell for the same reason the inbox does: a message
 * looks the same in all six apps, so there must not be six of it.
 *
 * ── AND A SECOND BUG THE BUILD TURNED UP ────────────────────────────────────────────────────
 * The inbox counts unread as `messages` where `read_at IS NULL`, and `public.messages` had NO
 * update policy permitting a RECIPIENT to set `read_at` — only "sender soft-deletes own" and a
 * narrow job_offer case. So nothing could ever be marked read and the badge could only grow.
 *
 * Fixed in migration `messages_mark_read_rpc_and_admin_role_table` with a SECURITY DEFINER
 * `mark_conversation_read(uuid)` rather than a broad UPDATE policy, because "participants can
 * update messages in their conversations" would also let either side quietly rewrite the other's
 * words after the fact. On a platform whose product is credibility that is a worse bug than the
 * one being fixed. The function can change exactly one column on exactly the rows the caller is
 * entitled to.
 *
 * ── LIVE, WITHOUT A POLLING LOOP ────────────────────────────────────────────────────────────
 * Postgres changes arrive over the realtime channel filtered to this conversation. If realtime is
 * not enabled for the table the subscription simply never fires and the thread still works — it is
 * an enhancement, never the delivery mechanism. What you send appears immediately because it is
 * appended optimistically; the realtime echo is de-duplicated by id.
 */

type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  message_type?: string | null;
  metadata?: Record<string,unknown>;
  pending?: boolean;
};

type GroupMember = { id: string; name: string | null; photo: string | null };
type GroupMediaItem = { id: string; url: string; type: "image" | "video" | "audio" | "file" };

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const AUDIO_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];
const MESSAGE_URLISH = /(https?:\/\/[^\s]+)/g;
const MESSAGE_MEDIA_URL = /\.(?:jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|mp3|m4a|aac|wav|ogg|oga)(?:[?#].*)?$/i;
const MESSAGE_MEDIA_LABEL = /^(Photo|Foto|Video|Attachment|Adjunto|Voice message|Mensaje de voz)(?::|\s|·|$)/i;
const EMOJIS = [
  "😀","😄","😂","🤣","😊","😍","😘","😎",
  "🥳","🤩","😇","🙂","😉","😌","😅","😭",
  "😤","😡","🤔","🙌","👏","🙏","💪","🔥",
  "✨","🎉","🚀","💯","❤️","🧡","💛","💚",
  "💙","💜","🤍","👍","👎","👀","💬","📍",
  "📸","🎥","🎤","🎟️","🍾","🍹","🍽️","☕",
  "🏆","💼","📅","⏰","✅","❌","⚠️","⭐",
  "🌎","🏠","🚗","✈️","💰","📎","🔗","📝",
];
const QUICK_REACTIONS = ["❤️", "😂", "😮", "🥺", "😡", "👍"];

export default function ThreadScreen({ product, contextSlot }: { product: AppKey; contextSlot?: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const isEs = lang === "es" || lang === "co";

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupMemberQuery, setGroupMemberQuery] = useState("");
  const [comingSoon, setComingSoon] = useState<"voice" | "video" | null>(null);
  const [composeBubble, setComposeBubble] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [actionMessage, setActionMessage] = useState<Msg | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const foot = useRef<HTMLDivElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const recordingStream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const soonTimer = useRef<number | null>(null);
  const composeTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  /* WHO IS THIS. Read the conversation first: it is also the authorisation check, because RLS
     returns no row for a conversation you are not in. A thread screen that renders chrome for a
     conversation you cannot read is a thread screen that leaks that the conversation exists. */
  const head = useAsync(async () => {
    const { data: c, error } = await supabase.from("conversations")
      .select("id, participant_ids, is_request, metadata")
      .eq("id", id!)
      .maybeSingle();
    if (error || !c) { setDenied(true); return null; }

    /* EVENT GROUP CHAT (17 Aug 2026): a conversation whose metadata says {group:true} is a room
       named after its event, with many participants. The header shows the event title instead of
       a counterparty, and each incoming bubble is attributed to its sender below. */
    const meta = (c.metadata as Record<string, unknown> | null) ?? null;
    const participantIds = (c.participant_ids as string[] | null) ?? [];
    if (meta?.group) {
      const eventId = (meta.event_id as string | undefined) ?? null;
      let photo: string | null = (meta.photo_url as string | undefined) ?? null;
      if (!photo && eventId) {
        const { data: eventRow } = await supabase.from("events")
          .select("cover_image_url")
          .eq("id", eventId)
          .maybeSingle();
        photo = (eventRow?.cover_image_url as string | null) ?? null;
      }
      return {
        otherId: null, name: (meta.title as string | undefined) ?? "Event chat", photo,
        isRequest: false, isGroup: true,
        memberCount: participantIds.length,
        memberIds: participantIds,
        eventId,
      };
    }

    const otherId = participantIds.find(p => p !== userId) ?? null;
    let name: string | null = null;
    let photo: string | null = null;
    if (otherId) {
      /* Column-named. `select('*')` on `profiles` throws 42501 for a signed-in member — the rule
         is in the architecture skill and it has bitten this codebase before. */
      const { data: p } = await supabase.from("profiles")
        .select("id, full_name, photo_url").eq("id", otherId).maybeSingle();
      name = (p?.full_name as string | null) ?? null;
      photo = (p?.photo_url as string | null) ?? null;
    }
    return {
      otherId, name, photo, isRequest: !!c.is_request, isGroup: false, memberCount: 2,
      memberIds: participantIds,
      eventId: (meta?.event_id as string | undefined) ?? null,
    };
  }, [id, userId], !!id && !!userId);

  useEffect(() => {
    setMenuOpen(false);
    setMessageMenuId(null);
    setSearchOpen(false);
    setSearchQuery("");
    setGroupInfoOpen(false);
    setGroupMemberQuery("");
    setComingSoon(null);
    setComposeBubble(null);
    setAttachMenuOpen(false);
    setEmojiOpen(false);
    setEditing(null);
    setReplyingTo(null);
    setActionMessage(null);
  }, [id]);

  useEffect(() => () => {
    if (soonTimer.current) window.clearTimeout(soonTimer.current);
    if (composeTimer.current) window.clearTimeout(composeTimer.current);
    window.dispatchEvent(new CustomEvent("ow-thread-composer-focus", { detail: { active: false } }));
    clearRecordingTimer();
    stopRecordingStream();
    clearLongPressTimer();
  }, []);

  useEffect(() => {
    if (!id) return;
    setPinnedId(window.localStorage.getItem(pinStorageKey(id)));
  }, [id]);

  /* WHO SAID WHAT — group mode only. Sender names are fetched in one batched read per new set of
     speakers; a missing profile renders as "Member" rather than blocking the thread. */
  const [senders, setSenders] = useState<Map<string, { name: string | null; photo: string | null }>>(new Map());
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  useEffect(() => {
    if (!head?.isGroup) return;
    const missing = [...new Set(msgs.map(m => m.sender_id))].filter(s => s !== userId && !senders.has(s));
    if (!missing.length) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, photo_url").in("id", missing);
      setSenders(prev => {
        const next = new Map(prev);
        for (const s of missing) next.set(s, { name: null, photo: null }); // never refetch a miss
        for (const p of data ?? []) next.set(p.id as string,
          { name: (p.full_name as string | null) ?? null, photo: (p.photo_url as string | null) ?? null });
        return next;
      });
    })();
  }, [head?.isGroup, msgs, userId, senders]);

  useEffect(() => {
    if (!head?.isGroup || !head.memberIds.length) { setGroupMembers([]); return; }
    let dead = false;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, photo_url")
        .in("id", head.memberIds);
      if (dead) return;
      const byId = new Map((data ?? []).map((p: any) => [p.id as string, p]));
      setGroupMembers(head.memberIds.map(uid => {
        const p = byId.get(uid) as any;
        return { id: uid, name: (p?.full_name as string | null) ?? null, photo: (p?.photo_url as string | null) ?? null };
      }));
    })();
    return () => { dead = true; };
  }, [head?.isGroup, head?.memberIds.join("|")]);

  /* THE MESSAGES. Soft-deleted rows are excluded here rather than rendered as "deleted" —
     `deleted_by` exists but nothing in the product has ever shown a tombstone, and inventing one
     now would change what every historic delete meant. */
  useEffect(() => {
    if (!id || !userId) return;
    let dead = false;
    (async () => {
      const { data, error } = await supabase.from("messages")
        .select("id, sender_id, content, created_at, read_at, message_type, metadata")
        .eq("conversation_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(500);
      if (dead) return;
      if (error) { setErr(error.message); return; }
      setMsgs((data ?? []) as Msg[]);
    })();
    return () => { dead = true; };
  }, [id, userId]);

  /* MARK READ. Fire-and-forget on open: a failure here must not stop you reading the thread, and
     the next open retries it anyway. */
  useEffect(() => {
    if (!id || !userId) return;
    supabase.rpc("mark_conversation_read", { p_conversation_id: id })
      .then(({ error }) => { if (error) console.error("[shell] mark read failed —", error.message); });
  }, [id, userId]);

  /* LIVE. Filtered server-side to this conversation so a busy platform does not stream every
     message on the instance to every open tab. */
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`thread:${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        payload => {
          const m = payload.new as Msg;
          if (!m?.id) return;
          setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  /* Stay pinned to the bottom, which is where a conversation is. `auto` rather than `smooth` on
     first paint — animating a scroll the user did not ask for reads as the page being unstable. */
  const count = msgs.length;
  useEffect(() => { foot.current?.scrollIntoView({ block: "end" }); }, [count]);

  async function send() {
    const rawText = draft.trim();
    const text = replyingTo && !editing ? withReplyPrefix(rawText, replyingTo, messageAuthor(replyingTo)) : rawText;
    const editingMedia = editing ? hasEditableMedia(editing) : false;
    if ((!rawText && !editingMedia) || !id || !userId || sending) return;
    setSending(true); setErr(null);

    if (editing) {
      const current = editing;
      const nextContent = editingMedia ? contentWithEditedMediaCaption(current.content, rawText) : rawText;
      const res = await editMessage(current.id, userId, nextContent);
      setSending(false);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsgs(prev => prev.map(m => m.id === current.id ? { ...m, content: nextContent } : m));
      setEditing(null);
      setDraft("");
      return;
    }

    /* Optimistic, with a temporary id. The realtime echo carries the real id and is de-duplicated
       against it, so the message does not appear twice. */
    const tmp: Msg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      sender_id: userId, content: text,
      created_at: new Date().toISOString(), read_at: null, message_type: "text", pending: true,
    };
    setMsgs(prev => [...prev, tmp]);
    setDraft("");
    setReplyingTo(null);

    const res = await sendMessage(id, userId, text);
    setSending(false);
    if ("error" in res) {
      /* Put the words back in the box. Losing what somebody typed because the network blinked is
         the one outcome a message box is not allowed to have. */
      setMsgs(prev => prev.filter(m => m.id !== tmp.id));
      setDraft(text);
      setErr(res.error);
      return;
    }
    setMsgs(prev => prev.map(m => m.id === tmp.id ? { ...m, pending: false } : m));
  }

  function startEditMessage(m: Msg) {
    setMessageMenuId(null);
    setActionMessage(null);
    if (!canEditMessage(m)) return;
    setEditing(m);
    setReplyingTo(null);
    setDraft(editableMessageText(m));
    window.requestAnimationFrame(() => textInput.current?.focus());
  }

  async function recallOwnMessage(m: Msg) {
    if (!userId || !canRecallMessage(m)) return;
    setMessageMenuId(null);
    setActionMessage(null);
    const res = await recallMessage(m.id, userId);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    setMsgs(prev => prev.filter(x => x.id !== m.id));
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  function startReply(m: Msg) {
    setActionMessage(null);
    setEditing(null);
    setReplyingTo(m);
    window.requestAnimationFrame(() => textInput.current?.focus());
  }

  async function copyMessage(m: Msg) {
    setActionMessage(null);
    try {
      await navigator.clipboard.writeText(m.content);
      showComposeBubble(W(lang, "Copied", "Copiado"));
    } catch {
      setErr(W(lang, "Could not copy that message.", "No se pudo copiar ese mensaje."));
    }
  }

  function translateMessage(m: Msg) {
    setActionMessage(null);
    const target = lang === "en" ? "en" : lang === "co" ? "es" : lang;
    window.open(`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(m.content)}&op=translate`, "_blank", "noopener,noreferrer");
  }

  function togglePinMessage(m: Msg) {
    if (!id) return;
    const next = pinnedId === m.id ? null : m.id;
    setPinnedId(next);
    if (next) window.localStorage.setItem(pinStorageKey(id), next);
    else window.localStorage.removeItem(pinStorageKey(id));
    setActionMessage(null);
  }

  function addStickerToReply(m: Msg) {
    setActionMessage(null);
    setReplyingTo(m);
    setEmojiOpen(true);
    window.requestAnimationFrame(() => textInput.current?.focus());
  }

  async function sendQuickReaction(emoji: string, m: Msg) {
    if (!id || !userId) return;
    setActionMessage(null);
    const text = withReplyPrefix(emoji, m, messageAuthor(m));
    const tmp: Msg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      sender_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
      message_type: "text",
      pending: true,
    };
    setMsgs(prev => [...prev, tmp]);
    const res = await sendText(text);
    if ("error" in res) {
      setMsgs(prev => prev.filter(x => x.id !== tmp.id));
      setErr(res.error);
      return;
    }
    setMsgs(prev => prev.map(x => x.id === tmp.id ? { ...x, pending: false } : x));
  }

  function openMessageActions(m: Msg) {
    clearLongPressTimer();
    setMessageMenuId(null);
    setActionMessage(m);
  }

  function armLongPress(m: Msg) {
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => openMessageActions(m), 430);
  }

  function clearLongPressTimer() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function showComingSoon(kind: "voice" | "video") {
    if (soonTimer.current) window.clearTimeout(soonTimer.current);
    setComingSoon(kind);
    soonTimer.current = window.setTimeout(() => setComingSoon(null), 1500);
  }

  function showComposeBubble(label: string) {
    if (composeTimer.current) window.clearTimeout(composeTimer.current);
    setComposeBubble(label);
    composeTimer.current = window.setTimeout(() => setComposeBubble(null), 1600);
  }

  function setComposerKeyboardMode(active: boolean) {
    setComposerFocused(active);
    window.dispatchEvent(new CustomEvent("ow-thread-composer-focus", { detail: { active } }));
  }

  function insertEmoji(emoji: string) {
    const el = textInput.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    window.requestAnimationFrame(() => {
      textInput.current?.focus();
      textInput.current?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function sendText(text: string) {
    if (!id || !userId) return { error: W(lang, "Missing conversation.", "Falta la conversación.") };
    return sendMessage(id, userId, text);
  }

  async function sendMediaMessage(text: string, messageType: "image" | "video" | "file" | "audio") {
    if (!id || !userId) return { error: W(lang, "Missing conversation.", "Falta la conversación.") };
    return sendMessage(id, userId, text, { messageType });
  }

  async function attach(files: FileList | null) {
    const f = files?.[0];
    if (!f || !id || !userId || attaching) return;
    setAttachMenuOpen(false);
    setErr(null);

    if (f.size > MAX_ATTACHMENT_BYTES) {
      setErr(W(lang, "That file is over 25 MB.", "Ese archivo supera 25 MB."));
      return;
    }

    setAttaching(true);
    try {
      const path = `${userId}/messages/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(f.name)}`;
      const { error } = await supabase.storage.from("media")
        .upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
      if (error) throw error;

      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const label = f.type.startsWith("image/")
        ? W(lang, "Photo", "Foto")
        : f.type.startsWith("video/")
          ? W(lang, "Video", "Video")
          : W(lang, "Attachment", "Adjunto");
      const messageType = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file";
      const res = await sendMediaMessage(`${label}: ${f.name.slice(0, 80)}\n${url}`, messageType);
      if ("error" in res) setErr(res.error);
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? W(lang, "Could not attach that file.", "No se pudo adjuntar ese archivo.")));
    } finally {
      setAttaching(false);
    }
  }

  async function shareLocation() {
    setAttachMenuOpen(false);
    if (!navigator.geolocation) {
      showComposeBubble(W(lang, "Location is not available here.", "La ubicación no está disponible aquí."));
      return;
    }
    setAttaching(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const url = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      const res = await sendText(`${W(lang, "My location", "Mi ubicación")}\n${url}`);
      if ("error" in res) setErr(res.error);
      setAttaching(false);
    }, error => {
      setErr(error.message || W(lang, "Could not get your location.", "No se pudo obtener su ubicación."));
      setAttaching(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  async function shareRelatedEvent() {
    setAttachMenuOpen(false);
    if (!relatedEventHref) {
      showComposeBubble(W(lang, "Event sharing is coming soon", "Compartir eventos próximamente"));
      return;
    }
    const href = `${window.location.origin}${relatedEventHref}`;
    const res = await sendText(`${W(lang, "Event", "Evento")}: ${who}\n${href}`);
    if ("error" in res) setErr(res.error);
  }

  async function toggleVoiceRecording() {
    setAttachMenuOpen(false);
    setEmojiOpen(false);
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!id || !userId || attaching || sending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showComposeBubble(W(lang, "Voice recording is not available here.", "La grabación de voz no está disponible aquí."));
      return;
    }

    try {
      setErr(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder: rec, mimeType } = createAudioRecorder(stream);
      recordingStream.current = stream;
      recordingChunks.current = [];
      recorder.current = rec;

      rec.ondataavailable = e => {
        if (e.data.size > 0) recordingChunks.current.push(e.data);
      };
      rec.onerror = e => {
        console.error("[thread] voice recording failed:", e);
        setErr(W(lang, "Voice recording stopped unexpectedly.", "La grabación se detuvo inesperadamente."));
        clearRecordingTimer();
        stopRecordingStream();
        setRecording(false);
      };
      rec.onstop = () => {
        const chunks = recordingChunks.current;
        const seconds = recordingSecondsRef.current;
        const type = rec.mimeType || mimeType || chunks[0]?.type || "audio/mp4";
        clearRecordingTimer();
        stopRecordingStream();
        setRecording(false);
        setRecordingSeconds(0);
        if (!chunks.length || seconds < 1) return;
        void sendVoiceBlob(new Blob(chunks, { type }), seconds, type);
      };

      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      setRecording(true);
      recordingTimer.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
      rec.start();
    } catch (e: any) {
      stopRecordingStream();
      setRecording(false);
      setErr(String(e?.message ?? e ?? W(lang, "Could not start voice recording.", "No se pudo iniciar la grabación.")));
    }
  }

  function clearRecordingTimer() {
    if (recordingTimer.current) window.clearInterval(recordingTimer.current);
    recordingTimer.current = null;
    recordingSecondsRef.current = 0;
  }

  function stopRecordingStream() {
    recordingStream.current?.getTracks().forEach(track => track.stop());
    recordingStream.current = null;
    recorder.current = null;
  }

  async function sendVoiceBlob(blob: Blob, seconds: number, mimeType: string) {
    if (!id || !userId) return;
    setAttaching(true);
    try {
      const ext = audioExt(mimeType);
      const contentType = storageAudioContentType(mimeType);
      const path = `${userId}/messages/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-voice.${ext}`;
      const { error } = await supabase.storage.from("media")
        .upload(path, blob, { upsert: false, contentType });
      if (error) throw error;

      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const label = `${W(lang, "Voice message", "Mensaje de voz")} · ${formatDuration(seconds)}`;
      const tmp: Msg = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        sender_id: userId,
        content: `${label}\n${url}`,
        created_at: new Date().toISOString(),
        read_at: null,
        message_type: "audio",
        pending: true,
      };
      setMsgs(prev => [...prev, tmp]);
      const res = await sendMediaMessage(`${label}\n${url}`, "audio");
      if ("error" in res) {
        setMsgs(prev => prev.filter(m => m.id !== tmp.id));
        setErr(res.error);
        return;
      }
      setMsgs(prev => prev.map(m => m.id === tmp.id ? { ...m, pending: false } : m));
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? W(lang, "Could not send that voice note.", "No se pudo enviar esa nota de voz.")));
    } finally {
      setAttaching(false);
    }
  }

  const who = head?.name ?? W(lang, "Conversation", "Conversación");
  const backHref = productHref(product, "/messages");
  const relatedEventHref = head?.eventId && product === "oneevent" ? productHref(product, `/e/${head.eventId}`) : null;

  /* Day separators. A wall of times with no dates is unreadable past about a day. */
  const withDays = useMemo(() => {
    let last = "";
    return msgs.map(m => {
      const d = new Date(m.created_at).toDateString();
      const first = d !== last;
      last = d;
      return { m, dayLabel: first ? dayLabel(m.created_at, isEs) : null };
    });
  }, [msgs, isEs]);
  const query = searchQuery.trim().toLowerCase();
  const pinnedMessage = pinnedId ? msgs.find(m => m.id === pinnedId) ?? null : null;
  const groupMedia = useMemo(() => head?.isGroup ? msgs.flatMap(messageMediaItems) : [], [head?.isGroup, msgs]);
  const visibleGroupMembers = useMemo(() => {
    const q = groupMemberQuery.trim().toLowerCase();
    if (!q) return groupMembers;
    return groupMembers.filter(m => (m.name ?? W(lang, "Member", "Miembro")).toLowerCase().includes(q));
  }, [groupMembers, groupMemberQuery, lang]);

  function messageAuthor(m: Msg): string {
    if (m.sender_id === userId) return W(lang, "You", "Tú");
    if (head?.isGroup) return senders.get(m.sender_id)?.name ?? W(lang, "Member", "Miembro");
    return who;
  }

  if (denied) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] font-bold">
          {W(lang, "That conversation isn’t available.", "Esa conversación no está disponible.")}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed opacity-60">
          {W(lang, "It may have been deleted, or it belongs to someone else.",
                   "Puede que se haya eliminado, o que sea de otra persona.")}
        </p>
        <button onClick={() => nav(backHref)} className="btn-primary mt-4">
          {W(lang, "Back to messages", "Volver a mensajes")}
        </button>
      </div>
    );
  }

  return (
    /* The composer is fixed above app tabs until the message box is focused. On phones, the
       keyboard owns the bottom edge and the global tabs stand down; the composer moves with the
       keyboard instead of dragging the whole app footer with it. */
    <div className="flex min-h-[60vh] min-w-0 flex-col overflow-x-hidden pb-[calc(var(--ow-tabs,76px)+104px)]">
      {/* ── WHO ────────────────────────────────────────────────────────────────────────────
          Tapping the name opens their public world. On a credibility platform, "who am I actually
          talking to" is one tap from every message, not buried in a menu. */}
      <div className="sticky top-14 z-30 -mx-4 -mt-4 mb-2 border-b border-ink/[0.07] bg-paper/95 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-ink/95">
        <div className="flex min-h-10 items-center gap-1.5">
          <button onClick={() => nav(backHref)} aria-label={W(lang, "Back", "Atrás")}
            className="ow-tap grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold opacity-75">‹</button>
          <button
            onClick={() => head?.isGroup ? setGroupInfoOpen(true) : head?.otherId && nav(productHref(product, `/p/${head.otherId}`))}
            disabled={!head?.isGroup && !head?.otherId}
            className="ow-tap flex min-w-0 flex-1 items-center gap-2 text-left">
            {head?.isGroup ? (
              <Avatar src={head.photo ?? null} name={who} size={36} rounded="rounded-full" textSize="text-xs" />
            ) : (
              <Avatar src={head?.photo ?? null} name={who} size={36} rounded="rounded-full" textSize="text-sm" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold leading-tight">{who}</span>
              {head?.isRequest && (
                <span className="block text-[11px] font-semibold opacity-55">
                  {W(lang, "Message request", "Solicitud de mensaje")}
                </span>
              )}
              {head?.isGroup && (
                <span className="block text-[11px] font-semibold opacity-55">
                  {W(lang, `Event chat · ${head.memberCount} people`, `Chat del evento · ${head.memberCount} personas`)}
                </span>
              )}
            </span>
          </button>
          {!head?.isGroup && (
            <>
              <div className="relative max-[420px]:hidden">
                {comingSoon === "voice" && <ComingSoonBubble label={W(lang, "Coming soon", "Próximamente")} />}
                <button type="button" onClick={() => showComingSoon("voice")} aria-label={W(lang, "Voice call", "Llamada")}
                title={W(lang, "Voice calling is not available yet.", "Las llamadas aún no están disponibles.")}
                className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/60 opacity-45 dark:border-white/10 dark:bg-white/10">
                  <IconPhone />
                </button>
              </div>
              <div className="relative max-[420px]:hidden">
                {comingSoon === "video" && <ComingSoonBubble label={W(lang, "Coming soon", "Próximamente")} />}
                <button type="button" onClick={() => showComingSoon("video")} aria-label={W(lang, "Video call", "Videollamada")}
                title={W(lang, "Video calling is not available yet.", "Las videollamadas aún no están disponibles.")}
                className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/60 opacity-45 dark:border-white/10 dark:bg-white/10">
                  <IconVideo />
                </button>
              </div>
            </>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)} aria-label={W(lang, "Conversation menu", "Menú de conversación")}
              className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand/10 text-brand shadow-sm">
              <IconMore />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-ink/10 bg-paper p-1.5 text-[13px] font-semibold shadow-2xl dark:border-white/10 dark:bg-ink">
                {head?.isGroup && (
                  <button onClick={() => { setMenuOpen(false); setGroupInfoOpen(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/10">
                    <IconInfo /> {W(lang, "Group info", "Info del grupo")}
                  </button>
                )}
                {head?.otherId && (
                  <button onClick={() => { setMenuOpen(false); nav(productHref(product, `/p/${head.otherId}`)); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/10">
                    <IconPerson /> {W(lang, "View profile", "Ver perfil")}
                  </button>
                )}
                <button onClick={() => { setMenuOpen(false); setSearchOpen(true); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/10">
                  <IconSearch /> {W(lang, "Search chat", "Buscar chat")}
                </button>
                {relatedEventHref && (
                  <button onClick={() => { setMenuOpen(false); nav(relatedEventHref); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/10">
                    <IconTicket /> {W(lang, "View event", "Ver evento")}
                  </button>
                )}
                {head?.isGroup && (
                  <button onClick={() => { setMenuOpen(false); setGroupInfoOpen(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/10">
                    <IconGallery /> {W(lang, "Media", "Medios")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {searchOpen && (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={W(lang, "Search this chat", "Buscar en este chat")}
              className="input h-9 flex-1 !rounded-full !py-1.5 text-[13px]" />
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="ow-tap rounded-full px-3 py-1.5 text-[12px] font-bold opacity-65">
              {W(lang, "Close", "Cerrar")}
            </button>
          </div>
        )}
        {pinnedMessage && (
          <button type="button" onClick={() => setActionMessage(pinnedMessage)}
            className="ow-tap mt-2 flex w-full items-center gap-2 rounded-2xl border border-brand/20 bg-brand/10 px-3 py-2 text-left text-[12px]">
            <IconPin />
            <span className="min-w-0 flex-1">
              <span className="block font-black text-brand">{W(lang, "Pinned message", "Mensaje fijado")}</span>
              <span className="block truncate opacity-65">{messageSnippet(pinnedMessage.content, 90)}</span>
            </span>
            <span className="text-[11px] font-bold opacity-55">{W(lang, "Open", "Abrir")}</span>
          </button>
        )}
      </div>

      {groupInfoOpen && head?.isGroup && (
        <div className="fixed inset-0 z-[80] bg-ink/45 p-3 backdrop-blur-sm" onClick={() => setGroupInfoOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className="relative mx-auto flex h-full max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-paper shadow-2xl dark:border-white/10 dark:bg-ink">
            <div className="border-b border-ink/[0.07] px-5 py-4 text-center dark:border-white/10">
              <button onClick={() => setGroupInfoOpen(false)}
                className="ow-tap absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white/70 dark:border-white/10 dark:bg-white/10">
                <IconClose />
              </button>
              <Avatar src={head.photo ?? null} name={who} size={68} rounded="rounded-full" textSize="text-sm" />
              <h2 className="mx-auto max-w-xs text-balance text-lg font-black leading-tight">{who}</h2>
              <p className="mt-1 text-[12px] font-semibold opacity-55">
                {W(lang, `Event chat · ${head.memberCount} people`, `Chat del evento · ${head.memberCount} personas`)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-black">
                {relatedEventHref && (
                  <button onClick={() => { setGroupInfoOpen(false); nav(relatedEventHref); }}
                    className="ow-tap rounded-2xl border border-ink/10 bg-white/70 px-2 py-2.5 dark:border-white/10 dark:bg-white/10">
                    <span className="mx-auto mb-1 grid h-7 w-7 place-items-center"><IconTicket /></span>
                    {W(lang, "Event", "Evento")}
                  </button>
                )}
                <button onClick={() => { setGroupInfoOpen(false); setSearchOpen(true); }}
                  className="ow-tap rounded-2xl border border-ink/10 bg-white/70 px-2 py-2.5 dark:border-white/10 dark:bg-white/10">
                  <span className="mx-auto mb-1 grid h-7 w-7 place-items-center"><IconSearch /></span>
                  {W(lang, "Search", "Buscar")}
                </button>
                <button onClick={() => {
                  const el = document.getElementById("ow-group-media");
                  el?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
                  className="ow-tap rounded-2xl border border-ink/10 bg-white/70 px-2 py-2.5 dark:border-white/10 dark:bg-white/10">
                  <span className="mx-auto mb-1 grid h-7 w-7 place-items-center"><IconGallery /></span>
                  {W(lang, "Media", "Medios")}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section id="ow-group-media">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13px] font-black">{W(lang, "Media, links, and docs", "Medios, enlaces y docs")}</h3>
                  <span className="text-[11px] font-bold opacity-45">{groupMedia.length}</span>
                </div>
                {groupMedia.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {groupMedia.slice(0, 12).map(item => (
                      <a key={item.id} href={item.url} target="_blank" rel="noreferrer"
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink/[0.04] dark:border-white/10 dark:bg-white/10">
                        {item.type === "image" ? (
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-brand"><IconGallery /></span>
                        )}
                        <span className="absolute bottom-1 right-1 rounded-full bg-ink/75 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {W(lang, "Open", "Abrir")}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-ink/10 px-4 py-5 text-center text-[12px] opacity-55 dark:border-white/10">
                    {W(lang, "Photos and shared files will appear here after the group starts using the chat.",
                             "Las fotos y archivos compartidos aparecerán aquí cuando el grupo use el chat.")}
                  </p>
                )}
              </section>
              <section>
                <input value={groupMemberQuery} onChange={e => setGroupMemberQuery(e.target.value)}
                  placeholder={W(lang, "Search members", "Buscar miembros")}
                  className="mb-3 h-10 w-full rounded-full border border-ink/10 bg-white/75 px-4 text-[13px] font-semibold outline-none placeholder:font-semibold placeholder:opacity-45 dark:border-white/10 dark:bg-white/10" />
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-black">
                    {W(lang, `${head.memberCount} members`, `${head.memberCount} miembros`)}
                  </h3>
                  <span className="text-[11px] font-bold opacity-45">
                    {visibleGroupMembers.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {visibleGroupMembers.map(member => (
                    <button key={member.id} onClick={() => nav(productHref(product, `/p/${member.id}`))}
                      className="ow-tap flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-ink/[0.04] dark:hover:bg-white/10">
                      <Avatar src={member.photo} name={member.name ?? W(lang, "Member", "Miembro")} size={38} rounded="rounded-full" textSize="text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{member.id === userId ? W(lang, "You", "Tú") : member.name ?? W(lang, "Member", "Miembro")}</span>
                        <span className="block text-[11px] opacity-45">{W(lang, "Ticket holder", "Titular de entrada")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-1.5">
        {withDays.length === 0 && (
          <p className="py-14 text-center text-[13px] opacity-55">
            {W(lang, "No messages yet. Say hello.", "Aún no hay mensajes. Saluda.")}
          </p>
        )}

        {withDays.map(({ m, dayLabel: dl }) => {
          const mine = m.sender_id === userId;
          const canEdit = mine && canEditMessage(m);
          const canRecall = mine && canRecallMessage(m);
          return (
            <div key={m.id}>
              {dl && (
                <p className="py-3 text-center text-[10.5px] font-black uppercase tracking-wide opacity-40">{dl}</p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  onContextMenu={e => { e.preventDefault(); openMessageActions(m); }}
                  onPointerDown={() => armLongPress(m)}
                  onPointerUp={clearLongPressTimer}
                  onPointerCancel={clearLongPressTimer}
                  onPointerLeave={clearLongPressTimer}
                  className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${(canEdit || canRecall) ? "pr-8" : ""} ${
                  mine
                    ? "rounded-br-md bg-brand text-white"
                    : "rounded-bl-md bg-ink/[0.06] dark:bg-white/[0.10]"}`}>
                  {(canEdit || canRecall) && (
                    <div className="absolute right-1.5 top-1.5">
                      <button type="button" onClick={() => setMessageMenuId(messageMenuId === m.id ? null : m.id)}
                        aria-label={W(lang, "Message actions", "Acciones del mensaje")}
                        className="ow-tap grid h-6 w-6 place-items-center rounded-full bg-white/15 text-white/75 hover:bg-white/25">
                        <IconMore />
                      </button>
                      {messageMenuId === m.id && (
                        <div className="absolute right-0 top-7 z-40 w-36 overflow-hidden rounded-xl border border-ink/10 bg-paper p-1 text-[12px] font-bold text-ink shadow-2xl dark:border-white/10 dark:bg-ink dark:text-white">
                          {canEdit && (
                            <button type="button" onClick={() => startEditMessage(m)}
                              className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-ink/[0.06] dark:hover:bg-white/10">
                              {W(lang, "Edit", "Editar")}
                            </button>
                          )}
                          {canRecall && (
                            <button type="button" onClick={() => recallOwnMessage(m)}
                              className="block w-full rounded-lg px-2.5 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10">
                              {W(lang, "Recall", "Retirar")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Group rooms attribute every incoming bubble — a nameless message in a
                      50-person event chat is noise. 1:1 threads stay clean; the header says who. */}
                  {head?.isGroup && !mine && (
                    <p className="mb-0.5 text-[11px] font-bold text-brand">
                      {senders.get(m.sender_id)?.name ?? W(lang, "Member", "Miembro")}
                    </p>
                  )}
                  <MessageBody text={m.content} mine={mine} highlight={query} messageType={m.message_type} />
                  <ReservationMessageLink metadata={m.metadata} userId={userId} lang={lang} />
                  <p className={`mt-0.5 text-right text-[10px] tabular-nums ${mine ? "text-white/65" : "opacity-45"}`}>
                    {m.pending
                      ? W(lang, "Sending…", "Enviando…")
                      : new Date(m.created_at).toLocaleTimeString(isEs ? "es" : "en",
                          { hour: "numeric", minute: "2-digit" })}
                    {mine && !m.pending && m.read_at ? " · ✓✓" : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {contextSlot && <div className="my-3">{contextSlot}</div>}
        <div ref={foot} />
      </div>

      {err && <p className="mt-2 text-center text-[12px] font-semibold text-red-500">{err}</p>}
      {actionMessage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 px-3 pb-[calc(var(--ow-tabs,76px)+12px)] backdrop-blur-[2px]"
          onClick={() => setActionMessage(null)}>
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="mb-2 rounded-[28px] border border-white/10 bg-ink/95 px-3 py-2 text-white shadow-2xl">
              <p className="mb-1 text-center text-[12px] font-semibold text-white/55">
                {W(lang, "Tap and hold to react", "Mantén presionado para reaccionar")}
              </p>
              <div className="flex items-center justify-between gap-1 text-[28px]">
                {QUICK_REACTIONS.map(emoji => (
                  <button key={emoji} type="button" onClick={() => sendQuickReaction(emoji, actionMessage)}
                    className="ow-tap grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
                    {emoji}
                  </button>
                ))}
                <button type="button" onClick={() => addStickerToReply(actionMessage)}
                  className="ow-tap grid h-11 w-11 place-items-center rounded-full text-[34px] text-white/70 hover:bg-white/10">
                  +
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-ink/95 p-2 text-[18px] font-semibold text-white shadow-2xl">
              <MessageAction onClick={() => startReply(actionMessage)} icon={<IconReply />} label={W(lang, "Reply", "Responder")} />
              <MessageAction onClick={() => copyMessage(actionMessage)} icon={<IconCopy />} label={W(lang, "Copy", "Copiar")} />
              <MessageAction onClick={() => translateMessage(actionMessage)} icon={<IconTranslate />} label={W(lang, "Translate", "Traducir")} />
              <MessageAction onClick={() => togglePinMessage(actionMessage)} icon={<IconPin />} label={pinnedId === actionMessage.id ? W(lang, "Unpin", "Desfijar") : W(lang, "Pin", "Fijar")} />
              <MessageAction onClick={() => addStickerToReply(actionMessage)} icon={<IconSticker />} label={W(lang, "Add sticker", "Agregar sticker")} />
              {actionMessage.sender_id === userId && canRecallMessage(actionMessage) && (
                <MessageAction danger onClick={() => recallOwnMessage(actionMessage)} icon={<IconUndo />} label={W(lang, "Unsend", "Anular envío")} />
              )}
              {actionMessage.sender_id === userId && canEditMessage(actionMessage) && (
                <MessageAction onClick={() => startEditMessage(actionMessage)} icon={<IconEdit />} label={W(lang, "Edit", "Editar")} />
              )}
              <MessageAction onClick={() => { setActionMessage(null); setMenuOpen(true); }} icon={<IconMore />} label={W(lang, "More", "Más")} />
            </div>
          </div>
        </div>
      )}

      {/* ── THE COMPOSER ───────────────────────────────────────────────────────────────────
          Fixed to the shell-published tab-bar height instead of a guessed pixel offset. Enter
          sends, Shift+Enter is a newline — the convention everywhere, and a textarea that grows
          to four lines and then scrolls. */}
      <div style={{ bottom: composerFocused ? "env(safe-area-inset-bottom)" : "var(--ow-tabs,76px)" }}
        className="fixed inset-x-0 z-30 box-border w-screen max-w-[100vw] overflow-visible border-t border-ink/[0.07] bg-paper/95 px-2 py-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-ink/95 sm:px-3">
        <div className="mx-auto w-full max-w-lg min-w-0">
          {editing && (
            <div className="mb-1 flex items-center justify-between rounded-2xl border border-brand/20 bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand">
              <span>{W(lang, "Editing message", "Editando mensaje")}</span>
              <button type="button" onClick={cancelEdit} className="ow-tap rounded-full px-2 py-1 text-[11px]">
                {W(lang, "Cancel", "Cancelar")}
              </button>
            </div>
          )}
          {replyingTo && !editing && (
            <div className="mb-1 flex items-center justify-between rounded-2xl border border-brand/20 bg-brand/10 px-3 py-1.5 text-[12px]">
              <span className="min-w-0">
                <span className="block font-black text-brand">{W(lang, "Replying to", "Respondiendo a")} {messageAuthor(replyingTo)}</span>
                <span className="block truncate opacity-65">{messageSnippet(replyingTo.content, 100)}</span>
              </span>
              <button type="button" onClick={() => setReplyingTo(null)} className="ow-tap rounded-full px-2 py-1 text-[11px] font-bold opacity-70">
                {W(lang, "Cancel", "Cancelar")}
              </button>
            </div>
          )}
          <div className="flex min-w-0 items-end gap-1.5 sm:gap-2">
          <input ref={galleryInput} type="file" className="hidden"
            accept="image/*,video/*"
            onChange={e => { attach(e.currentTarget.files); e.currentTarget.value = ""; }} />
          <input ref={cameraInput} type="file" className="hidden"
            accept="image/*" capture="environment"
            onChange={e => { attach(e.currentTarget.files); e.currentTarget.value = ""; }} />
          <input ref={documentInput} type="file" className="hidden"
            accept="application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={e => { attach(e.currentTarget.files); e.currentTarget.value = ""; }} />

          <div className="relative flex min-h-[46px] min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-brand/25 bg-white/92 px-1.5 py-1 shadow-[0_2px_14px_rgba(120,60,12,.10)] dark:border-white/10 dark:bg-white/[0.10]">
            {composeBubble && <ComingSoonBubble label={composeBubble} />}
            {attachMenuOpen && (
              <div className="glass-modal absolute bottom-[calc(100%+10px)] left-0 right-0 z-40 max-w-[calc(100vw-1rem)] overflow-hidden rounded-[28px] bg-white/[0.98] px-3 pb-3 pt-2 text-[12px] font-bold backdrop-blur-2xl dark:bg-ink/[0.98]">
                <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-ink/20 dark:bg-white/25" />
                <div className="grid grid-cols-4 gap-2 text-center">
                  <ComposerAction label={W(lang, "Gallery", "Galería")} tone="blue" onClick={() => galleryInput.current?.click()} icon={<IconGallery />} />
                  <ComposerAction label={W(lang, "Camera", "Cámara")} tone="pink" onClick={() => cameraInput.current?.click()} icon={<IconCamera />} />
                  <ComposerAction label={W(lang, "Location", "Ubicación")} tone="green" onClick={shareLocation} icon={<IconLocation />} />
                  <ComposerAction label={W(lang, "Contact", "Contacto")} tone="cyan"
                    onClick={() => { setAttachMenuOpen(false); showComposeBubble(W(lang, "Contact sharing is coming soon", "Compartir contactos próximamente")); }}
                    icon={<IconPerson />} muted />
                  <ComposerAction label={W(lang, "Document", "Documento")} tone="violet" onClick={() => documentInput.current?.click()} icon={<IconDocument />} />
                  <ComposerAction label={W(lang, "Poll", "Encuesta")} tone="amber"
                    onClick={() => { setAttachMenuOpen(false); showComposeBubble(W(lang, "Polls are coming soon", "Encuestas próximamente")); }}
                    icon={<IconPoll />} muted />
                  <ComposerAction label={W(lang, "Event", "Evento")} tone="rose" onClick={shareRelatedEvent} icon={<IconCalendar />} muted={!relatedEventHref} />
                  <ComposerAction label={W(lang, "AI images", "Imágenes AI")} tone="sky"
                    onClick={() => { setAttachMenuOpen(false); showComposeBubble(W(lang, "AI images are coming soon", "Imágenes AI próximamente")); }}
                    icon={<IconSparkles />} muted />
                </div>
              </div>
            )}
            {emojiOpen && (
              <div className="glass-modal absolute bottom-[calc(100%+10px)] left-0 right-0 z-40 max-w-[calc(100vw-1rem)] overflow-hidden rounded-[28px] bg-white/[0.98] px-3 pb-3 pt-2 text-[22px] backdrop-blur-2xl dark:bg-ink/[0.98]">
                <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-ink/20 dark:bg-white/25" />
                <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto pr-1 sm:grid-cols-8">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}
                      className="ow-tap grid h-9 place-items-center rounded-xl hover:bg-ink/[0.06] dark:hover:bg-white/10">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => { setAttachMenuOpen(v => !v); setEmojiOpen(false); }}
              aria-label={W(lang, "Add attachment", "Agregar adjunto")}
              className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand">
              <IconPlus />
            </button>
            <button type="button" onClick={() => { setEmojiOpen(v => !v); setAttachMenuOpen(false); }}
              aria-label={W(lang, "Emoji", "Iconos")}
              className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-70">
              <IconSmile />
            </button>
            <textarea
              ref={textInput}
              rows={1}
              className="min-h-[38px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-snug outline-none placeholder:text-ink/45 dark:placeholder:text-white/45"
              value={draft}
              placeholder={recording
                ? `${W(lang, "Recording", "Grabando")} ${formatDuration(recordingSeconds)}`
                : attaching
                  ? W(lang, "Attaching...", "Adjuntando...")
                  : W(lang, "Write a message...", "Escribe un mensaje...")}
              onChange={e => setDraft(e.target.value)}
              disabled={recording}
              onFocus={() => setComposerKeyboardMode(true)}
              onBlur={() => window.setTimeout(() => setComposerKeyboardMode(false), 120)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" onClick={() => cameraInput.current?.click()}
              aria-label={W(lang, "Camera", "Cámara")}
              className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-70">
              <IconCamera />
            </button>
          </div>

          {draft.trim() ? (
            <button onClick={send} disabled={sending || attaching}
              aria-label={W(lang, "Send", "Enviar")}
              className="btn-primary ow-tap grid h-11 w-11 shrink-0 place-items-center !rounded-2xl !p-0 disabled:opacity-40 sm:h-[46px] sm:w-[46px]">
              <IconSend />
            </button>
          ) : (
            <button type="button" onClick={toggleVoiceRecording} disabled={attaching || sending}
              aria-label={W(lang, "Voice message", "Mensaje de voz")}
              title={recording
                ? W(lang, "Tap to send voice note", "Pulse para enviar la nota de voz")
                : W(lang, "Record voice note", "Grabar nota de voz")}
              className={`btn-primary ow-tap relative grid h-11 w-11 shrink-0 place-items-center !rounded-2xl !p-0 disabled:opacity-40 sm:h-[46px] sm:w-[46px] ${recording ? "animate-pulse ring-2 ring-red-400/60" : ""}`}>
              <IconMic />
              {recording && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow" />}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function dayLabel(iso: string, isEs: boolean): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return isEs ? "Hoy" : "Today";
  if (same(d, y)) return isEs ? "Ayer" : "Yesterday";
  return d.toLocaleDateString(isEs ? "es" : "en",
    { weekday: "short", month: "short", day: "numeric" });
}

function safeFileName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-96) || "attachment";
}

function bestAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createAudioRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  const mimeType = bestAudioMimeType();
  if (!mimeType) return { recorder: new MediaRecorder(stream), mimeType: "" };
  try {
    return { recorder: new MediaRecorder(stream, { mimeType }), mimeType };
  } catch {
    return { recorder: new MediaRecorder(stream), mimeType: "" };
  }
}

function storageAudioContentType(mimeType: string): string {
  if (mimeType.includes("webm")) return "video/webm";
  return "video/mp4";
}

function audioExt(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60).toString();
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function isWithinMessageChangeWindow(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t <= MESSAGE_CHANGE_WINDOW_MS;
}

function canRecallMessage(m: Msg): boolean {
  return !m.pending && !m.id.startsWith("tmp-") && isWithinMessageChangeWindow(m.created_at);
}

function canEditMessage(m: Msg): boolean {
  const type = m.message_type ?? "text";
  return canRecallMessage(m) && !m.read_at && (type === "text" || hasEditableMedia(m));
}

function hasEditableMedia(m: Msg): boolean {
  const type = m.message_type ?? "text";
  return ["image", "video", "audio", "file"].includes(type) || mediaLineIndexes(m.content).mediaLines.size > 0;
}

function editableMessageText(m: Msg): string {
  if (!hasEditableMedia(m)) return m.content;
  const { hiddenLines } = mediaLineIndexes(m.content);
  return m.content.split(/\r?\n/).filter((_, i) => !hiddenLines.has(i)).join("\n").trim();
}

function contentWithEditedMediaCaption(original: string, caption: string): string {
  const lines = original.split(/\r?\n/);
  const { hiddenLines } = mediaLineIndexes(original);
  const preserved = lines.filter((_, i) => hiddenLines.has(i)).map(line => line.trim()).filter(Boolean);
  const cleanCaption = caption.trim();
  return cleanCaption ? `${cleanCaption}\n${preserved.join("\n")}` : preserved.join("\n");
}

function mediaLineIndexes(text: string): { hiddenLines: Set<number>; mediaLines: Set<number> } {
  const hiddenLines = new Set<number>();
  const mediaLines = new Set<number>();
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const raw of line.match(MESSAGE_URLISH) ?? []) {
      const href = raw.replace(/[.,;:!?)\]]+$/, "");
      if (!MESSAGE_MEDIA_URL.test(href)) continue;
      mediaLines.add(i);
      if (line.trim() === raw || line.trim() === href) {
        hiddenLines.add(i);
        const previous = lines[i - 1]?.trim() ?? "";
        if (previous && MESSAGE_MEDIA_LABEL.test(previous)) hiddenLines.add(i - 1);
      }
    }
  });
  return { hiddenLines, mediaLines };
}

function messageMediaItems(m: Msg): GroupMediaItem[] {
  const found: GroupMediaItem[] = [];
  for (const line of m.content.split(/\r?\n/)) {
    for (const raw of line.match(MESSAGE_URLISH) ?? []) {
      const url = raw.replace(/[.,;:!?)\]]+$/, "");
      if (!MESSAGE_MEDIA_URL.test(url)) continue;
      const lower = url.toLowerCase();
      const type: GroupMediaItem["type"] =
        /\.(?:jpe?g|png|webp|gif|heic|heif)(?:[?#].*)?$/.test(lower) ? "image" :
        /\.(?:mp4|mov|webm)(?:[?#].*)?$/.test(lower) ? "video" :
        /\.(?:mp3|m4a|aac|wav|ogg|oga)(?:[?#].*)?$/.test(lower) ? "audio" : "file";
      found.push({ id: `${m.id}-${found.length}`, url, type });
    }
  }
  return found;
}

function pinStorageKey(conversationId: string): string {
  return `ow.thread.${conversationId}.pinned`;
}

function messageSnippet(text: string, max = 76): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean;
}

function withReplyPrefix(text: string, m: Msg, author: string): string {
  const quote = messageSnippet(m.content, 96);
  return `Replying to ${author}: "${quote}"\n\n${text}`;
}

function ComingSoonBubble({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/20 bg-paper px-2.5 py-1 text-[11px] font-black text-brand shadow-lg dark:bg-ink">
      {label}
    </span>
  );
}

function MessageAction({
  icon, label, onClick, danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`ow-tap flex w-full items-center gap-4 rounded-2xl px-5 py-3 text-left hover:bg-white/[0.08] ${
        danger ? "text-red-400" : "text-white"}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center opacity-90">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function ComposerAction({
  label, tone, icon, onClick, muted = false,
}: {
  label: string;
  tone: "blue" | "pink" | "green" | "cyan" | "violet" | "amber" | "rose" | "sky";
  icon: ReactNode;
  onClick: () => void;
  muted?: boolean;
}) {
  const colors: Record<typeof tone, string> = {
    blue: "text-blue-500",
    pink: "text-pink-500",
    green: "text-emerald-500",
    cyan: "text-cyan-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    sky: "text-sky-500",
  };
  return (
    <button type="button" onClick={onClick}
      className={`ow-tap flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 ${muted ? "opacity-55" : ""}`}>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-ink/[0.06] ${colors[tone]} dark:bg-white/10`}>
        {icon}
      </span>
      <span className="w-full truncate opacity-70">{label}</span>
    </button>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconGallery() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
      <path d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6Z" />
    </svg>
  );
}

function IconSmile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4l1.4 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.1l1.4-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconPoll() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19V5" />
      <path d="M9 19v-8" />
      <path d="M14 19V9" />
      <path d="M19 19V3" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 10l5-3v10l-5-3Z" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconReply() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 17 4 12l5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function IconTranslate() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h8" />
      <path d="M9 4v4" />
      <path d="M4 14c2.6-1 5.4-3.4 6.8-6" />
      <path d="M7 11c1 1.5 2.4 2.7 4 3.5" />
      <path d="M15 20l4-9 4 9" />
      <path d="M16.2 17h5.6" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 4 5 5-4 4v3l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h3Z" />
    </svg>
  );
}

function IconSticker() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 12V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5" />
      <path d="M8 10h.01M14 10h.01" />
      <path d="M8.5 14a4.5 4.5 0 0 0 4 2" />
      <path d="M17 15v6M14 18h6" />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
