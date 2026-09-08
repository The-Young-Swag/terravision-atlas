import { useEffect, useRef } from 'react';
import { Chart, Plugin, registerables, ScriptableContext, ScriptableScaleContext } from 'chart.js';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import type { HourlyPoint } from '../../../features/weather/openMeteo';

Chart.register(...registerables);

interface ForecastChartProps {
  hourly: HourlyPoint[];
  label: string;
}

// Custom plugin: draw the y-axis title text centered against the full plot
// area height, not the tick label area. Chart.js's default positioning
// uses the midpoint between the first and last tick label, which is
// visually off-center when the chart has layout padding or when the
// tick area doesn't span the full plot height. We compute the vertical
// center of the chart area ourselves and place the rotated text there.
const centerYAxisTitlePlugin: Plugin<'bar'> = {
  id: 'centerYAxisTitle',
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const plotCenterY = (chartArea.top + chartArea.bottom) / 2;
    for (const axisId of ['y-temp', 'y-precip'] as const) {
      const scale = scales[axisId];
      if (!scale) continue;
      const scaleOptions = scale.options as {
        position?: 'left' | 'right';
        title?: {
          display?: boolean;
          text?: string | string[];
          color?: string;
          font?: { family?: string; size?: number; weight?: number };
        };
      };
      const titleConfig = scaleOptions.title;
      if (!titleConfig?.display || !titleConfig.text) continue;
      const text = Array.isArray(titleConfig.text) ? titleConfig.text.join(' ') : titleConfig.text;
      const fontSize = titleConfig.font?.size ?? 10;
      const fontFamily = titleConfig.font?.family ?? 'sans-serif';
      const fontWeight = titleConfig.font?.weight ?? 'normal';
      const color = titleConfig.color ?? '#888';
      const isLeft = scaleOptions.position === 'left';
      // Offset 14px outside the chart area for clearance from tick labels.
      const xPos = isLeft ? chartArea.left - 14 : chartArea.right + 14;
      ctx.save();
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(xPos, plotCenterY);
      ctx.rotate(isLeft ? -Math.PI / 2 : Math.PI / 2);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  },
};

// Temperature line + precipitation bars sharing one canvas (precipitation
// on a hidden secondary axis so rain stays visible next to temperature).
// Rebuilt on every data change, following the FuelChart instance pattern.
// Null temperature/precipitation values render as gaps (not interpolated).
export function ForecastChart({ hourly, label }: ForecastChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const isBrightBasemap = useBrightBasemap();
  const tickColor = isBrightBasemap ? '#475569' : '#94a3b8';
  const gridColor = isBrightBasemap ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
  const axisTitleColor = isBrightBasemap ? '#64748b' : '#7c8aa3';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // Labels match the data granularity so they read at a glance:
    // single-day hourly data gets time-of-day labels ("6 AM"), while a
    // multi-day window gets one label per calendar day ("Sep 7") at each
    // midnight boundary — never bare numbers ("04") and never hours
    // leaking into a daily view.
    const dayKeys = hourly.map((point) => new Date(point.time).toDateString());
    const multiDay = new Set(dayKeys).size > 1;
    const formatHour = (date: Date) => {
      let hours = date.getHours();
      const suffix = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours} ${suffix}`;
    };
    const labels: (string | string[])[] = hourly.map((point, index) => {
      const date = new Date(point.time);
      if (!multiDay) return formatHour(date);
      const isDayBoundary = date.getHours() === 0 && (index === 0 || dayKeys[index] !== dayKeys[index - 1]);
      if (!isDayBoundary) return '';
      const month = date.toLocaleDateString(undefined, { month: 'short' });
      const day = String(date.getDate());
      return [month, day];
    });
    // Day-boundary slot indices drive the separator gridlines below.
    const dayBoundarySlots = new Set<number>();
    labels.forEach((text, index) => {
      const isLabeled = Array.isArray(text) ? text.length > 0 : text !== '';
      if (isLabeled) dayBoundarySlots.add(index);
    });
    const tempData = hourly.map((point) => point.temperatureC);
    const precipData = hourly.map((point) => point.precipitationMm);

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Temp (°C)',
            data: tempData,
            borderColor: '#FF9F1C',
            backgroundColor: 'rgba(255,159,28,0.12)',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#FF9F1C',
            tension: 0.3,
            yAxisID: 'y-temp',
            spanGaps: false, // null values render as gaps, not interpolated
          },
          {
            type: 'bar',
            label: 'Precip (mm)',
            data: precipData,
            backgroundColor: (ctx: ScriptableContext<'bar'>) => {
              const value = ctx.raw as number | null;
              return value && value > 0 ? 'rgba(32,157,215,0.7)' : 'transparent';
            },
            borderRadius: 4,
            yAxisID: 'y-precip',
            barPercentage: 0.5,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13,27,42,0.95)',
            titleColor: '#F8F9FA',
            bodyColor: '#F8F9FA',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'IBM Plex Mono', size: 11 },
            bodyFont: { family: 'IBM Plex Mono', size: 11 },
            displayColors: true,
            callbacks: {
              // Axis labels are sparse by design (one per day in a
              // multi-day view), so the tooltip always shows the full
              // date + time of the hovered point.
              title: (items) => {
                const point = hourly[items[0]?.dataIndex ?? -1];
                if (!point) return '';
                const date = new Date(point.time);
                const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return multiDay ? `${day}, ${formatHour(date)}` : `${day} · ${formatHour(date)}`;
              },
              label: (context) => {
                const value = context.raw as number | null;
                if (value === null) return `${context.dataset.label}: no data`;
                if (context.dataset.yAxisID === 'y-temp') {
                  return `Temp: ${value.toFixed(1)}°C`;
                }
                return `Precip: ${value.toFixed(1)} mm`;
              },
            },
          },
        },
        scales: {
          x: {
            // Day separators: a faint vertical line only at labeled day
            // boundaries groups each day's hours visually. Single-day
            // views keep a clean axis with no gridlines at all.
            grid: {
              // Gridlines render only in multi-day views, and only at
              // labeled day boundaries — single-day views stay clean.
              display: multiDay,
              drawTicks: false,
              color: (context: ScriptableScaleContext) =>
                dayBoundarySlots.has(context.index ?? -1) ? gridColor : 'transparent',
            },
            ticks: {
              color: tickColor,
              font: { family: 'IBM Plex Mono', size: 10 },
              maxTicksLimit: multiDay ? 7 : 6,
              autoSkip: !multiDay,
              autoSkipPadding: 16,
              maxRotation: 0,
              padding: 10,
              // Push date labels slightly right so they sit centred over
              // their day's data, not hugging the gridline. Y-axis labels
              // keep their own padding (12) and are not moved.
              labelOffset: 4,
            },
            border: { display: false },
          },
          'y-temp': {
            type: 'linear',
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (value) => `${value}°`,
              padding: 12,
            },
            border: { display: false },
            title: {
              display: false, // drawn by centerYAxisTitlePlugin
              text: 'Temperature (°C)',
              color: axisTitleColor,
              font: { family: 'IBM Plex Mono', size: 9, weight: 500 },
              padding: { top: 8, bottom: 8 },
            },
          },
          'y-precip': {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (value) => value === 0 ? '' : `${value} mm`,
              padding: 12,
            },
            border: { display: false },
            title: {
              display: false, // drawn by centerYAxisTitlePlugin
              text: 'Precipitation (mm)',
              color: axisTitleColor,
              font: { family: 'IBM Plex Mono', size: 9, weight: 500 },
              padding: { top: 8, bottom: 8 },
            },
          },
        },
        layout: {
          // Chart pushed slightly left (less left padding, more right) so
          // plot uses the reclaimed space; y-axis ticks keep 12px padding
          // so their labels don't move, only the x-axis area and dates shift.
          padding: { top: 4, right: 12, bottom: 4, left: 0 },
        },
        animation: { duration: 400 },
      },
      // Custom plugin: draws y-axis titles centered against the full
      // plot area (Chart.js default centers against the tick label area,
      // which is visually off-center when the chart has layout padding).
      plugins: [centerYAxisTitlePlugin],
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [hourly, label, tickColor, gridColor, axisTitleColor]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 px-1" aria-hidden="true">
        <span className={`flex items-center gap-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
          <span className="inline-block h-[3px] w-4 rounded-full bg-[#FF9F1C]" />
          Temp °C
        </span>
        <span className={`flex items-center gap-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#209dd7]/70" />
          Precip mm
        </span>
      </div>
      <div className="h-[240px] w-full min-w-0 max-w-full overflow-hidden">
        <canvas ref={canvasRef} aria-label={label} role="img" />
      </div>
    </div>
  );
}
