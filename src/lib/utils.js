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
