-- A message from you asking to verify or review, after verify-build has already run in
-- that session: a step the flow should have taken itself.
SELECT min(u.session_id) AS session_id, u.ts, substr(replace(u.text, char(10), ' '), 1, 100) AS detail
FROM session_events u
WHERE u.kind = 'user'
  AND u.agent_id IS NULL
  AND (lower(u.text) LIKE '%verif%' OR lower(u.text) LIKE '%review%')
  AND u.text NOT LIKE '<%'
  AND u.text NOT LIKE 'Base directory for this skill%'
  AND u.text NOT LIKE 'Another Claude session sent a message%'
  AND u.text NOT LIKE 'This session is being continued%'
  -- Tracker and team chatter: a ticket moved to a "code review" status, reviewers assigned.
  AND lower(u.text) NOT LIKE '%to code review%'
  AND lower(u.text) NOT LIKE '%assign%'
  AND lower(u.text) NOT LIKE '%request%review%'
  AND lower(u.text) NOT LIKE '%slack%'
  AND EXISTS (
    SELECT 1 FROM session_events s
    WHERE s.session_id = u.session_id
      AND s.agent_id IS NULL
      AND s.kind = 'tool_use'
      AND s.tool IN ('Agent', 'Task')
      AND s.input ->> '$.prompt' LIKE '%verify-build%'
      AND s.ts < u.ts
  )
GROUP BY u.id
ORDER BY u.ts;
