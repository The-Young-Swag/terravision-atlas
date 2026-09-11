import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBrightBasemap } from '../../../shared/hooks/useBrightBasemap';

Chart.register(...registerables);

interface FuelChartProps {
  fuelNeeded: number;
  totalCost: number;
  fuelUnit: 'L' | 'gal';
}

export function FuelChart({ fuelNeeded, totalCost, fuelUnit }: FuelChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const isBrightBasemap = useBrightBasemap();
  const labelPrimary = isBrightBasemap ? '#1e293b' : '#F8F9FA';
  const labelSecondary = isBrightBasemap ? '#475569' : '#94a3b8';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [`Fuel (${fuelUnit})`, 'Cost (₱)'],
        datasets: [
          {
            label: `Fuel (${fuelUnit})`,
            data: [fuelNeeded, null],
            backgroundColor: '#5500a4',
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 18,
            xAxisID: 'x-fuel',
            order: 2,
          },
          {
            label: 'Cost (₱)',
            data: [null, totalCost],
            backgroundColor: '#00d890',
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 18,
            xAxisID: 'x-cost',
            order: 1,
          },
        ],
      },
      options: {
        indexAxis: 'y',
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
            displayColors: true,
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                if (context.dataset.label?.includes('Fuel')) {
                  return `Fuel needed: ${value.toFixed(1)} ${fuelUnit}`;
                }
                return `Total cost: ₱${value.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          'x-fuel': {
            type: 'linear',
            position: 'bottom',
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: labelSecondary, font: { family: 'IBM Plex Mono', size: 10 } },
            border: { display: false },
            offset: true,
          },
          'x-cost': {
            type: 'linear',
            position: 'top',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: 'transparent' },
            border: { display: false },
            offset: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: labelPrimary, font: { family: 'Inter', size: 11, weight: 500 } },
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
  }, [fuelNeeded, totalCost, fuelUnit, isBrightBasemap, labelPrimary, labelSecondary]);

  return (
    <div className="h-[110px] w-full">
      <canvas ref={canvasRef} aria-label="Fuel consumption breakdown" role="img" />
    </div>
  );
}