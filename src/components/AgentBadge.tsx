'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AgentType } from '@/types';

const AGENT_CONFIG: Record<AgentType, { label: string; description: string; color: string; bg: string; icon: string }> = {
  PROBE: {
    label: 'Probe',
    description: 'Socratic questioning',
    color: '#00FF85',
    bg: 'rgba(0, 255, 133, 0.08)',
    icon: '🔍',
  },
  HINT: {
    label: 'Hint',
    description: 'Progressive scaffolding',
    color: '#FFB347',
    bg: 'rgba(255, 179, 71, 0.08)',
    icon: '💡',
  },
  REPAIR: {
    label: 'Repair',
    description: 'Fixing misconceptions',
    color: '#FF4D6D',
    bg: 'rgba(255, 77, 109, 0.08)',
    icon: '🔧',
  },
  CHALLENGE: {
    label: 'Challenge',
    description: 'Mastery probing',
    color: '#A78BFA',
    bg: 'rgba(167, 139, 250, 0.08)',
    icon: '⚡',
  },
  META: {
    label: 'Meta',
    description: 'Learning insights',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.08)',
    icon: '🧠',
  },
  FEYNMAN: {
    label: 'Feynman',
    description: 'Teach-back evaluation',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.08)',
    icon: '📖',
  },
};

interface AgentBadgeProps {
  agentType: AgentType;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

export default function AgentBadge({ agentType, size = 'md', showDescription = false }: AgentBadgeProps) {
  const config = AGENT_CONFIG[agentType];

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '10px', iconSize: '10px' },
    md: { padding: '4px 10px', fontSize: '11px', iconSize: '12px' },
    lg: { padding: '6px 14px', fontSize: '13px', iconSize: '14px' },
  }[size];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={agentType}
        initial={{ opacity: 0, scale: 0.8, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="inline-flex items-center gap-1.5 rounded-full font-mono font-medium"
        style={{
          background: config.bg,
          border: `1px solid ${config.color}30`,
          color: config.color,
          padding: sizeStyles.padding,
          fontSize: sizeStyles.fontSize,
        }}
      >
        <span style={{ fontSize: sizeStyles.iconSize }}>{config.icon}</span>
        <span>{config.label.toUpperCase()}</span>
        {showDescription && (
          <span style={{ color: config.color + '99', marginLeft: 2 }}>
            · {config.description}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
