"use client";

import MicButton from "@/components/interview/MicButton";

// A single-line form-input with an embedded mic button for speaking the
// answer instead of typing it.
export default function VoiceTextInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`form-input pr-12 ${className}`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <MicButton
          onResult={(transcript) =>
            onChange(value ? `${value} ${transcript}` : transcript)
          }
        />
      </div>
    </div>
  );
}
