import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUpdates } from '../../hooks/useUpdates';
import { logAction } from '../../lib/audit';
import { useToast } from '../../context/ToastContext';
import { IconButton, EditIcon, DeleteIcon, PlusIcon } from '../common/Icons';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';

function formatDateEs(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    if (ref.current) {
      ref.current.innerHTML = value || '';
      inited.current = true;
    }
  }, [value]);

  const exec = (cmd, arg = null) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML || '');
  };

  const Btn = ({ cmd, arg, label, title }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={() => exec(cmd, arg)}
      className="px-2 py-1 rounded text-xs font-medium"
      style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-card)' }}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        <Btn cmd="bold" label="N" title="Negrita (Ctrl+B)" />
        <Btn cmd="italic" label={<em>I</em>} title="Cursiva (Ctrl+I)" />
        <Btn cmd="underline" label={<u>S</u>} title="Subrayado (Ctrl+U)" />
        <span className="mx-1" style={{ color: 'var(--color-border)' }}>|</span>
        <Btn cmd="insertUnorderedList" label="• Lista" title="Lista con viñetas" />
        <Btn cmd="insertOrderedList" label="1. Lista" title="Lista numerada" />
        <span className="mx-1" style={{ color: 'var(--color-border)' }}>|</span>
        <Btn cmd="formatBlock" arg="h3" label="Título" title="Subtítulo" />
        <Btn cmd="formatBlock" arg="p" label="Párrafo" title="Texto normal" />
        <span className="mx-1" style={{ color: 'var(--color-border)' }}>|</span>
        <Btn cmd="removeFormat" label="Limpiar" title="Quitar formato" />
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML || '')}
        className="min-h-[160px] px-3 py-2 rounded-md text-sm leading-relaxed rich-editor"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          outline: 'none',
        }}
      />
      <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Podés usar negrita, cursiva, listas y subtítulos. Pegá texto con formato desde otro lado y lo respeta.
      </p>
    </div>
  );
}

function UpdateForm({ initial, onCancel, onSaved, user }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

  const stripHtml = (html) => html.replace(/<[^>]*>/g, '').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !stripHtml(body)) {
      toast.warning('Completá el título y el detalle');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await updateDoc(doc(db, 'updates', initial.id), {
          title: title.trim(),
          body,
          updatedAt: serverTimestamp(),
        });
        await logAction(user, 'update', 'updates', initial.id, `Edito actualizacion: ${title.trim()}`);
        toast.success('Actualización editada');
      } else {
        const ref = await addDoc(collection(db, 'updates'), {
          title: title.trim(),
          body,
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdByEmail: user?.email || null,
        });
        await logAction(user, 'create', 'updates', ref.id, `Publico actualizacion: ${title.trim()}`);
        toast.success('Actualización publicada');
      }
      onSaved();
    } catch (err) {
      console.error('Error saving update:', err);
      toast.error('Error al guardar la actualización');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-lg mb-6 space-y-3"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {initial ? 'Editar actualización' : 'Nueva actualización'}
        </h3>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Título</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ej: Planilla en vivo con reloj"
          className="w-full px-3 py-2 rounded-md text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Detalle</label>
        <RichTextEditor value={body} onChange={setBody} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          {saving ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Publicar')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function UpdatesManager({ isOwner, user }) {
  const { toast } = useToast();
  const { data: updates, loading } = useUpdates();
  const [showForm, setShowForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);

  const handleDelete = async (update) => {
    if (!window.confirm(`Eliminar la actualización "${update.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'updates', update.id));
      await logAction(user, 'delete', 'updates', update.id, `Elimino actualizacion: ${update.title}`);
      toast.success('Actualización eliminada');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {isOwner && !showForm && !editingUpdate && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          <PlusIcon style={{ width: 16, height: 16 }} /> Nueva actualización
        </button>
      )}

      {isOwner && showForm && (
        <UpdateForm
          onCancel={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
          user={user}
        />
      )}

      {isOwner && editingUpdate && (
        <UpdateForm
          initial={editingUpdate}
          onCancel={() => setEditingUpdate(null)}
          onSaved={() => setEditingUpdate(null)}
          user={user}
        />
      )}

      {updates.length === 0 ? (
        <EmptyState message="Todavía no hay actualizaciones publicadas" />
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <article
              key={u.id}
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {u.title}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDateEs(u.publishedAt)}
                    {u.createdByEmail && <span className="ml-1">· {u.createdByEmail}</span>}
                  </p>
                </div>
                {isOwner && (
                  <div className="flex gap-1 shrink-0">
                    <IconButton icon={EditIcon} label="Editar" onClick={() => setEditingUpdate(u)} />
                    <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(u)} color="var(--color-danger)" />
                  </div>
                )}
              </div>
              <div
                className="text-sm mt-2 rich-content"
                style={{ color: 'var(--color-text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: u.body || '' }}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
