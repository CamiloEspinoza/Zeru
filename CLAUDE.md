# Zeru — Project Memory

## AI Cost Tracking (mandatory requirement)

Every AI model interaction MUST be tracked with a detailed usage log. This applies to ALL current and future AI features.

### Requirements

1. **Per-interaction logging**: Every API call to any AI provider must be recorded in the `AiUsageLog` database table with:
   - `provider` (OPENAI, GEMINI, etc.)
   - `model` used (e.g., gpt-5.4, text-embedding-3-small)
   - `inputTokens` and `outputTokens`
   - `conversationId` (when applicable)
   - `tenantId`
   - `feature` (e.g., "chat", "embedding", "image-generation", "title-generation")
   - Timestamp

2. **Cumulative tracking per conversation**: Show accumulated input/output tokens per conversation. If multiple providers/models are used, break down by provider+model (expandable detail in the UI).

3. **Token meter UI**: Visual gauge/meter component in the chat showing usage relative to the 272K pricing threshold for gpt-5.4.

4. **Context compaction**: Use OpenAI's `context_management` with `compact_threshold: 260000` to auto-compress context before hitting the 272K price tier.

5. **Cost analysis table**: API endpoint + UI page to query and analyze AI costs across conversations and features.

### Implementation notes

- OpenAI Responses API returns `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens` on each response
- With `previous_response_id`, `input_tokens` grows each turn (full history re-sent as input)
- Server-side compaction (`context_management: [{ type: "compaction", compact_threshold: 260000 }]`) auto-compresses when threshold is crossed
- `max_output_tokens: 16384` limits output per response to control costs
