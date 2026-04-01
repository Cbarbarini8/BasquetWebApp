import { useState } from 'react';
import { collection, addDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { IconButton, DeleteIcon } from '../common/Icons';

function extractInstagramUrl(url) {
  const cleaned = url.trim();
  const match = cleaned.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (match) return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  return null;
}

export default function PostManager({ posts, canEdit, user }) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const igUrl = extractInstagramUrl(url);
    if (!igUrl) {
      alert('URL de Instagram no valida. Usa el formato: instagram.com/p/CODIGO o instagram.com/reel/CODIGO');
      return;
    }

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'posts'), {
        url: igUrl,
        createdAt: serverTimestamp(),
      });
      await logAction(user, 'create', 'posts', ref.id, `Agrego post de Instagram: ${igUrl}`);
      setUrl('');
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm('Eliminar este post?')) return;
    await deleteDoc(doc(db, 'posts', post.id));
    await logAction(user, 'delete', 'posts', post.id, `Elimino post de Instagram: ${post.url}`);
  };

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-6">
          <input
            type="url"
            placeholder="URL de Instagram (ej: https://www.instagram.com/p/ABC123/)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
            className="flex-1 min-w-[300px] px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {saving ? 'Guardando...' : 'Agregar'}
          </button>
        </form>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          No hay posts de Instagram cargados
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div
              key={post.id}
              className="flex items-center justify-between px-4 py-3 rounded-md"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <a href={post.url} target="_blank" rel="noopener noreferrer"
                className="text-sm underline truncate flex-1 mr-2" style={{ color: 'var(--color-primary)' }}>
                {post.url}
              </a>
              {canEdit && (
                <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(post)} color="var(--color-danger)" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
