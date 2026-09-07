import { useEffect, useRef } from 'react';
import { Chart, Plugin, registerables, ScriptableContext } from 'chart.js';
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

    // Prepare labels and data, preserving nulls as gaps.
    // For a 7-day hourly forecast, the date+hour concatenation from
    // toLocaleString (e.g. "Sep 7, 00") is ambiguous — "00" reads as
    // a day or month, not an hour. Use an explicit, unambiguous format:
    //   - Midnight (00:00) ticks show the day label "Sep 7" so each day
    //     boundary is visually anchored.
    //   - All other ticks show the 24h hour "06" / "12" / "18" so the
    //     time is unambiguous.
    // Using Date methods instead of toLocaleString also removes the
    // locale-dependent rendering that produced inconsistent output.
    const labels = hourly.map((point) => {
      const date = new Date(point.time);
      const hours = date.getHours();
      if (hours === 0) {
        // Day boundary — show the day label.
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      // 24h zero-padded hour for unambiguous time.
      return `${hours.toString().padStart(2, '0')}`;
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
            backgroundColor: '#FF9F1C',
            borderWidth: 2,
            pointRadius: 0,
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
            borderRadius: 3,
            yAxisID: 'y-precip',
            barPercentage: 0.6,
            categoryPercentage: 0.8,
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
            grid: { display: false },
            ticks: {
              color: tickColor,
              font: { family: 'IBM Plex Mono', size: 9 },
              maxTicksLimit: 10,
              maxRotation: 0,
              autoSkip: true,
              padding: 8,
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
          // Extra left/right padding (28px) to give the centered y-axis
          // titles room to render without overlapping the tick labels.
          padding: { top: 8, right: 28, bottom: 8, left: 28 },
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
    <div className="h-[180px] w-full">
      <canvas ref={canvasRef} aria-label={label} role="img" />
    </div>
  );
}
