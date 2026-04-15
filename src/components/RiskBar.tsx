'use client';

import { motion } from 'framer-motion';

interface RiskBarProps {
  score: number; // 0-1
  label?: string;
  showLabel?: boolean;
  height?: number;
}

export default function RiskBar({ score, label, showLabel = true, height = 6 }: RiskBarProps) {
  const pct = Math.max(0, Math.min(1, score)) * 100;

  const getRiskLevel = (s: number) => {
    if (s > 0.7) return { label: 'High Risk', color: '#FF4D6D' };
    if (s > 0.4) return { label: 'Medium Risk', color: '#FFB347' };
    return { label: 'Low Risk', color: '#00FF85' };
  };

  const risk = getRiskLevel(score);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted font-mono">{label || 'Risk Score'}</span>
          <span className="text-xs font-mono font-semibold" style={{ color: risk.color }}>
            {Math.round(pct)}% · {risk.label}
          </span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full rounded-full risk-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            background: `linear-gradient(90deg, #00FF85 0%, #FFB347 50%, #FF4D6D 100%)`,
            backgroundSize: '200% 100%',
            backgroundPosition: `${pct}% 0`,
          }}
        />
      </div>
    </div>
  );
}
