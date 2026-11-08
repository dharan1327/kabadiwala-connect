import { useState } from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { api, uploadPhoto } from '../lib/api.js';
import { CATEGORIES } from '../lib/constants.js';
import { errorText } from './ui.jsx';

// Photo upload with AI suggestion. The suggestion is advisory: the household always confirms or corrects,
// and when no model is available the category is chosen manually. No prediction is ever invented.
export default function PhotoUpload({ value, onChange, onError }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');

  const pick = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onError?.('Please choose a JPEG, PNG or WebP photograph.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.('The photograph must be under 5 MB.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const { image_id } = await uploadPhoto(file);
      const result = await api(`/scrap/images/${image_id}/classify`, { method: 'POST' });
      if (result.status === 'ok') {
        setAiNote(`AI suggests ${CATEGORIES.find((c) => c.value === result.category)?.label} (confidence ${(result.confidence * 100).toFixed(0)}%). ${result.message}`);
        onChange({ ...value, imageId: image_id, aiCategory: result.category, aiConfidence: result.confidence, category: result.category });
      } else {
        setAiNote(result.message || 'AI classification is unavailable. Please choose the category manually.');
        onChange({ ...value, imageId: image_id, aiCategory: null, aiConfidence: null });
      }
    } catch (err) {
      onError?.(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-6 text-center hover:bg-emerald-50">
        {preview ? (
          <img src={preview} alt="Preview of the scrap photograph" className="max-h-56 rounded-xl object-contain" />
        ) : (
          <>
            <Camera className="h-8 w-8 text-emerald" />
            <span className="mt-2 font-semibold text-forest">Upload a scrap photograph</span>
            <span className="text-xs text-ink/50">JPEG, PNG or WebP · up to 5 MB</span>
          </>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
               onChange={(e) => pick(e.target.files?.[0])} aria-label="Upload scrap photograph" />
      </label>
      {busy && <p className="text-sm text-ink/60">Processing photograph…</p>}
      {aiNote && (
        <p className="flex gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {aiNote}
        </p>
      )}
      <div>
        <label className="label" htmlFor="category">Material category (confirm or correct)</label>
        <select id="category" className="input" value={value.category || ''}
                onChange={(e) => onChange({ ...value, category: e.target.value })}>
          <option value="">Select a category…</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}
