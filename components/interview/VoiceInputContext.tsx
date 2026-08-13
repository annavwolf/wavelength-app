"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  NO_HOSTED_AUDIO,
  type HostedAudioCapabilities,
} from "@/lib/otisAudio";

type VoiceInputState = {
  allowed: boolean;
  hostedAudio: HostedAudioCapabilities;
  /** An optional self-ID used only as a server-side scope cross-check. */
  memberId?: string;
};

const VoiceInputContext = createContext<VoiceInputState>({
  allowed: false,
  hostedAudio: NO_HOSTED_AUDIO,
  memberId: undefined,
});

export function VoiceInputProvider({
  allowed,
  memberId,
  children,
}: {
  allowed: boolean;
  memberId?: string;
  children: React.ReactNode;
}) {
  const [hostedAudio, setHostedAudio] = useState<HostedAudioCapabilities>(NO_HOSTED_AUDIO);

  // The optional hosted audio service is discovered once per participant
  // session. We never even probe those routes until the participant has
  // explicitly enabled voice input; the server independently rechecks that
  // setting before it contacts Deepgram.
  useEffect(() => {
    if (!allowed) {
      setHostedAudio(NO_HOSTED_AUDIO);
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetch("/api/audio/transcribe", { cache: "no-store" }),
      fetch("/api/audio/synthesize", { cache: "no-store" }),
    ])
      .then(async ([transcribe, synthesize]) => {
        const [transcribeData, synthesizeData] = await Promise.all([
          transcribe.ok ? transcribe.json().catch(() => ({})) : Promise.resolve({}),
          synthesize.ok ? synthesize.json().catch(() => ({})) : Promise.resolve({}),
        ]);
        if (!cancelled) {
          setHostedAudio({
            transcription: transcribeData?.available === true,
            synthesis: synthesizeData?.available === true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setHostedAudio(NO_HOSTED_AUDIO);
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, memberId]);

  return (
    <VoiceInputContext.Provider value={{ allowed, hostedAudio, memberId }}>
      {children}
    </VoiceInputContext.Provider>
  );
}

export function useVoiceInputAllowed() {
  return useContext(VoiceInputContext).allowed;
}

export function useHostedVoiceInputAvailable() {
  const { allowed, hostedAudio } = useContext(VoiceInputContext);
  return allowed && hostedAudio.transcription;
}

export function useHostedSpeechAvailable() {
  const { allowed, hostedAudio } = useContext(VoiceInputContext);
  return allowed && hostedAudio.synthesis;
}

export function useVoiceParticipantMemberId() {
  return useContext(VoiceInputContext).memberId;
}
