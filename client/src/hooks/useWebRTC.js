import { useEffect, useRef, useCallback, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Add TURN server credentials here for production:
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
  ],
};

export function useWebRTC({ socket, roomId, localStream }) {
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream

  const addRemoteStream = useCallback((socketId, stream) => {
    setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
  }, []);

  const removeRemoteStream = useCallback((socketId) => {
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
  }, []);

  const createPeer = useCallback((socketId, isInitiator) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[socketId] = peer;

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    // ICE candidates
    peer.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('ice-candidate', { to: socketId, candidate, roomId });
      }
    };

    // Remote stream
    peer.ontrack = ({ streams }) => {
      if (streams[0]) addRemoteStream(socketId, streams[0]);
    };

    peer.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${socketId}: ${peer.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        removeRemoteStream(socketId);
      }
    };

    if (isInitiator) {
      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', { to: socketId, offer: peer.localDescription, roomId });
        })
        .catch(console.error);
    }

    return peer;
  }, [socket, roomId, localStream, addRemoteStream, removeRemoteStream]);

  useEffect(() => {
    if (!socket) return;

    // New participant joined — we initiate the offer
    socket.on('participant-joined', ({ socketId }) => {
      createPeer(socketId, true);
    });

    // Received an offer — create peer and send answer
    socket.on('offer', async ({ from, offer }) => {
      const peer = createPeer(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer: peer.localDescription });
    });

    // Received answer to our offer
    socket.on('answer', async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
      }
    });

    // ICE candidate from peer
    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer && candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
    });

    // Peer left
    socket.on('participant-left', ({ socketId }) => {
      removeRemoteStream(socketId);
    });

    return () => {
      socket.off('participant-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('participant-left');
    };
  }, [socket, createPeer, removeRemoteStream]);

  // Update tracks when local stream changes
  useEffect(() => {
    if (!localStream) return;
    Object.values(peersRef.current).forEach(peer => {
      const senders = peer.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) sender.replaceTrack(track).catch(console.error);
        else peer.addTrack(track, localStream);
      });
    });
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach(p => p.close());
      peersRef.current = {};
    };
  }, []);

  return { remoteStreams };
}
