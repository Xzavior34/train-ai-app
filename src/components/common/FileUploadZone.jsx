import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";

// Strip anything that isn't safe in a storage object path/name.
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/**
 * Reusable drag-and-drop + click-to-browse upload zone backed by Supabase
 * Storage. Purely handles the storage upload + producing a usable URL —
 * callers are responsible for persisting that URL wherever it belongs
 * (user_profiles.avatar_url, courses.cover_image_url, a file_uploads row,
 * etc.), since that varies per use case.
 *
 * Props:
 *  - bucket: storage bucket name (default "uploads" — the generic bucket
 *    this schema's `file_uploads` table naming convention implies).
 *  - pathPrefix: folder prefix inside the bucket (e.g. a user id or
 *    "courses/<id>") so uploads land in a predictable, permission-scoped path.
 *  - accept: native <input accept> filter (e.g. "image/*").
 *  - maxSizeMB: client-side size guard before attempting the upload.
 *  - onUploaded(url, path): called once the file is stored, with the best
 *    available URL (signed URL for private buckets, public URL otherwise)
 *    and the raw storage path.
 */
function FileUploadZone({
  bucket = "uploads",
  pathPrefix = "",
  accept = "*",
  maxSizeMB = 10,
  onUploaded,
  label = "Drag and drop a file here, or click to browse",
  disabled = false,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    if (disabled) return;
    const file = fileList?.[0];
    if (!file) return;
    setError("");

    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large — max ${maxSizeMB}MB.`);
      return;
    }

    if (!supabase) {
      setError("Storage isn't configured in this environment.");
      return;
    }

    setUploading(true);
    try {
      const dotIndex = file.name.lastIndexOf(".");
      const ext = dotIndex > -1 ? file.name.slice(dotIndex) : "";
      const base = dotIndex > -1 ? file.name.slice(0, dotIndex) : file.name;
      const safeName = `${Date.now()}_${sanitizeFileName(base)}${ext}`;
      const path = pathPrefix ? `${pathPrefix.replace(/\/$/, "")}/${safeName}` : safeName;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      // Prefer a signed URL (works for both public and private buckets, as
      // long as RLS allows the caller to read the path); fall back to a
      // plain public URL if signing isn't available.
      let url = null;
      try {
        const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (!signErr && signed?.signedUrl) url = signed.signedUrl;
      } catch {
        // ignore — fall through to public URL
      }
      if (!url) {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        url = pub?.publicUrl || null;
      }

      setUploadedName(file.name);
      if (onUploaded) onUploaded(url, path);
    } catch (e) {
      console.warn("File upload failed:", e);
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [bucket, pathPrefix, maxSizeMB, onUploaded, disabled]);

  return (
    <div>
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "22px 16px",
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          background: dragOver ? "var(--surface-2)" : "var(--surface)",
          transition: "border-color .15s ease, background-color .15s ease",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Uploading...</div>
        ) : uploadedName ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={22} color="var(--success)" />
            <div style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>{uploadedName}</div>
            <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700 }}>Click or drop to replace</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <UploadCloud size={24} color="var(--text-3)" />
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Max {maxSizeMB}MB</div>
          </div>
        )}
      </div>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "var(--danger)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

export default FileUploadZone;
export { FileUploadZone };
