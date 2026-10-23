# VmiYou project context

@AGENTS.md
@SPEC.md

Use the specification index to open only documents relevant to the task. Reusable workflows are available as project Skills under `.claude/skills/`; invoke them with `/frontend-development`, `/backend-development`, `/design-system`, `/database-management`, `/worker-scheduler`, `/testing-quality`, `/security-review`, or `/deployment-review`.

The canonical Skill bodies live in `.agents/skills/` for Codex. Claude wrappers import those files so the two agents share one maintained workflow.
