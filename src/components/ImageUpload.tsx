import { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../lib/firebase';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Button, Input, cn } from './Common';
import { AlertCircle, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../hooks/useLocale';
import {
  isSupabaseStorageConfigured,
  supabase,
  supabaseProductBucket,
} from '../lib/supabase';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  path: string;
  label?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
  companyId?: string;
  storageProvider?: 'firebase' | 'supabase-product';
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-');
}

function getProductStoragePath(companyId: string, fileName: string) {
  return `companies/${companyId}/products/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  path,
  label = 'Upload Image',
  className,
  aspectRatio = 'square',
  companyId,
  storageProvider = 'firebase',
}: ImageUploadProps) {
  const { t } = useLocale();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [manualUrl, setManualUrl] = useState(value || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setManualUrl(value || '');
  }, [value]);

  const ratioClasses = useMemo(
    () => ({
      square: 'aspect-square',
      video: 'aspect-video',
      portrait: 'aspect-[3/4]',
    }),
    []
  );

  const useSupabaseProductMode = storageProvider === 'supabase-product';
  const canUseSupabase =
    useSupabaseProductMode && isSupabaseStorageConfigured && Boolean(companyId) && Boolean(supabase);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      return t('common.image_upload.invalid_type');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('common.image_upload.file_too_large');
    }
    return null;
  };

  const uploadWithFirebase = async (file: File) => {
    const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const nextProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(nextProgress);
        },
        (uploadError) => reject(uploadError),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setProgress(100);
            onChange(downloadURL);
            resolve();
          } catch (urlError) {
            reject(urlError);
          }
        }
      );
    });
  };

  const uploadWithSupabase = async (file: File) => {
    if (!supabase || !companyId) {
      throw new Error(t('common.image_upload.supabase_not_configured'));
    }

    const storagePath = getProductStoragePath(companyId, file.name);
    setProgress(15);

    const { error: uploadError } = await supabase.storage
      .from(supabaseProductBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    setProgress(85);

    const { data } = supabase.storage.from(supabaseProductBucket).getPublicUrl(storagePath);
    if (!data?.publicUrl) {
      throw new Error(t('common.image_upload.upload_failed'));
    }

    setProgress(100);
    onChange(data.publicUrl);
  };

  const handleSelectedFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      if (useSupabaseProductMode && !canUseSupabase) {
        throw new Error(t('common.image_upload.supabase_not_configured'));
      }

      if (canUseSupabase) {
        await uploadWithSupabase(file);
      } else {
        await uploadWithFirebase(file);
      }
    } catch (uploadError: any) {
      console.error('Image upload failed:', uploadError);
      setError(t('common.image_upload.upload_failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (useSupabaseProductMode && !canUseSupabase) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
  };

  const handleRemove = () => {
    setError(null);
    setManualUrl('');
    if (onRemove) {
      onRemove();
      return;
    }
    onChange('');
  };

  const handleManualUrlChange = (nextUrl: string) => {
    setError(null);
    setManualUrl(nextUrl);
    onChange(nextUrl.trim());
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (canUseSupabase || storageProvider === 'firebase') setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all overflow-hidden flex items-center justify-center bg-white/[0.02]',
          value && !uploading ? 'border-blue-500/30' : 'border-white/10 hover:border-white/20',
          dragActive && 'border-blue-500/50 bg-blue-500/10',
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {Math.round(progress)}%
            </span>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={() => setError(t('common.image_upload.upload_failed'))}
            />
            <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {(canUseSupabase || storageProvider === 'firebase') && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white text-black hover:bg-neutral-200 h-9"
                >
                  {t('common.image_upload.change')}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                aria-label={t('common.image_upload.remove')}
                className="text-white hover:bg-red-500/20 hover:text-red-400 h-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (canUseSupabase || storageProvider === 'firebase') {
                fileInputRef.current?.click();
              }
            }}
            className="flex flex-col items-center gap-2 p-6 text-neutral-500 hover:text-neutral-300 transition-colors w-full h-full justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-2">
              {canUseSupabase || storageProvider === 'firebase' ? (
                <Upload className="w-5 h-5" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
            {canUseSupabase || storageProvider === 'firebase' ? (
              <>
                <span className="text-[10px] opacity-60">{t('common.image_upload.drag_here')}</span>
                <span className="text-[10px] opacity-60">{t('common.image_upload.click_to_upload')}</span>
                <span className="text-[10px] opacity-60">JPG, PNG, WEBP | 2MB max</span>
              </>
            ) : (
              <span className="text-[10px] opacity-60">{t('common.image_upload.paste_url')}</span>
            )}
          </button>
        )}
      </div>

      {useSupabaseProductMode && !canUseSupabase && (
        <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3 text-amber-200">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-2 w-full">
              <p className="text-xs font-semibold">{t('common.image_upload.supabase_not_configured')}</p>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-amber-100/80 font-bold">
                  {t('common.image_upload.paste_url')}
                </label>
                <Input
                  value={manualUrl}
                  onChange={(event) => handleManualUrlChange(event.target.value)}
                  placeholder="https://..."
                  className="bg-black/30 border-amber-500/20"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{error}</p>
      )}

      {(canUseSupabase || storageProvider === 'firebase') && (
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
        />
      )}
    </div>
  );
}
