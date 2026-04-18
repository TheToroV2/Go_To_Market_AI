# Section 3 – AI / LLM Architecture

> **Status**: To be completed.
> Outline below reflects planned structure.

## Provider Abstraction

### Interface / adapter pattern

<!-- Describe your TypeScript interface for LLM providers here -->
<!-- How do you make OpenAI and Anthropic swappable with zero upstream changes? -->

```typescript
// TODO: Add LLMProvider interface
// - complete() or generate() method signature
// - How structured output types are passed in
// - How errors are surfaced
```

### Handling API differences between providers

<!-- OpenAI uses `messages` with roles. Anthropic uses `messages` + `system` separately.
     How does your adapter layer normalise this? -->

### Provider configuration

<!-- env var, DB flag, or per-tenant setting? What are the trade-offs? -->

---

## Structured Outputs

### Extracting reliable JSON from LLM responses

<!-- Do you use function calling / tool use, JSON mode, or prompt engineering?
     Each has trade-offs — document them. -->

### Schema validation

<!-- How do you validate LLM output against an expected schema?
     What happens when a response doesn't conform? -->

---

## Error Handling & Fallbacks

### Primary provider timeout or malformed response

<!-- Retry same provider? Fall back to another? Fail the job? -->

### Hallucinated data that passes schema validation

<!-- This is a data integrity problem. How do you detect or mitigate it? -->

---

## Code Snippet

```typescript
// TODO: TypeScript interface or abstract class for LLM provider abstraction
// Must include:
// - complete() or generate() method
// - Structured output type parameter
// - Error surface
```

---

## Bonus: Multi-Agent Thinking

<!-- Optional. Describe orchestrator + specialist agent design:
     - Research agent
     - Scoring agent
     - Formatting agent
     How do they communicate? What orchestration layer do you use? -->
