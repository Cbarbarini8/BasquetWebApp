export function normalizeDriveUrl(url) {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  const match2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (match2) return `https://lh3.googleusercontent.com/d/${match2[1]}`;
  return url;
}

export function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Distancia absoluta en ms entre la fecha programada del partido (solo dia, ignorando horario) y now.
// Devuelve Infinity si el partido no tiene scheduledDate valida.
// Se usa para ordenar los encabezados de fechas pendientes por cercania a hoy.
export function getMatchProximityToNow(match, now = Date.now()) {
  if (!match?.scheduledDate) return Infinity;
  const d = match.scheduledDate.toDate ? match.scheduledDate.toDate() : new Date(match.scheduledDate);
  if (isNaN(d.getTime())) return Infinity;
  d.setHours(12, 0, 0, 0);
  return Math.abs(d.getTime() - now);
}
