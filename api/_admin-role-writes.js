const APPROVABLE_ROLES = ["gratis", "basic", "premium"];
const ASSIGNABLE_CURRENT_ROLES = [...APPROVABLE_ROLES, "teacher"];

export function isSelfDemotion(adminId, targetId, nextRole) {
  return Boolean(adminId) && String(adminId).toLowerCase() === String(targetId).toLowerCase() && nextRole !== "admin";
}

export async function setEligibleRole(supabase, targetId, nextRole) {
  // Never demote any existing administrator through this bearer-only route.
  // Role revocation needs a separate reviewed, strongly authenticated flow.
  const currentRoles = nextRole === "admin"
    ? [...ASSIGNABLE_CURRENT_ROLES, "admin"] : ASSIGNABLE_CURRENT_ROLES;
  const { data, error } = await supabase.from("profiles")
    .update({ role: nextRole })
    .eq("id", targetId)
    .in("role", currentRoles)
    .select("id");
  if (error) return "error";
  return Array.isArray(data) && data.length === 1 ? "changed" : "ineligible";
}

export async function approveEligibleProfile(supabase, targetId) {
  const { data, error } = await supabase.from("profiles")
    .update({ approved: true, role: "premium" })
    .eq("id", targetId)
    .in("role", APPROVABLE_ROLES)
    .select("id");
  if (error) return "error";
  return Array.isArray(data) && data.length === 1 ? "approved" : "ineligible";
}
