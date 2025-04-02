"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container, Typography, Box, Alert, Button } from "@mui/material";

/**
 * Phone side:
 * 1) Attempt to retrieve the Desktop's offer from /api/webrtc?sessionId=xxx
 * 2) Once we have the offer, setRemoteDescription(offer), createAnswer => setLocalDescription(answer) => PATCH to /api/webrtc
 * 3) On ICE candidate => POST to /api/webrtc with role=phone
 * 4) Poll for the desktop’s ICE candidates with a setInterval
 * 5) Show local preview, so user sees their own camera feed
 */

export default function PhonePage() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("sessionId") || "";
  const [sessionId] = useState(initialSessionId);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const candidatesPollRef = React.useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    const newPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    newPc.onicecandidate = async (event) => {
      if (event.candidate && sessionId) {
        try {
          await fetch("/api/webrtc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              candidate: event.candidate.toJSON(),
              role: "phone",
            }),
          });
        } catch (err) {
          console.error("Error sending phone ICE candidate", err);
        }
      }
    };

    newPc.onconnectionstatechange = () => {
      if (
        newPc.connectionState === "connected" ||
        newPc.connectionState === "completed"
      ) {
        setConnected(true);
      }
    };

    setPc(newPc);

    return () => {
      newPc.close();
      if (candidatesPollRef.current) {
        clearInterval(candidatesPollRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // On enabling the webcam, try connecting
  useEffect(() => {
    if (webcamEnabled) {
      (async () => {
        await handleStartCamera();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamEnabled]);

  const handleStartCamera = async () => {
    setErrorMessage("");
    if (!pc) {
      setErrorMessage("No PeerConnection.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      setLocalStream(stream);
      // Add tracks to PeerConnection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // If we have a sessionId, that means we have a desktop offer
      if (sessionId) {
        // First, get the desktop's offer
        const response = await fetch(`/api/webrtc?sessionId=${sessionId}`);
        const data = await response.json();

        if (!data.offer) {
          setErrorMessage("No offer found. Make sure Desktop created a session.");
          return;
        }

        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send our answer to the Desktop
        await fetch("/api/webrtc", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            description: answer,
          }),
        });

        // Poll for the desktop's ICE candidates
        if (candidatesPollRef.current) {
          clearInterval(candidatesPollRef.current);
        }
        candidatesPollRef.current = setInterval(
          () => pollCandidates(sessionId, pc, "desktop"),
          2000
        );
      }
    } catch (err) {
      console.error("Error accessing webcam or microphone:", err);
      setErrorMessage("There was an issue connecting to the webcam.");
    }
  };

  const pollCandidates = async (
    sId: string,
    pcRef: RTCPeerConnection,
    side: "desktop" | "phone"
  ) => {
    try {
      const res = await fetch(`/api/webrtc?sessionId=${sId}`);
      const data = await res.json();
      const candidatesKey =
        side === "desktop" ? "candidatesDesktop" : "candidatesPhone";
      const candidates: RTCIceCandidateInit[] = data[candidatesKey] || [];
      for (const c of candidates) {
        try {
          await pcRef.addIceCandidate(new RTCIceCandidate(c));
        } catch (iceErr) {
          console.error("Error adding ICE candidate:", iceErr);
        }
      }
    } catch (err) {
      console.error("Poll candidate error:", err);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Phone - WebRTC Sender
      </Typography>
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {!connected ? (
        <>
          <Typography>
            {sessionId ? (
              <>
                Session ID: <strong>{sessionId}</strong>
              </>
            ) : (
              "No Session ID. Open the camera to scan the Desktop QR code."
            )}
          </Typography>
          <Box mt={2}>
            <Button variant="contained" onClick={() => setWebcamEnabled(true)}>
              {sessionId ? "Start Camera and Send Stream" : "Open Camera"}
            </Button>
          </Box>
        </>
      ) : (
        <Alert severity="success">
          Connection Established. Your camera stream is sent to the Desktop.
        </Alert>
      )}
      {localStream && (
        <Box mt={2}>
          <Typography variant="h6">Local Preview</Typography>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ maxWidth: "100%", border: "1px solid #ccc" }}
          />
        </Box>
      )}
    </Container>
  );
}