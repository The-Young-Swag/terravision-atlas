export function NasaBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="NASA — National Aeronautics and Space Administration"
      className={`inline-flex shrink-0 items-center gap-1 rounded bg-[#0B3D91] px-1.5 py-0.5 text-[9px] font-black leading-none tracking-[0.08em] text-white ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" aria-hidden />
      NASA
    </span>
  );
}
