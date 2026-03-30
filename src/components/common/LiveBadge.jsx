export default function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--color-live)' }}>
      <span className="w-2 h-2 rounded-full bg-white animate-pulse-live" />
      EN VIVO
    </span>
  );
}
