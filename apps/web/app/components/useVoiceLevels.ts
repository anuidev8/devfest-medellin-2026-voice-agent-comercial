"use client";

import { useEffect, useRef } from "react";
import {
  createAudioAnalyser,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalTrackPublication,
  type RemoteAudioTrack,
  type RemoteTrack,
  type Room,
} from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import type { VoiceLevels } from "./VoiceWave";

type Analyser = ReturnType<typeof createAudioAnalyser>;

/**
 * Smooth agent/user volume levels for the bottom VoiceWave.
 * Reads from LiveKit tracks without causing React re-renders every frame.
 */
export function useVoiceLevels() {
  const room = useRoomContext() as Room;
  const levelsRef = useRef<VoiceLevels>({ agent: 0, user: 0 });
  const agentAnalyserRef = useRef<Analyser | null>(null);
  const userAnalyserRef = useRef<Analyser | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      void agentAnalyserRef.current?.cleanup();
      void userAnalyserRef.current?.cleanup();
      agentAnalyserRef.current = null;
      userAnalyserRef.current = null;
      levelsRef.current = { agent: 0, user: 0 };
    };

    const tick = () => {
      const agent = agentAnalyserRef.current?.calculateVolume() ?? 0;
      const user = userAnalyserRef.current?.calculateVolume() ?? 0;
      const prev = levelsRef.current;
      levelsRef.current = {
        agent: prev.agent + (agent - prev.agent) * 0.35,
        user: prev.user + (user - prev.user) * 0.35,
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    };

    const attachAgent = (track: RemoteAudioTrack) => {
      void agentAnalyserRef.current?.cleanup();
      agentAnalyserRef.current = createAudioAnalyser(track, { cloneTrack: true, smoothingTimeConstant: 0.7 });
      ensureLoop();
    };

    const attachUser = (track: LocalAudioTrack) => {
      void userAnalyserRef.current?.cleanup();
      userAnalyserRef.current = createAudioAnalyser(track, { cloneTrack: true, smoothingTimeConstant: 0.7 });
      ensureLoop();
    };

    for (const pub of room.localParticipant.audioTrackPublications.values()) {
      if (pub.track) attachUser(pub.track as LocalAudioTrack);
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track && pub.track.kind === Track.Kind.Audio) attachAgent(pub.track as RemoteAudioTrack);
      }
    }

    const onLocalPublished = (pub: LocalTrackPublication) => {
      if (pub.track?.kind === Track.Kind.Audio) attachUser(pub.track as LocalAudioTrack);
    };
    const onRemoteSubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) attachAgent(track as RemoteAudioTrack);
    };

    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.TrackSubscribed, onRemoteSubscribed);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.TrackSubscribed, onRemoteSubscribed);
      stop();
    };
  }, [room]);

  return levelsRef;
}
