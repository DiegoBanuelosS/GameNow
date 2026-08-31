import { useId, useRef, type KeyboardEvent } from "react";
import "./RangeSlider.css";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, min: number, max: number, step: number) {
  const snapped = Math.round((value - min) / step) * step + min;
  return clamp(Number(snapped.toFixed(4)), min, max);
}

function valueFromPoint(track: HTMLElement, clientX: number, min: number, max: number, step: number) {
  const rect = track.getBoundingClientRect();
  const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
  return snap(min + ratio * (max - min), min, max, step);
}

function onKey(
  event: KeyboardEvent,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (next: number) => void,
) {
  const large = step * 10;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    onChange(snap(value + step, min, max, step));
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    onChange(snap(value - step, min, max, step));
  }
  if (event.key === "Home") {
    event.preventDefault();
    onChange(min);
  }
  if (event.key === "End") {
    event.preventDefault();
    onChange(max);
  }
  if (event.key === "PageUp") {
    event.preventDefault();
    onChange(snap(value + large, min, max, step));
  }
  if (event.key === "PageDown") {
    event.preventDefault();
    onChange(snap(value - large, min, max, step));
  }
}

export function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  valueText,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueText: string;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  function move(clientX: number) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    onChange(valueFromPoint(track, clientX, min, max, step));
  }

  return (
    <div className="range">
      <div className="range-copy">
        <span id={labelId}>{label}</span>
        <span>{valueText}</span>
      </div>
      <div
        ref={trackRef}
        className="range-track"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            move(event.clientX);
          }
        }}
      >
        <span className="range-fill" style={{ left: 0, width: `${percent}%` }} />
        <button
          type="button"
          className="range-thumb"
          style={{ left: `${percent}%` }}
          role="slider"
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          onKeyDown={(event) => onKey(event, value, min, max, step, onChange)}
        />
      </div>
    </div>
  );
}

export function DualRangeSlider({
  label,
  minValue,
  maxValue,
  min,
  max,
  step = 1,
  minText,
  maxText,
  onChange,
}: {
  label: string;
  minValue: number;
  maxValue: number;
  min: number;
  max: number;
  step?: number;
  minText: string;
  maxText: string;
  onChange: (minValue: number, maxValue: number) => void;
}) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const span = max - min || 1;
  const start = ((minValue - min) / span) * 100;
  const end = ((maxValue - min) / span) * 100;
  const dragging = useRef<"min" | "max" | null>(null);

  function apply(clientX: number, target?: "min" | "max") {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const next = valueFromPoint(track, clientX, min, max, step);
    const which =
      target ??
      dragging.current ??
      (Math.abs(next - minValue) <= Math.abs(next - maxValue) ? "min" : "max");
    dragging.current = which;
    if (which === "min") {
      onChange(Math.min(next, maxValue), maxValue);
    } else {
      onChange(minValue, Math.max(next, minValue));
    }
  }

  return (
    <div className="range">
      <div className="range-copy">
        <span id={labelId}>{label}</span>
        <span>
          {minText} – {maxText}
        </span>
      </div>
      <div
        ref={trackRef}
        className="range-track"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          apply(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            apply(event.clientX);
          }
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
      >
        <span className="range-fill" style={{ left: `${start}%`, width: `${end - start}%` }} />
        <button
          type="button"
          className="range-thumb"
          style={{ left: `${start}%` }}
          role="slider"
          aria-labelledby={labelId}
          aria-label="Mínimo"
          aria-valuemin={min}
          aria-valuemax={maxValue}
          aria-valuenow={minValue}
          aria-valuetext={minText}
          onPointerDown={(event) => {
            event.stopPropagation();
            dragging.current = "min";
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              apply(event.clientX, "min");
            }
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onKeyDown={(event) =>
            onKey(event, minValue, min, maxValue, step, (next) => onChange(next, maxValue))
          }
        />
        <button
          type="button"
          className="range-thumb"
          style={{ left: `${end}%` }}
          role="slider"
          aria-labelledby={labelId}
          aria-label="Máximo"
          aria-valuemin={minValue}
          aria-valuemax={max}
          aria-valuenow={maxValue}
          aria-valuetext={maxText}
          onPointerDown={(event) => {
            event.stopPropagation();
            dragging.current = "max";
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              apply(event.clientX, "max");
            }
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onKeyDown={(event) =>
            onKey(event, maxValue, minValue, max, step, (next) => onChange(minValue, next))
          }
        />
      </div>
    </div>
  );
}
