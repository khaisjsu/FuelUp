type Props = { score: number; threshold: number; size?: number };

/** Ring gauge for the 0-100 hunger score, with the order threshold marked. */
export default function HungerGauge({ score, threshold, size = 168 }: Props) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270 degree ring
  const filled = (Math.min(100, Math.max(0, score)) / 100) * c * arc;
  const tAngle = (135 + (threshold / 100) * 270) * (Math.PI / 180);
  const tx = size / 2 + r * Math.cos(tAngle);
  const ty = size / 2 + r * Math.sin(tAngle);
  const over = score >= threshold;
  const label = score >= threshold ? "Hungry soon" : score >= threshold - 20 ? "Building" : "Fueled";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Hunger score ${score} of 100`}>
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke}
          strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? "var(--threshold)" : "var(--brand)"} strokeWidth={stroke}
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </g>
      <circle cx={tx} cy={ty} r={4} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
      <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.27} fontWeight={700} fill="var(--text)" className="num">
        {score}
      </text>
      <text x="50%" y="63%" textAnchor="middle" fontSize={12} fill="var(--text-2)">
        {label}
      </text>
    </svg>
  );
}
