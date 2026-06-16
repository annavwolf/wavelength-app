"use client";

import MicButton from "@/components/interview/MicButton";

// A textarea with an embedded mic button for speaking the answer instead
// of typing it.
export default function VoiceTextarea({
  value,
  onChange,
  rows = 5,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`form-input pr-12 ${className}`}
      />
      <div className="absolute right-2 bottom-2">
        <MicButton
          onResult={(transcript) =>
            onChange(value ? `${value} ${transcript}` : transcript)
          }
        />
      </div>
    </div>
  );
}
