#!/usr/bin/env python3
"""Print every open PR that involves you, with the next action on each.

Read-only: one `gh api graphql` call, nothing written anywhere.
Usage: python3 pr_status.py
"""

import json
import subprocess
import sys
from datetime import datetime, timezone

QUERY = """
query {
  viewer { login }
  mine: search(type: ISSUE, first: 30, query: "is:pr is:open archived:false author:@me") { nodes { ...pr } }
  requested: search(type: ISSUE, first: 30, query: "is:pr is:open archived:false review-requested:@me") { nodes { ...pr } }
  reviewed: search(type: ISSUE, first: 30, query: "is:pr is:open archived:false reviewed-by:@me -author:@me") { nodes { ...pr } }
}
fragment pr on PullRequest {
  number title url isDraft headRefName headRefOid updatedAt
  repository { nameWithOwner }
  author { login }
  reviewDecision mergeable
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  reviews(last: 20) { nodes { author { login } state submittedAt body commit { oid } } }
  comments(last: 20) { nodes { author { __typename login } createdAt } }
  reviewThreads(first: 50) { nodes { isResolved comments(last: 10) { nodes { author { login } } } } }
}
"""

REVIEW_LABEL = {"APPROVED": "approved", "CHANGES_REQUESTED": "changes requested",
                "REVIEW_REQUIRED": "pending"}


def login(node):
    return (node.get("author") or {}).get("login")


def nodes(conn):
    return (conn or {}).get("nodes") or []


def fetch():
    r = subprocess.run(["gh", "api", "graphql", "-f", f"query={QUERY}"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"gh failed: {r.stderr.strip() or r.stdout.strip()}")
    data = json.loads(r.stdout)
    if data.get("errors"):
        sys.exit(f"gh failed: {data['errors'][0].get('message')}")
    return data["data"]


def ci_state(pr):
    commit = nodes(pr["commits"])
    rollup = commit[0]["commit"].get("statusCheckRollup") if commit else None
    return (rollup or {}).get("state")


def unanswered(pr, me):
    """Threads and top-level comments /pr-fix would act on: an unresolved thread
    whose last word isn't yours, or a comment/review body posted after your last
    top-level comment. Top-level comments from bots (deploy previews) don't count."""
    threads = sum(1 for t in nodes(pr["reviewThreads"])
                  if not t["isResolved"] and nodes(t["comments"])
                  and login(nodes(t["comments"])[-1]) != me)
    mine = [c["createdAt"] for c in nodes(pr["comments"]) if login(c) == me]
    since = max(mine) if mine else ""
    top = sum(1 for c in nodes(pr["comments"])
              if login(c) != me and c["createdAt"] > since
              and (c.get("author") or {}).get("__typename") != "Bot")
    top += sum(1 for r in nodes(pr["reviews"])
               if login(r) != me and r["state"] in ("COMMENTED", "CHANGES_REQUESTED")
               and (r.get("body") or "").strip()
               and (r.get("submittedAt") or "") > since)
    return threads, top


def my_pr_row(pr, me):
    threads, top = unanswered(pr, me)
    ci = ci_state(pr)
    decision = pr.get("reviewDecision")
    if threads + top:
        parts = [f"{threads} thread{'s' * (threads != 1)}"] if threads else []
        parts += [f"{top} comment{'s' * (top != 1)}"] if top else []
        action = f"/pr-fix: {' + '.join(parts)} unanswered"
    elif decision == "CHANGES_REQUESTED":
        action = "all answered, changes still requested: re-request review"
    elif ci in ("FAILURE", "ERROR"):
        action = "CI failing"
    elif pr.get("mergeable") == "CONFLICTING":
        action = "merge conflicts"
    elif pr["isDraft"]:
        action = "draft"
    elif decision == "APPROVED":
        action = "approved: ready to merge"
    else:
        action = "waiting on review"
    if ci in ("FAILURE", "ERROR") and action != "CI failing":
        action += " · CI failing"
    review = "draft" if pr["isDraft"] else REVIEW_LABEL.get(decision, "—")
    return action in QUIET, [link(pr), pr["headRefName"], age(pr), review, (ci or "—").lower(), action]


def review_row(pr, me, requested):
    reviews = [r for r in nodes(pr["reviews"]) if login(r) == me and r["state"] != "PENDING"]
    in_threads = [t for t in nodes(pr["reviewThreads"])
                  if any(login(c) == me for c in nodes(t["comments"]))]
    replies = sum(1 for t in in_threads
                  if not t["isResolved"] and login(nodes(t["comments"])[-1]) != me)
    if not reviews and not in_threads:
        action = "review"
    elif requested:
        action = "re-review requested"
    elif reviews and (reviews[-1].get("commit") or {}).get("oid") != pr["headRefOid"]:
        action = "re-review: new commits since your review"
    elif reviews and reviews[-1]["state"] == "CHANGES_REQUESTED":
        action = "waiting on author"
    else:
        action = "nothing new"
    quiet = action in QUIET and not replies
    if replies:
        lead = f"{replies} repl{'ies' if replies != 1 else 'y'} to you"
        action = lead if action in QUIET else f"{lead} · {action}"
    if pr["isDraft"]:
        action += " · draft"
    return quiet, [link(pr), login(pr) or "?", pr["headRefName"], age(pr), action]


def days_since_update(pr):
    then = datetime.fromisoformat(pr["updatedAt"].replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - then).days


def age(pr):
    days = days_since_update(pr)
    return f"{days}d" if days < 60 else f"{days // 30}mo"


def link(pr):
    title = pr["title"] if len(pr["title"]) <= 50 else pr["title"][:49] + "…"
    return f"[{pr['repository']['nameWithOwner']}#{pr['number']}]({pr['url']}) {title}"


STALE_DAYS = 14      # one sprint; review requests untouched longer are hidden, mine never are
QUIET = ("waiting on review", "draft", "nothing new", "waiting on author")


def table(header, rows):
    rows.sort(key=lambda r: r[0])      # needs-action first; stable, so newest-first within each
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(cells).replace("\n", " ") + " |" for _, cells in rows]
    return "\n".join(lines)


def main():
    data = fetch()
    me = data["viewer"]["login"]
    requested = {p["url"] for p in nodes(data["requested"])}
    others = {}
    for p in nodes(data["requested"]) + nodes(data["reviewed"]):
        if login(p) != me:
            others[p["url"]] = p

    newest = lambda prs: sorted(prs, key=lambda p: p["updatedAt"], reverse=True)
    mine = [my_pr_row(p, me) for p in newest(nodes(data["mine"]))]
    live = [p for p in others.values() if days_since_update(p) < STALE_DAYS]
    stale = len(others) - len(live)
    theirs = [review_row(p, me, p["url"] in requested) for p in newest(live)]

    print(f"## Your PRs ({len(mine)})")
    print(table(["PR", "Branch", "Updated", "Review", "CI", "Next"], mine) if mine else "None open.")
    print(f"\n## To review ({len(theirs)})")
    print(table(["PR", "Author", "Branch", "Updated", "Next"], theirs) if theirs else "Nothing requested or in progress.")
    if stale:
        print(f"\n+{stale} not updated in {STALE_DAYS}+ days, hidden.")


if __name__ == "__main__":
    main()
