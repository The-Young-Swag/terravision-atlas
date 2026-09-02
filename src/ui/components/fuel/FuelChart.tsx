import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface FuelChartProps {
  fuelNeeded: number;
  totalCost: number;
  carbonKg: number;
  fuelUnit: 'L' | 'gal';
}

export function FuelChart({ fuelNeeded, totalCost, carbonKg, fuelUnit }: FuelChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [`Fuel (${fuelUnit})`, 'Cost (₱)', 'CO₂ (kg)'],
        datasets: [
          {
            data: [fuelNeeded, totalCost, carbonKg],
            backgroundColor: ['#5500a4', '#00d890', '#FF9F1C'],
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 18,
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
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#94a3b8', font: { family: 'IBM Plex Mono', size: 10 } },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#F8F9FA', font: { family: 'Inter', size: 11, weight: 500 } },
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
  }, [fuelNeeded, totalCost, carbonKg, fuelUnit]);

  return (
    <div className="h-[110px] w-full">
      <canvas ref={canvasRef} aria-label="Fuel consumption breakdown" role="img" />
    </div>
  );
}
