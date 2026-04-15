'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { KGNode, KGLink } from '@/types';

interface KnowledgeGraphProps {
  nodes: KGNode[];
  links: KGLink[];
  height?: number;
  onNodeClick?: (node: KGNode) => void;
}

export default function KnowledgeGraph({
  nodes,
  links,
  height = 380,
  onNodeClick,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth || 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs — glow filters
    const defs = svg.append('defs');

    // Accent glow
    const glowAccent = defs.append('filter').attr('id', 'glow-accent').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowAccent.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const merge1 = glowAccent.append('feMerge');
    merge1.append('feMergeNode').attr('in', 'coloredBlur');
    merge1.append('feMergeNode').attr('in', 'SourceGraphic');

    // Danger glow
    const glowDanger = defs.append('filter').attr('id', 'glow-danger').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowDanger.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const merge2 = glowDanger.append('feMerge');
    merge2.append('feMergeNode').attr('in', 'coloredBlur');
    merge2.append('feMergeNode').attr('in', 'SourceGraphic');

    // Color scale: mastery → color
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 0.4, 0.75, 1])
      .range(['#FF4D6D', '#FFB347', '#00CC6A', '#00FF85']);

    // Node radius: proportional to review count
    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d.reviewCount) || 1])
      .range([12, 28]);

    // Clone nodes/links to avoid mutation
    const simNodes: (KGNode & d3.SimulationNodeDatum)[] = nodes.map(n => ({ ...n }));
    const simLinks: d3.SimulationLinkDatum<typeof simNodes[0]>[] = links.map(l => ({
      source: typeof l.source === 'string' ? l.source : (l.source as KGNode).id,
      target: typeof l.target === 'string' ? l.target : (l.target as KGNode).id,
      strength: (l as KGLink).strength,
    }));

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3.forceLink(simLinks)
          .id((d: d3.SimulationNodeDatum) => (d as KGNode).id)
          .distance(100)
          .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: d3.SimulationNodeDatum) => radiusScale((d as KGNode).reviewCount) + 10));

    // Zoom/pan
    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', event => g.attr('transform', event.transform))
    );

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', (d) => ((d as unknown as { strength: number }).strength * 2.5).toString())
      .attr('stroke-linecap', 'round');

    // Node groups
    const node = g
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<SVGGElement, typeof simNodes[0]>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as unknown as (selection: d3.Selection<d3.BaseType | SVGGElement, typeof simNodes[0], SVGGElement, unknown>) => void
      )
      .on('click', (_, d) => onNodeClick?.(d as KGNode));

    // Outer glow ring for misconceptions
    node
      .filter(d => d.misconceptions > 0)
      .append('circle')
      .attr('r', d => radiusScale(d.reviewCount) + 6)
      .attr('fill', 'none')
      .attr('stroke', '#FF4D6D')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
      .attr('opacity', 0.6)
      .attr('filter', 'url(#glow-danger)');

    // Main circle
    node
      .append('circle')
      .attr('r', d => radiusScale(d.reviewCount))
      .attr('fill', d => colorScale(d.mastery))
      .attr('stroke', d => d.retention < 0.5 ? '#FFB347' : colorScale(d.mastery))
      .attr('stroke-width', d => d.retention < 0.5 ? 2 : 1.5)
      .attr('filter', d => d.mastery > 0.7 ? 'url(#glow-accent)' : 'none')
      .attr('opacity', d => 0.6 + d.retention * 0.4);

    // Retention indicator arc
    node.each(function (d) {
      const r = radiusScale(d.reviewCount);
      const retention = d.retention;
      if (retention < 0.95) {
        const arcPath = d3.arc()({
          innerRadius: r + 3,
          outerRadius: r + 5,
          startAngle: 0,
          endAngle: retention * 2 * Math.PI,
        });
        d3.select(this)
          .append('path')
          .attr('d', arcPath || '')
          .attr('fill', '#FFB347')
          .attr('opacity', 0.7);
      }
    });

    // Label
    node
      .append('text')
      .text(d => d.concept.length > 14 ? d.concept.slice(0, 14) + '…' : d.concept)
      .attr('text-anchor', 'middle')
      .attr('dy', d => radiusScale(d.reviewCount) + 14)
      .attr('font-size', '10px')
      .attr('fill', '#8896A4')
      .attr('font-family', 'var(--font-dm-sans), sans-serif');

    // Mastery label inside node
    node
      .append('text')
      .text(d => `${Math.round(d.mastery * 100)}%`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '9px')
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('font-family', 'var(--font-mono), monospace')
      .attr('font-weight', '500');

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('pointer-events', 'none');

    node
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <div style="font-weight:600;color:#E8EDF2;margin-bottom:4px">${d.concept}</div>
            <div style="color:#8896A4;font-size:11px">Mastery: <span style="color:#00FF85">${Math.round(d.mastery * 100)}%</span></div>
            <div style="color:#8896A4;font-size:11px">Retention: <span style="color:#FFB347">${Math.round(d.retention * 100)}%</span></div>
            ${d.misconceptions > 0 ? `<div style="color:#FF4D6D;font-size:11px">⚠ ${d.misconceptions} misconception(s)</div>` : ''}
            <div style="color:#8896A4;font-size:11px">Reviews: ${d.reviewCount}</div>
          `)
          .style('left', `${(event as MouseEvent).offsetX + 12}px`)
          .style('top', `${(event as MouseEvent).offsetY - 12}px`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${(event as MouseEvent).offsetX + 12}px`)
          .style('top', `${(event as MouseEvent).offsetY - 12}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as typeof simNodes[0]).x ?? 0)
        .attr('y1', d => (d.source as typeof simNodes[0]).y ?? 0)
        .attr('x2', d => (d.target as typeof simNodes[0]).x ?? 0)
        .attr('y2', d => (d.target as typeof simNodes[0]).y ?? 0);

      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [nodes, links, height, onNodeClick]);

  useEffect(() => {
    const cleanup = draw();
    return cleanup;
  }, [draw]);

  useEffect(() => {
    const observer = new ResizeObserver(() => draw());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  if (nodes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height }}
      >
        <div className="text-4xl mb-3 opacity-30">⬡</div>
        <p className="text-muted text-sm">Knowledge graph will appear as you learn</p>
        <p className="text-muted text-xs mt-1 opacity-60">Start chatting to map your understanding</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
