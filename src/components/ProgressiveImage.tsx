import React, { useState } from 'react';
import { Layout } from 'lucide-react';
import { cn } from '../lib/utils';

// Global cache to track loaded image URLs across component remounts
const loadedImageCache = new Set<string>();

interface ProgressiveImageProps {
  src: string;
  className?: string;
  imageClassName?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  alt?: string;
  showIcon?: boolean;
  priority?: boolean;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({ 
  src, 
  className, 
  imageClassName, 
  referrerPolicy, 
  alt = "",
  showIcon = true,
  priority = false
}) => {
  const cached = loadedImageCache.has(src);
  const [isLoaded, setIsLoaded] = useState(cached);
  const [error, setError] = useState(false);

  return (
    <div className={cn("relative overflow-hidden w-full h-full bg-stone-100", className)}>
      {/* Lightweight static placeholder without CPU-draining continuous animations */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 z-0">
          {showIcon && (
            <Layout className="text-stone-300/60" size={className?.includes('w-9') ? 16 : 24} strokeWidth={1} />
          )}
        </div>
      )}

      {(src && !error) && (
        <img
          src={src}
          alt={alt}
          referrerPolicy={referrerPolicy}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          onLoad={() => {
            setIsLoaded(true);
            loadedImageCache.add(src);
          }}
          onError={() => {
            setError(true);
          }}
          className={cn(
            "w-full h-full",
            !cached && "transition-opacity duration-150 ease-out",
            imageClassName,
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center bg-stone-100">
          <p className="text-[10px] text-stone-400 font-medium leading-tight">
            Image unavailable
          </p>
        </div>
      )}
    </div>
  );
};
