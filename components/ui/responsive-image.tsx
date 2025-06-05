'use client';

import { useState } from 'react';
import Image from 'next/image';

type ResponsiveImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
};

export function ResponsiveImage({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  className,
  style,
}: ResponsiveImageProps) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onError={() => setImgSrc(fallbackSrc)}
    />
  );
}
