import { useEffect, useRef } from 'react';
import { Chart, registerables, ScriptableContext } from 'chart.js';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import type { HourlyPoint } from '../../../features/weather/openMeteo';

Chart.register(...registerables);

interface ForecastChartProps {
  hourly: HourlyPoint[];
  label: string;
}

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

    // Prepare labels and data, preserving nulls as gaps
    const labels = hourly.map((point) => {
      const date = new Date(point.time);
      return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
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
              display: true,
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
              display: true,
              text: 'Precipitation (mm)',
              color: axisTitleColor,
              font: { family: 'IBM Plex Mono', size: 9, weight: 500 },
              padding: { top: 8, bottom: 8 },
            },
          },
        },
        layout: {
          padding: { top: 8, right: 16, bottom: 8, left: 8 },
        },
        animation: { duration: 400 },
      },
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
