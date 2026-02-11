#!/usr/bin/env bash

set -euo pipefail

MODE="${1:---all}"

SECRET_REGEX='(sk-(proj-)?[A-Za-z0-9_-]{20,}|vercel_blob_rw_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|CIRCLE_API_TOKEN[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9]{24,}["'"'"']?|CIRCLE_HEADLESS_AUTH_TOKEN[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9]{24,}["'"'"']?|UPSTASH_USER_RAG_REST_TOKEN[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9+/=]{30,}["'"'"']?|AUTH_SECRET[[:space:]]*=[[:space:]]*["'"'"']?[A-Fa-f0-9]{32,}["'"'"']?|BLOB_READ_WRITE_TOKEN[[:space:]]*=[[:space:]]*["'"'"']?vercel_blob_rw_[A-Za-z0-9_-]{20,}["'"'"']?|VERCEL_OIDC_TOKEN[[:space:]]*=[[:space:]]*["'"'"']?eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}["'"'"']?|((DATABASE_URL|POSTGRES_URL)[[:space:]]*=[[:space:]]*["'"'"']?(postgres|postgresql)://[^"'"'"'[:space:]@:]+:[^"'"'"'[:space:]@]{12,}@[^"'"'"'[:space:]]+["'"'"']?)|(REDIS_URL[[:space:]]*=[[:space:]]*["'"'"']?redis://[^"'"'"'[:space:]@:]+:[^"'"'"'[:space:]@]{12,}@[^"'"'"'[:space:]]+["'"'"']?))'

report_file="$(mktemp)"
filtered_report_file="$(mktemp)"
cleanup() {
  rm -f "$report_file"
  rm -f "$filtered_report_file"
}
trap cleanup EXIT

filter_placeholder_matches() {
  grep -Evi '(your_|YOUR_|placeholder|example|sk-proj-\.\.\.|redis://default:your_password@)' "$1" || true
}

scan_staged() {
  local added_lines
  added_lines="$(
    git diff --cached --no-color --unified=0 --diff-filter=ACM \
      | grep -E '^\+' \
      | grep -vE '^\+\+\+' \
      || true
  )"

  if [ -z "$added_lines" ]; then
    echo "[secrets-scan] No staged additions detected."
    return 0
  fi

  if printf '%s\n' "$added_lines" | grep -En "$SECRET_REGEX" >"$report_file"; then
    filter_placeholder_matches "$report_file" >"$filtered_report_file"
    if [ -s "$filtered_report_file" ]; then
      echo "[secrets-scan] Potential secrets found in staged changes:"
      cat "$filtered_report_file"
      return 1
    fi
  fi

  echo "[secrets-scan] Staged secret scan passed."
  return 0
}

scan_all() {
  local tracked_files=()
  while IFS= read -r file_path; do
    if [ -f "$file_path" ]; then
      tracked_files+=("$file_path")
    fi
  done < <(git ls-files)

  if [ "${#tracked_files[@]}" -eq 0 ]; then
    echo "[secrets-scan] No tracked files found."
    return 0
  fi

  if printf '%s\0' "${tracked_files[@]}" | xargs -0 grep -En "$SECRET_REGEX" >"$report_file"; then
    filter_placeholder_matches "$report_file" >"$filtered_report_file"
    if [ -s "$filtered_report_file" ]; then
      echo "[secrets-scan] Potential secrets found in repository files:"
      cat "$filtered_report_file"
      return 1
    fi
  fi

  echo "[secrets-scan] Repository secret scan passed."
  return 0
}

case "$MODE" in
  --staged)
    scan_staged
    ;;
  --all)
    scan_all
    ;;
  *)
    echo "Usage: $0 [--staged|--all]"
    exit 1
    ;;
esac
