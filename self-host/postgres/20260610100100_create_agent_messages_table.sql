-- migrate:up
create table if not exists measure.agent_messages (
    id bigint generated always as identity primary key,
    conversation_id uuid not null references measure.agent_conversations(id) on delete cascade,
    role text not null,
    content jsonb not null,
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    reasoning_tokens integer,
    cache_read_tokens integer,
    cache_write_tokens integer,
    compacted_through bigint,
    created_at timestamptz not null default now()
);

comment on table measure.agent_messages is 'table storing query agent conversation transcripts in chat-completions message format';
comment on column measure.agent_messages.id is 'unique monotonic id for each message, used for ordering';
comment on column measure.agent_messages.conversation_id is 'id of the conversation this message belongs to';
comment on column measure.agent_messages.role is 'chat role of the message: user, assistant or tool';
comment on column measure.agent_messages.content is 'raw chat message object including any tool calls or tool results';
comment on column measure.agent_messages.model is 'model that produced this message, set on assistant rows only';
comment on column measure.agent_messages.prompt_tokens is 'prompt token usage of the llm call that produced this message, set on assistant rows only';
comment on column measure.agent_messages.completion_tokens is 'completion token usage of the llm call that produced this message, set on assistant rows only';
comment on column measure.agent_messages.reasoning_tokens is 'reasoning token usage (a subset of completion) of the llm call that produced this message, set on assistant rows only';
comment on column measure.agent_messages.cache_read_tokens is 'prompt tokens served from a cache read (cache hit) by the llm call that produced this message, set on assistant rows only';
comment on column measure.agent_messages.cache_write_tokens is 'prompt tokens written to the cache by the llm call that produced this message, set on assistant rows only';
comment on column measure.agent_messages.compacted_through is 'set on compaction summary rows only: id of the newest message this summary covers; messages up to it are kept stored but skipped when loading the conversation';
comment on column measure.agent_messages.created_at is 'utc timestamp at the time of message creation';

create index on measure.agent_messages(conversation_id, id);

-- migrate:down
drop table if exists measure.agent_messages;
