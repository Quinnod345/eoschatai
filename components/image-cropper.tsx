'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedAreaPixels: any, croppedImage: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const handleCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      console.log('Crop complete. Cropped area pixels:', croppedAreaPixels);
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const createCroppedImage = async () => {
    setIsProcessing(true);
    try {
      if (!croppedAreaPixels) {
        throw new Error('No crop area selected');
      }
      console.log('Creating cropped image with:', { croppedAreaPixels, zoom });

      // Try the standard cropping first
      try {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels);
        onCropComplete(croppedAreaPixels, croppedImage);
        return;
      } catch (mainError) {
        console.error('Primary cropping failed:', mainError);
        // If the primary method fails, try the fallback method
        try {
          console.log('Attempting fallback cropping method...');
          const fallbackImage = await getFallbackCroppedImg(
            image,
            croppedAreaPixels,
          );
          onCropComplete(croppedAreaPixels, fallbackImage);
          return;
        } catch (fallbackError) {
          console.error('Fallback cropping also failed:', fallbackError);
          throw new Error(
            'Both cropping methods failed. Please try a different image.',
          );
        }
      }
    } catch (e) {
      console.error('Error creating cropped image:', e);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Crop Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="relative h-[300px] w-full mt-4">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onCropComplete={handleCropComplete}
            onZoomChange={onZoomChange}
          />
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm text-muted-foreground">Zoom</p>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(value) => setZoom(value[0])}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={createCroppedImage} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Crop & Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to create a cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  try {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Check if crop area is valid
    if (!pixelCrop || pixelCrop.width <= 0 || pixelCrop.height <= 0) {
      console.error('Invalid crop area:', pixelCrop);
      throw new Error('Invalid crop area');
    }

    // Set canvas size to the final desired size (the width of the crop)
    const size = Math.min(pixelCrop.width, pixelCrop.height);
    canvas.width = size;
    canvas.height = size;

    // Clear the canvas with a transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create temporary canvas to handle the cropping first
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('No 2d context for temp canvas');
    }

    // Set temp canvas size to the crop area
    tempCanvas.width = pixelCrop.width;
    tempCanvas.height = pixelCrop.height;

    try {
      // First draw the cropped portion to the temp canvas
      tempCtx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );

      // Then draw from the temp canvas to the final one with proper circular mask
      // Draw the image in the center of the final canvas
      const offsetX = (canvas.width - pixelCrop.width) / 2;
      const offsetY = (canvas.height - pixelCrop.height) / 2;

      // Draw the temp canvas onto the final one
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
        offsetX,
        offsetY,
        pixelCrop.width,
        pixelCrop.height,
      );
    } catch (e) {
      console.error('Error drawing image on canvas:', e, {
        imageWidth: image.width,
        imageHeight: image.height,
        crop: pixelCrop,
      });
      throw new Error('Error drawing image');
    }

    // Create a circular clip path
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, size / 2, 0, 2 * Math.PI);
    ctx.fill();

    // As a blob
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.error('Canvas produced empty blob');
              reject(new Error('Canvas is empty'));
              return;
            }

            // Verify blob has content
            if (blob.size === 0) {
              console.error('Generated blob has zero size');
              reject(new Error('Generated image is empty'));
              return;
            }

            resolve(blob);
          },
          'image/jpeg',
          0.95, // High quality
        );
      } catch (e) {
        console.error('Error creating blob:', e);
        reject(e);
      }
    });
  } catch (e) {
    console.error('Error in getCroppedImg:', e);
    throw e;
  }
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

// Fallback helper function with a simpler approach
async function getFallbackCroppedImg(
  imageSrc: string,
  pixelCrop: any,
): Promise<Blob> {
  try {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Create a square canvas regardless of crop dimensions
    const size = Math.min(image.width, image.height, 500); // Limit max size
    canvas.width = size;
    canvas.height = size;

    // Fill with transparent background
    ctx.clearRect(0, 0, size, size);

    // Calculate scale to fit image within canvas while maintaining aspect ratio
    const scale = Math.min(size / image.width, size / image.height);

    // Center the image
    const x = (size - image.width * scale) / 2;
    const y = (size - image.height * scale) / 2;

    // Draw the full image scaled to fit in the canvas
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      x,
      y,
      image.width * scale,
      image.height * scale,
    );

    // Create a circular mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size === 0) {
            reject(new Error('Failed to create image'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.9,
      );
    });
  } catch (e) {
    console.error('Error in fallback crop method:', e);
    throw e;
  }
}
