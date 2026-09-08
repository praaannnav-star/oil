// Audit trail is tamper-evident and hash-chained.
// Entries are created automatically by the app — never seed raw rows here.
// The chain is verified by GET /api/audit/verify.
export const MOCK_AUDIT_LOG = [];

