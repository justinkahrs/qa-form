"use client";
import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextareaAutosize from "@mui/material/TextareaAutosize";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [copyButtonText, setCopyButtonText] = useState("Copy Response");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("pic", file);
      const response = await fetch(
        "https://hook.us2.make.com/qbiavde1hf7s8vb89iojifhk1h1nvfmb",
        {
          method: "POST",
          body: formData,
        }
      );
      const responseText = await response.text();
      setMessage(responseText);
    } catch (error) {
      setMessage("An error occurred.");
    }
    setUploading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopyButtonText("Copied!");
    setTimeout(() => {
      setCopyButtonText("Copy Response");
    }, 3000);
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload an Image
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Paper
          elevation={dragActive ? 3 : 1}
          sx={{
            border: "2px dashed #ccc",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
            backgroundColor: dragActive ? "grey.200" : "transparent",
            cursor: "pointer",
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
          onClick={() => {
            document.getElementById("fileInput")?.click();
          }}
          onKeyDown={() => {
            document.getElementById("fileInput")?.click();
          }}
        >
          {file ? (
            <Box sx={{ display: "flex", alignItems: "center", border: "1px solid #ccc", borderRadius: 2, p: 1, backgroundColor: "#fff" }}>
              <Box
                component="img"
                src={URL.createObjectURL(file)}
                alt={file.name}
                sx={{
                  width: 50,
                  height: 50,
                  objectFit: "cover",
                  mr: 2,
                }}
              />
              <Typography>{file.name}</Typography>
            </Box>
          ) : (
            <Typography>Drag &amp; drop an image here or click to select file</Typography>
          )}
        </Paper>
        <input
          type="file"
          id="fileInput"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <Button variant="contained" type="submit" disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Submit"}
        </Button>
      </Box>
      {message && (
        <>
          <TextareaAutosize
            value={message}
            readOnly
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "8px",
              fontFamily: "inherit",
              fontSize: "1rem",
              borderColor: "#ccc",
              borderRadius: "4px"
            }}
          />
          <Button variant="outlined" onClick={handleCopy} sx={{ mt: 1 }}>
            {copyButtonText}
          </Button>
        </>
      )}
    </Container>
  );
}