import type { ButtonHTMLAttributes } from "react";

/** Secondary wizard actions share spacing, readability and non-submit semantics. */
export default function OnboardingAction({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" className={`ow-onboarding-action ${className}`} />;
}
