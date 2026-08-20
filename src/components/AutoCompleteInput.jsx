import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function AutoCompleteInput({
  value,
  onChange,
  options = [],
  placeholder,
  required,
  className = 'input-field',
  id,
  name,
  disabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, bottom: 'auto', left: 0, width: 0, placement: 'bottom' });
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const query = (value || '').toLowerCase().trim();
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(query)
  );

  const updateCoords = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // If less space below than required and more space above, open upwards
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      setCoords({
        bottom: window.innerHeight - rect.top + 4,
        top: 'auto',
        left: rect.left,
        width: rect.width,
        placement: 'top',
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        bottom: 'auto',
        left: rect.left,
        width: rect.width,
        placement: 'bottom',
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollOrResize = () => {
        updateCoords();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      updateCoords();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        className={className}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value || ''}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
          updateCoords();
        }}
        onFocus={() => {
          if (options.length > 0) {
            setIsOpen(true);
            updateCoords();
          }
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && filteredOptions.length > 0 &&
        createPortal(
          <ul
            ref={dropdownRef}
            className={`autocomplete-dropdown portal-dropdown ${coords.placement}`}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top !== 'auto' ? `${coords.top}px` : 'auto',
              bottom: coords.bottom !== 'auto' ? `${coords.bottom}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
          >
            {filteredOptions.map((opt, index) => (
              <li
                key={opt}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`autocomplete-item${index === highlightedIndex ? ' highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevents input blur before select
                  handleSelect(opt);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {opt}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
