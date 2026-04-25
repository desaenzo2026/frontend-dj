import { useState, useEffect, useRef } from 'react';
import { searchYoutube } from '../api';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';

export default function SongAutocomplete({ value, onChange, onSelect, placeholder = 'Nombre de la canción' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const debounceRef                   = useRef(null);
  const selectingRef                  = useRef(false);
  const requestSeqRef                 = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError('');
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestSeqRef.current;
      setLoading(true);
      setError('');

      try {
        const results = await searchYoutube(query);
        if (requestSeqRef.current !== requestId) return;

        const normalized = Array.isArray(results)
          ? results.filter((s) => typeof s === 'string' && s.trim())
          : [];

        setSuggestions(normalized);
        setOpen(true);
      } catch {
        if (requestSeqRef.current !== requestId) return;
        setSuggestions([]);
        setError('No se pudieron cargar sugerencias');
        setOpen(true);
      } finally {
        if (requestSeqRef.current === requestId) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const select = (s) => {
    selectingRef.current = true;
    if (onSelect) {
      onSelect(s);
    } else {
      onChange(s);
    }
    setOpen(false);
    setSuggestions([]);
    setTimeout(() => { selectingRef.current = false; }, 100);
  };

  const handleBlur = () => {
    // Longer delay so touch events on mobile can register before closing
    setTimeout(() => {
      if (!selectingRef.current) setOpen(false);
    }, 300);
  };

  return (
    <div className="autocomplete-wrap">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => value.trim() && setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {loading && <li className="is-muted">Buscando...</li>}
          {!loading && error && <li className="is-muted">{error}</li>}
          {!loading && !error && suggestions.length === 0 && (
            <li className="is-muted">Sin sugerencias</li>
          )}
          {!loading && !error && suggestions.map((s, i) => (
            <li key={i} onPointerDown={(e) => { e.preventDefault(); select(s); }}>
              <MusicalNoteIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />{s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
