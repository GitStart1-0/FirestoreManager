# Firebase Firestore Security Specification

This document details the security model, invariants, and threat analysis for the **Firestore Manager** application, with a particular focus on the `/connections` collection if utilized for sharing database shortcuts.

## 1. Data Invariants

1. **Relation Constraint**: A connection shortcut document requires a unique, well-formed ID matching the alphanumeric syntax.
2. **Identity Integrity**: No user may read, edit, or delete another user's saved connection profile.
3. **Temporal constraint**: `createdAt` must match the server timestamp on document creation.
4. **Size Enforcements**: All String fields must have `.size()` limits to protect from Denial of Wallet (DoW) attacks.

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payloads designed to violate system safety that must be blocked:

1. **Malicious ID Injection**: Creating a connection with a 2MB identifier string to exhaust index resources.
2. **Identity Spoofing (Owner Swap)**: Creating a connection and setting `ownerId` to another user's UID.
3. **Ghost Fields Injection**: Setting undocumented keys such as `isSystemAdmin: true` on the payload.
4. **Type Confusion**: Passing `projectId` as an integer or boolean instead of a string.
5. **Privilege Escalation during Update**: Attempting to alter the immutable `ownerId` field during connection edit.
6. **Temporal Forgery (Past Timestamp)**: Supplying a client-customized `createdAt` date from weeks ago.
7. **Temporal Forgery (Future Timestamp)**: Client tries to set `updatedAt` to a future date instead of the server time.
8. **Blanket Read Exploit**: Trying to query the entire list of connections without specifying a filter on `ownerId`.
9. **Orphaned Writes Action**: Issuing a connection document write with missing required property keys.
10. **Admin Claim Impersonation**: Modifying our document profiles under a fake `request.auth.token.role` tag.
11. **Negative Size Limits**: Sending empty strings or arrays whose properties contain corrupt byte values.
12. **Malicious Delete Attempt**: Attempting to delete someone else's saved connection workspace.

## 3. Recommended Security Rules

We implement these constraints in the `firestore.rules` to reject unauthorized inputs.
