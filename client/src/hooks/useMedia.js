import { useState, useEffect, useRef, useCallback } from 'react';

export function useMedia() {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedDevices, setSelectedDevices] = useState({});
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  // Get available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(list => {
      setDevices({
        cameras: list.filter(d => d.kind === 'videoinput'),
        microphones: list.filter(d => d.kind === 'audioinput'),
        speakers: list.filter(d => d.kind === 'audiooutput'),
      });
    });
  }, []);

  const startMedia = useCallback(async (constraints = {}) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints.videoDeviceId
          ? { deviceId: { exact: constraints.videoDeviceId } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: constraints.audioDeviceId
          ? { deviceId: { exact: constraints.audioDeviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });

      streamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      console.error('[Media] getUserMedia error:', err);
      setError(err.message);
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach(track => { track.enabled = !track.enabled; });
    setMuted(m => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    videoTracks.forEach(track => { track.enabled = !track.enabled; });
    setVideoOff(v => !v);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true,
      });

      setScreenStream(screen);
      setScreenSharing(true);

      screen.getVideoTracks()[0].onended = () => {
        setScreenSharing(false);
        setScreenStream(null);
      };

      return screen;
    } catch (err) {
      console.error('[Media] Screen share error:', err);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setScreenSharing(false);
  }, [screenStream]);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setScreenStream(null);
    setScreenSharing(false);
  }, [screenStream]);

  useEffect(() => () => stopMedia(), []);

  return {
    localStream: screenSharing ? screenStream : localStream,
    cameraStream: localStream,
    muted,
    videoOff,
    screenSharing,
    devices,
    selectedDevices,
    setSelectedDevices,
    error,
    startMedia,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopMedia,
  };
}
