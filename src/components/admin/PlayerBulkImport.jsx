import { useState, useRef } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { useToast } from '../../context/ToastContext';

// CSV parser tolerante a campos entre comillas y CRLF/LF.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function escapeCSV(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Acepta yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy. Devuelve { empty | ok | invalid }.
function parseDate(value) {
  if (value == null) return { empty: true };
  const v = String(value).trim();
  if (!v) return { empty: true };
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { ok: false };
    return { ok: true, iso };
  }
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { ok: false };
    return { ok: true, iso };
  }
  return { ok: false };
}

const HEADERS = ['ID', 'Equipo', 'Nombre', 'Apellido', 'Numero', 'FechaNacimiento'];

export default function PlayerBulkImport({ players, teams, user }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const teamMap = {};
    teams.forEach(t => { teamMap[t.id] = t.name; });
    const sorted = [...players].sort((a, b) => {
      const ta = teamMap[a.teamId] || '';
      const tb = teamMap[b.teamId] || '';
      if (ta !== tb) return ta.localeCompare(tb);
      return (a.lastName || '').localeCompare(b.lastName || '');
    });
    const lines = [HEADERS.map(escapeCSV).join(',')];
    sorted.forEach(p => {
      lines.push([
        p.id,
        teamMap[p.teamId] || '',
        p.firstName || '',
        p.lastName || '',
        p.number || '',
        p.birthDate || '',
      ].map(escapeCSV).join(','));
    });
    const csv = '﻿' + lines.join('\r\n'); // BOM para que Excel respete UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jugadores-fechas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileSelected = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast.error('CSV vacio o sin filas de datos.');
        return;
      }
      const headers = rows[0].map(h => h.trim());
      const idIdx = headers.indexOf('ID');
      const dateIdx = headers.indexOf('FechaNacimiento');
      if (idIdx < 0 || dateIdx < 0) {
        toast.error('CSV invalido: faltan columnas ID y/o FechaNacimiento.');
        return;
      }
      const playersById = {};
      players.forEach(p => { playersById[p.id] = p; });
      const changes = [];
      const errors = [];
      const notFound = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(c => !c || !c.trim())) continue;
        const id = (row[idIdx] || '').trim();
        const dateRaw = (row[dateIdx] || '').trim();
        if (!id) continue;
        const player = playersById[id];
        if (!player) { notFound.push({ rowIdx: i + 1, id }); continue; }
        const parsed = parseDate(dateRaw);
        if (parsed.empty) continue;
        if (!parsed.ok) {
          errors.push({
            rowIdx: i + 1,
            name: `${player.firstName} ${player.lastName}`,
            value: dateRaw,
          });
          continue;
        }
        if (parsed.iso === (player.birthDate || '')) continue;
        changes.push({
          id,
          name: `${player.firstName} ${player.lastName}`,
          from: player.birthDate || '',
          to: parsed.iso,
        });
      }
      setPreview({ changes, errors, notFound });
    } catch (err) {
      console.error(err);
      toast.error('Error leyendo CSV.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmApply = async () => {
    if (!preview || preview.changes.length === 0) return;
    setSaving(true);
    try {
      // Firestore batch limit es 500 ops; uso 400 por margen.
      for (let i = 0; i < preview.changes.length; i += 400) {
        const chunk = preview.changes.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(ch => {
          batch.update(doc(db, 'players', ch.id), { birthDate: ch.to });
        });
        await batch.commit();
      }
      if (user) {
        await logAction(
          user,
          'bulk_update',
          'players',
          null,
          `Carga masiva fechas nacimiento: ${preview.changes.length} jugadores`,
        );
      }
      toast.success(`Se actualizaron ${preview.changes.length} jugadores.`);
      setPreview(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  const btnStyle = {
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-3 py-1.5 rounded-md text-sm font-medium"
          style={btnStyle}
        >
          Descargar template (CSV)
        </button>
        <label className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer" style={btnStyle}>
          Subir template
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileSelected}
            className="hidden"
          />
        </label>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Edite solo la columna FechaNacimiento (formato yyyy-mm-dd).
        </span>
      </div>

      {preview && (
        <div
          className="mt-3 rounded-md p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            Vista previa
          </div>
          <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            {preview.changes.length} cambio{preview.changes.length === 1 ? '' : 's'} a aplicar
            {preview.errors.length > 0 && ` · ${preview.errors.length} error${preview.errors.length === 1 ? '' : 'es'}`}
            {preview.notFound.length > 0 && ` · ${preview.notFound.length} ID${preview.notFound.length === 1 ? '' : 's'} no encontrado${preview.notFound.length === 1 ? '' : 's'}`}
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-3 text-xs" style={{ color: 'var(--color-danger)' }}>
              <div className="font-medium mb-1">Filas con fecha invalida (se omitiran):</div>
              <ul className="list-disc list-inside">
                {preview.errors.map((e, idx) => (
                  <li key={idx}>Fila {e.rowIdx}: {e.name} - "{e.value}"</li>
                ))}
              </ul>
            </div>
          )}

          {preview.notFound.length > 0 && (
            <div className="mb-3 text-xs" style={{ color: 'var(--color-warning)' }}>
              <div className="font-medium mb-1">IDs sin coincidencia (se omitiran):</div>
              <ul className="list-disc list-inside">
                {preview.notFound.map((nf, idx) => (
                  <li key={idx}>Fila {nf.rowIdx}: {nf.id}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.changes.length > 0 && (
            <div className="mb-3 max-h-64 overflow-y-auto text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <ul className="space-y-1">
                {preview.changes.map(c => (
                  <li key={c.id}>
                    <span style={{ color: 'var(--color-text)' }}>{c.name}</span>
                    : {c.from || 'vacio'} → {c.to}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || preview.changes.length === 0}
              onClick={confirmApply}
              className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-btn-primary)' }}
            >
              {saving ? 'Guardando...' : `Aplicar ${preview.changes.length} cambio${preview.changes.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={saving}
              className="px-4 py-2 rounded-md text-sm"
              style={btnStyle}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
