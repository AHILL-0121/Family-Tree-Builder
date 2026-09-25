"use client";

import React, { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Check, RotateCcw } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = 1, // Default to square for profile photos
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    },
    [aspectRatio]
  );

  const getCroppedImage = useCallback(async (): Promise<string> => {
    const image = imgRef.current;
    if (!image || !completedCrop) {
      throw new Error("Crop data not available");
    }

    // Avatars are shown at most ~100 px, so store at most 256 px: a phone photo would
    // otherwise add megabytes to every save and export.
    const MAX = 256;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    const scale = Math.min(1, MAX / Math.max(cropWidth, cropHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cropWidth * scale));
    canvas.height = Math.max(1, Math.round(cropHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // WebP where supported (browsers without it silently return PNG), JPEG otherwise
    const webp = canvas.toDataURL("image/webp", 0.82);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  }, [completedCrop]);

  const handleConfirm = async () => {
    try {
      const croppedImageUrl = await getCroppedImage();
      onCropComplete(croppedImageUrl);
    } catch (error) {
      console.error("Error cropping image:", error);
    }
  };

  const handleReset = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    }
  };

  const btn = "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] font-medium";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-[400px] justify-center overflow-auto rounded-[10px] border border-rule bg-[radial-gradient(hsl(var(--grid))_1px,transparent_1px)] p-4 [background-size:16px_16px]">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspectRatio}
          circularCrop
          className="max-w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            onLoad={onImageLoad}
            style={{ maxHeight: "350px", maxWidth: "100%" }}
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handleReset} className={`${btn} border-transparent text-ink-2 hover:bg-rule-2 hover:text-ink`}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className={`${btn} border-rule bg-card hover:border-line`}>
          Cancel
        </button>
        <button type="button" onClick={handleConfirm} className={`${btn} border-ink bg-ink text-surface hover:opacity-90`}>
          <Check className="h-4 w-4" />
          Use photo
        </button>
      </div>
    </div>
  );
}
