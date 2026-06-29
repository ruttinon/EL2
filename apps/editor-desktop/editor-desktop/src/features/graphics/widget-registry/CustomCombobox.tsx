import React, { useState, useRef, useEffect } from 'react';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
};

export function CustomCombobox({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', outline: 'none' }}
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          maxHeight: '220px',
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          zIndex: 99999,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '4px'
        }}>
          {filteredOptions.length > 0 ? filteredOptions.map(opt => (
            <div
              key={opt.value}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                background: value === opt.value ? 'rgba(8, 124, 139, 0.08)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(8, 124, 139, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = value === opt.value ? 'rgba(8, 124, 139, 0.08)' : 'transparent';
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                setSearch(opt.value);
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{opt.value || 'System UI'}</div>
            </div>
          )) : (
            <div style={{ padding: '8px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
              No matches...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
