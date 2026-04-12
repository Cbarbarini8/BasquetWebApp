import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { logAction } from '../lib/audit';
import { useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

export default function PlayerPhotoUpload() {
  const { toast } = useToast();
  const { token } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState('');
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    async function findPlayer() {
      try {
        const q = query(collection(db, 'players'), where('uploadToken', '==', token));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPlayer({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setError('Link invalido o expirado');
        }
      } catch {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    findPlayer();
  }, [token]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.warning('La imagen no puede superar los 5MB');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setSaving(true);
    try {
      const url = await uploadToCloudinary(file, 'players');
      await updateDoc(doc(db, 'players', player.id), {
        pendingPhotoUrl: url,
        photoStatus: 'pending',
      });
      await logAction({ uid: 'player-self', email: `${player.firstName} ${player.lastName}` }, 'update', 'players', player.id, `Jugador subio foto: ${player.firstName} ${player.lastName}`).catch(() => {});
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Error al subir la foto. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  if (error) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <p className="text-lg font-medium" style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-success)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Foto enviada</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Tu foto fue enviada correctamente. El administrador la revisara y aprobara pronto.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-md mx-auto py-6">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="LCB SF" className="w-16 h-16 mx-auto mb-3 rounded-full" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Subir foto de jugador</h1>
          <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
            {player.firstName} {player.lastName}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            #{player.number}
          </p>
        </div>

        {player.photoUrl && (
          <div className="text-center mb-4">
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Foto actual:</p>
            <img src={player.photoUrl} alt="Actual" className="w-24 h-24 mx-auto rounded-full object-cover" />
          </div>
        )}

        {player.photoStatus === 'pending' && (
          <div className="text-center mb-4 px-4 py-3 rounded-md" style={{ backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-warning)' }}>
            <p className="text-sm" style={{ color: 'var(--color-warning)' }}>
              Ya enviaste una foto que esta pendiente de aprobacion.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            {preview && (
              <div className="mb-4">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-32 h-32 mx-auto rounded-full object-cover"
                  style={{ border: '3px solid var(--color-primary)' }}
                />
              </div>
            )}

            <label
              className="inline-block px-6 py-3 rounded-md text-sm font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '2px dashed var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {file ? 'Cambiar foto' : 'Seleccionar foto'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              JPG, PNG o WEBP. Maximo 5MB.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !file}
            className="w-full py-2.5 px-4 rounded-md text-white font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {saving ? 'Subiendo...' : 'Enviar foto'}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
