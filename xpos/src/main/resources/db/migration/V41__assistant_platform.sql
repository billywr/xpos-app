-- Assistant query audit trail (governance + explain-by-requestId)
CREATE TABLE assistant_query_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org (id),
    branch_id UUID REFERENCES branch (id),
    staff_user_id UUID REFERENCES staff_user (id),
    request_id VARCHAR(64) NOT NULL,
    intent VARCHAR(64) NOT NULL,
    message_preview VARCHAR(500),
    llm_used BOOLEAN NOT NULL DEFAULT false,
    llm_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_query_log_org_created ON assistant_query_log (org_id, created_at DESC);

CREATE UNIQUE INDEX uq_assistant_query_log_org_request ON assistant_query_log (org_id, request_id);

-- Proactive insight events (rule-based alerts)
CREATE TABLE insight_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org (id),
    branch_id UUID REFERENCES branch (id),
    insight_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data_json JSONB,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insight_event_org_branch_created ON insight_event (org_id, branch_id, created_at DESC);

CREATE INDEX idx_insight_event_unacked ON insight_event (org_id, branch_id)
    WHERE acknowledged_at IS NULL;
