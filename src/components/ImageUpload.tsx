'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface ImageUploadProps {
  onImage: (base64: string, mimeType: string, preview: string) => void;
  onClear: () => void;
  hasImage: boolean;
  disabled?: boolean;
}

export default function ImageUpload({ onImage, onClear, hasImage, disabled = false }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type as string;
      setPreview(dataUrl);
      onImage(base64, mimeType, dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleClear = () => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    onClear();
  };

  return (
    <div className="relative flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {!hasImage ? (
        <motion.button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all"
          style={{
            background: isDragging ? 'rgba(0, 255, 133, 0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isDragging ? '#00FF8540' : 'rgba(255,255,255,0.08)'}`,
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          title="Upload image"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8896A4" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </motion.button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-10 h-10 rounded-xl overflow-hidden border"
            style={{ borderColor: 'rgba(0, 255, 133, 0.3)' }}
          >
            {preview && (
              <Image
                src={preview}
                alt="Upload preview"
                fill
                className="object-cover"
                unoptimized
              />
            )}
            <button
              onClick={handleClear}
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF4D6D" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
