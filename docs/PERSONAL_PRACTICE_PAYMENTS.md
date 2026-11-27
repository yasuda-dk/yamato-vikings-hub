# Personal Unpaid Practices

- Home retains the current Practice payment summary. Regular members additionally see Your unpaid Practices, loaded separately when the section comes into view.
- Include all historical Football events whose title begins with Practice, with no season or year limit, through today's Copenhagen date.
- Only the selected member's Going RSVPs count. Exclude Draft, Cancelled, future events and events with an existing payment record.
- Use the existing member payment rules, including current Custom amounts, student/age rates and exemptions. These amounts are not new historical price snapshots.
- Each row shows the date, location and amount. Mark as paid records that event for the selected member, removes it from their unpaid list and updates the existing current summary.
- This records a member's payment report; it does not transfer money or independently verify a MobilePay transaction.
- Repeated submissions do not duplicate payments or overwrite the original paid timestamp.
- The database derives the member from the authenticated approved device/profile. Clients cannot supply another member ID. Team history and Admin/Genki tracking permissions are unchanged.
- Apply the personal_unpaid_practice_payments migration and deploy practice-payment-state before publishing the frontend. The existing mark-practice-payment-paid Edge Function calls the updated RPC without a deployment change.
- Database integration: run annual-awards.sql fixtures, then personal-unpaid-practices.sql inside BEGIN/ROLLBACK. These tests never modify live payment records.
