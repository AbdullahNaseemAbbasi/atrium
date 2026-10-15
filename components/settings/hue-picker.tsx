"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HUE_PRESETS } from "@/lib/settings/options";

/**
 * Colour picker for avatar and brand hues: preset swatches (radio group) plus
 * a slider for any hue. Posts the hue as a hidden field named `name`.
 */
export function HuePicker({
  name,
  value,
  onChange,
  label,
  disabled = false,
  id,
}: {
  name: string;
  value: number;
  onChange: (hue: number) => void;
  label: string;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={`${label} presets`} className="flex flex-wrap gap-2">
        {HUE_PRESETS.map((hue) => {
          const selected = hue === value;
          return (
            <button
              key={hue}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Hue ${hue}`}
              disabled={disabled}
              onClick={() => onChange(hue)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full sm:h-8 sm:w-8 ring-offset-2 ring-offset-[#101b26] transition disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "ring-2 ring-cyan-300" : "hover:ring-2 hover:ring-white/20",
              )}
              style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 30%))` }}
            >
              {selected && <Check size={14} className="text-white" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label htmlFor={id} className="w-16 flex-none text-xs text-ink-faint">
          Fine-tune
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={359}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={`Hue ${value} degrees`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow"
          style={{
            background:
              "linear-gradient(90deg, hsl(0 70% 50%), hsl(60 70% 50%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 50%), hsl(300 70% 50%), hsl(359 70% 50%))",
          }}
        />
        <span className="w-10 flex-none text-right text-xs tabular-nums text-ink-muted">{value}°</span>
      </div>
    </div>
  );
}
