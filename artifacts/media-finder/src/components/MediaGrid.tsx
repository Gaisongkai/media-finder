import React from "react";
import MediaTile from "./MediaTile";
import { SearchResultItem } from "@workspace/api-client-react";

interface MediaGridProps {
  loading: boolean;
  items: SearchResultItem[];
}

export default function MediaGrid({ loading, items }: MediaGridProps) {
  if (loading) {
    return (
      <div className="masonry-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={i} 
            className="masonry-item rounded-xl bg-muted/30 animate-pulse"
            style={{ height: `${Math.floor(Math.random() * 200) + 150}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="masonry-grid">
      {items.map((item, i) => (
        <div key={item.id} className="masonry-item animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
          <MediaTile item={item} />
        </div>
      ))}
    </div>
  );
}
