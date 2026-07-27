'use client';

import { useState, useRef, useCallback } from 'react';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<{ preview?: string; error?: string }>;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

export default function DocumentUploader({
  onUpload,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt'],
  maxSizeMB = 10,
}: DocumentUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(ext)) {
      return `Aina ya faili haikusudiiwi. Tumia: ${acceptedTypes.join(', ')}`;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      return `Faili kubwa sana. Ukubwa wa juu: ${maxSizeMB}MB`;
    }
    return null;
  };

  const handleFile = useCallback(
    async (f: File) => {
      const validationError = validate(f);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(f);
      setError(null);
      setPreview(null);
      setUploading(true);

      try {
        const result = await onUpload(f);
        if (result.error) {
          setError(result.error);
        } else if (result.preview) {
          setPreview(result.preview);
        }
      } catch {
        setError('Imeshindwa kupakia faili. Jaribu tena.');
      } finally {
        setUploading(false);
      }
    },
    [onUpload, acceptedTypes, maxSizeMB],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-orange-500/50 bg-orange-500/5'
            : 'border-border bg-card hover:border-primary/30 hover:bg-muted'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
        <CloudArrowUpIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-1">
          Buruta faili hapa au bonyeza kupakia
        </p>
        <p className="text-xs text-muted-foreground">
          {acceptedTypes.join(', ')} — hadi {maxSizeMB}MB
        </p>
      </div>

      {/* File info */}
      {file && (
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
          <DocumentTextIcon className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          {uploading && (
            <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          )}
          {!uploading && !error && preview && (
            <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Muhtasari uliochukuliwa
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-10">
            {preview}
          </p>
        </div>
      )}
    </div>
  );
}
