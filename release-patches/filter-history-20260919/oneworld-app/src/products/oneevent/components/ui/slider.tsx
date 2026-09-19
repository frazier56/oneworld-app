import * as React from "react";
import { cn } from "@evt/lib/utils";
export interface SliderProps {
  value?: number[]; defaultValue?: number[]; onValueChange?: (v: number[]) => void;
  min?: number; max?: number; step?: number; className?: string; disabled?: boolean;
}
export function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, step = 1, className, disabled }: SliderProps) {
  const v = (value ?? defaultValue ?? [min])[0];
  return (
    <input type="range" min={min} max={max} step={step} value={v} disabled={disabled}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      className={cn("w-full accent-teal", className)} />
  );
}
export default Slider;
