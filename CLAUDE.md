# AIBIo Module Map

Implementácia prebieha modul po module v poradí 00 → 09. Pred začatím akejkoľvek práce
si Claude **musí** prečítať relevantný `TODO.md` pre modul, ktorého sa zmena týka, a
aktualizovať checkbox položky po dokončení každej úlohy.

**Master tracker:** [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md)

| # | Module    | Phase    | TODO                                                             |
|---|-----------|----------|------------------------------------------------------------------|
| 0 | core      | P0a–P0b  | [docs/00-core/TODO.md](docs/00-core/TODO.md)                     |
| 1 | shell     | P0c–P0d  | [docs/01-shell/TODO.md](docs/01-shell/TODO.md)                   |
| 2 | connect   | C1       | [docs/02-connect/TODO.md](docs/02-connect/TODO.md)               |
| 3 | explore   | E1–E2    | [docs/03-explore/TODO.md](docs/03-explore/TODO.md)               |
| 4 | govern    | G1–G2    | [docs/04-govern/TODO.md](docs/04-govern/TODO.md)                 |
| 5 | model     | M1–M3    | [docs/05-model/TODO.md](docs/05-model/TODO.md)                   |
| 6 | document  | D1–D3    | [docs/06-document/TODO.md](docs/06-document/TODO.md)             |
| 7 | test      | T1–T2    | [docs/07-test/TODO.md](docs/07-test/TODO.md)                     |
| 8 | translate | TR1–TR3  | [docs/08-translate/TODO.md](docs/08-translate/TODO.md)           |
| 9 | export    | X1 (MVP) | [docs/09-export/TODO.md](docs/09-export/TODO.md)                 |

**Cross-cutting referenčné docs (root `docs/`):** `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`,
`MCP_TOOLS.md`, `API_CONTRACT.md`, `AGENT_PROMPTS.md`, `TESTING.md`, `DEPLOY.md`,
`DEV_SETUP.md`, `ERROR_HANDLING.md`, `UI_UX.md`, `AIBIO.md`, `AINDERSTANDING.md`.

**Workflow pre Claude pri každej zmene:**
1. Identifikuj modul → otvor jeho `TODO.md`
2. Nájdi relevantnú úlohu (`- [ ]`) a over závislosti (sekcia "Závislosti")
3. Po dokončení zaškrtni checkbox — `- [x]`
4. Pri každom novom subagentovi, MCP tooli alebo API endpointe aktualizuj príslušnú sekciu v TODO.md

---

# Core Philosophy

Write code that is **simple, maintainable, and production-ready**. Prioritize clarity over cleverness, and always leave the codebase cleaner than you found it.

## Key Principles

1. **Simplicity First**: Choose the simplest solution that meets requirements (KISS principle)
2. **Consistency**: Maintain tech stack consistency unless there's strong justification for change
3. **Maintainability**: Prioritize code clarity and self-documentation over clever solutions
4. **Scalability**: Design for growth without premature optimization
5. **Best Practices**: Follow established patterns, idioms, and community conventions
6. **Clean Architecture**: Apply SOLID principles and maintain separation of concerns
7. **Quality First**: Continuous refactoring and cleanup are not optional

## Code Quality Standards

### SOLID Principles (Non-negotiable)

- **Single Responsibility**: Each class/function has exactly one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable for their base types
- **Interface Segregation**: Many specific interfaces beat one general-purpose interface
- **Dependency Inversion**: Depend on abstractions, not concrete implementations

### Clean Code Practices

**Code Organization:**

- Keep functions small (< 20 lines ideally, < 100 lines maximum)
- One level of abstraction per function
- Use meaningful, pronounceable names (avoid abbreviations unless widely known)
- Self-documenting code is the goal; comments explain "why", not "what"

**Code Quality:**

- **DRY Principle**: Don't Repeat Yourself - eliminate duplication through abstraction
- **YAGNI**: You Aren't Gonna Need It - don't add features speculatively
- Write code that's easy to delete, not easy to extend
- Prefer composition over inheritance

**Error Handling:**

- Fail fast and explicitly
- Use typed errors/exceptions with clear messages
- Never silently ignore errors
- Validate inputs at system boundaries

## Development Workflow

### Before Writing Code
1. Understand the requirement completely - ask clarifying questions if needed
2. Identify impacted areas of the codebase
3. Plan the simplest approach that satisfies requirements

### While Writing Code

1. **Write clean code from the start** - don't plan to "clean it up later"
2. **Test as you go** - verify changes work before moving on
3. **Refactor continuously** - improve code structure immediately when you see issues
4. **Remove dead code** - delete unused functions, variables, imports, and commented code

### After Writing Code

1. **Review and update comments** - ensure they reflect current implementation
2. **Clean up imports** - remove unused dependencies
3. **Verify tests pass** - run existing tests and add new ones if needed
4. **Check for side effects** - ensure changes don't break other functionality

## Technology Stack

### Frontend & UI

**JavaScript/TypeScript:**

- Package Manager: `npm`
- Runtime: Node.js
- Framework: React
- UI Components: shadcn-ui (https://ui.shadcn.com/), Radix UI primitives
- Charts: lightweight-charts (https://github.com/tradingview/lightweight-charts)
- Styling: Tailwind CSS
- Type Safety: TypeScript with strict mode enabled

### Backend

> **AIBIo:** The primary backend is **Next.js 15 Route Handlers** (Node.js). Python is used only for the Translate validator service (Phase 2, post-MVP). Python guidelines below apply exclusively to that component.

**Node.js (primary — AIBIo API layer):**

- Package Manager: `npm`
- API Framework: Next.js 15 Route Handlers (`app/api/`)
- Type Safety: TypeScript with strict mode enabled

**Python (Phase 2 only — Translate validator service):**

- **CRITICAL**: Use `uv` exclusively - NEVER use `pip` directly
- Virtual Environment: `uv venv` followed by `source .venv/bin/activate`
- Dependency Management: `uv sync` (not `pip install`)
- CLI Reference: `uv --help`
- **AVOID**: `hatchling.build` in pyproject.toml
- Type Hints: Use type annotations consistently (Python 3.10+ syntax)

**Go:**

- Use only when justified (performance-critical services, system tools)

### Scripting & Automation

- **Default**: Python for all scripts
- **Avoid**: Bash/Shell scripts (unless trivial one-liners), PowerShell
- Keep scripts simple, documented, and testable

### Operating System

- **Development**: macOS (primary)
- **Production**: Linux (Ubuntu LTS preferred)
- **Containers**: `node:20-slim` or distroless for production images. **Alpine is NOT supported** — musl libc is incompatible with `better-sqlite3` and `duckdb` native addons (see `docs/DEPLOY.md`)
- **Avoid**: Windows unless specifically required

### AI & Machine Learning

**Frameworks:**

- ML/DL: PyTorch (primary), avoid TensorFlow
- Model Hub: Hugging Face for pretrained models
- Embeddings: sentence-transformers

**Agent Development:**

- **Preferred**: Claude Agent SDK (https://docs.claude.com/en/docs/agent-sdk/overview)
- **Alternative**: LangChain >= 1.0.0 + LangGraph >= 1.0.0 (https://docs.langchain.com/)
- Keep agent chains simple and debuggable

### Infrastructure & DevOps

**Containerization:**

- Docker for local development and production
- Multi-stage builds for minimal image sizes
- .dockerignore to exclude unnecessary files

**Orchestration:**

- Kubernetes via Google Kubernetes Engine (GKE)
- Helm for K8s resource templating
- Keep manifests DRY and well-documented

**Infrastructure as Code:**

- Terraform for cloud resources
- Version control all IaC configurations
- Use modules for reusability

**Networking:**

- Traefik as ingress/reverse proxy

## Code Review Checklist

Before considering code complete, verify:

- [ ] All unused code removed (functions, variables, imports, comments)
- [ ] Comments updated to reflect current implementation
- [ ] No code duplication (DRY principle applied)
- [ ] Functions are small and focused (single responsibility)
- [ ] Error handling is explicit and comprehensive
- [ ] Type safety maintained (TypeScript/Python type hints)
- [ ] Tests written/updated and passing
- [ ] No hardcoded values (use configuration/environment variables)
- [ ] Security best practices followed (no secrets in code, input validation, etc.)
- [ ] Performance considered (no obvious bottlenecks)

## Communication Guidelines

**Context:**

- Assume 20+ years of software engineering experience
- Skip basic explanations unless specifically requested
- Be direct and technical in communication
- Ask for clarification when requirements are ambiguous

**Code Explanations:**

- Focus on "why" decisions were made, not "what" the code does
- Highlight tradeoffs and alternatives considered
- Point out areas that may need future attention

## Anti-Patterns to Avoid

- ❌ Leaving commented-out code "just in case"
- ❌ Adding TODO comments 
- ❌ Copying and pasting code instead of abstracting
- ❌ Premature optimization
- ❌ Over-engineering simple solutions
- ❌ Ignoring compiler/linter warnings
- ❌ Writing code without understanding its purpose
- ❌ Implementing features "we might need someday"

## Remember

> "Code is read far more often than it is written." - Guido van Rossum

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." - Martin Fowler

Write code you'd be proud to maintain in 2 years.

