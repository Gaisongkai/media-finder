import React, { useState } from "react";
import { SearchResultItem } from "@workspace/api-client-react";
import { Download, ExternalLink, Sparkles } from "lucide-react";

interface MediaTileProps {
  item: SearchResultItem;
  onFindSimilar?: (item: SearchResultItem) => void;
}

export default function MediaTile({ item, onFindSimilar }: MediaTileProps) {
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
      window.open(item.imageUrl, '_blank');
    }
  };

  const handleFindSimilar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFindSimilar?.(item);
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'google': return 'bg-blue-500/80 text-white';
      case 'pinterest': return 'bg-red-500/80 text-white';
      case 'youtube': return 'bg-red-600/80 text-white';
      case 'artstation': return 'bg-emerald-500/80 text-white';
      default: return 'bg-gray-500/80 text-white';
    }
  };

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-muted/20 border border-white/5 cursor-zoom-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleFindSimilar}
      title="Click to find similar"
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
          <button
            onClick={handleFindSimilar}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground py-2 rounded-lg backdrop-blur-md text-xs font-medium transition-colors"
            title="Find similar"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Find similar
          </button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md transition-colors"
            title="Open source"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md transition-colors"
            title="Download image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
