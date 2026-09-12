import { useState, useRef, useEffect, useCallback } from "react";
import { useMicro } from "@evt/i18n/LanguageContext";
import { Upload, Send, ImageIcon, Loader2, CheckCircle2, X, Video, Search, Check, Download } from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { toast } from "sonner";
import { createNotification } from "@evt/lib/notificationHelpers";
import { notifySmsNewMessage } from "@evt/lib/notifySms";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@evt/components/ui/dialog";

interface Registration {
  id: string;
  user_id: string;
  status: string;
  profile?: { full_name: string; email: string; photo_url: string | null };
}

interface Props {
  eventId: string;
  eventTitle: string;
  registrations: Registration[];
}

interface UploadedMedia {
  url: string;
  name: string;
  type: "image" | "video";
}

export default function EventPhotosTab({ eventId, eventTitle, registrations }: Props) {
  const m = useMicro(); // v15: seven-language host-panel strings
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [attendeeSearch, setAttendeeSearch] = useState("");

  // Deduplicate attendees
  const uniqueAttendees = registrations.filter((r, i, arr) => arr.findIndex(x => x.user_id === r.user_id) === i);
  const filteredAttendees = uniqueAttendees.filter(r => {
    if (!attendeeSearch.trim()) return true;
    const q = attendeeSearch.toLowerCase();
    return r.profile?.full_name?.toLowerCase().includes(q) || r.profile?.email?.toLowerCase().includes(q);
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id) return;
    setUploading(true);
    const newMedia: UploadedMedia[] = [];

    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) continue;

        const path = `${user.id}/event-photos/${eventId}/${crypto.randomUUID()}-${file.name}`;
        const { data, error } = await supabase.storage.from("event-media").upload(path, file);
        if (error) { console.error("Upload error:", error); continue; }
        const url = supabase.storage.from("event-media").getPublicUrl(data.path).data.publicUrl;
        newMedia.push({ url, name: file.name, type: isVideo ? "video" : "image" });
      }
      setMedia(prev => [...prev, ...newMedia]);
      if (newMedia.length > 0) toast.success(`${newMedia.length} file${newMedia.length > 1 ? "s" : ""} uploaded!`);
    } catch (err: any) {
      toast.error(m("Upload failed: ") + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const openAttendeePicker = () => {
    if (media.length === 0) { toast.error(m("Upload media first.")); return; }
    // Pre-select all attendees
    setSelectedAttendees(new Set(uniqueAttendees.map(r => r.user_id)));
    setShowAttendeePicker(true);
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAttendees.size === uniqueAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(uniqueAttendees.map(r => r.user_id)));
    }
  };

  const handleShareWithSelected = async () => {
    if (selectedAttendees.size === 0) { toast.error(m("Select at least one person.")); return; }
    setSharing(true);
    setShowAttendeePicker(false);

    try {
      const mediaUrls = media.map(m => ({ url: m.url, name: m.name, type: m.type }));

      for (const attendeeId of selectedAttendees) {
        // NOTE: we intentionally do NOT skip the host here. Hosts often share with
        // themselves to verify the flow, and they should also receive the media in
        // their own inbox + a notification + the "Add to my events" confirmation.

        // Find or create conversation with attendee (or self-thread if host shared with self)
        const participants = attendeeId === user!.id ? [user!.id] : [user!.id, attendeeId];

        const isSelf = attendeeId === user!.id;

        const { data: existingConvos } = await supabase
          .from("conversations")
          .select("id, participant_ids")
          .contains("participant_ids", participants);

        let convoId: string;
        const existingConvo = existingConvos?.find(c => {
          if (isSelf) {
            return c.participant_ids.length === 1 && c.participant_ids[0] === user!.id;
          }
          return c.participant_ids.length === 2 && c.participant_ids.includes(user!.id) && c.participant_ids.includes(attendeeId);
        });

        if (existingConvo) {
          convoId = existingConvo.id;
        } else {
          const { data: newConvo } = await supabase.from("conversations").insert({
            participant_ids: participants,
            category: "events",
            last_message_text: `📸 Shared ${media.length} files from "${eventTitle}"`,
            last_message_at: new Date().toISOString(),
            metadata: { created_by: user!.id, self_thread: isSelf },
          }).select("id").single();
          convoId = newConvo!.id;
        }

        // Send as a special shared_media message — include a confirm CTA so the
        // recipient can add this event to their profile as "attended".
        await supabase.from("messages").insert({
          conversation_id: convoId,
          sender_id: user!.id,
          content: `📸 Shared ${media.length} file${media.length > 1 ? "s" : ""} from "${eventTitle}". Tap "Add to my events" to confirm you attended and feature it on your profile.`,
          message_type: "shared_media",
          metadata: {
            shared_media: {
              event_id: eventId,
              event_title: eventTitle,
              items: mediaUrls,
              confirm_attendance: true,
            },
          },
        });
        // SMS — send to everyone selected, including yourself if you picked self.
        notifySmsNewMessage({ recipientId: attendeeId, senderId: user!.id, messagePreview: `Shared ${media.length} files from "${eventTitle}"`, messageType: "media" });

        // Update conversation last message
        await supabase.from("conversations").update({
          last_message_text: `📸 Shared ${media.length} files from "${eventTitle}"`,
          last_message_at: new Date().toISOString(),
        }).eq("id", convoId);

        // In-app notification
        await createNotification({
          userId: attendeeId,
          type: "general",
          title: isSelf ? "Your event media is ready 📸" : "Event Media Shared! 📸",
          body: isSelf
            ? `You shared ${media.length} file${media.length > 1 ? "s" : ""} from "${eventTitle}". Open the thread to confirm and add it to your profile.`
            : `Media from "${eventTitle}" has been shared with you. Check your messages to view, save, and add the event to your profile.`,
          actionUrl: `/events/messages?convo=${convoId}`,
          metadata: { event_id: eventId, media_count: media.length, confirm_attendance: true },
        });
      }

      // Save to event attachment_urls
      const { data: ev } = await supabase.from("events").select("attachment_urls").eq("id", eventId).single();
      const existing = (ev?.attachment_urls as any[]) || [];
      const merged = [...existing, ...media.map(m => ({ name: m.name, url: m.url, type: m.type === "video" ? "event-video" : "event-photo" }))];
      await supabase.from("events").update({ attachment_urls: merged }).eq("id", eventId);

      setShared(true);
      toast.success(`Media shared with ${selectedAttendees.size} attendee${selectedAttendees.size !== 1 ? "s" : ""}! 📸`);
    } catch (err: any) {
      toast.error(m("Failed to share: ") + (err.message || "Unknown error"));
    } finally {
      setSharing(false);
    }
  };

  const avatarUrl = (p?: Registration["profile"]) =>
    p?.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p?.full_name || "U")}`;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{m("Share Media")}</h3>
              <p className="text-xs text-muted-foreground">Upload photos & videos from the event and share with attendees</p>
            </div>
          </div>
          {media.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {media.length} file{media.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{m("Uploading...")}</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground mb-1">{m("Upload event media")}</p>
              <p className="text-xs text-muted-foreground">Photos & Videos · JPG, PNG, WEBP, MP4, MOV · Multiple files supported</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => { handleUpload(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Media Grid */}
      {media.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{m("Uploaded Media")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((item, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden aspect-square">
                {item.type === "video" ? (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Video className="w-8 h-8 text-primary/50" />
                    <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">{item.name}</span>
                  </div>
                ) : (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <button
                    onClick={() => removeMedia(i)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-destructive/80 flex items-center justify-center text-white transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Button */}
      {media.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{m("Share with Attendees")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send media to {uniqueAttendees.length} registered attendee{uniqueAttendees.length !== 1 ? "s" : ""} via their messages
              </p>
            </div>
            {shared && <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />}
          </div>
          <button
            onClick={openAttendeePicker}
            disabled={sharing || shared}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {sharing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{m("Sharing...")}</>
            ) : shared ? (
              <><CheckCircle2 className="w-4 h-4" />{m("Media Shared!")}</>
            ) : (
              <><Send className="w-4 h-4" />{m("Select Attendees & Share")}</>
            )}
          </button>
        </div>
      )}

      {/* Attendee Picker Dialog */}
      <Dialog open={showAttendeePicker} onOpenChange={setShowAttendeePicker}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{m("Share Media with Attendees")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Select who should receive {media.length} file{media.length > 1 ? "s" : ""} from "{eventTitle}"
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={attendeeSearch}
              onChange={e => setAttendeeSearch(e.target.value)}
              placeholder={m("Search attendees...")}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Select All */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline px-1"
          >
            {selectedAttendees.size === uniqueAttendees.length ? "Deselect All" : "Select All"}
            <span className="text-muted-foreground font-normal">({selectedAttendees.size}/{uniqueAttendees.length})</span>
          </button>

          {/* Attendee List */}
          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 min-h-0 max-h-[300px]">
            {filteredAttendees.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">{m("No attendees found")}</p>
            ) : filteredAttendees.map(r => {
              const selected = selectedAttendees.has(r.user_id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleAttendee(r.user_id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left hover:bg-secondary/80"
                  style={{ background: selected ? "hsl(var(--primary) / 0.08)" : undefined }}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? "bg-primary border-primary" : "border-border"}`}>
                    {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <img src={avatarUrl(r.profile)} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.profile?.full_name || "Unknown"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.profile?.email || ""}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Send Button */}
          <button
            onClick={handleShareWithSelected}
            disabled={selectedAttendees.size === 0 || sharing}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {sharing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{m("Sending...")}</>
            ) : (
              <><Send className="w-4 h-4" /> Share with {selectedAttendees.size} Attendee{selectedAttendees.size !== 1 ? "s" : ""}</>
            )}
          </button>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {media.length === 0 && !uploading && (
        <div className="rounded-2xl bg-secondary/50 border border-border p-12 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground mb-1">{m("No media uploaded yet")}</p>
          <p className="text-xs text-muted-foreground">Upload photos & videos from your event and share them with attendees</p>
        </div>
      )}
    </div>
  );
}
