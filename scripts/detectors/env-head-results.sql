-- A write to ENVIRONMENT.md that mentions HEAD. It may hold setup facts and test results
-- from base only, so a HEAD result would hand the next pass an outcome of its own check.
SELECT session_id, ts, coalesce(agent_id, 'main') || ' ' || tool AS detail
FROM events
WHERE kind = 'tool_use'
  AND (
       (tool IN ('Write', 'Edit') AND input ->> '$.file_path' LIKE '%/ENVIRONMENT.md'
        AND coalesce(input ->> '$.content', input ->> '$.new_string', '') GLOB '*HEAD*')
    OR (tool = 'Bash' AND input ->> '$.command' LIKE '%ENVIRONMENT.md%'
        AND input ->> '$.command' GLOB '*HEAD*' AND input ->> '$.command' LIKE '%>%')
  )
ORDER BY ts;
