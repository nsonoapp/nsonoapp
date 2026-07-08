export const ADMIN_COLLECTIONS = {
  companies: "companies",
  companySecrets: "company_secrets",
  companyAuthProbes: "company_auth_probes",
  entitySecrets: "entity_secrets",
  entityAuthProbes: "entity_auth_probes",
  entities: "entities",
  roles: "roles",
  users: "users"
};

/** Une seule société par instance Firebase — docId fixe */
export const SINGLE_COMPANY_ID = "main";

export function mapAdminDocs(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
