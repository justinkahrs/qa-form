"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Container, Typography, Box, Alert, Button } from "@mui/material";

/**
 * Phone side:
 * 1) If there's a sessionId, automatically retrieve the Desktop's offer, setRemoteDescription -> createAnswer -> setLocalDescription -> PATCH to server
 * 2) If no sessionId, optionally let user open the camera just for scanning or local usage
 * 3) On ICE candidate => POST to /api/webrtc with role=phone
 * 4) Poll for the Desktop’s ICE candidates with a setInterval
 * 5) Show local preview, so user sees their own camera feed
 * 6) Once the local preview is showing, hide all other UI
 */

export default function PhonePage() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("sessionId") || "";
  const [sessionId] = useState(initialSessionId);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Polling reference for ICE candidates
  const candidatesPollRef = useRef<NodeJS.Timer | null>(null);

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

  // If there's a sessionId, automatically start the camera to connect
  useEffect(() => {
    if (sessionId && pc && !localStream) {
      void handleStartCamera();
    }
  }, [sessionId, pc, localStream]);

  useEffect(() => {
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
        // Fetch the desktop's offer
        const response = await fetch(`/api/webrtc?sessionId=${sessionId}`);
        const data = await response.json();

        if (!data.offer) {
          setErrorMessage(
            "No offer found. Make sure Desktop created a session."
          );
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
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {!localStream ? (
        // If we don't have localStream yet
        <>
          <Typography variant="h4" gutterBottom>
            Phone Page
          </Typography>
          {/* Show a fallback if there's no session ID */}
          {!sessionId && (
            <>
              <Typography>
                No Session ID. You can still open your camera if needed.
              </Typography>
              <Box mt={2}>
                <Button variant="contained" onClick={() => handleStartCamera()}>
                  Open Camera
                </Button>
              </Box>
            </>
          )}
        </>
      ) : (
        // Once localStream is available, show only the local preview
        <Box>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ maxWidth: "100%", border: "1px solid #ccc" }}
          />
        </Box>
      )}
      {connected && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Connection Established. Your camera stream is sent to the Desktop.
        </Alert>
      )}
    </Container>
  );
}
