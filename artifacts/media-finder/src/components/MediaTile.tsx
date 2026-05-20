import React, { useState } from "react";
import { SearchResultItem } from "@workspace/api-client-react";
import { Download, ExternalLink, ImageOff } from "lucide-react";

interface MediaTileProps {
  item: SearchResultItem;
}

export default function MediaTile({ item }: MediaTileProps) {
  const [hasError, setHasError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (hasError) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(item.imageUrl, { mode: 'cors' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media-${item.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      // Fallback if cross-origin blocked
      window.open(item.imageUrl, '_blank');
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'google': return 'bg-blue-500/80 text-white';
      case 'pinterest': return 'bg-red-500/80 text-white';
      case 'youtube': return 'bg-red-600/80 text-white';
      default: return 'bg-gray-500/80 text-white';
    }
  };

  return (
    <div 
      className="group relative rounded-xl overflow-hidden bg-muted/20 border border-white/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={item.thumbnailUrl}
        alt={item.title}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-auto object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        style={{
          aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto'
        }}
      />
      
      {/* Source Badge */}
      <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${getSourceColor(item.source)}`}>
        {item.source}
      </div>

      {/* Hover Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 flex flex-col justify-end p-4 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-white font-medium text-sm line-clamp-2 mb-3 drop-shadow-md">
          {item.title}
        </p>
        
        <div className="flex items-center gap-2">
          <a 
            href={item.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg backdrop-blur-md text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Source
          </a>
          <button 
            onClick={handleDownload}
            className="flex items-center justify-center w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg backdrop-blur-md transition-colors"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
