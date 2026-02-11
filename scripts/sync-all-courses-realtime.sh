#!/bin/bash

# Circle Course Sync - All Courses with Real-Time Logging
# This script syncs all Circle courses one by one, showing full output

export UPSTASH_USER_RAG_REST_URL="https://fast-seasnail-12447-us1-vector.upstash.io"
export CIRCLE_SPACE_ID="2310423"

required_env_vars=(
  UPSTASH_USER_RAG_REST_TOKEN
  CIRCLE_API_TOKEN
  CIRCLE_HEADLESS_AUTH_TOKEN
  OPENAI_API_KEY
)

for var_name in "${required_env_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    echo "❌ Missing required env var: $var_name"
    echo "Set it in your shell or .env.local before running this script."
    exit 1
  fi
done

# Define all courses
declare -a courses=(
  "782928:EOS A - Z:14"
  "813417:EOS Implementer Community:5"
  "815352:Biz Dev:6"
  "815357:Practice Management:11"
  "815361:Client Resources:8"
  "815371:Path to Mastery:6"
  "815739:Events:4"
  "839429:Getting Started:6"
  "850665:Franchise Advisory Council:1"
  "879850:QCE Contributors Training:1"
  "907974:Test:1"
)

total=${#courses[@]}
successful=0
failed=0

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║      Sync ALL Circle Courses to Upstash (Real-Time)       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Total courses: $total"
echo "Space ID: $CIRCLE_SPACE_ID"
echo ""
echo "Starting sync in 3 seconds..."
sleep 3

for i in "${!courses[@]}"; do
  IFS=':' read -r course_id course_name space_count <<< "${courses[$i]}"
  course_num=$((i + 1))
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "[$course_num/$total] $course_name (ID: $course_id, Spaces: $space_count)"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
  
  # Run sync command (shows all output in real-time)
  if pnpm tsx scripts/sync-circle-course-to-upstash.ts "$course_id"; then
    echo ""
    echo "✅ [$course_num/$total] $course_name - SUCCESS"
    ((successful++))
  else
    echo ""
    echo "❌ [$course_num/$total] $course_name - FAILED"
    ((failed++))
  fi
  
  echo ""
  echo "Progress: $course_num/$total complete ($successful successful, $failed failed)"
  echo ""
  
  # Small delay between courses
  if [ $course_num -lt $total ]; then
    sleep 2
  fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   FINAL SUMMARY                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Courses: $total"
echo "✅ Successful: $successful"
echo "❌ Failed: $failed"
echo ""

if [ $successful -eq $total ]; then
  echo "🎉 All courses synced successfully!"
else
  echo "⚠️  Some courses failed. Check logs above for details."
fi

echo ""
echo "✨ All successful courses are ready for user activation!"
echo ""
