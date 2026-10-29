-- A verify-build spawn whose prompt carries an earlier pass's verdict or findings.
-- dev-flow step 9 spawns every pass with a fixed input and nothing from a previous pass.
WITH phrases (p) AS (
  VALUES ('prior version'), ('prior verif'), ('prior pass'), ('prior run'), ('previous verif'),
         ('previous pass'), ('earlier pass'), ('last pass'), ('returned `falsified`'), ('holds pass')
),
spawns AS (
  SELECT id, session_id, ts, coalesce(input ->> '$.description', '') AS description,
         lower(input ->> '$.prompt') AS prompt
  FROM events
  WHERE kind = 'tool_use'
    AND tool IN ('Agent', 'Task')
    AND (input ->> '$.prompt' LIKE '%verify-build%' OR input ->> '$.description' LIKE '%verif%')
),
mentions AS (
  -- The 50 characters before a phrase's first use. A negation there ("do not read the
  -- prior verification") makes it an instruction to stay independent, not a carried result.
  SELECT s.id, s.session_id, s.ts, s.description,
         ' ' || substr(s.prompt, max(1, instr(s.prompt, p) - 50), min(instr(s.prompt, p) - 1, 50)) AS before
  FROM spawns s JOIN phrases ON instr(s.prompt, p) > 0
)
SELECT session_id, ts, description AS detail
FROM mentions
WHERE before NOT LIKE '% not %'   AND before NOT LIKE '%n''t %' AND before NOT LIKE '%n’t %'
  AND before NOT LIKE '% never %' AND before NOT LIKE '% no %'  AND before NOT LIKE '% without %'
  AND before NOT LIKE '% ignore %'
GROUP BY id
ORDER BY ts;
