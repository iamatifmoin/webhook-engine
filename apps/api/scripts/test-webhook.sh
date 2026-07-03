#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

send_request() {
  local label="$1"
  local url="$2"
  local body="$3"
  shift 3

  local response_file
  response_file="$(mktemp)"

  local status
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$url" \
    -H "Content-Type: application/json" \
    "$@" \
    --data "$body")"

  echo "== $label =="
  cat "$response_file"
  echo
  echo "HTTP $status"
  echo

  rm -f "$response_file"
}

acme_body='{"order":{"id":"1001","total_price":750,"customer_email":"buyer@test.com"}}'
acme_signature="$(
  printf '%s' "$acme_body" \
    | openssl dgst -sha256 -hmac 'shopify_acme_secret' -binary \
    | base64 \
    | tr -d '\r\n'
)"

send_request "Acme high-value order" "$API_URL/webhooks/shopify-acme" "$acme_body" \
  -H "X-Tenant-Api-Key: key_acme_abc123" \
  -H "X-Idempotency-Key: test-evt-001" \
  -H "X-Event-Type: order.created" \
  -H "X-Shopify-Hmac-Sha256: $acme_signature"

sleep 2

send_request "Acme duplicate delivery" "$API_URL/webhooks/shopify-acme" "$acme_body" \
  -H "X-Tenant-Api-Key: key_acme_abc123" \
  -H "X-Idempotency-Key: test-evt-001" \
  -H "X-Event-Type: order.created" \
  -H "X-Shopify-Hmac-Sha256: $acme_signature"

beta_body='{"amount":1500,"payment_id":"pay_002","customer_email":"buyer@test.com"}'
beta_signature="$(
  printf '%s%s' "$beta_body" 'stripe_beta_secret' \
    | openssl dgst -sha256 -hex \
    | awk '{print $2}'
)"

send_request "Beta guaranteed-failure path" "$API_URL/webhooks/stripe-beta" "$beta_body" \
  -H "X-Tenant-Api-Key: key_beta_def456" \
  -H "X-Idempotency-Key: test-evt-002" \
  -H "X-Event-Type: payment.failed" \
  -H "X-Webhook-Signature: $beta_signature"
