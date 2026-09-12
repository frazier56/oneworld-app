// Reconciliation shim: replace the old shadcn toast reducer with sonner, which
// the ported event code also uses directly. Keeps the useToast()/toast() API.
import { toast as sonnerToast } from "sonner";

type ToastArg = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | string;
} & Record<string, any>;

export function toast(arg: ToastArg | string) {
  if (typeof arg === "string") { sonnerToast(arg); return; }
  const { title, description, variant } = arg;
  const msg = (title as string) || (description as string) || "";
  if (variant === "destructive") sonnerToast.error(msg, { description: title ? (description as string) : undefined });
  else sonnerToast(msg, { description: title ? (description as string) : undefined });
}

export function useToast() {
  return { toast, dismiss: (id?: string) => sonnerToast.dismiss(id as any), toasts: [] as any[] };
}
