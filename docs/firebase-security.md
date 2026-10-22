# Firebase security audit — 2026-10-22

Scope: repository configuration, web/mobile clients, Firestore rules, and Cloud
Functions. Live Firebase Console settings, deployed rules, existing accounts,
IAM, API restrictions and access logs were **not** accessible in this audit.
Source changes do not deploy Firebase rules or functions automatically.

## Fixes

| Before                                                                                                              | Protection                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A user could change their own school, roster, `isAdmin` or teacher/admin role.                                      | Protected profile fields are server assigned. An existing administrator can promote/demote teachers only in their own school. Setup no longer offers self-promotion.                                                                     |
| Teacher codes were readable, creatable and redeemable by any authenticated account.                                 | Admin-only invitation access, authenticated server redemption, atomic single use and 20 membership attempts per account per 10 minutes, including failed codes.                                                                          |
| A browser could claim an unlinked student without presenting a code; parents had no safe linking path.              | Server verifies a private invitation, then links the roster and profile in one transaction. A separate parent account can link without taking the pupil's identity.                                                                      |
| Six-digit pupil codes were included in the shared roster.                                                           | 16-character cryptographically generated codes in teacher-only `studentInvites`. Migration rotates previously exposed codes. The same private code is the existing parent/student invitation capability: share it only with that family. |
| School collections were readable/writable across schools, and every pupil could read classmates' marks.             | School boundaries, teacher-only teaching data writes, immutable school IDs, and marks limited to teachers and the linked pupil/parent. Queries enforce the same bounds.                                                                  |
| A nonmember could append themselves to a private chat; all auto chats were globally readable.                       | Private membership is server validated, every invited member must belong to the school, and auto joining is limited to the matching school/class/teacher role. Message edits require current membership.                                 |
| Office holders could directly mint points or forge award/budget state.                                              | Server awards debit the actual budget and update recipients, reward history and award records atomically. Duplicate awards and client-supplied legacy holds cannot bypass the debit.                                                     |
| Any account could enqueue outgoing email, alter others' votes/club memberships, or rewrite a received notification. | Browser mail writes denied; only one's own vote/candidacy or club membership can change; a recipient can only mark a notification read.                                                                                                  |
| Firebase Storage had no versioned rule file.                                                                        | Storage is denied by default; the current clients do not use Firebase Storage.                                                                                                                                                           |

Firebase web configuration is intentionally public and is consistent between web
and mobile (`schooleballs`). It is not an Admin SDK credential. No service-account
private keys were found in the tracked source. Package patches address the audit
findings in Vite, source-map-js and the Firestore Node gRPC transport.

## Apply to the existing project

Use a trusted administrator with Application Default Credentials. Do not put a
service-account JSON file, token or `.env` in this repository. Take a Firestore
backup and review existing teacher/admin profiles first: the old rules allowed
self-promotion, so existing privileges cannot be assumed to be legitimate.

1. Run the migration in dry-run mode; it prints counts, never invitation codes or
   personal records:
   `node functions/scripts/migrate-security.mjs --project schooleballs`
2. Deploy the functions, then rules/indexes during a short maintenance window:
   `firebase deploy --only functions:chess --project schooleballs`
   `firebase deploy --only firestore,storage --project schooleballs`
3. Apply the migration:
   `node functions/scripts/migrate-security.mjs --project schooleballs --apply`
   It creates/rotates private student invitations, removes codes from rosters,
   rotates unused legacy teacher invitations, and removes invalid chat members.
   It is resumable; a second dry run should show no remaining migrations.
4. Publish the web build and updated mobile client together. Old clients cannot
   use the former direct role/link/chat/reward writes. Teachers must re-share the
   new codes with families and incoming teachers.
5. Verify a new teacher, pupil and parent account; grades, auto chats and a private
   chat; a reward debit; and negative cross-school access. Reconcile any reported
   legacy reward holds manually; unverified client-authored holds are never
   refunded automatically.

## Console settings still requiring verification

- Authentication: only intended providers and production authorized domains,
  email enumeration protection, server-enforced password policy, account abuse
  quotas, and administrator account protection.
- Google Cloud: API-key API restrictions, least-privilege IAM/service accounts,
  unused credentials, billing alerts and request monitoring.
- Firestore/Storage: compare the deployed rules with this version; check backups
  and existing privileged accounts. Review logs for past cross-school access.
- App Check: the web client supports `VITE_FIREBASE_APPCHECK_SITE_KEY` with
  reCAPTCHA Enterprise. Register the production domains, provision attestation
  for the mobile client, and monitor valid tokens first. Only then set the
  Functions parameter `ENFORCE_APP_CHECK=true` and enable Firestore enforcement
  in the Console. The default remains false to avoid locking out existing clients.
  Debug App Check tokens must never be shipped to production.

## Regression verification

`npm run test:firebase-security` requires an isolated Firestore emulator. It tests
direct SDK attacks and the real Admin SDK transaction adapter, including races
for one invitation/student identity, failed-code limits, cross-school chats and
duplicate reward payment. Existing Firestore, settings and chess rule suites
also remain required. CI uses a demo project and never production credentials.

References: [field allowlists](https://firebase.google.com/docs/firestore/security/rules-fields),
[authenticated rules](https://firebase.google.com/docs/rules/rules-and-auth),
[callable authentication](https://firebase.google.com/docs/functions/callable),
[public API keys](https://firebase.google.com/docs/projects/api-keys),
[App Check rollout](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
