/**
 * RolodexAISearch — Pro+ natural-language search across a host's Rolodex.
 * Calls vaia-event-intelligence (action: rolodex_search). Shows VAIA's matches with reasoning.
 */
import { useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { Sparkles, Search, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface Match {
  rolodex_id: string;
  name: string;
  reason: string;
}

interface Props {
  onMatchClick?: (rolodexId: string) => void;
}

export default function RolodexAISearch({ onMatchClick }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [locked, setLocked] = useState(false);

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setMatches([]);
    setSummary("");
    setLocked(false);
    try {
      const { data, error } = await supabase.functions.invoke("vaia-event-intelligence", {
        body: { action: "rolodex_search", query: query.trim() },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) {
        if (d.upgrade_to) {
          setLocked(true);
          toast.error(d.error);
        } else {
          toast.error(d.error);
        }
        return;
      }
      setMatches(d?.matches || []);
      setSummary(d?.summary || "");
      if ((d?.matches || []).length === 0) toast.message("No matches found.");
    } catch (e: any) {
      toast.error(e.message || "VAIA search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Ask VAIA about your Rolodex
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold">Pro</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && ask()}
              placeholder="e.g., who's a photographer in Atlanta? Or — anyone interested in real estate?"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
            />
          </div>
          <button
            onClick={ask}
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Ask
          </button>
        </div>
      </div>

      {locked && (
        <div className="mt-2 rounded-xl bg-secondary/50 border border-border p-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground flex-1">
            AI Rolodex search is a Pro feature. Upgrade to unlock.
          </p>
          <a href="/upgrade" className="text-xs font-semibold text-primary">Upgrade →</a>
        </div>
      )}

      {summary && !locked && (
        <p className="mt-2 text-xs text-muted-foreground italic px-1">{summary}</p>
      )}

      {matches.length > 0 && (
        <div className="mt-2 space-y-2">
          {matches.map((m) => (
            <button
              key={m.rolodex_id}
              onClick={() => onMatchClick?.(m.rolodex_id)}
              className="w-full text-left p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
            >
              <p className="text-sm font-bold text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.reason}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
