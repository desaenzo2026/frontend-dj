import { useState, useEffect, useRef } from 'react';
import { searchYoutube } from '../api';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';

export default function SongAutocomplete({ value, onChange, onSelect, placeholder = 'Nombre de la canción' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const debounceRef                   = useRef(null);
  const selectingRef                  = useRef(false);

  useEffect(() => {
    if (!value.trim() || value.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchYoutube(value);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
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
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {suggestions.map((s, i) => (
            <li key={i} onPointerDown={(e) => { e.preventDefault(); select(s); }}>
              <MusicalNoteIcon className="icon-sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />{s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
