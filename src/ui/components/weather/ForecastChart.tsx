import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
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
export function ForecastChart({ hourly, label }: ForecastChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const isBrightBasemap = useBrightBasemap();
  const tickColor = isBrightBasemap ? '#475569' : '#94a3b8';
  const gridColor = isBrightBasemap ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const labels = hourly.map((point) => point.time.slice(5, 16).replace('T', ' '));
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Temp (°C)',
            data: hourly.map((point) => point.temperatureC),
            borderColor: '#FF9F1C',
            backgroundColor: '#FF9F1C',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: 'y-temp',
          },
          {
            type: 'bar',
            label: 'Precip (mm)',
            data: hourly.map((point) => point.precipitationMm),
            backgroundColor: 'rgba(32,157,215,0.55)',
            borderRadius: 2,
            yAxisID: 'y-precip',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13,27,42,0.9)',
            titleColor: '#F8F9FA',
            bodyColor: '#F8F9FA',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 8 },
            border: { display: false },
          },
          'y-temp': {
            type: 'linear',
            position: 'left',
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 } },
            border: { display: false },
          },
          'y-precip': {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: { display: false },
            border: { display: false },
          },
        },
        animation: { duration: 400 },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [hourly, label, tickColor, gridColor]);

  return (
    <div className="h-[140px] w-full">
      <canvas ref={canvasRef} aria-label={label} role="img" />
    </div>
  );
}
