"use client";

import { useState } from "react";
import ChatBubble from "@/components/interview/ChatBubble";
import type { Member } from "@/types/database";

export default function RosterStep({
  member,
  allMembers,
  onAdvance,
}: {
  member: Member;
  allMembers: Member[];
  onAdvance: () => void;
}) {
  const [showMissingField, setShowMissingField] = useState(false);
  const [missingName, setMissingName] = useState("");
  const [missingRole, setMissingRole] = useState("");
  const [noted, setNoted] = useState(false);

  function handleMissingSubmit() {
    // V2: route this to the consultant / update the roster for real.
    // For this pass, just capture the note so nothing is lost.
    console.log("[interview/roster] reported missing member:", {
      reportedBy: member.member_id,
      name: missingName,
      role: missingRole,
    });
    setNoted(true);
  }

  return (
    <div>
      <ChatBubble>
        Here&apos;s everyone I know about on this team. Does this look right
        to you?
      </ChatBubble>

      <div className="space-y-3 mt-6 mb-6">
        {allMembers.map((m) => (
          <div key={m.member_id} className="card flex items-center py-4">
            <div>
              <p className="font-medium">
                {m.display_name}
                {m.member_id === member.member_id && (
                  <span className="text-sm text-[var(--color-grey)]">
                    {" "}
                    (you)
                  </span>
                )}
              </p>
              {m.role && (
                <p className="text-sm text-[var(--color-grey)] mt-1">
                  {m.role}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!showMissingField && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onAdvance} className="btn-primary">
            Yes, that&apos;s the team
          </button>
          <button
            type="button"
            onClick={() => setShowMissingField(true)}
            className="btn-secondary"
          >
            Someone&apos;s missing
          </button>
        </div>
      )}

      {showMissingField && !noted && (
        <div className="card space-y-4">
          <div>
            <label className="form-label">Their name</label>
            <input
              type="text"
              value={missingName}
              onChange={(e) => setMissingName(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Their role</label>
            <input
              type="text"
              value={missingRole}
              onChange={(e) => setMissingRole(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleMissingSubmit}
              disabled={!missingName.trim()}
              className="btn-primary"
            >
              Add note
            </button>
            <button
              type="button"
              onClick={() => setShowMissingField(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {noted && (
        <>
          <p className="text-[var(--color-grey)] mb-6">
            Thanks — I&apos;ve made a note of that.
          </p>
          <button type="button" onClick={onAdvance} className="btn-primary">
            Continue
          </button>
        </>
      )}
    </div>
  );
}
