"use client";

import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Alert,
  Button,
} from "@mui/material";

export default function PhonePage({
  searchParams,
}: {
  searchParams?: { sessionId?: string };
}) {
  const [sessionId, setSessionId] = useState(searchParams?.sessionId || "");
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    newPc.onicecandidate = async (event) => {
      if (event.candidate) {
        // Typically you'd send ICE to desktop via the signaling server
        // but for simplicity, ignoring ICE exchange
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartCamera = async () => {
    setErrorMessage("");
    if (!pc || !sessionId) {
      setErrorMessage("No PeerConnection or Session ID.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      // Add tracks to PC
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Get Desktop's Offer from server
      const response = await fetch(`/api/webrtc?sessionId=${sessionId}`);
      const data = await response.json();

      if (!data.offer) {
        setErrorMessage("No offer found. Ensure Desktop generated a session.");
        return;
      }

      // Set remote description (Desktop’s Offer)
      await pc.setRemoteDescription(data.offer);

      // Create local answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // POST answer to server
      await fetch("/api/webrtc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          description: answer,
        }),
      });
    } catch (err) {
      console.error(err);
      setErrorMessage("Error accessing camera or creating answer.");
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
            Session ID: <strong>{sessionId || "No Session ID"}</strong>
          </Typography>
          <Box mt={2}>
            <Button variant="contained" onClick={handleStartCamera}>
              Start Camera and Send Stream
            </Button>
          </Box>
        </>
      ) : (
        <Alert severity="success">
          Connection Established. Your camera stream is sent to Desktop.
        </Alert>
      )}
    </Container>
  );
}