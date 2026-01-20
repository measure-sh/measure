-- migrate:up
CREATE TABLE measure.team_billing (
    team_id UUID PRIMARY KEY REFERENCES measure.teams(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    usage_notified_threshold INT NOT NULL DEFAULT 0,
    usage_notified_cycle TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_billing_plan ON measure.team_billing(plan);
CREATE INDEX idx_team_billing_stripe_customer ON measure.team_billing(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE measure.team_billing IS 'Billing configuration per team';
COMMENT ON COLUMN measure.team_billing.team_id IS 'References the team this billing config belongs to';
COMMENT ON COLUMN measure.team_billing.plan IS 'free or pro';
COMMENT ON COLUMN measure.team_billing.usage_notified_threshold IS 'Last usage notification threshold sent to the team';
COMMENT ON COLUMN measure.team_billing.usage_notified_cycle IS 'Billing cycle for which the last usage notification was sent';
COMMENT ON COLUMN measure.team_billing.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN measure.team_billing.stripe_subscription_id IS 'Stripe subscription ID for billing';
COMMENT ON COLUMN measure.team_billing.created_at IS 'Timestamp when the billing config was created';
COMMENT ON COLUMN measure.team_billing.updated_at IS 'Timestamp when the billing config was last updated';

-- migrate:down
DROP TABLE measure.team_billing;