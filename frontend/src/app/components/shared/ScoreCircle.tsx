interface ScoreCircleProps {
  score: number;
  maxScore?: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#6B9E7A';
  if (score >= 60) return '#4A6FA5';
  if (score >= 40) return '#D4A843';
  return '#C46B6B';
}

export function ScoreCircle({ score, maxScore = 100, size = 140 }: ScoreCircleProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - percentage);
  const color = getScoreColor(score);

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8ECF0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#2C3E50', lineHeight: 1 }}>{score.toFixed(1)}</div>
        <div style={{ fontSize: 12, color: '#7F8C8D', marginTop: 2 }}>/ {maxScore}</div>
      </div>
    </div>
  );
}
