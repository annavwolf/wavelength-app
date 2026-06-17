"use client";

import { useEffect, useState } from "react";
import type { AppSupabaseClient } from "@/components/interview/types";
import type { Member } from "@/types/database";

export default function CloseStep({
  member,
  supabase,
  onSaved,
}: {
  member: Member;
  supabase: AppSupabaseClient;
  onSaved: (fields: Partial<Member>) => void;
}) {
  const [statusSet, setStatusSet] = useState(false);

  useEffect(() => {
    async function complete() {
      const { error } = await supabase
        .from("members")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("member_id", member.member_id);

      if (error) {
        console.error("[interview/close] failed to set status=complete:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else {
        onSaved({ status: "complete" });
      }
      setStatusSet(true);
    }

    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center py-8">
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <h1
        className="text-4xl font-serif mb-4"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        Thank you,{" "}
        <span className="purple">{member.display_name.split(" ")[0]}.</span>
      </h1>

      <p className="accent text-xl mb-6">
        That was a meaningful conversation.
      </p>

      <p className="text-[var(--color-grey)] max-w-md mx-auto mb-4">
        I&apos;m going to sit with what you&apos;ve shared and bring it
        together with your team&apos;s responses. Once everyone has spoken
        with me, I&apos;ll come back to you.
      </p>

      <p className="text-[var(--color-grey)] max-w-md mx-auto">
        You can close this window. If you need to change anything or get in
        touch, reach Dr. Wolf at{" "}
        <a
          href="mailto:anna.v.wolf@gmail.com"
          className="underline text-[var(--color-purple)]"
        >
          anna.v.wolf@gmail.com
        </a>
        .
      </p>

      {statusSet && (
        <p className="mt-8 text-xs text-[var(--color-grey)]">
          ✓ Your responses have been saved.
        </p>
      )}
    </div>
  );
}
