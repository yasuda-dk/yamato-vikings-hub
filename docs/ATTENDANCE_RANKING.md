# Attendance Top 10

- Home > Attendance Top 10 is visible to the protected Takashi profile only.
- Rankings are fetched on demand, not during Home startup.
- The default period is the current Copenhagen calendar year; previous event years and All time are selectable.
- Count distinct events with RSVP `Going`, across all event types. The current workflow does not use actual attendance; the UI explicitly labels the ranking as Going RSVPs. Maybe and Not going do not count. This is not a confirmed physical attendance measure.
- Exclude Draft, Cancelled and future-dated events. Include today's Going RSVPs.
- Include Active and Inactive historical members. Event-specific Guests are not merged into member rankings.
- Return at most 10 members, ordered by count descending then name and ID. Equal counts share a rank; at the tenth-member boundary use the name/ID order.
- The database validates the approved device and pinned, Active Takashi identity on every request, including direct RPC calls. Other Admins are denied.
- No new application tables or changes to existing event, attendance or voting data.
