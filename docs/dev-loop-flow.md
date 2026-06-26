# The dev-loop flow

A rendered flowchart of `/dev-loop`, showing the proportional **PLAN-gate fast-path** — the
human vs auto branching, the three classifier checkpoints, and the fail-closed escalations.
For the quick-scan version, see the ASCII loop in the [README](../README.md#the-loop); for the
full spec, see [`skills/dev-loop/SKILL.md`](../skills/dev-loop/SKILL.md).

```mermaid
flowchart TD
    A([/dev-loop · task]):::start --> B

    B["Route<br/>feature vs bug · ticket?<br/>approval mode: human or auto<br/>readiness scan"]:::always --> C

    C["Recon — ALWAYS runs<br/>plan-brief / investigate-bug"]:::always --> CP1

    CP1{"Checkpoint 1 · auto path<br/>blast radius still small?"}:::auto
    CP1 -->|"bigger than it looked"| GATE
    CP1 -->|ok| D

    D["Plan the approach — ALWAYS runs"]:::always --> M

    M{"approval mode?"}:::auto
    M -->|human path| GATE
    M -->|auto path| CP2

    CP2{"Checkpoint 2 · binding<br/>tripwires + recon file list<br/>+ independent verifier subagent"}:::auto
    CP2 -->|"fail · doubt · verifier unavailable"| GATE
    CP2 -->|"trivial ✓"| AN

    GATE["⏸ PLAN gate — HUMAN<br/>surface forks · wait for approval"]:::human --> BUILD
    AN["announce in one line · proceed, no wait"]:::auto --> BUILD

    BUILD["Build + commit each change"]:::always --> CP3

    CP3{"Checkpoint 3 · auto path · the REAL gate<br/>tripwires on cumulative diff since base<br/>side-effecting build / migration / deploy?"}:::auto
    CP3 -->|"breach"| ESC
    CP3 -->|clean| VER

    ESC["⏸ stop — HUMAN approves<br/>the now-non-trivial change"]:::human --> BUILD

    VER["Verify<br/>auto path: read-only checks only"]:::always --> CR
    CR["Code review"]:::always --> RG

    RG["🛑 REVIEW gate — ALWAYS HUMAN<br/>hard stop · nothing pushes until approved"]:::human --> PR

    PR([/pr · push + PR]):::start

    classDef start fill:#1f2937,color:#fff,stroke:#111;
    classDef always fill:#e5e7eb,color:#111,stroke:#9ca3af;
    classDef auto fill:#dbeafe,color:#0c4a6e,stroke:#2563eb;
    classDef human fill:#fee2e2,color:#7f1d1d,stroke:#ef4444,stroke-width:2px;
```

## How to read it

- 🟥 **Red = human gates.** 🟦 **Blue = the auto-path classifier checkpoints.** ⬜ **Grey = steps
  that always run** — recon and planning are never skipped, even on the auto path.
- **The auto path skips exactly one red node — the PLAN gate — and only when *all* blue checkpoints
  pass.** The last red node (the REVIEW gate) is never skippable: even an unattended run hard-stops
  there, so nothing reaches a remote unreviewed.
- **Every blue checkpoint has one escape hatch: → red.** Any breach, any doubt, or an unreachable
  verifier funnels back to a human (fail-closed). Blue can only ever *downgrade* to red, never the
  reverse — that's the whole safety story in one visual.
- **Checkpoint 3 is "the real gate"** because it's the one checking an actual diff (cumulative since
  the auto path began), and it also catches side-effecting build commands *before* they run.
