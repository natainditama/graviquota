import type { Component } from "solid-js";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

export const CircularProgress: Component<CircularProgressProps> = (props) => {
  const size = () => props.size ?? 28;
  const strokeWidth = () => props.strokeWidth ?? 3.5;
  const radius = () => (size() - strokeWidth()) / 2;
  const circumference = () => 2 * Math.PI * radius();
  const strokeDashoffset = () => circumference() - (Math.min(100, Math.max(0, props.percentage)) / 100) * circumference();

  const activeColor = () => {
    if (props.color) return props.color;
    if (props.percentage <= 0) return "var(--color-muted)";
    if (props.percentage < 25) return "var(--color-error-foreground)";
    if (props.percentage < 50) return "var(--color-warning-foreground)";
    return "var(--color-success-foreground)";
  };

  return (
    <div class="relative inline-flex items-center justify-center shrink-0" style={{ width: `${size()}px`, height: `${size()}px` }}>
      <svg class="transform -rotate-90 filter drop-shadow-sm" width={size()} height={size()} viewBox={`0 0 ${size()} ${size()}`}>
        <circle cx={size() / 2} cy={size() / 2} r={radius()} stroke={props.trackColor ?? "var(--color-border)"} stroke-width={strokeWidth()} fill="none" />
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={radius()}
          stroke={activeColor()}
          stroke-width={strokeWidth()}
          stroke-linecap="round"
          stroke-dasharray={`${circumference()}`}
          stroke-dashoffset={strokeDashoffset()}
          fill="none"
          class="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
};
