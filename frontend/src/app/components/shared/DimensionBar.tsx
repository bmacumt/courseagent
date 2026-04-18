import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DimensionScore } from '../../data/mockData';

function getBarColor(score: number): string {
  if (score >= 80) return '#6B9E7A';
  if (score >= 60) return '#4A6FA5';
  if (score >= 40) return '#D4A843';
  return '#C46B6B';
}

interface DimensionBarProps {
  dimension: DimensionScore;
  defaultExpanded?: boolean;
}

export function DimensionBar({ dimension, defaultExpanded = false }: DimensionBarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = getBarColor(dimension.score);

  return (
    <div style={{ borderBottom: '1px solid #F0F2F5', paddingBottom: 8, marginBottom: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '6px 0' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ width: 56, fontSize: 13, color: '#2C3E50', fontWeight: 500, flexShrink: 0 }}>{dimension.label}</div>
        <div style={{ flex: 1, height: 20, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${dimension.score}%`,
              background: color,
              borderRadius: 4,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: '#2C3E50', flexShrink: 0, minWidth: 100, textAlign: 'right' }}>
          <span style={{ fontWeight: 500 }}>{dimension.score}</span>
          <span style={{ color: '#7F8C8D', fontSize: 12 }}> (×{dimension.weight})</span>
          <span style={{ color: color, fontWeight: 600, marginLeft: 6 }}>{dimension.weighted_score.toFixed(1)}</span>
        </div>
        <div style={{ color: '#7F8C8D', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>
      {expanded && dimension.comment && (
        <div style={{ padding: '8px 12px', background: '#F7F8FA', borderRadius: 6, margin: '4px 0 4px 68px', fontSize: 13, color: '#4A5568', lineHeight: 1.7, borderLeft: `3px solid ${color}` }}>
          {dimension.comment}
        </div>
      )}
    </div>
  );
}
