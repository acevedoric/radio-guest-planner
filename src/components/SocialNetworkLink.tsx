import { ExternalLink } from "lucide-react";

interface SocialNetworkLinkProps {
  platform: string;
  username: string;
  className?: string;
}

const platformConfig: Record<string, { url: string; label: string; icon: string }> = {
  twitter: { url: "https://twitter.com/", label: "Twitter/X", icon: "𝕏" },
  instagram: { url: "https://instagram.com/", label: "Instagram", icon: "📷" },
  facebook: { url: "https://facebook.com/", label: "Facebook", icon: "📘" },
  youtube: { url: "https://youtube.com/@", label: "YouTube", icon: "▶️" },
  linkedin: { url: "https://linkedin.com/in/", label: "LinkedIn", icon: "💼" },
  pinterest: { url: "https://pinterest.com/", label: "Pinterest", icon: "📌" },
};

export const SocialNetworkLink = ({ platform, username, className = "" }: SocialNetworkLinkProps) => {
  // Clean username (remove @ if present)
  const cleanUsername = username.startsWith("@") ? username.slice(1) : username;
  
  const config = platformConfig[platform.toLowerCase()];
  
  if (!config) {
    // Unknown platform - just show as text
    return (
      <div className={`text-sm text-foreground ${className}`}>
        {platform}: {username}
      </div>
    );
  }
  
  const fullUrl = `${config.url}${cleanUsername}`;
  
  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-sm text-primary hover:text-primary-glow hover:underline transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span>{config.icon}</span>
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
