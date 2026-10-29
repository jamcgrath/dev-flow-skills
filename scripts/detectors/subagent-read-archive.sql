-- A subagent reading an archived verdict (VERIFICATION.attempt-*). Moving a stale verdict
-- aside, or any other command that does not read one, is not counted.
WITH RECURSIVE segments (id, session_id, ts, agent_id, rest, part) AS (
  -- Each Bash command split into its simple commands on && || ; | and newlines.
  SELECT id, session_id, ts, agent_id,
         replace(replace(replace(replace(input ->> '$.command', '&&', char(10)), '||', char(10)),
                 ';', char(10)), '|', char(10)) || char(10),
         NULL
  FROM events
  WHERE agent_id IS NOT NULL AND kind = 'tool_use' AND tool = 'Bash'
    AND input LIKE '%VERIFICATION.attempt-%'
  UNION ALL
  SELECT id, session_id, ts, agent_id,
         substr(rest, instr(rest, char(10)) + 1),
         ltrim(substr(rest, 1, instr(rest, char(10)) - 1))
  FROM segments
  WHERE rest <> ''
),
reads AS (
  SELECT id, session_id, ts, agent_id || ' Bash' AS detail
  FROM segments
  WHERE part LIKE '%VERIFICATION.attempt-%'
    AND (substr(part, 1, instr(part || ' ', ' ') - 1)
           IN ('cat', 'head', 'tail', 'less', 'more', 'grep', 'rg', 'sed', 'awk', 'diff', 'bat', 'jq')
         OR part LIKE '%< %VERIFICATION.attempt-%')
  UNION ALL
  SELECT id, session_id, ts, agent_id || ' ' || tool
  FROM events
  WHERE agent_id IS NOT NULL AND kind = 'tool_use' AND tool IN ('Read', 'Grep', 'Glob')
    AND input LIKE '%VERIFICATION.attempt-%'
)
SELECT session_id, ts, detail
FROM reads
GROUP BY id
ORDER BY ts;
