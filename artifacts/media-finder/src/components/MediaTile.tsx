import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchResultItem } from "@workspace/api-client-react";
import { Download, ExternalLink, Sparkles, Maximize2, X } from "lucide-react";

interface MediaTileProps {
  item: SearchResultItem;
  onFindSimilar?: (item: SearchResultItem) => void;
}

export default function MediaTile({ item, onFindSimilar }: MediaTileProps) {
  const [hasError, setHasError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isAnyDragging, setIsAnyDragging] = useState(false);
  const clickTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
    };
  }, []);

  // Track a global "is something being dragged" flag so that the cursor
  // passing over other tiles during a drag does NOT trigger their hover
  // overlay / scale effect.
  useEffect(() => {
    const onStart = () => setIsAnyDragging(true);
    const onEnd = () => setIsAnyDragging(false);
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragend", onEnd);
    document.addEventListener("drop", onEnd);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragend", onEnd);
      document.removeEventListener("drop", onEnd);
    };
  }, []);

  const showHoverUI = isHovered && !menuOpen && !isAnyDragging;

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

  // Same-origin proxy URLs:
  //  - `proxiedThumbUrl` for fast display (small, keeps the drag ghost tiny)
  //  - `proxiedFullUrl`  for PureRef downloads (original full-size, bypassing
  //    upstream hotlink protection via server-side Referer)
  const safeName = (item.title || "media")
    .replace(/[^\w\u4e00-\u9fa5\-]+/g, "_")
    .slice(0, 60) || "media";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const proxiedThumbUrl = `${origin}/api/image?url=${encodeURIComponent(item.thumbnailUrl)}&name=${encodeURIComponent(safeName)}`;
  const proxiedFullUrl = `${origin}/api/image?url=${encodeURIComponent(item.imageUrl)}&name=${encodeURIComponent(safeName)}`;

  // Drag-out to PureRef etc.: hand over the proxied full-size URL so the
  // drop target can actually download the original file.
  const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    const filename = `${safeName}.jpg`;
    const dragUrl = proxiedFullUrl;
    try {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/uri-list", dragUrl);
      e.dataTransfer.setData("text/plain", dragUrl);
      e.dataTransfer.setData("text/x-moz-url", `${dragUrl}\n${item.title || ""}`);
      // Chrome-specific: streams the file directly to the OS drop target.
      e.dataTransfer.setData("DownloadURL", `image/jpeg:${filename}:${dragUrl}`);

      // Force the drag ghost to use the *rendered* size of the <img>
      // element, not the image's natural pixel dimensions. Without this,
      // a 2000x3000 source image produces a giant translucent ghost that
      // visually drags across (and seems to "disturb") neighbouring tiles.
      const target = e.currentTarget as HTMLImageElement;
      const rect = target.getBoundingClientRect();
      try {
        e.dataTransfer.setDragImage(
          target,
          Math.round(rect.width / 2),
          Math.round(rect.height / 2),
        );
      } catch {
        // setDragImage unsupported — accept the default ghost.
      }
    } catch {
      // ignore — text/uri-list above is the fallback that PureRef relies on
    }
  };

  // Single click = find similar (debounced so a double-click doesn't also fire it)
  const handleSingleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) return;
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = window.setTimeout(() => {
      onFindSimilar?.(item);
      clickTimer.current = null;
    }, 240);
  };

  // Double click = open the action menu (view full size / go to source)
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setMenuOpen(true);
  };

  const closeMenu = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuOpen(false);
  };

  const openLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setLightboxOpen(true);
  };

  const goSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    window.open(item.sourceUrl, "_blank", "noopener,noreferrer");
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
    <>
      <div
        className={`group relative rounded-xl overflow-hidden bg-muted/20 border border-white/5 cursor-grab active:cursor-grabbing transition-all duration-200 ease-out ${
          showHoverUI ? 'scale-[1.06] z-20 shadow-2xl shadow-black/60 ring-2 ring-primary/40' : 'scale-100 z-0'
        }`}
        onMouseEnter={() => { if (!isAnyDragging) setIsHovered(true); }}
        onMouseLeave={() => { setIsHovered(false); }}
        onClick={handleSingleClick}
        onDoubleClick={handleDoubleClick}
        title="Click: find similar  •  Double-click: more actions"
      >
        <img
          src={proxiedFullUrl}
          alt={item.title}
          loading="lazy"
          draggable
          onDragStart={handleDragStart}
          onError={() => setHasError(true)}
          className="w-full h-auto object-cover"
          style={{
            aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto'
          }}
        />

        {/* Source Badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${getSourceColor(item.source)}`}>
          {item.source}
        </div>

        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 flex flex-col justify-end p-4 ${showHoverUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

        {/* Double-click action menu */}
        {menuOpen && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={closeMenu}
          >
            <div
              className="flex flex-col gap-2 p-3 rounded-xl bg-background/90 border border-white/10 shadow-2xl min-w-[180px]"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={openLightbox}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-primary/20 hover:text-primary transition-colors text-left"
              >
                <Maximize2 className="w-4 h-4" />
                View full size
              </button>
              <button
                onClick={goSource}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-primary/20 hover:text-primary transition-colors text-left"
              >
                <ExternalLink className="w-4 h-4" />
                Go to source
              </button>
              <button
                onClick={closeMenu}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-white/5 transition-colors text-left"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full-size lightbox — portaled to document.body so it actually covers the viewport */}
      {lightboxOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-4 right-16 text-white/80 text-sm truncate">
            {item.title}
          </div>
          <img
            src={item.imageUrl}
            alt={item.title}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              // fall back to thumbnail if the full-size url is blocked / 404
              const target = e.currentTarget as HTMLImageElement;
              if (target.src !== item.thumbnailUrl) target.src = item.thumbnailUrl;
            }}
            className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Go to source
            </a>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-medium backdrop-blur-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
