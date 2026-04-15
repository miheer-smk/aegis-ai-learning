'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MisconceptionData } from '@/types';

interface HeatmapGridProps {
  data: MisconceptionData[];
  height?: number;
}

export default function HeatmapGrid({ data, height = 240 }: HeatmapGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const containerWidth = containerRef.current.clientWidth || 500;
    const margin = { top: 12, right: 16, bottom: 80, left: 16 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const topData = data.slice(0, Math.min(15, data.length));
    const cols = Math.min(topData.length, 8);
    const rows = Math.ceil(topData.length / cols);

    const cellW = w / cols;
    const cellH = h / rows;

    const maxCount = d3.max(topData, d => d.count) || 1;

    // Color scale: severity
    const colorByCount = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgb('rgba(255,77,109,0.1)', 'rgba(255,77,109,0.85)'));

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('pointer-events', 'none')
      .style('background', 'rgba(21,28,36,0.95)')
      .style('border', '1px solid rgba(255,255,255,0.1)')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('color', '#E8EDF2')
      .style('z-index', '50');

    topData.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW;
      const y = row * cellH;

      const cell = g.append('g').attr('transform', `translate(${x},${y})`).style('cursor', 'pointer');

      // Background
      cell.append('rect')
        .attr('width', cellW - 3)
        .attr('height', cellH - 3)
        .attr('rx', 6)
        .attr('fill', colorByCount(d.count))
        .attr('stroke', 'rgba(255,77,109,0.2)')
        .attr('stroke-width', 1);

      // Concept text
      const maxChars = Math.floor((cellW - 8) / 6);
      const label = d.concept.length > maxChars ? d.concept.slice(0, maxChars - 1) + '…' : d.concept;

      cell.append('text')
        .attr('x', (cellW - 3) / 2)
        .attr('y', (cellH - 3) / 2 - 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#E8EDF2')
        .attr('font-family', 'var(--font-dm-sans), sans-serif')
        .text(label);

      cell.append('text')
        .attr('x', (cellW - 3) / 2)
        .attr('y', (cellH - 3) / 2 + 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#FF4D6D')
        .attr('font-family', 'var(--font-mono), monospace')
        .attr('font-weight', '700')
        .text(d.count);

      cell
        .on('mouseover', (event) => {
          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-weight:600;margin-bottom:4px">${d.concept}</div>
              <div style="color:#FF4D6D">${d.count} misconception(s)</div>
              <div style="color:#8896A4;font-size:11px">Severity: ${d.severity}</div>
              <div style="color:#8896A4;font-size:11px">Students: ${d.students.slice(0, 3).join(', ')}${d.students.length > 3 ? ` +${d.students.length - 3}` : ''}</div>
            `)
            .style('left', `${(event as MouseEvent).offsetX + 12}px`)
            .style('top', `${(event as MouseEvent).offsetY - 12}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0));
    });

    return () => { tooltip.remove(); };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted text-sm" style={{ height }}>
        No misconceptions recorded yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} width="100%" height={height} />
    </div>
  );
}
