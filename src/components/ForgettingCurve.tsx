'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { forgettingCurvePoints } from '@/lib/decay';
import type { ConceptNode } from '@/types';

interface ForgettingCurveProps {
  concepts: ConceptNode[];
  width?: number;
  height?: number;
  daysToShow?: number;
}

const CURVE_COLORS = ['#00FF85', '#38BDF8', '#A78BFA', '#FFB347', '#FF4D6D', '#34D399'];

export default function ForgettingCurve({
  concepts,
  width: propWidth,
  height = 200,
  daysToShow = 21,
}: ForgettingCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || concepts.length === 0) return;

    const containerWidth = containerRef.current?.clientWidth || propWidth || 500;
    const margin = { top: 16, right: 20, bottom: 36, left: 40 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, daysToShow]).range([0, w]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([h, 0]);

    // Grid
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(4))
      .join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('stroke', 'rgba(255,255,255,0.04)')
      .attr('stroke-dasharray', '4,4');

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => `${d}d`))
      .selectAll('text')
      .attr('fill', '#8896A4')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono), monospace');

    g.selectAll('.domain, .tick line').attr('stroke', 'rgba(255,255,255,0.06)');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${Math.round((d as number) * 100)}%`))
      .selectAll('text')
      .attr('fill', '#8896A4')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono), monospace');

    // 50% retention threshold line
    g.append('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', yScale(0.5)).attr('y2', yScale(0.5))
      .attr('stroke', '#FFB347')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,3')
      .attr('opacity', 0.5);

    g.append('text')
      .attr('x', w - 2).attr('y', yScale(0.5) - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', '#FFB347')
      .attr('opacity', 0.7)
      .text('50% threshold');

    // Today line
    const today = 0;
    g.append('line')
      .attr('x1', xScale(today)).attr('x2', xScale(today))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#00FF85')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.4);

    // Draw curves
    const topConcepts = concepts.slice(0, 6);
    const line = d3.line<{ day: number; retention: number }>()
      .x(d => xScale(d.day))
      .y(d => yScale(d.retention))
      .curve(d3.curveCatmullRom);

    topConcepts.forEach((concept, i) => {
      const pts = forgettingCurvePoints(concept.stability, daysToShow, 50);
      const color = CURVE_COLORS[i % CURVE_COLORS.length];

      const path = g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7)
        .attr('d', line);

      // Animate path drawing
      const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(800)
        .delay(i * 100)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);

      // Current position dot
      const nowPts = forgettingCurvePoints(concept.stability, 0.01, 2);
      const nowRetention = nowPts[0]?.retention ?? 1;
      g.append('circle')
        .attr('cx', xScale(0))
        .attr('cy', yScale(nowRetention))
        .attr('r', 3)
        .attr('fill', color)
        .attr('opacity', 0.9);
    });

    // Legend
    const legend = g.append('g').attr('transform', `translate(8, 8)`);
    topConcepts.slice(0, 4).forEach((concept, i) => {
      const color = CURVE_COLORS[i % CURVE_COLORS.length];
      legend.append('circle').attr('cx', 5).attr('cy', i * 14).attr('r', 3).attr('fill', color);
      legend.append('text')
        .attr('x', 12).attr('y', i * 14 + 4)
        .attr('font-size', '9px')
        .attr('fill', '#8896A4')
        .attr('font-family', 'var(--font-dm-sans), sans-serif')
        .text(concept.concept.length > 16 ? concept.concept.slice(0, 16) + '…' : concept.concept);
    });
  }, [concepts, daysToShow, height, propWidth]);

  if (concepts.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted text-sm" style={{ height }}>
        No concepts to display yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} width="100%" height={height} />
    </div>
  );
}
