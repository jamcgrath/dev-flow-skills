-- A subagent reading an archived verdict (VERIFICATION.attempt-*). Moving a stale
-- verdict aside with `mv` is allowed and not counted.
SELECT session_id, ts, agent_id || ' ' || tool AS detail
FROM events
WHERE agent_id IS NOT NULL
  AND kind = 'tool_use'
  AND input LIKE '%VERIFICATION.attempt-%'
  AND (
       tool IN ('Read', 'Grep', 'Glob')
    OR (tool = 'Bash' AND input ->> '$.command' NOT LIKE 'mv %' AND input ->> '$.command' NOT LIKE '%&& mv %')
  )
ORDER BY ts;
