export default function TeamLogo({ url, name, size = 32 }) {
  if (!url) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: 'var(--color-primary)',
          fontSize: size * 0.35,
        }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name || 'Logo'}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
