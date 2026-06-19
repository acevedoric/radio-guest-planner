-- Restrict Realtime channel subscriptions to producers/admins
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers and admins can receive realtime" ON realtime.messages;

CREATE POLICY "Producers and admins can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'producer'::public.app_role)
);