#!/usr/bin/env bash
# Rebase open PRs targeting `next` onto the modules/ tidy-up branch.
#
# For each PR:
#   1. Check out the PR head
#   2. Rebase onto TIDY_UP_BRANCH (default: current branch / cursor/reorganize-modules-a709)
#   3. Relocate any files still under packages/v1-ready/<x> or packages/needs-updating/<x>
#      into modules/<x>
#   4. Regenerate package-lock.json on lockfile conflicts
#   5. Run npm test in the affected module(s)
#   6. Force-push with --force-with-lease (unless --dry-run)
#
# Usage:
#   scripts/rebase-open-prs-onto-modules.sh --dry-run
#   scripts/rebase-open-prs-onto-modules.sh --dry-run --limit 5
#   scripts/rebase-open-prs-onto-modules.sh --execute   # actually force-pushes
#
# NEVER run against next/main. Does not merge or publish.

set -euo pipefail

DRY_RUN=1
LIMIT=0
BASE_BRANCH="next"
TIDY_UP_BRANCH="${TIDY_UP_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
# Keep the report outside the worktree so checkouts during the loop cannot fail.
REPORT_FILE="${REPORT_FILE:-${TMPDIR:-/tmp}/aml-rebase-open-prs-dry-run.md}"
WORKDIR="${TMPDIR:-/tmp}/aml-rebase-$$"
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ORIGINAL_HEAD="$(git rev-parse HEAD)"

usage() {
  sed -n '2,20p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --execute) DRY_RUN=0; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --tidy-up) TIDY_UP_BRANCH="$2"; shift 2 ;;
    --base) BASE_BRANCH="$2"; shift 2 ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

if [[ "$TIDY_UP_BRANCH" == "next" || "$TIDY_UP_BRANCH" == "main" ]]; then
  echo "Refusing to use next/main as tidy-up branch." >&2
  exit 1
fi

mkdir -p "$WORKDIR"
cleanup() {
  git checkout -q "$ORIGINAL_BRANCH" 2>/dev/null || git checkout -q "$ORIGINAL_HEAD" 2>/dev/null || true
  git rebase --abort 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "Tidy-up branch: $TIDY_UP_BRANCH"
echo "Base branch:    $BASE_BRANCH"
echo "Dry run:        $DRY_RUN"
echo "Report:         $REPORT_FILE"

# Enumerate open PRs into next
PR_JSON="$WORKDIR/prs.json"
gh pr list --base "$BASE_BRANCH" --state open --limit 200 \
  --json number,title,headRefName,headRepositoryOwner,isCrossRepository,url \
  > "$PR_JSON"

mapfile -t PR_NUMBERS < <(jq -r '.[].number' "$PR_JSON")
if [[ "$LIMIT" -gt 0 ]]; then
  PR_NUMBERS=("${PR_NUMBERS[@]:0:$LIMIT}")
fi

echo "Open PRs into $BASE_BRANCH: $(jq length "$PR_JSON") (processing ${#PR_NUMBERS[@]})"

{
  echo "# Open PR rebase dry-run onto \`$TIDY_UP_BRANCH\`"
  echo
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Dry-run: $DRY_RUN (force-push skipped when dry-run=1)"
  echo
  echo "| PR | Module | Head | Fork? | Pushable? | Rebase | Tests | Notes |"
  echo "| --- | --- | --- | --- | --- | --- | --- | --- |"
} > "$REPORT_FILE"

detect_modules_from_diff() {
  local base="$1"
  local head="$2"
  git diff --name-only "$base...$head" 2>/dev/null \
    | sed -nE 's#^(packages/(v1-ready|needs-updating)|modules)/([^/]+)/.*#\3#p' \
    | sort -u
}

relocate_legacy_paths() {
  # After rebase, move any leftover packages/v1-ready|needs-updating trees into modules/
  local moved=0
  for root in packages/v1-ready packages/needs-updating; do
    [[ -d "$root" ]] || continue
    for dir in "$root"/*/; do
      [[ -d "$dir" ]] || continue
      local name
      name="$(basename "$dir")"
      mkdir -p modules
      if [[ -e "modules/$name" ]]; then
        echo "CONFLICT: modules/$name already exists while relocating $dir" >&2
        return 1
      fi
      git mv "$dir" "modules/$name"
      moved=1
    done
  done
  if [[ -d packages ]]; then
    find packages -type d -empty -delete 2>/dev/null || true
  fi
  return 0
}

regenerate_lockfile_if_needed() {
  if git diff --name-only --diff-filter=U | grep -qx 'package-lock.json' \
    || git status --porcelain | grep -q 'package-lock.json'; then
    git checkout --ours package-lock.json 2>/dev/null || true
    rm -f package-lock.json
    npm install --package-lock-only --ignore-scripts >/dev/null 2>&1 \
      || npm install --ignore-scripts >/dev/null 2>&1 || return 1
    git add package-lock.json package.json 2>/dev/null || true
  fi
  return 0
}

run_module_tests() {
  local modules=("$@")
  if [[ ${#modules[@]} -eq 0 ]]; then
    echo "skip"
    return 0
  fi
  local failed=0
  for mod in "${modules[@]}"; do
    local dir="modules/$mod"
    if [[ ! -d "$dir" ]]; then
      echo "missing:$mod"
      failed=1
      continue
    fi
    if [[ ! -f "$dir/package.json" ]]; then
      echo "no-pkg:$mod"
      continue
    fi
    if ! (cd "$dir" && timeout 180 npm test --if-present) >/dev/null 2>&1; then
      echo "fail:$mod"
      failed=1
    else
      echo "pass:$mod"
    fi
  done
  return $failed
}

for num in "${PR_NUMBERS[@]}"; do
  meta="$(jq -c --argjson n "$num" '.[] | select(.number==$n)' "$PR_JSON")"
  title="$(jq -r '.title' <<<"$meta")"
  head_ref="$(jq -r '.headRefName' <<<"$meta")"
  is_fork="$(jq -r '.isCrossRepository' <<<"$meta")"
  owner="$(jq -r '.headRepositoryOwner.login' <<<"$meta")"
  url="$(jq -r '.url' <<<"$meta")"

  module_guess="$(sed -nE 's/.*feat\(([^)]+)\).*/\1/p' <<<"$title" | head -1)"
  [[ -n "$module_guess" ]] || module_guess="?"

  pushable="yes"
  if [[ "$is_fork" == "true" ]]; then
    pushable="no-fork"
  fi

  rebase_status="pending"
  test_status="—"
  notes=""

  echo
  echo "======== PR #$num ($head_ref) ========"

  # Skip our own tidy-up PR head if present
  if [[ "$head_ref" == "$TIDY_UP_BRANCH" ]]; then
    rebase_status="skip"
    notes="tidy-up branch itself"
    echo "| #$num | $module_guess | \`$head_ref\` | $is_fork | $pushable | $rebase_status | $test_status | $notes |" >> "$REPORT_FILE"
    continue
  fi
  # Also skip PRs that only touch repo meta (no module paths) when title matches reorganize
  if [[ "$title" == *"reorganize modules"* ]]; then
    rebase_status="skip"
    notes="tidy-up PR"
    echo "| #$num | $module_guess | \`$head_ref\` | $is_fork | $pushable | $rebase_status | $test_status | $notes |" >> "$REPORT_FILE"
    continue
  fi

  # Fetch PR head
  if ! git fetch origin "pull/$num/head:refs/rebase-pr/$num" 2>"$WORKDIR/fetch-$num.err"; then
    rebase_status="fetch-fail"
    notes="$(tr '\n' ' ' <"$WORKDIR/fetch-$num.err" | head -c 120)"
    echo "| #$num | $module_guess | \`$head_ref\` | $is_fork | $pushable | $rebase_status | $test_status | $notes |" >> "$REPORT_FILE"
    continue
  fi

  git checkout -q "refs/rebase-pr/$num"
  modules_before="$(detect_modules_from_diff "origin/$BASE_BRANCH" HEAD | tr '\n' ' ')"
  if [[ -n "$modules_before" && "$module_guess" == "?" ]]; then
    module_guess="$(awk '{print $1}' <<<"$modules_before")"
  fi
  [[ -n "$module_guess" && "$module_guess" != "?" ]] || module_guess="$(echo "$modules_before" | awk '{print $1}')"
  module_guess="${module_guess:-?}"

  # Attempt rebase onto tidy-up
  set +e
  git rebase "$TIDY_UP_BRANCH" >"$WORKDIR/rebase-$num.log" 2>&1
  rebase_rc=$?
  set -e

  if [[ $rebase_rc -ne 0 ]]; then
    # Try to auto-resolve path moves + lockfile, then continue
    if relocate_legacy_paths 2>>"$WORKDIR/rebase-$num.log"; then
      regenerate_lockfile_if_needed >>"$WORKDIR/rebase-$num.log" 2>&1 || true
      # Prefer ours for MODULES.md / workspaces during conflict, then regenerate
      if git diff --name-only --diff-filter=U | grep -q .; then
        while IFS= read -r conflicted; do
          case "$conflicted" in
            package-lock.json)
              regenerate_lockfile_if_needed >>"$WORKDIR/rebase-$num.log" 2>&1 || true
              ;;
            MODULES.md|package.json|lerna.json|.autorc)
              git checkout --ours -- "$conflicted" 2>/dev/null || git checkout --theirs -- "$conflicted" 2>/dev/null || true
              git add -- "$conflicted" 2>/dev/null || true
              ;;
            packages/v1-ready/*|packages/needs-updating/*)
              # leave for relocate
              ;;
            *)
              # default: take tidy-up (ours during rebase) for config, theirs for module sources
              if [[ "$conflicted" == modules/* ]]; then
                git checkout --theirs -- "$conflicted" 2>/dev/null || true
              else
                git checkout --ours -- "$conflicted" 2>/dev/null || true
              fi
              git add -- "$conflicted" 2>/dev/null || true
              ;;
          esac
        done < <(git diff --name-only --diff-filter=U)
        relocate_legacy_paths >>"$WORKDIR/rebase-$num.log" 2>&1 || true
      fi
      set +e
      GIT_EDITOR=true git rebase --continue >>"$WORKDIR/rebase-$num.log" 2>&1
      rebase_rc=$?
      # Keep continuing while conflicts remain (cap iterations)
      local_i=0
      while [[ $rebase_rc -ne 0 && $local_i -lt 10 ]]; do
        if ! git diff --name-only --diff-filter=U | grep -q .; then
          break
        fi
        while IFS= read -r conflicted; do
          if [[ "$conflicted" == modules/* || "$conflicted" == packages/* ]]; then
            git checkout --theirs -- "$conflicted" 2>/dev/null || true
          else
            git checkout --ours -- "$conflicted" 2>/dev/null || true
          fi
          git add -- "$conflicted" 2>/dev/null || true
        done < <(git diff --name-only --diff-filter=U)
        relocate_legacy_paths >>"$WORKDIR/rebase-$num.log" 2>&1 || true
        regenerate_lockfile_if_needed >>"$WORKDIR/rebase-$num.log" 2>&1 || true
        GIT_EDITOR=true git rebase --continue >>"$WORKDIR/rebase-$num.log" 2>&1
        rebase_rc=$?
        local_i=$((local_i + 1))
      done
      set -e
    fi
  fi

  if [[ $rebase_rc -ne 0 ]]; then
    rebase_status="conflict"
    notes="see $WORKDIR/rebase-$num.log"
    git rebase --abort 2>/dev/null || true
    echo "| #$num | $module_guess | \`$head_ref\` | $is_fork | $pushable | $rebase_status | $test_status | $notes |" >> "$REPORT_FILE"
    continue
  fi

  # Relocate even on clean rebase if PR still adds under packages/
  relocate_legacy_paths >>"$WORKDIR/rebase-$num.log" 2>&1 || true
  if ! git diff --quiet || ! git diff --cached --quiet; then
    regenerate_lockfile_if_needed >>"$WORKDIR/rebase-$num.log" 2>&1 || true
    # refresh MODULES.md if generator exists
    if [[ -f scripts/gen-modules-index.js ]]; then
      node scripts/gen-modules-index.js >>"$WORKDIR/rebase-$num.log" 2>&1 || true
      git add MODULES.md 2>/dev/null || true
    fi
    git add -A
    if ! git diff --cached --quiet; then
      git -c user.email=cursoragent@cursor.com -c user.name='Cursor Agent' \
        commit -m "chore: relocate module paths to modules/ after tidy-up rebase" \
        >>"$WORKDIR/rebase-$num.log" 2>&1 || true
    fi
  fi

  rebase_status="clean"

  # Tests
  mapfile -t mods < <(detect_modules_from_diff "$TIDY_UP_BRANCH" HEAD)
  if [[ ${#mods[@]} -eq 0 && "$module_guess" != "?" ]]; then
    mods=("$module_guess")
  fi
  set +e
  test_out="$(run_module_tests "${mods[@]}")"
  test_rc=$?
  set -e
  if [[ $test_rc -eq 0 ]]; then
    test_status="pass (${test_out//$'\n'/, })"
  else
    test_status="fail (${test_out//$'\n'/, })"
  fi

  if [[ "$DRY_RUN" -eq 0 ]]; then
    if [[ "$pushable" != "yes" ]]; then
      notes="rebase ok locally; cannot push to fork"
    else
      if git push --force-with-lease "origin" "HEAD:refs/heads/$head_ref" >>"$WORKDIR/push-$num.log" 2>&1; then
        notes="force-pushed"
      else
        notes="push failed"
        pushable="push-fail"
      fi
    fi
  else
    notes="dry-run (no push)"
  fi

  echo "| #$num | $module_guess | \`$head_ref\` | $is_fork | $pushable | $rebase_status | $test_status | $notes |" >> "$REPORT_FILE"
done

{
  echo
  echo "## Summary"
  echo
  echo "- Clean rebases: $(grep -c '| clean |' "$REPORT_FILE" || true)"
  echo "- Conflicts: $(grep -c '| conflict |' "$REPORT_FILE" || true)"
  echo "- Fetch failures: $(grep -c '| fetch-fail |' "$REPORT_FILE" || true)"
  echo "- Forks / unpushable: $(grep -c 'no-fork' "$REPORT_FILE" || true)"
} >> "$REPORT_FILE"

echo
echo "Wrote report: $REPORT_FILE"
