# Spec-to-Test Execution Loop

```yaml
lifecycle: spec-to-test
states: [SPEC, TEST_PLAN, IMPLEMENT, VERIFY, COMPLETE]
invariants: [no-code-before-test-contract, 100-percent-test-pass-before-complete]
```

## State Machine Definition

| State | Responsible Mode | Inputs | Core Outputs | Exit Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **`SPEC`** | Orchestrator & Architect | User intent, codebase analysis | YAML-frontmatter spec document | All functional requirements & data schemas locked |
| **`TEST_PLAN`** | Verifier | Spec document | Automated test suite / assertion scripts | Test cases fail cleanly against unbuilt code (Red) |
| **`IMPLEMENT`** | Builder | Spec + Test suite | Feature code, refactors, migrations | Code compiles and passes all test assertions (Green) |
| **`VERIFY`** | Verifier | Code + Test suite | Audit verdict, regression check, lint output | All tests green, 0 regressions, security standards met |
| **`COMPLETE`** | Orchestrator | Verification verdict | Git commit, changelog entry | Clean working tree, documented state |

## Transition Rules

1. **`SPEC -> TEST_PLAN`**:
   - Requires: `spec.id`, `spec.inputs`, `spec.outputs`, `spec.invariants` explicitly defined.
   - Forbidden: Ambiguous or unquantified requirements.

2. **`TEST_PLAN -> IMPLEMENT`**:
   - Requires: Executable test files written and failing with expected assertions.
   - Forbidden: Mock-only assertions that do not exercise realistic interfaces.

3. **`IMPLEMENT -> VERIFY`**:
   - Requires: Implementation in place with local test runner execution passing.

4. **`VERIFY -> IMPLEMENT` (Feedback Loop)**:
   - Trigger: Test failure, edge case breach, boundary regression, or lint error.
   - Action: Builder updates code targeted strictly to failing assertions.

5. **`VERIFY -> COMPLETE`**:
   - Requires: 100% test pass rate, no regressions on existing test suites, audit verdict = `PASSED`.

