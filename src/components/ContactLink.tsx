import { Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactLinkProps {
  type: "phone" | "email";
  value: string;
  className?: string;
}

export const ContactLink = ({ type, value, className }: ContactLinkProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (type === "phone") {
      const cleanPhone = value.replace(/\s|-|\(|\)/g, "");
      const whatsappUrl = `https://wa.me/${cleanPhone}`;
      window.open(whatsappUrl, "_blank");
    } else if (type === "email") {
      window.location.href = `mailto:${value}`;
    }
  };

  const Icon = type === "phone" ? Phone : Mail;
  const label = type === "phone" ? "Teléfono" : "Email";

  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-primary mt-1" />
      <div>
        <span className="text-xs text-muted-foreground block">{label}</span>
        <a
          href="#"
          onClick={handleClick}
          className={cn(
            "text-sm text-primary hover:underline cursor-pointer transition-colors",
            type === "email" && "break-all",
            className
          )}
        >
          {value}
        </a>
      </div>
    </div>
  );
};
