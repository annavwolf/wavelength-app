"use client";

import { useEffect, useRef, useState } from "react";
import { CITIES, type City } from "@/lib/cities";

// Free-text location input backed by a small bundled city list. Typing
// narrows a dropdown of "City, Country" matches; picking one fills the
// location text and auto-populates the linked timezone field. Free text
// that doesn't match anything is still allowed — this only augments typing,
// it never blocks it.
export default function LocationAutocomplete({
  value,
  onChange,
  onTimezoneSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onTimezoneSelect: (timezone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const matches: City[] =
    query.length > 0
      ? CITIES.filter((c) => c.city.toLowerCase().includes(query)).slice(0, 6)
      : [];

  function selectCity(city: City) {
    onChange(`${city.city}, ${city.country}`);
    onTimezoneSelect(city.timezone);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Start typing a city..."
        className="form-input"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full card py-1 px-0 max-h-56 overflow-auto">
          {matches.map((c) => (
            <button
              key={`${c.city}-${c.country}`}
              type="button"
              onClick={() => selectCity(c)}
              className="w-full text-left px-4 py-2 hover:bg-black/5 flex items-baseline gap-2"
            >
              <span>{c.city}</span>
              <span className="text-sm text-[var(--color-grey)]">
                {c.country}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
