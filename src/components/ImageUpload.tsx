import { useState, useRef } from 'react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Button } from './Common';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './Common';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  path: string;
  label?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
}

export function ImageUpload({ 
  value, 
  onChange, 
  onRemove, 
  path, 
  label = 'Upload Image', 
  className,
  aspectRatio = 'square'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setError('File size must be less than 2MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Wrap in promise for better error/finally handling
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(p);
          },
          (err) => {
            console.error('Upload observer error:', err);
            reject(err);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              onChange(downloadURL);
              resolve();
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message?.includes('storage/unauthorized') 
        ? 'Permission denied. Please check storage rules.' 
        : 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      // Reset input value to allow re-upload of same file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    
    // We don't necessarily need to delete from storage every time if we want to keep history
    // but for clean demo, we'll just trigger the onRemove callback
    if (onRemove) {
      onRemove();
    } else {
      onChange('');
    }
  };

  const ratioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]'
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div 
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all overflow-hidden flex items-center justify-center bg-white/[0.02]',
          value && !uploading ? 'border-blue-500/30' : 'border-white/10 hover:border-white/20',
          ratioClasses[aspectRatio]
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-blue-500"
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{Math.round(progress)}%</span>
          </div>
        ) : value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            {/* Always-visible controls on touch devices; reveal on hover for pointer devices. */}
            <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-black hover:bg-neutral-200 h-9"
              >
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                aria-label="Remove image"
                className="text-white hover:bg-red-500/20 hover:text-red-400 h-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-6 text-neutral-500 hover:text-neutral-300 transition-colors w-full h-full justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
            <span className="text-[10px] opacity-60">JPG, PNG up to 2MB</span>
          </button>
        )}
      </div>
      
      {error && (
        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{error}</p>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*"
        onChange={handleUpload}
      />
    </div>
  );
}
