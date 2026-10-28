-- A message from you asking to verify or review, after verify-build has already run in
-- that session: a step the flow should have taken itself.
SELECT u.session_id, u.ts, substr(replace(u.text, char(10), ' '), 1, 100) AS detail
FROM events u
WHERE u.kind = 'user'
  AND u.agent_id IS NULL
  AND (lower(u.text) LIKE '%verif%' OR lower(u.text) LIKE '%review%')
  AND u.text NOT LIKE '<%'
  AND u.text NOT LIKE 'Base directory for this skill%'
  AND u.text NOT LIKE 'Another Claude session sent a message%'
  AND EXISTS (
    SELECT 1 FROM events s
    WHERE s.session_id = u.session_id
      AND s.agent_id IS NULL
      AND s.kind = 'tool_use'
      AND s.tool IN ('Agent', 'Task')
      AND s.input ->> '$.prompt' LIKE '%verify-build%'
      AND s.ts < u.ts
  )
ORDER BY u.ts;
