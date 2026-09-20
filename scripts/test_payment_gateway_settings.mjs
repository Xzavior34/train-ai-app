import {
  DEFAULT_PAYMENT_GATEWAY_SETTINGS,
  testOrgPaymentGatewayConnection,
  fetchOrgPaymentGatewaySettings,
  updateOrgPaymentGatewaySettings,
  resolveOrgPaymentGateway,
} from "../src/lib/api/organizations.js";

async function runTests() {
  console.log("==========================================");
  console.log("Testing Organization Payment Gateway Settings");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Check Default Settings structure
  assert(
    DEFAULT_PAYMENT_GATEWAY_SETTINGS.preferred_gateway === "default",
    "Default preferred_gateway is 'default'"
  );
  assert(
    DEFAULT_PAYMENT_GATEWAY_SETTINGS.environment === "test",
    "Default environment is 'test'"
  );
  assert(
    "paystack_public_key" in DEFAULT_PAYMENT_GATEWAY_SETTINGS,
    "DEFAULT_PAYMENT_GATEWAY_SETTINGS contains paystack_public_key"
  );
  assert(
    "stripe_publishable_key" in DEFAULT_PAYMENT_GATEWAY_SETTINGS,
    "DEFAULT_PAYMENT_GATEWAY_SETTINGS contains stripe_publishable_key"
  );

  // Test 2: Valid Paystack Test Keys
  const paystackTestRes = testOrgPaymentGatewayConnection({
    provider: "paystack",
    publicKey: "pk_test_1234567890abcdef",
    secretKey: "sk_test_0987654321fedcba",
    subaccountCode: "ACCT_test123",
    environment: "test",
  });
  assert(paystackTestRes.success === true, "Paystack test keys validation succeeded");
  assert(
    paystackTestRes.message.includes("Valid Paystack TEST"),
    "Paystack success message format is correct"
  );

  // Test 3: Paystack key mismatch detection (live key in test mode)
  const paystackMismatchRes = testOrgPaymentGatewayConnection({
    provider: "paystack",
    publicKey: "pk_live_1234567890abcdef",
    secretKey: "sk_test_0987654321fedcba",
    environment: "test",
  });
  assert(
    paystackMismatchRes.success === false,
    "Paystack key mismatch correctly flagged"
  );
  assert(
    paystackMismatchRes.message.includes("Expected prefix 'pk_test_'"),
    "Paystack key mismatch error message specifies expected prefix"
  );

  // Test 4: Valid Stripe Test Keys
  const stripeTestRes = testOrgPaymentGatewayConnection({
    provider: "stripe",
    publicKey: "pk_test_stripeSampleKey123",
    secretKey: "sk_test_stripeSampleSecKey456",
    accountId: "acct_123456789",
    environment: "test",
  });
  assert(stripeTestRes.success === true, "Stripe test keys validation succeeded");
  assert(
    stripeTestRes.message.includes("Valid Stripe TEST"),
    "Stripe success message format is correct"
  );

  // Test 5: Stripe key mismatch detection
  const stripeMismatchRes = testOrgPaymentGatewayConnection({
    provider: "stripe",
    publicKey: "pk_live_stripeSampleKey123",
    secretKey: "sk_test_stripeSampleSecKey456",
    environment: "test",
  });
  assert(
    stripeMismatchRes.success === false,
    "Stripe key mismatch correctly flagged"
  );

  // Test 6: fetchOrgPaymentGatewaySettings fallback
  const fallbackSettings = await fetchOrgPaymentGatewaySettings(null);
  assert(
    fallbackSettings.preferred_gateway === "default",
    "fetchOrgPaymentGatewaySettings handles missing org ID with defaults"
  );

  // Test 7: resolveOrgPaymentGateway resolver
  const resolved = await resolveOrgPaymentGateway(null);
  assert(resolved.provider === "default", "resolveOrgPaymentGateway returns provider");
  assert(resolved.environment === "test", "resolveOrgPaymentGateway returns environment");

  console.log("==========================================");
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
