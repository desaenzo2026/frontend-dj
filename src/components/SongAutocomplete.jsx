import { useState, useEffect, useRef } from 'react';
import { searchYoutube } from '../api';

export default function SongAutocomplete({ value, onChange, onSelect, placeholder = 'Nombre de la canción' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const debounceRef                   = useRef(null);

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
    if (onSelect) {
      onSelect(s);
    } else {
      onChange(s);
    }
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="autocomplete-wrap">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => select(s)}>
              🎵 {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
