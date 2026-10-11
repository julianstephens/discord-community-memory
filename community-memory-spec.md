# Community Memory

Development Specification · v0.1 · October 2026

## 1. Project Overview

Community Memory is an open-source, self-hostable Discord application that preserves, organizes, and retrieves useful knowledge from community conversations.

Discord is effective for conversation but poor at preserving institutional memory. Important decisions, explanations, recommendations, and resources disappear into message histories. Search retrieves matching messages, but it does not distinguish durable knowledge from incidental conversation.

Community Memory addresses this by creating a persistent, searchable knowledge layer over selected Discord channels.

The goal is not to replace Discord or build another chat application. It is to make existing conversations useful after they have ended.

### Product thesis

> A community should be able to remember what it has learned without requiring its members to maintain a separate knowledge base.
> The system should allow a member to ask:

- "What did we decide about hosting?"
- "Where was that article about early Christian monasticism?"
- "What resources have people recommended for learning Rust?"
- "Why did we choose PostgreSQL instead of MongoDB?"
  The initial release will support structured knowledge capture and keyword-based retrieval. Later releases can introduce semantic search, decision extraction, and conversational retrieval.

CORE WORKFLOW

Discord Conversations

Selected channels and manually saved messages

Ingestion & Processing

Normalize · Deduplicate · Apply changes

Persistent Community Memory

Knowledge records · Sources · Search index

Discord Search & Retrieval

Access checked · Ranked · Source linked

## 2. Project Goals

### Functional goals

1. Persist knowledge records associated with Discord messages.
2. Support explicit message saving through Discord interactions.
3. Optionally ingest new messages automatically from administrator-selected channels.
4. Search stored knowledge using full-text retrieval.
5. Preserve links to the originating Discord messages.
6. Respect Discord channel visibility and membership permissions.
7. Propagate message edits and deletions into stored records.
8. Allow administrators to configure retention and remove stored data.

### Engineering goals

This is intended to demonstrate senior-level backend engineering, particularly:

Domain

Demonstration

Event-driven architecture

Discord event ingestion and asynchronous processing

Data consistency

Idempotent handling of duplicated and reordered operations

Security

Tenant isolation, authorization, least privilege

Distributed systems

Durable jobs, retries, crash recovery

Data modeling

Canonical records and derived search projections

Operational maturity

Structured logging, metrics, health checks

Testing

Integration tests, fault injection, recovery scenarios

System evolution

Versioned events, database migrations, replaceable retrieval components

### Non-goals for v0.1

The first release will not include an LLM, automatic summarization, vector database, knowledge graph, public website, standalone user accounts, cross-server search, attachment downloads, voice transcription, or historical bulk import.

These features are intentionally excluded. The first engineering milestone is a reliable and secure memory system, not an AI chatbot.

## 3. Technology Stack

I recommend TypeScript for the initial release. Discord integration is strongest in the Node.js ecosystem, and sharing types across the gateway, application layer, and persistence layer reduces the initial development burden.

Component

Technology

Rationale

Runtime

Node.js 24 LTS

Stable server-side TypeScript ecosystem

Language

TypeScript, strict mode

Typed boundaries and domain models

Discord client

discord.js v14

Gateway, interactions, permissions

Database

PostgreSQL 17+

Transactional storage, JSONB, full-text indexing

SQL access

Kysely + pg

Explicit SQL, migrations, type-safe queries

Validation

Zod

Runtime validation at external boundaries

API

Fastify

Internal administration and health endpoints

Background processing

PostgreSQL-backed job queue

Durable jobs without another service

Logging

Pino

Structured logs and contextual metadata

Metrics

prom-client

Prometheus-compatible metrics

Tests

Vitest + Testcontainers

Unit and real database integration testing

Packaging

Docker + Compose

Reproducible local and self-hosted deployment

CI

GitHub Actions

Validation and release automation

Use a PostgreSQL queue implemented with `FOR UPDATE SKIP LOCKED` and explicit worker leases. For this project, that is worth implementing rather than immediately introducing Redis, RabbitMQ, or Kafka.

The queue should be a small, carefully bounded component, not a general-purpose workflow engine.

### Deployment model

A single repository produces three runnable processes:

- `bot`: Discord gateway connection, interactions, event normalization.
- `worker`: asynchronous persistence, reconciliation, and search projection updates.
- `api`: internal administration API, health checks, and metrics.
  All three share PostgreSQL. They may run in separate containers while sharing one application codebase.

v0.1 runs one bot gateway instance and one or more workers. Distributed gateway sharding is explicitly deferred.

## 4. Discord Integration

Discord is both the primary user interface and the source of community knowledge.

### 4.1 Supported commands

Save Message — Message context menu

A member right-clicks a message, selects Apps → Save Message, and the bot stores it as a knowledge record.

The response is ephemeral and includes the created record ID.

`/memory search query:<text>`

Searches accessible community knowledge.

Returns at most five results, each with an excerpt, source channel, date, and link to the original message. Responses are ephemeral.

`/memory add title:<text> content:<text> type:<type>`

Creates a manually authored knowledge record. The types are `note`, `decision`, and `resource`.

The record is scoped to the channel where the command is invoked.

`/memory remove id:<id>`

Removes a manually created record or the explicit saved status of a message. Only its creator or an administrator can use it.

If the source message belongs to an automatically indexed channel, removing its saved status does not remove it from that channel's ordinary search index.

`/memory status`

Shows whether memory is enabled, indexed channel count, ingestion health, and recent processing errors, without exposing private message contents.

`/memory config` — Administrator only

Subcommands: `enable`, `disable`, `channel-add`, `channel-remove`, `retention`, and `purge`.

Commands operate only in guild contexts. DMs and user-installed application contexts are unsupported.

### 4.2 Knowledge scopes

There are two sources of memory.

Explicit records

Created using the Save Message context action or `/memory add`.

Explicit records are intentionally curated. Saved messages reference their source rather than permanently preserving an unrelated copy. Manual records preserve the text supplied by their creator.

Automatically indexed messages

The bot processes messages from channels whose administrators explicitly enabled indexing.

Only new messages are indexed. Installing the application does not trigger an import of existing server history.

### 4.3 Message Content Intent

Automatic collection of ordinary message text generally requires Discord's privileged `MESSAGE_CONTENT` intent. Discord has exceptions, including message context-menu invocations. Applications requiring privileged access may need approval as they scale.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub
+1

Implement two operating modes:

Mode

Required intent

Capabilities

Manual

Nonprivileged intents

Save messages, add notes, search

Automatic

Message Content intent

All manual functionality plus selected-channel indexing

The application must remain useful in manual mode.

For automatic mode, request only the necessary gateway intents, initially `Guilds`, `GuildMessages`, and `MessageContent`. Do not request `GuildMembers` merely for convenience.

### 4.4 Discord permissions

For v0.1, support ordinary guild text channels only.

Exclude:

- DMs and group DMs
- Private and public threads
- Forum posts
- Voice and stage channels
- NSFW channels
  A future release can add threads with a complete membership-aware authorization model.

The bot should initially request `View Channel`, `Read Message History`, and `Send Messages`, plus only the additional permissions required for its interaction behavior.

The application must never require Discord Administrator permission.

## 5. System Architecture

Logical architecture. The bot receives events and interactions; canonical writes and search operations are mediated by the application services. PostgreSQL supplies transactional state and durable work.

### 5.1 Components

Bot Adapter

Responsible for Discord-specific operations: gateway connection, command registration, event conversion, interaction acknowledgments, and response formatting.

It must not contain SQL queries or business rules.

Event Inbox

A durable record of accepted external events.

The adapter normalizes a Discord event and commits it to PostgreSQL before treating it as accepted. Duplicate events are rejected using a domain-specific idempotency key.

Processing Worker

Consumes pending events, updates canonical records, maintains deletion state, and schedules reconciliation when source data is uncertain.

Memory Service

Implements domain operations such as saving a message, creating a note, deleting a record, searching memories, and changing channel configuration.

Search Repository

Executes full-text queries, applies database-level tenant and channel restrictions, and returns candidates for final authorization checks.

Admin API

Provides health, metrics, and future administrative integrations. Discord remains the user-facing control surface in v0.1.

### 5.2 Architecture constraints

1. Domain code must not import `discord.js`.
2. Gateway handlers must not directly modify knowledge records.
3. All persistent writes must be transactional.
4. Ingestion must tolerate at-least-once event delivery.
5. Search must never bypass authorization.
6. Projection indexes must be reconstructible from canonical database records.
7. External services must be accessed behind interfaces that can be substituted in tests.

## 6. Domain Model

The application distinguishes between source messages and knowledge records.

A message is an external entity managed by Discord. A knowledge record is an object managed by Community Memory.

This distinction permits manual knowledge entries, prevents repeated saves from duplicating content, and separates the lifecycle of a source message from its curated status.

### 6.1 Core entities

Entity

Responsibility

Guild

Tenant boundary and configuration

IndexedChannel

Opted-in ingestion scope

SourceMessage

Canonical representation of a Discord message

MemoryEntry

Explicitly saved message or authored knowledge

IngestionEvent

Durable external change event

ProcessingJob

Retryable worker operation

DeletionMarker

Prevents stale events restoring deleted content

All Discord snowflake IDs must be stored as decimal strings at application boundaries and as `TEXT` in the database. Never convert them to JavaScript `number`.

### 6.2 PostgreSQL schema

This is the target logical schema, with the essential constraints. Migration files should define the exact SQL.

```
CREATE TYPE memory_kind AS ENUM (
  'message', 'note', 'decision', 'resource'
);

CREATE TABLE guilds (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ingestion_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (ingestion_mode IN ('manual', 'automatic')),
  retention_days INTEGER
    CHECK (retention_days BETWEEN 1 AND 3650),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE indexed_channels (
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  channel_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE source_messages (
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,
  edited_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (guild_id, message_id)
);

CREATE INDEX source_messages_channel_idx
  ON source_messages (guild_id, channel_id);

CREATE TABLE memory_entries (
  id UUID PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  channel_id TEXT NOT NULL,
  source_message_id TEXT,
  kind memory_kind NOT NULL,
  title TEXT,
  content TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (
      kind = 'message'
      AND source_message_id IS NOT NULL
      AND content IS NULL
    )
    OR
    (
      kind <> 'message'
      AND source_message_id IS NULL
      AND content IS NOT NULL
    )
  ),
  FOREIGN KEY (guild_id, source_message_id)
    REFERENCES source_messages(guild_id, message_id)
);

CREATE UNIQUE INDEX one_saved_entry_per_message
  ON memory_entries(guild_id, source_message_id)
  WHERE source_message_id IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX memory_entries_channel_idx
  ON memory_entries(guild_id, channel_id);
```

`source_messages.content` is the canonical text representation, not the permanent search projection.

The schema must additionally include:

`ingestion_events`

`id`, `guild_id`, `event_kind`, `dedupe_key`, `payload JSONB`, `received_at`, `processed_at`, `attempt_count`, `last_error`.

The unique `dedupe_key` is required. Events must not be deduplicated only by message ID because a message can receive multiple edits.

`processing_jobs`

`id`, `job_type`, `payload JSONB`, `state`, `available_at`, `attempt_count`, `lease_owner`, `lease_until`, `last_error`, `created_at`.

States: `pending`, `running`, `completed`, `dead`.

`deletion_markers`

`guild_id`, `message_id`, `deleted_at`, `expires_at`.

Composite primary key: `(guild_id, message_id)`.

### 6.3 Search projection

Use a separate `search_documents` table:

```
CREATE TABLE search_documents (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id),
  channel_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, source_type, source_id)
);

CREATE INDEX search_documents_fts_idx
  ON search_documents USING GIN (search_vector);

CREATE INDEX search_documents_scope_idx
  ON search_documents(guild_id, channel_id);
```

Valid `source_type` values are `message` and `entry`.

Projection policy:

- Automatically indexed source messages have one search document.
- Explicitly saved messages use the same source document, not a duplicate.
- Manually authored notes, decisions, and resources have separate documents.
- Deletion of a source message removes its search document.
- Expiration removes the relevant canonical content and its projection.
- A repair job can regenerate the projection from all nondeleted canonical records.
  The search projection must never become the authoritative source of knowledge.

### 6.4 Source-message lifecycle

Deletion is terminal for a Discord message ID. Receiving an older create or edit event must never reactivate a deleted message.

### 6.5 Important data invariants

The implementation must enforce:

- A message ID belongs to exactly one guild within stored source records.
- A live explicitly saved message exists only once per guild.
- A manually authored record is associated with one guild and one channel.
- An inactive channel cannot accept new automatic ingestion.
- A deleted source message cannot appear in search.
- A deleted source message cannot be restored by a replayed event.
- A failed job cannot block processing unrelated jobs indefinitely.
- A query can never return documents belonging to another guild.
  Where practical, these invariants should be enforced through database constraints as well as application logic.

## 7. Event Ingestion and Consistency

This is the most important subsystem from an engineering standpoint.

The application must remain correct across gateway reconnects, duplicate deliveries, delayed workers, partial events, and process crashes.

### 7.1 Supported events

Discord event

Application operation

`MESSAGE_CREATE`

Insert or reconcile source message

`MESSAGE_UPDATE`

Reconcile message content

`MESSAGE_DELETE`

Tombstone message and remove searchable content

`MESSAGE_DELETE_BULK`

Apply deletion to each message

`CHANNEL_DELETE`

Purge corresponding channel records

`GUILD_DELETE`

Suspend ingestion; purge only when permanent removal is established

`INTERACTION_CREATE`

Execute an application command

Every gateway event is normalized into an internal event contract.

```
type MessageEvent =
  | {
      kind: "message.observed";
      guildId: string;
      channelId: string;
      messageId: string;
      eventId: string;
      observedAt: string;
    }
  | {
      kind: "message.deleted";
      guildId: string;
      messageId: string;
      eventId: string;
      observedAt: string;
    };

type IngestionEvent = {
  schemaVersion: 1;
  idempotencyKey: string;
  payload: MessageEvent;
};
```

For ordinary message updates, the worker should reconcile against Discord's current message state rather than blindly applying the content of an old gateway event.

The `eventId` is an internally generated ingestion identifier. Discord gateway dispatches do not provide globally unique event IDs suitable for this field. An observed event's deduplication key must therefore represent a deliberate operation identity, such as a snapshot revision; duplicate observations of one message may be safely coalesced because reconciliation fetches current state.

### 7.2 Processing algorithm

1. Receive gateway event.
2. Validate guild, channel type, and configured ingestion scope.
3. Normalize event and insert into the durable inbox.
4. Commit inbox transaction.
5. Worker claims pending work.
6. Worker resolves the current source state if necessary.
7. Worker performs canonical mutation and projection update in one database transaction.
8. Worker marks the event processed within that transaction.
9. Worker acknowledges completion.
   A database failure must never result in a successful processing acknowledgment.

A process crash between steps 4 and 8 must leave the event eligible for replay.

### 7.3 Message reconciliation

For create and update events:

```
reconcile(guildId, channelId, messageId):

  acquire per-message serialization lock

  if deletion marker exists:
      return

  if channel no longer eligible:
      return

  fetch current message from Discord

  if fetch returns 404:
      mark message deleted
      return

  if fetch fails transiently:
      schedule retry
      return

  if message belongs to wrong scope:
      reject

  upsert canonical message
  regenerate search projection
  commit
```

Important concurrency requirement: the per-message lock must cover the authoritative fetch and database write, or an equivalent generation/version protocol must be used.

Otherwise, two workers can fetch different revisions and commit in the wrong order.

Use PostgreSQL advisory locks keyed by a collision-resistant internal identifier, or serialize work through an explicit database row. If advisory lock keys are hashed, treat collisions as a performance concern, never as a correctness mechanism by themselves.

For v0.1, deliberately serialize all operations for the same message. Throughput is less important than correctness.

### 7.4 Deletion semantics

Deletion is an irreversible operation for the corresponding Discord message ID.

When a deletion event arrives:

1. Insert a deletion marker.
2. Mark the canonical source as deleted.
3. Clear the canonical message content.
4. Delete the search projection.
5. Remove or invalidate references from explicit saved-message entries.
6. Commit all changes atomically.
   Only retain metadata necessary for deduplication and recovery.

A delayed `MESSAGE_CREATE` or `MESSAGE_UPDATE` must not restore deleted content.

Deletion markers should be retained for the lifetime of the relevant guild configuration. If they are garbage-collected, the system must first guarantee that no old event or job can replay them. The safest v0.1 default is to retain content-free tombstones.

### 7.5 Reconciliation limitations

Gateway delivery alone cannot guarantee perfect synchronization after an extended outage.

Define a bounded repair mechanism:

- On reconnection, resume the gateway session when possible.
- When the session cannot be resumed, mark indexed channels as potentially stale.
- Reconcile a configurable recent window, initially the last 24 hours, through rate-limited Discord API requests.
- Compare fetched message IDs and current content against stored records within the successfully enumerated window.
- Recheck explicitly saved source messages separately.
- Record the reconciliation window, coverage, and outcome.
  Do not interpret a failed or incomplete API scan as evidence of deletion.

Messages older than the repair window may remain stale if Discord events were missed. Expose this limitation in `/memory status`. A future release can add full-history reconciliation.

### 7.6 Job processing

Use a PostgreSQL-backed queue with leasing.

A worker claims jobs through `FOR UPDATE SKIP LOCKED`. A claimed job has a lease expiration, after which another worker can reclaim it.

Default operational configuration:

Parameter

Default

Worker concurrency

4

Job lease

60 seconds

Retry limit

8

Backoff

Exponential with jitter

Initial retry delay

2 seconds

Maximum retry delay

15 minutes

Dead-letter retention

30 days, sanitized

Scheduled reconciliation

Every 6 hours

All values are application defaults, not Discord API limits.

Apply per-route REST throttling using discord.js's REST manager. Honor Discord's returned rate-limit metadata and `Retry-After` behavior rather than implementing an independent fixed requests-per-second assumption.

### 7.7 Outbox and transaction boundaries

If processing creates follow-up work, insert that job in the same database transaction as the originating state change.

For example:

```
transaction:
  update channel ingestion configuration
  insert channel reconciliation job
commit
```

Do not update configuration, commit, and then enqueue work in a separate operation. A crash between those actions would leave the state changed without the required job.

## 8. Search and Retrieval

### 8.1 Search contract

```
interface SearchRequest {
  guildId: string;
  requesterId: string;
  query: string;
  limit: number;
  channelId?: string;
}

interface SearchResult {
  id: string;
  kind: "message" | "note" | "decision" | "resource";
  title?: string;
  excerpt: string;
  channelId: string;
  sourceUrl?: string;
  createdAt: string;
  score: number;
}
```

The `guildId` and `requesterId` must come from the authenticated Discord interaction, not user-supplied command arguments.

### 8.2 Search algorithm

1. Validate the search request.
2. Resolve channels the requester may currently access.
3. Query PostgreSQL full-text search using those channels as an initial filter.
4. Rank candidates.
5. Fetch enough candidates to allow for permission-check failures.
6. Revalidate permissions and document eligibility before disclosure.
7. Return a maximum of five results.
   Use `websearch_to_tsquery` for user-entered queries and `ts_rank_cd` for ranking.

Example:

```
SELECT
  id,
  source_type,
  source_id,
  channel_id,
  ts_rank_cd(
    search_vector,
    websearch_to_tsquery('english', $3)
  ) AS score
FROM search_documents
WHERE guild_id = $1
  AND channel_id = ANY($2::text[])
  AND search_vector @@ websearch_to_tsquery('english', $3)
ORDER BY score DESC, updated_at DESC
LIMIT 30;
```

The caller provides only authorized candidate channel IDs.

The search service must then verify final permissions before returning document excerpts.

Use prepared queries, enforce a maximum query length of 256 characters, and impose a statement timeout.

### 8.3 Search ranking

For v0.1:

\[
S = R_{\text{text}} \cdot W_{\text{kind}} + B_{\text{saved}}
\]
Where:

- \(R_{\text{text}}\) is PostgreSQL full-text relevance.
- \(W_{\text{kind}}\) is a small weight based on record type.
- \(B_{\text{saved}}\) is a bonus for explicitly curated content.
  These weights must be configurable and covered by deterministic ranking tests.

Start with:

Record

Weight

Ordinary message

1.0

Saved message

1.3

Note

1.4

Resource

1.4

Decision

1.5

These are initial heuristics requiring evaluation, not empirically established values.

A saved-message bonus applies through an indexed curation flag or a join against active `memory_entries`.

### 8.4 Retrieval response

An example user-facing response:

Memory search

3 results

Query: "postgres database choice"

Decision: Use PostgreSQL

#architecture · Decision

PostgreSQL was chosen because the application needs transactional updates, reliable indexing, and straightforward deployment.

View original message ↗

Database discussion

#development · Saved message

Discussion comparing PostgreSQL with MongoDB for the first release...

View original message ↗

Migration plan

#architecture · Note

Initial migrations will be managed by Kysely, with application startup checking database compatibility.

Illustrative Discord response; all content is fictional. Real results must always come from stored, authorized records.
Never present a search result as a synthesized answer. The first release retrieves records, not conclusions.

## 9. Authorization and Tenant Isolation

This deserves independent treatment rather than being implemented as a final filter added to search.

### 9.1 Security model

The trust boundary is the Discord guild.

Every database query handling user data must be scoped by `guild_id`. Every returned document must additionally be authorized against the requester's current channel visibility.

An administrator of one guild has no administrative authority over another.

### 9.2 Permission resolution

Discord combines guild-level roles with channel-specific permission overwrites. The implementation must use Discord's permission semantics rather than assuming that the existence of a role grants access.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

For search authorization:

1. Fetch the requester's current guild membership, without relying solely on stale local caches.
2. Resolve current role information.
3. Resolve each candidate channel's current permission overwrites.
4. Use discord.js permission calculation.
5. Require effective `ViewChannel` and `ReadMessageHistory`.
6. Require the bot itself to retain access to the channel.
7. Reject missing or indeterminate permission state.
   Fetch failures should produce an explicit incomplete-search response, not silently broaden permissions.

Do not cache positive authorization decisions across independent search requests in v0.1. A short-lived cache scoped to one request is acceptable.

### 9.3 Permission changes

If a member loses access to a channel, their next search must not expose its stored contents.

For the first release, this is enforced through live authorization at retrieval time, not through the reliability of receiving role-change gateway events.

If authorization cannot be established, fail closed.

A security test must demonstrate that removing a role prevents access to previously indexed documents without requiring a reindex.

### 9.4 Disclosure boundaries

- All search responses are ephemeral.
- Search results are never posted automatically into public channels.
- Logs never contain message bodies or unredacted search queries.
- Error messages never reveal private channel names.
- The bot never sends stored knowledge from one guild to another.
- Administrative diagnostics contain operational metadata rather than indexed message content.

## 10. Data Retention and Privacy

The system stores community conversation data, so retention and deletion are central product behavior.

### 10.1 Consent and activation

On installation, the guild starts with memory disabled.

An administrator must explicitly enable memory before any message content is persisted.

Automatic ingestion requires a second explicit configuration action selecting individual channels.

The bot must provide a discoverable `/memory status` command explaining whether messages in the current channel are indexed.

### 10.2 Retention

Default policies:

Data

Retention

Ordinary automatically indexed messages

90 days

Explicit saved-message records

Until unsaved or source deleted

Manually created notes

Until removed

Deleted message content

Purged immediately upon observed deletion

Processing event payloads

7 days after successful processing

Failed-job metadata

30 days, without retained message text

Content-free tombstones

Retained while needed for replay safety

Saved messages are exempt from ordinary 90-day expiration, but remain subject to source deletion.

Retention jobs must use an explicit eligibility predicate, avoiding expiration of curated entries through an ordinary-message cleanup query.

### 10.3 Disable versus purge

`/memory config disable` stops new ingestion and search but leaves stored records intact for possible reactivation.

`/memory config channel-remove` stops indexing that channel. Existing ordinary indexed messages are purged; explicit entries originating in that channel are also purged by default.

`/memory config purge` permanently removes guild memory, configuration, and content-bearing event payloads, retaining only the minimum non-content metadata required for safe retry suppression.

Guild departure does not automatically imply deletion, because a temporary connection or permission loss can look similar to a permanent departure. Implement a configurable grace period before automatic purge, with an explicit administrative purge available when the bot is still installed.

### 10.4 Deletion guarantees

Deletion propagation must cover:

- Canonical records
- Search projections
- Explicit saved-message references
- Pending content-bearing jobs
- Event inbox payloads
- Temporary processing state
  The deletion operation should invalidate queued work before purging content. A retry must not reconstruct deleted content from an old job payload.

Operational limitation: immediate deletion applies to active application storage and search. PostgreSQL backups may retain older copies until backup expiration. Document backup retention and restoration-time deletion reconciliation. Do not claim that a normal database delete immediately erases all historical backups.

## 11. Application Interfaces

Define application-facing interfaces independent of Discord and PostgreSQL.

```
export interface MemoryService {
  saveMessage(input: SaveMessageInput): Promise<MemoryEntry>;
  createEntry(input: CreateEntryInput): Promise<MemoryEntry>;
  removeEntry(input: RemoveEntryInput): Promise<void>;
  search(input: SearchRequest): Promise<SearchResult[]>;
}

export interface MessageSource {
  fetchMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Promise<SourceMessage | null>;
}

export interface AuthorizationService {
  readableChannels(
    guildId: string,
    userId: string
  ): Promise<string[]>;

  canReadChannel(
    guildId: string,
    userId: string,
    channelId: string
  ): Promise<boolean>;
}

export interface IngestionService {
  accept(event: IngestionEvent): Promise<void>;
  reconcileMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Promise<void>;
  deleteMessage(
    guildId: string,
    messageId: string
  ): Promise<void>;
}
```

The bot adapter implements `MessageSource` and Discord authorization. Persistence adapters implement the repository interfaces.

### 11.1 Internal HTTP API

The initial HTTP API should be deliberately small.

Method

Endpoint

Purpose

GET

`/health/live`

Process liveness

GET

`/health/ready`

Database and dependency readiness

GET

`/metrics`

Prometheus metrics

GET

`/internal/guilds/:id/status`

Administrative diagnostics

POST

`/internal/jobs/reconcile`

Trigger bounded reconciliation

POST

`/internal/search/rebuild`

Rebuild search projections

This API is not a public user-facing API.

Bind it to an internal network interface. Protect operational endpoints using a service credential or equivalent internal authentication. Do not rely exclusively on obscure endpoint paths.

### 11.2 Discord interaction handling

Acknowledge potentially long-running interactions promptly using deferred ephemeral responses, then edit the response after processing.

In particular, search and save operations must not block the initial acknowledgment while waiting on database or Discord API calls.

All command handlers must:

- Validate the interaction context and arguments.
- Derive the acting user and guild from the interaction.
- Enforce permissions within the application service.
- Return stable error categories.
- Avoid leaking implementation details or stack traces.
  Recommended error types:

```
type MemoryErrorCode =
  | "GUILD_DISABLED"
  | "CHANNEL_NOT_SUPPORTED"
  | "CHANNEL_NOT_INDEXED"
  | "PERMISSION_DENIED"
  | "SOURCE_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "SOURCE_DELETED"
  | "SEARCH_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";
```

Map these to short, user-readable Discord responses.

## 12. Repository Structure

Use a pnpm monorepo with a small number of workspace packages.

```
community-memory/
├── apps/
│   ├── bot/
│   │   └── src/
│   │       ├── commands/
│   │       ├── events/
│   │       ├── adapters/
│   │       ├── client.ts
│   │       └── main.ts
│   ├── worker/
│   │   └── src/
│   │       ├── handlers/
│   │       ├── scheduler/
│   │       └── main.ts
│   └── api/
│       └── src/
│           ├── routes/
│           └── main.ts
├── packages/
│   ├── domain/
│   │   └── src/
│   │       ├── entities/
│   │       ├── errors/
│   │       ├── events/
│   │       └── ports/
│   ├── application/
│   │   └── src/
│   │       ├── memory/
│   │       ├── ingestion/
│   │       ├── search/
│   │       └── administration/
│   ├── persistence/
│   │   └── src/
│   │       ├── migrations/
│   │       ├── repositories/
│   │       ├── queue/
│   │       └── db.ts
│   └── shared/
│       └── src/
│           ├── config/
│           ├── logging/
│           └── telemetry/
├── tests/
│   ├── integration/
│   ├── contract/
│   └── fixtures/
├── deploy/
│   ├── Dockerfile.bot
│   ├── Dockerfile.worker
│   ├── Dockerfile.api
│   └── compose.yaml
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── security.md
│   ├── operations.md
│   └── adr/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

Dependency rules:

```
domain
  ↑
application
  ↑
bot / worker / api

persistence implements application ports
discord adapters implement application ports
```

The domain package must not depend on the persistence package or Discord SDK.

Avoid creating separate packages for every individual feature. Package boundaries should represent dependency direction or independently testable subsystems.

## 13. Observability

Operational visibility is a requirement for the first release.

### 13.1 Structured logs

Every log record should include relevant correlation fields:

```
{
  "level": "info",
  "service": "worker",
  "event": "message.reconciled",
  "guildId": "123456789",
  "messageId": "987654321",
  "jobId": "job-123",
  "durationMs": 42,
  "result": "success"
}
```

Use Pino with structured fields and explicit redaction.

Never log message content, Discord credentials, interaction tokens, or full event payloads containing user-authored text.

### 13.2 Metrics

Metric

Type

Purpose

`ingestion_events_total`

Counter

Accepted events by kind

`ingestion_failures_total`

Counter

Failed event processing

`queue_pending_jobs`

Gauge

Backlog size

`queue_oldest_job_age_seconds`

Gauge

Processing delay

`job_duration_seconds`

Histogram

Worker execution latency

`search_duration_seconds`

Histogram

Search response latency

`search_results_total`

Counter

Result counts

`authorization_denials_total`

Counter

Rejected access attempts

`discord_reconnects_total`

Counter

Gateway instability

`reconciliation_failures_total`

Counter

Source synchronization failures

Do not use guild IDs, message IDs, or query strings as Prometheus label values. They create high-cardinality metrics and unnecessary privacy exposure.

### 13.3 Operational objectives

Initial targets, to validate through testing:

- 99% of successfully received message events reach durable storage within 5 seconds.
- 95% of normal search requests complete within 2 seconds at the reference deployment scale.
- No unauthorized search results in the test suite.
- A worker crash never permanently loses an accepted event.
- Search projections can be reconstructed using canonical records.
- Deletion wins against every previously accepted observation of the same message.
  These are engineering acceptance targets, not production service-level guarantees.

## 14. Test Strategy

The test suite must verify behavior under failure, not just normal requests.

### 14.1 Unit tests

Cover:

- Message normalization
- Content validation
- Retention eligibility
- Idempotency-key construction
- State transitions
- Search ranking
- Application authorization requirements
- Job retry scheduling

### 14.2 Database integration tests

Run against PostgreSQL using Testcontainers.

Required scenarios:

Test

Expected outcome

Duplicate message observations

One canonical message

Duplicate save requests

One active saved-message entry

Concurrent worker claims

A job is leased to one worker

Worker crash before commit

Job is retried without partial writes

Worker crash after commit

Replayed processing is harmless

Edit followed by older observation

Current source content is retained

Delete followed by stale create

Message remains deleted

Search projection rebuild

Same eligible documents reproduced

Tenant-crossing query

No cross-guild results

Expired source message

Removed unless explicitly curated

### 14.3 Permission tests

Test Discord permission evaluation with fixtures representing:

1. Public channel accessible to everyone.
2. Channel denied to `@everyone`, granted to a role.
3. Member explicitly denied by channel overwrite.
4. Administrator access.
5. Member with multiple conflicting roles.
6. Role removed between two searches.
7. Bot loses access to a channel.
8. Member lookup fails.
9. Channel metadata cannot be retrieved.
   The default for all indeterminate permission cases is denial.

### 14.4 Fault injection tests

Implement deterministic tests for:

- Database disconnection during transaction commit.
- Discord REST returning 429.
- Discord REST returning 403.
- Discord REST returning 404.
- Gateway reconnection.
- Message deletion during reconciliation.
- Two workers processing different revisions of the same message.
- Worker lease expiration during a slow operation.
  A lease expiration must not permit an older worker to commit stale content. The message-level serialization mechanism must remain authoritative even when jobs are reclaimed.

### 14.5 End-to-end tests

Maintain a separate development Discord guild for actual integration testing.

Automate the database and service components in CI. Treat live Discord tests as a separate smoke-test suite using controlled test accounts and channels, since reproducing every gateway behavior in ordinary CI is neither necessary nor reliable.

## 15. Delivery Plan

Organize the project into six milestones. Each milestone should leave the repository in a working, testable state.

M1. Foundation

Establish the repository, dependency boundaries, database migrations, local deployment, and CI.

Deliverables: pnpm workspace, strict TypeScript, PostgreSQL container, Kysely, configuration validation, Pino, Vitest, health endpoint, migration runner, Docker builds.

Done when: A fresh clone can start the environment, run migrations, pass tests, and report readiness with one documented command.

M2. Manual Memory

Deliver the first usable Discord workflow without privileged message content access.

Deliverables: bot connection, command registration, Save Message, `/memory add`, `/memory remove`, guild configuration, explicit entries, source links.

Done when: Two members in a test guild can save and manage records, duplicates are handled, and all access is appropriately scoped.

M3. Search and Authorization

Make the stored knowledge retrievable.

Deliverables: PostgreSQL search projection, ranked retrieval, `/memory search`, authorization service, ephemeral result formatting, projection rebuild.

Done when: Search retrieves saved knowledge, enforces live channel permissions, and passes cross-guild isolation tests.

M4. Automatic Ingestion

Introduce event processing and selected-channel indexing.

Deliverables: Message Content mode, durable inbox, processing queue, workers, message reconciliation, edit propagation, deletion markers, retry policies.

Done when: Accepted message events survive crashes and retries, edits converge to current source content, and deleted messages cannot reappear.

M5. Recovery and Data Lifecycle

Address missed events and data removal.

Deliverables: reconnect reconciliation, bounded repair scans, retention jobs, guild purge, channel removal, stale-data indicators, deletion-safe queue cleanup.

Done when: The system recovers from simulated disconnection, respects retention, and passes deletion/replay safety tests.

M6. Production Hardening

Turn the working application into a credible open-source deployment.

Deliverables: metrics, operational documentation, deployment compose file, backups and restoration procedure, failure testing, performance benchmarks, CI releases.

Done when: A new operator can deploy, monitor, upgrade, restore, and troubleshoot the application using the published documentation.

### Recommended implementation order

M1 through M3 form the first vertical slice. At that point, Community Memory is already useful as a curated, searchable Discord knowledge repository.

M4 through M6 introduce the deeper distributed-systems problems.

This sequencing matters: building automatic ingestion before validating the knowledge and retrieval model risks constructing a sophisticated pipeline for a product nobody actually uses.

## 16. Critical Engineering Decisions

Create Architecture Decision Records (ADRs) for decisions that materially affect the design.

ADR

Decision

001

Modular monolith instead of microservices

002

PostgreSQL as database and durable queue

003

Canonical records separated from search projections

004

Reconciliation instead of gateway-event ordering assumptions

005

Deletion tombstones and replay safety

006

Live authorization at retrieval

007

Manual and automatic ingestion modes

008

Full-text search before semantic retrieval

Each ADR should document the problem, alternatives, decision, tradeoffs, and circumstances that would justify reconsideration.

One important design correction to keep in mind: a durable inbox does not make the Discord Gateway itself durable. Events can still be missed while the application is disconnected. The inbox guarantees recovery only after the event has successfully been written to PostgreSQL. Reconciliation handles some of the remaining gap, but cannot guarantee recovery of every missed event.

Likewise, the initial full-text search will not fully answer natural-language questions. It retrieves relevant records. Turning retrieved material into grounded answers is a later product capability.

Both limitations should be explicit in the README.

## 17. Performance and Reference Deployment

Use the following reference workload for initial benchmarks:

Dimension

Target

Guilds

25

Indexed channels per guild

10

Active stored messages

1,000,000

Average messages ingested

10/sec sustained

Ingestion bursts

100/sec

Concurrent search requests

20

Workers

2 processes × 4 concurrent jobs

Do not assume these targets will be achieved without measurement.

Measure:

- Ingestion-to-search visibility latency
- Search response latency by result count
- Database size per 100,000 messages
- Search index size
- Queue throughput
- Worker memory consumption
- Recovery time after sustained worker downtime
- Reconciliation time and Discord REST usage
  Document the workload generator and make benchmarks reproducible.

For v0.1, the deployment target is a single host running Docker Compose and PostgreSQL with persistent volumes.

Avoid introducing Kubernetes, Kafka, and Elasticsearch unless observed limitations justify them.

## 18. Definition of Done for v0.1

Release acceptance checklist

0 / 15

Application installs in a Discord guild and initializes with memory disabled
Administrators can enable memory and configure indexed channels
Members can save messages and author knowledge entries
Members can search records they are permitted to view
Search results provide a source link when one exists
Automatic ingestion processes selected channels only
Repeated or out-of-order observations do not corrupt canonical state
Edits update indexed content
Deleted messages cannot be recovered by stale jobs
Worker failure does not lose committed inbox events
Guilds cannot access one another's data
Retention and purge workflows remove eligible content
Database migrations and local deployment are documented
Integration, permission, and recovery tests pass
Metrics, logs, health checks, and operational documentation exist
Copy checklist

## 19. Future Roadmap

Do not implement these until v0.1 has been used by an actual community and its retrieval quality evaluated.

v0.2

Semantic Retrieval

Add embeddings and hybrid keyword/vector ranking using PostgreSQL with pgvector. Preserve the existing search interface and authorization contract.

v0.3

Knowledge Relationships

Connect related discussions, decisions, resources, and superseded conclusions. Introduce typed relationships and provenance-aware graph exploration.

v0.4

Grounded Answers

Add retrieval-augmented question answering with explicit citations, permission-safe context construction, and abstention when supporting evidence is insufficient.

v0.5

Community Knowledge Interface

Build a web UI for exploring historical decisions, reviewing stored resources, correcting knowledge records, and administering memory lifecycle policies.

## 20. Final Scope Assessment

This is a substantial senior-engineering project. Its strongest technical areas are correctness under asynchronous events, authorization over externally managed resources, and recoverable data processing.

There are also two risks worth managing.

The first is overengineering. Multiple deployable processes are reasonable because they have distinct operational responsibilities. Turning each domain operation into a separate service would add complexity without improving the first release.

The second is confusing message storage with community memory. Simply indexing all conversation history would create a better search bot, not necessarily a useful knowledge system. The distinction between automatically indexed messages and deliberately curated knowledge records must remain prominent.

I would treat M3, Search and Authorization, as the first product milestone and M5, Recovery and Data Lifecycle, as the critical engineering milestone. Together they demonstrate that the system is useful, secure, and resilient.

### Primary technical references

- [Discord Gateway and Intents](https://docs.discord.com/developers/events/gateway)
- [Discord Application Commands](https://docs.discord.com/developers/interactions/application-commands)
- [Discord Permission Model](https://docs.discord.com/developers/topics/permissions)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL SELECT and Row Locking](https://www.postgresql.org/docs/current/sql-select.html)
  The specification is intended to be implementation-ready at the architectural and milestone level. The first development task should be repository initialization and database migrations, with the precise event payloads and SQL migrations finalized as part of their respective milestones.
