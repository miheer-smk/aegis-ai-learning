'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CognitiveDNA } from '@/types';

interface DNARadarProps {
  dna: CognitiveDNA;
  size?: number;
  animated?: boolean;
}

const AXES = [
  { key: 'visual', label: 'Visual' },
  { key: 'abstract', label: 'Abstract' },
  { key: 'exampleFirst', label: 'Example-First' },
  { key: 'theoryFirst', label: 'Theory-First' },
  { key: 'analogyDriven', label: 'Analogy' },
] as const;

export default function DNARadar({ dna, size = 220, animated = true }: DNARadarProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) * 0.7;
    const n = AXES.length;
    const angleSlice = (Math.PI * 2) / n;

    // Grid rings
    const levels = 4;
    for (let level = levels; level >= 1; level--) {
      const rLevel = (r * level) / levels;
      const pts = AXES.map((_, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return [cx + rLevel * Math.cos(angle), cy + rLevel * Math.sin(angle)];
      });

      svg
        .append('polygon')
        .attr('points', pts.map(p => p.join(',')).join(' '))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-width', 1);
    }

    // Axis lines and labels
    AXES.forEach((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);

      svg
        .append('line')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1);

      const lx = cx + (r + 18) * Math.cos(angle);
      const ly = cy + (r + 18) * Math.sin(angle);
      const textAnchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';

      svg
        .append('text')
        .attr('x', lx)
        .attr('y', ly + 4)
        .attr('text-anchor', textAnchor)
        .attr('font-size', '10px')
        .attr('fill', '#8896A4')
        .attr('font-family', 'var(--font-dm-sans), sans-serif')
        .text(axis.label);
    });

    // Data polygon
    const dataPoints = AXES.map((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const val = (dna[axis.key as keyof CognitiveDNA] as number) || 0;
      return [cx + r * val * Math.cos(angle), cy + r * val * Math.sin(angle)];
    });

    const polygon = svg
      .append('polygon')
      .attr('points', dataPoints.map(p => p.join(',')).join(' '))
      .attr('fill', 'rgba(0, 255, 133, 0.12)')
      .attr('stroke', '#00FF85')
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round');

    if (animated) {
      polygon
        .attr('opacity', 0)
        .transition()
        .duration(600)
        .attr('opacity', 1);
    }

    // Dot markers at each vertex
    AXES.forEach((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const val = (dna[axis.key as keyof CognitiveDNA] as number) || 0;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);

      const dot = svg
        .append('circle')
        .attr('cx', x).attr('cy', y)
        .attr('r', 4)
        .attr('fill', '#00FF85')
        .attr('stroke', '#080C10')
        .attr('stroke-width', 1.5);

      if (animated) {
        dot.attr('opacity', 0).transition().duration(600).delay(100).attr('opacity', 1);
      }

      // Value label
      svg
        .append('text')
        .attr('x', cx + (r * val - 14) * Math.cos(angle))
        .attr('y', cy + (r * val - 14) * Math.sin(angle) + 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', '#00CC6A')
        .attr('font-family', 'var(--font-mono), monospace')
        .text(`${Math.round(val * 100)}%`);
    });

    // Center label: pace
    svg
      .append('text')
      .attr('x', cx).attr('y', cy + 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', 'rgba(255,255,255,0.3)')
      .attr('font-family', 'var(--font-mono), monospace')
      .text(dna.pace?.toUpperCase() || 'MED');
  }, [dna, size, animated]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    />
  );
}
