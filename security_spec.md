# Firestore Security Specification - Remix OS

## 1. Data Invariants
- **Membership Isolation**: A user can only access data belonging to a company they are a member of.
- **Role Hierarchy**:
    - `owner`: Can do everything. Only owners can delete the company or change other owners.
    - `admin`: Can manage team members (except owners), manage billing, and all operational data.
    - `staff`: Can manage products, customers, inventory, and orders. Cannot manage team, billing, or insights.
    - `viewer`: Read-only access to all data they are permitted to see.
- **Invitation Integrity**: Invitations must be pending to be accepted. Only admins/owners can invite.
- **Audit Logging**: All writes must be accompanied by an activity log (though enforced via client, rules should ensure validity).

## 2. The Dirty Dozen Payloads (Red Team Tests)
1. **Identity Theft**: User A tries to read User B's profile directly.
2. **Shadow Membership**: User A tries to create a membership for themselves in Company X without an invitation.
3. **Privilege Escalation**: User A (Staff) tries to update their own role to 'owner' in the membership collection.
4. **Data Scraping**: User A (Authenticated) tries to list all companies in the system.
5. **Orphaned Order**: User A tries to create an order for a company they don't belong to.
6. **Stock Poisoning**: User A tries to update a product price to $0.01.
7. **Invitation Hijack**: User A tries to accept an invitation meant for User B.
8. **Owner Termination**: An Admin tries to delete the last Owner of a company.
9. **PII Leak**: A Viewer tries to read the detailed private email/phone of a customer (if restricted).
10. **Ghost Fields**: User A tries to update a Product but adds a `verified: true` field not in schema.
11. **Time Travel**: User A tries to set a `createdAt` date in the past.
12. **Cross-Tenant Injection**: User A tries to move a Product from Company X to Company Y by changing `companyId`.

## 3. Test Runner (Mock Logic)
A `firestore.rules.test.ts` would verify these. (Implementation omitted for brevity as per instructions, but logic is integrated into Phase 5).
