import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ContactLink } from "./ContactLink";
import { Guest } from "@/types/guest";

interface GuestTooltipProps {
  guest: Guest;
  children: React.ReactNode;
}

export const GuestTooltip = ({ guest, children }: GuestTooltipProps) => {
  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold">{guest.name}</h4>
            <p className="text-sm text-muted-foreground">{guest.topic}</p>
          </div>
          {(guest.phone || guest.email) && (
            <div className="space-y-2 pt-2 border-t">
              {guest.phone && <ContactLink type="phone" value={guest.phone} />}
              {guest.email && <ContactLink type="email" value={guest.email} />}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
