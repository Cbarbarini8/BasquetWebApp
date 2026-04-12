import { useState, useRef } from 'react';
import { collection, addDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { IconButton, DeleteIcon } from '../common/Icons';
import { useToast } from '../../context/ToastContext';

function extractInstagramUrl(url) {
  const cleaned = url.trim();
  const match = cleaned.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (match) return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  return null;
}

function getPostLabel(url) {
  const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return 'Post';
  const type = match[1] === 'reel' ? 'Reel' : match[1] === 'tv' ? 'IGTV' : 'Post';
  return `${type}: ${match[2]}`;
}

export default function PostManager({ posts, canEdit, user }) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setThumbFile(f);
    setThumbPreview(URL.createObjectURL(f));
  };

  // Sort posts by order locally (in case some don't have order field)
  const sortedPosts = [...posts].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const igUrl = extractInstagramUrl(url);
    if (!igUrl) {
      toast.warning('URL de Instagram no valida. Usa el formato: instagram.com/p/CODIGO o instagram.com/reel/CODIGO');
      return;
    }

    setSaving(true);
    try {
      let thumbnailUrl = '';
      if (thumbFile) {
        thumbnailUrl = await uploadToCloudinary(thumbFile, 'posts');
      }
      const maxOrder = sortedPosts.length > 0 ? Math.max(...sortedPosts.map(p => p.order ?? 0)) + 1 : 0;
      const ref = await addDoc(collection(db, 'posts'), {
        url: igUrl,
        thumbnailUrl,
        order: maxOrder,
        createdAt: serverTimestamp(),
      });
      await logAction(user, 'create', 'posts', ref.id, `Agrego post de Instagram: ${igUrl}`);
      setUrl('');
      setThumbFile(null);
      setThumbPreview('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm('Eliminar este post?')) return;
    await deleteDoc(doc(db, 'posts', post.id));
    await logAction(user, 'delete', 'posts', post.id, `Elimino post de Instagram: ${post.url}`);
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedPosts.length) return;

    const current = sortedPosts[index];
    const target = sortedPosts[targetIndex];
    const currentOrder = current.order ?? index;
    const targetOrder = target.order ?? targetIndex;

    await updateDoc(doc(db, 'posts', current.id), { order: targetOrder });
    await updateDoc(doc(db, 'posts', target.id), { order: currentOrder });
  };

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="URL de Instagram (ej: https://www.instagram.com/p/ABC123/)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              className="flex-1 min-w-[250px] px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div className="flex items-center gap-3">
            {thumbPreview && <img src={thumbPreview} alt="Preview" className="w-12 h-12 rounded object-cover" />}
            <label className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              {thumbPreview ? 'Cambiar miniatura' : 'Subir miniatura'}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Captura de pantalla del post</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {saving ? 'Subiendo...' : 'Agregar'}
          </button>
        </form>
      )}

      {sortedPosts.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          No hay posts de Instagram cargados
        </p>
      ) : (
        <div className="space-y-2">
          {sortedPosts.map((post, idx) => (
            <div
              key={post.id}
              className="flex items-center gap-3 px-4 py-3 rounded-md"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-xs font-bold shrink-0 w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>
                {idx + 1}
              </span>
              {post.thumbnailUrl ? (
                <img src={post.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
                  IG
                </div>
              )}
              <a href={post.url} target="_blank" rel="noopener noreferrer"
                className="text-xs underline truncate flex-1 min-w-0" style={{ color: 'var(--color-primary)' }}>
                {getPostLabel(post.url)}
              </a>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    title="Subir"
                    className="p-1.5 rounded cursor-pointer disabled:opacity-20 disabled:cursor-default"
                    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === sortedPosts.length - 1}
                    title="Bajar"
                    className="p-1.5 rounded cursor-pointer disabled:opacity-20 disabled:cursor-default"
                    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(post)} color="var(--color-danger)" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
