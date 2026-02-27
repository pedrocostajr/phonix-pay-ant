import React from "react";

interface ThumbnailRendererProps {
    content: string | null | undefined;
    alt?: string;
    className?: string;
    aspectRatio?: 'horizontal' | 'vertical' | 'banner' | 'none';
}

export const ThumbnailRenderer: React.FC<ThumbnailRendererProps> = ({
    content,
    alt = "Thumbnail",
    className = "",
    aspectRatio = 'horizontal'
}) => {
    if (!content) return null;

    const aspectClass = aspectRatio === 'horizontal' ? 'aspect-video' : aspectRatio === 'vertical' ? 'aspect-[2/3]' : aspectRatio === 'banner' ? 'aspect-[4/1]' : '';

    // Basic check to see if content is HTML (like Canva embed)
    const isHtml = content.trim().startsWith("<") && content.includes(">") && (content.includes("iframe") || content.includes("div"));

    if (isHtml) {
        return (
            <div
                className={`relative overflow-hidden w-full h-full ${aspectClass} ${className}`}
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Fallback to standard image URL
    return (
        <img
            src={content}
            alt={alt}
            className={`w-full h-full object-cover ${aspectClass} ${className}`}
            onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
        />
    );
};
