export function normalizeCreditBalance(data) {
  if (!data || data.error) throw new Error("AI balance is unavailable");
  const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  return {
    organizationBalance: data.org_suspended ? 0 : amount(data.organization_balance ?? data.org_balance),
    personalBalance: amount(data.personal_balance),
  };
}
