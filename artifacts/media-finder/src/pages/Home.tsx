import React, { useState, useEffect } from "react";
import { useSearchMedia, getSearchMediaQueryKey, SearchResultItem } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Image as ImageIcon, Sparkles, AlertCircle } from "lucide-react";
import MediaGrid from "@/components/MediaGrid";
import SourceFilters from "@/components/SourceFilters";

export default function Home() {
  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeSource, setActiveSource] = useState<"all" | "google" | "pinterest" | "youtube" | "artstation">("all");

  const { data, isLoading, isError, refetch } = useSearchMedia(
    { q: submittedQuery },
    {
      query: {
        enabled: !!submittedQuery,
        queryKey: getSearchMediaQueryKey({ q: submittedQuery }),
      },
    }
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchInput.trim()) {
      setSubmittedQuery(searchInput.trim());
      setActiveSource("all");
    }
  };

  const handleSuggestionClick = (query: string) => {
    setSearchInput(query);
    setSubmittedQuery(query);
    setActiveSource("all");
  };

  const handleFindSimilar = (item: SearchResultItem) => {
    // Step 1: strip site-specific noise from the title.
    let cleaned = (item.title || "").trim();
    cleaned = cleaned
      .replace(/\s*[-–|]\s*YouTube\s*$/i, "")
      .replace(/^Pin\s+on\s+/i, "")
      .replace(/^ArtStation\s*[-–|:]\s*/i, "")
      .replace(/\s*[-–|]\s*ArtStation\s*$/i, "")
      .replace(/\s*\|\s*Pinterest\s*$/i, "")
      .replace(/\s*-\s*Pinterest\s*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Step 2: detect junk / generic Pinterest board titles that have nothing
    // to do with the image content (these are the #1 cause of "find similar"
    // returning unrelated results). When detected, fall back to the user's
    // original query so we stay on-topic.
    const junkPattern = /^(quick\s*saves?|saves?|pins?|board|collection|untitled|image|images|photo|photos|video|videos|jpg|png|home|new|art|design|inspiration|reference|cool|nice|favourites?|favorites?|misc|wallpapers?|aesthetic|mood\s*board)$/i;
    const isJunk =
      cleaned.length < 4 ||
      junkPattern.test(cleaned) ||
      cleaned.split(/\s+/).every((w) => junkPattern.test(w));

    // Step 3: build the new query. Anchor on the user's CURRENT search so the
    // topic (e.g. "Porsche 911") is preserved, and only add the cleaned title
    // when it's not junk and adds new information.
    let query: string;
    if (isJunk || !cleaned) {
      query = submittedQuery;
    } else if (!submittedQuery) {
      query = cleaned;
    } else {
      const lower = cleaned.toLowerCase();
      const baseLower = submittedQuery.toLowerCase();
      if (lower.includes(baseLower) || baseLower.includes(lower)) {
        // Title already restates the query — just use the more descriptive one.
        query = cleaned.length > submittedQuery.length ? cleaned : submittedQuery;
      } else {
        // Combine, cap length to avoid over-specific queries.
        const combined = `${submittedQuery} ${cleaned}`.slice(0, 100).trim();
        query = combined;
      }
    }
    if (!query) return;
    setSearchInput(query);
    setSubmittedQuery(query);
    setActiveSource("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const results = data?.results || [];
  const filteredResults = activeSource === "all" 
    ? results 
    : results.filter(r => r.source === activeSource);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4 lg:gap-8">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="font-display font-semibold text-lg hidden sm:inline-block">Media Finder</span>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search references (e.g. porsche 911 interior, 保时捷911 内饰)..."
              className="w-full pl-9 pr-12 bg-muted/50 border-white/10 focus-visible:ring-primary focus-visible:bg-muted/80 transition-colors"
            />
            {searchInput && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 hover:bg-transparent text-primary hover:text-primary/80"
              >
                Enter
              </Button>
            )}
          </form>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {!submittedQuery ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto pt-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">Curate your vision</h1>
            <p className="text-xl text-muted-foreground mb-8 text-balance">
              A focused image-hunting tool for designers and creators. Search across Google, Pinterest, YouTube, and ArtStation simultaneously.
              <br/><br/>
              为设计师和创作者打造的视觉灵感收集工具。
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">Try:</span>
              {[
                "Porsche 911 interior",
                "保时捷911 内饰 细节",
                "Bauhaus chair",
                "京都 庭院"
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1.5 rounded-full bg-secondary/50 text-secondary-foreground text-sm hover:bg-secondary transition-colors border border-white/5 hover:border-white/10"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Results Area */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-display font-semibold">
                Results for "{submittedQuery}"
              </h2>
              {data && (
                <SourceFilters 
                  counts={data.counts} 
                  activeSource={activeSource} 
                  onChange={setActiveSource} 
                />
              )}
            </div>

            {isLoading ? (
              <MediaGrid loading={true} items={[]} />
            ) : isError ? (
              <div className="p-8 rounded-xl bg-destructive/10 border border-destructive/20 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-destructive mb-4" />
                <p className="text-lg font-medium text-destructive mb-4">Failed to fetch results</p>
                <Button variant="outline" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-xl text-muted-foreground mb-2">No results found for "{submittedQuery}"</p>
                <p className="text-sm text-muted-foreground/60">Try a broader keyword or different language.</p>
              </div>
            ) : (
              <MediaGrid loading={false} items={filteredResults} onFindSimilar={handleFindSimilar} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
