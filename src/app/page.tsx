"use client";
import { useState, useEffect } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [copyButtonText, setCopyButtonText] = useState("Copy Response");

  // Listen for paste events to support pasting images from the clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              setFile(blob);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

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
      console.error(error);
      setMessage("An error occurred.");
    }
    setUploading(false);
  };

  const handleCopy = () => {
    const rows = message.split("\n").filter((line) => line.trim() !== "");
    if (rows.length > 1) {
      // Skip the header row
      const dataRows = rows
        .slice(1)
        .map((row) =>
          row
            .split(",")
            .map((cell) => cell.trim())
            .join("\t")
        )
        .join("\n");
      navigator.clipboard.writeText(dataRows);
    } else {
      navigator.clipboard.writeText(message);
    }
    setCopyButtonText("Copied!");
    setTimeout(() => {
      setCopyButtonText("Copy Response");
    }, 3000);
  };

  // Parse CSV response: first line is header, rest are data rows.
  const rows = message.split("\n").filter((line) => line.trim() !== "");
  const header =
    rows.length > 0 ? rows[0].split(",").map((cell) => cell.trim()) : [];
  const dataRows =
    rows.length > 1
      ? rows.slice(1).map((row) => row.split(",").map((cell) => cell.trim()))
      : [];

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload an Image
      </Typography>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #ccc",
                borderRadius: 2,
                p: 1,
                backgroundColor: "#fff",
              }}
            >
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
            <Typography>
              Drag &amp; drop an image here, click to select file, or paste an
              image
            </Typography>
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
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  {header.map((cell, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                    <TableCell key={index}>{cell}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {dataRows.map((row, rowIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                      <TableCell key={cellIndex}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="outlined" onClick={handleCopy} sx={{ mt: 1 }}>
            {copyButtonText}
          </Button>
        </>
      )}
    </Container>
  );
}
