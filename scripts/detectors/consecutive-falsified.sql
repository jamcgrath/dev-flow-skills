-- Two `falsified` verdicts written in a row in one session — the point at which dev-flow
-- step 9 tests the builds' shared premise before another retry.
WITH writes AS (
  SELECT session_id, ts,
         coalesce(input ->> '$.content', input ->> '$.command', '') AS body
  FROM events
  WHERE kind = 'tool_use'
    AND (
         (tool = 'Write' AND input ->> '$.file_path' LIKE '%/VERIFICATION.md')
      OR (tool = 'Bash'  AND input ->> '$.command' LIKE '%> %VERIFICATION.md%')
    )
),
verdicts AS (
  SELECT session_id, ts,
         CASE
           WHEN head LIKE '%falsified%'       THEN 'falsified'
           WHEN head LIKE '%couldn''t-verify%' THEN 'couldn''t-verify'
           WHEN head LIKE '%verified%'        THEN 'verified'
         END AS verdict
  FROM (
    SELECT session_id, ts, lower(substr(body, instr(lower(body), 'verdict'), 160)) AS head
    FROM writes
    WHERE instr(lower(body), 'verdict') > 0
  )
),
ordered AS (
  SELECT session_id, ts, verdict,
         lag(verdict) OVER (PARTITION BY session_id ORDER BY ts) AS previous
  FROM verdicts
  WHERE verdict IS NOT NULL
)
SELECT session_id, ts, 'falsified after falsified' AS detail
FROM ordered
WHERE verdict = 'falsified' AND previous = 'falsified'
ORDER BY ts;
