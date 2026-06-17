import "../styles/stat-bar.css";

interface StatBarProps {
  label: string;
  value: number; // 0-100
  color?: string; // CSS color for the bar fill
}

export function StatBar({ label, value, color = "#4caf50" }: StatBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="stat-bar">
      <span className="stat-bar__label">{label}</span>
      <div
        className="stat-bar__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="stat-bar__fill"
          style={{ width: `${clampedValue}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
