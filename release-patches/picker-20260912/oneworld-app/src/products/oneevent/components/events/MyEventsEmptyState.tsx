import { motion } from "framer-motion";
import { Calendar, Plus } from "lucide-react";
import { useLanguage } from "@evt/i18n/LanguageContext";

interface MyEventsEmptyStateProps {
  perspective: "attending" | "hosting" | "rolodex";
  onCreate: () => void;
}

export default function MyEventsEmptyState({ perspective, onCreate }: MyEventsEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="col-span-full rounded-2xl border border-border bg-secondary/50 p-12 text-center"
    >
      <Calendar className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">{t("hub.events.empty_title")}</h3>
      <p className="text-sm text-muted-foreground">{t("hub.events.empty_desc")}</p>
      {perspective === "hosting" && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 min-h-11 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
        >
          <Plus className="mr-1 inline h-4 w-4" /> {t("hub.events.create_first", "Create Your First Event")}
        </button>
      )}
    </motion.div>
  );
}
