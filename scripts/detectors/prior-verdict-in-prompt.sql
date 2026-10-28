-- A verify-build spawn whose prompt carries an earlier pass's verdict or findings.
-- dev-flow step 9 spawns every pass with a fixed input and nothing from a previous pass.
SELECT session_id, ts, coalesce(input ->> '$.description', '') AS detail
FROM events
WHERE kind = 'tool_use'
  AND tool IN ('Agent', 'Task')
  AND (input ->> '$.prompt' LIKE '%verify-build%' OR input ->> '$.description' LIKE '%verif%')
  AND (
       lower(input ->> '$.prompt') LIKE '%prior version%'
    OR lower(input ->> '$.prompt') LIKE '%prior verif%'
    OR lower(input ->> '$.prompt') LIKE '%prior pass%'
    OR lower(input ->> '$.prompt') LIKE '%prior run%'
    OR lower(input ->> '$.prompt') LIKE '%previous verif%'
    OR lower(input ->> '$.prompt') LIKE '%previous pass%'
    OR lower(input ->> '$.prompt') LIKE '%earlier pass%'
    OR lower(input ->> '$.prompt') LIKE '%last pass%'
    OR lower(input ->> '$.prompt') LIKE '%returned `falsified`%'
    OR lower(input ->> '$.prompt') LIKE '%holds pass%'
  )
ORDER BY ts;
