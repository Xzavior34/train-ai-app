// Shared pure validation, used by the booking endpoint and local regression tests.
export function validateDemoInput(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid booking details.' };
  const limits = { fullName: 160, workEmail: 254, phoneNumber: 50, organizationName: 200, teamSize: 100, orgType: 160, agendaNotes: 3000, scheduledDate: 10, scheduledTime: 20 };
  const input = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = body[key] ?? (key === 'phoneNumber' ? body.phone : '') ?? '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return { error: 'One or more booking fields are invalid or too long.' };
    input[key] = value.trim();
  }
  input.workEmail = input.workEmail.toLowerCase();
  if (input.fullName.length < 2 || !input.organizationName || !input.teamSize || !input.orgType) return { error: 'Please complete all required booking details.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.workEmail)) return { error: 'Enter a valid email address.' };
  const digits = input.phoneNumber.replace(/\D/g, '');
  if (!/^[+\d\s().\-/]+$/.test(input.phoneNumber) || digits.length < 7 || digits.length > 15) return { error: 'Enter a valid contact phone number.' };
  const date = new Date(input.scheduledDate + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== input.scheduledDate) return { error: 'Select a valid appointment date.' };
  if (typeof body.website === 'string' && body.website.trim()) return { error: 'Unable to accept this booking.' };
  return { input, contactVerification: 'unverified' };
}
