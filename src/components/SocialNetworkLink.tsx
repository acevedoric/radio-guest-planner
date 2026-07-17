import { ExternalLink, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SocialNetworkLinkProps {
  platform: string;
  username: string;
  className?: string;
  /** Icon-only compact link (used in dense views like Week/Month). */
  compact?: boolean;
  iconSize?: number;
}

// Official X (Twitter) logo — lucide's Twitter icon is the old bird, so use inline SVG.
const XLogo = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.828l-5.35-6.99L4.7 22H1.44l8.03-9.17L1 2h6.914l4.84 6.4L18.244 2Zm-2.397 18h1.86L7.24 4H5.27l10.577 16Z" />
  </svg>
);

const PinterestLogo = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12.017 2C6.484 2 2 6.484 2 12.017c0 4.253 2.652 7.884 6.397 9.339-.088-.794-.167-2.012.035-2.879.183-.784 1.18-4.994 1.18-4.994s-.301-.603-.301-1.494c0-1.4.812-2.446 1.822-2.446.859 0 1.274.645 1.274 1.418 0 .864-.55 2.156-.833 3.353-.237 1.002.502 1.819 1.492 1.819 1.79 0 3.165-1.888 3.165-4.615 0-2.412-1.734-4.099-4.211-4.099-2.869 0-4.554 2.152-4.554 4.376 0 .867.334 1.797.751 2.302a.302.302 0 0 1 .07.29c-.077.318-.246.998-.28 1.138-.044.183-.145.222-.334.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.472 6.165 5.777 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.965-.526-2.291-1.148l-.623 2.378c-.226.869-.835 1.958-1.243 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.54 2 12.017 2Z" />
  </svg>
);

type PlatformConfig = {
  urlPrefix: string;
  label: string;
  Icon: (props: { size?: number; className?: string }) => ReactNode;
  colorClass?: string;
};

const platformConfig: Record<string, PlatformConfig> = {
  twitter: { urlPrefix: "https://twitter.com/", label: "X", Icon: XLogo, colorClass: "text-foreground" },
  x: { urlPrefix: "https://twitter.com/", label: "X", Icon: XLogo, colorClass: "text-foreground" },
  instagram: {
    urlPrefix: "https://instagram.com/",
    label: "Instagram",
    Icon: ({ size, className }) => <Instagram size={size} className={className} />,
    colorClass: "text-pink-500",
  },
  facebook: {
    urlPrefix: "https://facebook.com/",
    label: "Facebook",
    Icon: ({ size, className }) => <Facebook size={size} className={className} />,
    colorClass: "text-blue-600",
  },
  youtube: {
    urlPrefix: "https://youtube.com/@",
    label: "YouTube",
    Icon: ({ size, className }) => <Youtube size={size} className={className} />,
    colorClass: "text-red-600",
  },
  linkedin: {
    urlPrefix: "https://linkedin.com/in/",
    label: "LinkedIn",
    Icon: ({ size, className }) => <Linkedin size={size} className={className} />,
    colorClass: "text-blue-700",
  },
  pinterest: {
    urlPrefix: "https://pinterest.com/",
    label: "Pinterest",
    Icon: PinterestLogo,
    colorClass: "text-red-500",
  },
};

export const SocialNetworkLink = ({ platform, username, className = "", compact = false, iconSize }: SocialNetworkLinkProps) => {
  const cleanUsername = username.startsWith("@") ? username.slice(1) : username;
  const config = platformConfig[platform.toLowerCase()];

  if (!config) {
    if (compact) return null;
    return (
      <div className={cn("text-sm text-foreground", className)}>
        {platform}: {username}
      </div>
    );
  }

  const fullUrl = `${config.urlPrefix}${cleanUsername}`;
  const { Icon } = config;

  if (compact) {
    return (
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`${config.label}: @${cleanUsername}`}
        className={cn("inline-flex items-center hover:opacity-80 transition-opacity", config.colorClass, className)}
      >
        <Icon size={iconSize ?? 14} />
      </a>
    );
  }

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-glow hover:underline transition-colors",
        className
      )}
    >
      <Icon size={iconSize ?? 16} className={config.colorClass} />
      <span>{config.label}: @{cleanUsername}</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  );
};

export const getSocialPlatformOptions = () => [
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "pinterest", label: "Pinterest" },
];
