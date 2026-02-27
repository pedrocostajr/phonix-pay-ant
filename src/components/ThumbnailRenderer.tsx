import React from "react";

interface ThumbnailRendererProps {
    content: string | null | undefined;
    alt?: string;
    className?: string;
    isCover?: boolean; // If true, applies specific styles for module/course covers
}

export const ThumbnailRenderer: React.FC<ThumbnailRendererProps> = ({
    content,
    alt = "Thumbnail",
    className = "",
    isCover = false
}) => {
    if (!content) return null;

    // Basic check to see if content is HTML (like Canva embed)
    const isHtml = content.trim().startsWith("<") && content.includes(">") && (content.includes("iframe") || content.includes("div"));

    if (isHtml) {
        return (
            <div
                className={`relative overflow-hidden ${className} ${isCover ? 'aspect-video' : ''}`}
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Fallback to standard image URL
    return (
        <img
            src={content}
            alt={alt}
            className={`w-full h-full object-cover ${className}`}
            onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
        />
    );
};
