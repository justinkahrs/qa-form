"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import QRCode from "react-qr-code";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  TextField,
} from "@mui/material";

export default function Desktop() {
  const [sessionId, setSessionId] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // For capturing
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // For uploading
  const [uploading, setUploading] = useState(false);
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    const newPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // If the phone sends us a track, we display it in remote video
    newPc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Collect ICE candidates automatically
    newPc.onicecandidate = async (event) => {
      if (event.candidate) {
        // In production you would send these to the phone, too.
        // For brevity, we skip ICE exchange. Some local networks still allow connection.
      }
    };

    setPc(newPc);

    return () => {
      newPc.close();
    };
  }, []);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleGenerateSession = async () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setErrorMessage("");
    if (!pc) return;

    try {
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to server
      await fetch("/api/webrtc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: newSessionId,
          description: offer,
        }),
      });

      // Poll for answer in background
      pollForAnswer(newSessionId, pc);
    } catch (err) {
      console.error(err);
      setErrorMessage("Error creating or sending offer.");
    }
  };

  const pollForAnswer = async (sId: string, pcRef: RTCPeerConnection) => {
    setLoading(true);
    let attempts = 0;
    let maxAttempts = 40;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(`/api/webrtc?sessionId=${sId}`);
        const data = await res.json();
        if (data.answer) {
          // We got the phone's answer
          const remoteDesc = new RTCSessionDescription(data.answer);
          await pcRef.setRemoteDescription(remoteDesc);
          setLoading(false);
          return;
        }
        // Wait 2 seconds between attempts
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error("Poll error:", err);
        setErrorMessage("Error polling for phone's answer.");
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    setErrorMessage("No answer received in time. Refresh and try again.");
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !remoteStream) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  const handleUpload = async () => {
    if (!canvasRef.current) return;
    setUploading(true);
    setResponseText("");

    // Convert canvas to blob
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append("pic", blob, "capture.png");
      try {
        const response = await fetch(
          "https://hook.us2.make.com/qbiavde1hf7s8vb89iojifhk1h1nvfmb",
          {
            method: "POST",
            body: formData,
          }
        );
        const text = await response.text();
        setResponseText(text);
      } catch (error) {
        console.error(error);
        setResponseText("An error occurred while uploading.");
      }
      setUploading(false);
    }, "image/png");
  };

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Desktop - WebRTC Receiver
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={handleGenerateSession}>
          Generate Session / Offer
        </Button>
      </Box>

      {sessionId && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">Session ID</Typography>
          <TextField
            fullWidth
            margin="dense"
            value={sessionId}
            inputProps={{ readOnly: true }}
          />
          <Typography variant="body2">
            Use your phone to scan this QR code (or open the link) to connect:
          </Typography>
          <Box mt={2} sx={{ textAlign: "center" }}>
            <QRCode
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/webrtc/phone?sessionId=${sessionId}`
                  : ""
              }
            />
          </Box>
        </Paper>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {loading && <Alert severity="info">Waiting for phone’s answer...</Alert>}

      <Box mt={4} sx={{ display: remoteStream ? "block" : "none" }}>
        <Typography variant="h6" gutterBottom>
          Remote Video Stream
        </Typography>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ maxWidth: "100%", border: "1px solid #ccc" }}
        />
      </Box>

      <Box mt={2}>
        <Button
          variant="contained"
          onClick={handleCapture}
          disabled={!remoteStream}
        >
          Capture Frame
        </Button>
      </Box>

      <canvas
        ref={canvasRef}
        style={{ display: "block", marginTop: "1rem", maxWidth: "100%" }}
      />

      {canvasRef && (
        <Box mt={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Captured Image"}
          </Button>
        </Box>
      )}

      {responseText && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="body2">{responseText}</Typography>
        </Paper>
      )}
    </Container>
  );
}