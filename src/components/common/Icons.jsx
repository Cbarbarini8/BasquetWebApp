const S = { width: 16, height: 16, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const EditIcon = (p) => <svg {...S} {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
export const DeleteIcon = (p) => <svg {...S} {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>;
export const PlayIcon = (p) => <svg {...S} {...p}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" /></svg>;
export const StopIcon = (p) => <svg {...S} {...p}><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" /></svg>;
export const CalendarIcon = (p) => <svg {...S} {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
export const ClipboardIcon = (p) => <svg {...S} {...p}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>;
export const UndoIcon = (p) => <svg {...S} {...p}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13" /></svg>;
export const CheckIcon = (p) => <svg {...S} {...p}><polyline points="20 6 9 17 4 12" /></svg>;
export const XIcon = (p) => <svg {...S} {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
export const LinkIcon = (p) => <svg {...S} {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
export const ShieldIcon = (p) => <svg {...S} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
export const ToggleOnIcon = (p) => <svg {...S} {...p}><rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="16" cy="12" r="3" fill="currentColor" /></svg>;
export const ToggleOffIcon = (p) => <svg {...S} {...p}><rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="8" cy="12" r="3" /></svg>;
export const ChartIcon = (p) => <svg {...S} {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
export const PlusIcon = (p) => <svg {...S} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
export const ImageIcon = (p) => <svg {...S} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;

export function IconButton({ icon: Icon, label, onClick, color = 'var(--color-primary)', border = true, ...rest }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
      style={{ color, border: border ? `1px solid ${color}` : 'none' }}
      {...rest}
    >
      <Icon width={14} height={14} />
    </button>
  );
}
