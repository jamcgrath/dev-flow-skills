-- Two `falsified` verdicts in a row in one session — the point at which dev-flow step 9
-- tests the builds' shared premise before another retry.
WITH changes AS (
  -- Every write or edit of VERIFICATION.md, with the text that follows the change.
  SELECT id, session_id, agent_id, ts, tool,
         lower(coalesce(input ->> '$.content', input ->> '$.command', input ->> '$.new_string', '')) AS body,
         lower(coalesce(input ->> '$.old_string', '')) AS old
  FROM session_events
  WHERE kind = 'tool_use'
    AND (
         (tool IN ('Write', 'Edit') AND input ->> '$.file_path' LIKE '%/VERIFICATION.md')
      OR (tool = 'Bash' AND input ->> '$.command' LIKE '%> %VERIFICATION.md%')
    )
),
heads AS (
  -- The word that opens the `## Verdict` section: the reason after it can name another verdict.
  -- An edit without the heading counts when it replaces the verdict line itself.
  SELECT id, session_id, agent_id, ts,
         CASE
           WHEN instr(body, '## verdict') > 0
             THEN ltrim(substr(body, instr(body, '## verdict') + 10), char(10, 13, 32, 42, 58, 96))
           WHEN tool = 'Edit' AND (ltrim(old, char(10, 13, 32, 42, 96)) LIKE 'verified%'
                                OR ltrim(old, char(10, 13, 32, 42, 96)) LIKE 'falsified%'
                                OR ltrim(old, char(10, 13, 32, 42, 96)) LIKE 'couldn%')
             THEN ltrim(body, char(10, 13, 32, 42, 96))
         END AS head
  FROM changes
),
verdicts AS (
  SELECT id, session_id, ts,
         -- One verify-build subagent is one pass; a verdict written by the main thread is its own.
         coalesce(agent_id, 'main:' || id) AS pass,
         CASE
           WHEN head LIKE 'falsified%' THEN 'falsified'
           WHEN head LIKE 'couldn%'    THEN 'couldn''t-verify'
           WHEN head LIKE 'could not%' THEN 'couldn''t-verify'
           WHEN head LIKE 'verified%'  THEN 'verified'
         END AS verdict
  FROM heads
),
passes AS (
  -- A pass's verdict is the last one it wrote: a draft can be revised before the pass ends.
  SELECT id, session_id, pass, ts, verdict
  FROM (
    SELECT *, row_number() OVER (PARTITION BY session_id, pass ORDER BY ts DESC) AS n
    FROM verdicts
    WHERE verdict IS NOT NULL
  )
  WHERE n = 1
),
ordered AS (
  SELECT id, session_id, ts, verdict,
         lag(verdict) OVER (PARTITION BY session_id ORDER BY ts) AS previous
  FROM passes
)
SELECT min(session_id) AS session_id, ts, 'falsified after falsified' AS detail
FROM ordered
WHERE verdict = 'falsified' AND previous = 'falsified'
GROUP BY id
ORDER BY ts;
