-- Kenyan Multi-Vertical POS (xpos) - Initial Schema
-- Notes:
-- 1) Append-only principles apply for audit_vault_record, ledger_entry, stock_movement, outbox_event.
-- 2) Use application/service layer to enforce "no edits after completion" for sales; DB constraints here are baseline.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Enums =====
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_common') THEN
        CREATE TYPE status_common AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
        CREATE TYPE sale_status AS ENUM ('OPEN', 'HELD', 'COMPLETED', 'VOIDED', 'REFUNDED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type') THEN
        CREATE TYPE item_type AS ENUM ('STOCK', 'MENU', 'SERVICE', 'ROOM_FEE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vat_category') THEN
        CREATE TYPE vat_category AS ENUM ('STANDARD', 'REDUCED', 'ZERO', 'EXEMPT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status') THEN
        CREATE TYPE shift_status AS ENUM ('OPEN', 'CLOSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'denom_stage') THEN
        CREATE TYPE denom_stage AS ENUM ('OPENING', 'CLOSING');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_movement_type') THEN
        CREATE TYPE cash_movement_type AS ENUM ('PAID_IN', 'PAID_OUT', 'PETTY_CASH', 'FLOAT_ADD');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
        CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST', 'WASTE', 'CONSUMPTION');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
        CREATE TYPE source_type AS ENUM ('SALE', 'GRN', 'TRANSFER', 'STOCKTAKE', 'PRODUCTION', 'SHIFT', 'CASH_MOVEMENT', 'REFUND');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_account_type') THEN
        CREATE TYPE ledger_account_type AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debit_credit') THEN
        CREATE TYPE debit_credit AS ENUM ('DEBIT', 'CREDIT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_type') THEN
        CREATE TYPE approval_type AS ENUM ('VOID', 'REFUND', 'DISCOUNT', 'ADJUSTMENT', 'PRICE_OVERRIDE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN
        CREATE TYPE ticket_type AS ENUM ('KITCHEN', 'BAR');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('PENDING', 'PREPARING', 'READY', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_status') THEN
        CREATE TYPE outbox_status AS ENUM ('PENDING', 'SENT', 'ACKED', 'FAILED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_close_status') THEN
        CREATE TYPE day_close_status AS ENUM ('OPEN', 'CLOSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'etims_status') THEN
        CREATE TYPE etims_status AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED');
    END IF;
END $$;

-- ===== Core tenant tables =====
CREATE TABLE IF NOT EXISTS org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    legal_name TEXT NOT NULL,
    kra_pin TEXT,
    logo_url TEXT,
    receipt_footer TEXT,
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_org_legal UNIQUE (org_id, legal_name)
);

CREATE TABLE IF NOT EXISTS tax_agency_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    vat_standard_rate NUMERIC(6,5) NOT NULL DEFAULT 0.16000,
    vat_reduced_rate NUMERIC(6,5) NOT NULL DEFAULT 0.08000,
    supports_etims BOOLEAN NOT NULL DEFAULT FALSE,
    etims_mapping_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_agency_org_name UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS receipt_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    template_json JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipt_template_org_name UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS branch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    business_id UUID NOT NULL REFERENCES business(id),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    currency TEXT NOT NULL DEFAULT 'KES',
    address_json JSONB,
    tax_agency_config_id UUID REFERENCES tax_agency_config(id),
    receipt_template_id UUID REFERENCES receipt_template(id),
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_org_business_name UNIQUE (org_id, business_id, name)
);

CREATE TABLE IF NOT EXISTS device_registration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    device_id TEXT NOT NULL,
    device_fingerprint TEXT,
    status status_common NOT NULL DEFAULT 'ACTIVE',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_device_org_device UNIQUE (org_id, device_id)
);

CREATE TABLE IF NOT EXISTS printer_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    config_json JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_printer_profile_org_name UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS terminal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_code TEXT NOT NULL,
    device_registration_id UUID REFERENCES device_registration(id),
    printer_profile_id UUID REFERENCES printer_profile(id),
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_terminal_org_branch_code UNIQUE (org_id, branch_id, terminal_code)
);

-- ===== Identity references (Keycloak-backed) =====
CREATE TABLE IF NOT EXISTS staff_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    iam_user_id TEXT NOT NULL,
    username TEXT,
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_user_org_iam UNIQUE (org_id, iam_user_id)
);

CREATE TABLE IF NOT EXISTS staff_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    display_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    employee_no TEXT,
    default_branch_id UUID REFERENCES branch(id),
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_profile_org_user UNIQUE (org_id, staff_user_id)
);

CREATE TABLE IF NOT EXISTS staff_branch_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_branch_assign UNIQUE (org_id, staff_user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS reason_code (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_reason_code_org_code UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS approval_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID REFERENCES branch(id),
    policy_code TEXT NOT NULL,
    threshold_value NUMERIC(18,2),
    requires_manager BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_approval_policy UNIQUE (org_id, branch_id, policy_code)
);

CREATE TABLE IF NOT EXISTS approval_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    approved_by_staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    requested_by_staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    approval_type approval_type NOT NULL,
    target_entity_type TEXT NOT NULL,
    target_entity_id UUID NOT NULL,
    reason_code_id UUID REFERENCES reason_code(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Tax profiles =====
CREATE TABLE IF NOT EXISTS tax_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    vat_category vat_category NOT NULL,
    service_charge_rate NUMERIC(6,5),
    levy_rate NUMERIC(6,5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_profile_org_name UNIQUE (org_id, name)
);

-- ===== Catalog =====
CREATE TABLE IF NOT EXISTS category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    parent_id UUID REFERENCES category(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_org_parent_name UNIQUE (org_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS uom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    symbol TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_uom_org_name UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sku TEXT,
    name TEXT NOT NULL,
    item_type item_type NOT NULL,
    category_id UUID REFERENCES category(id),
    base_uom_id UUID REFERENCES uom(id),
    tax_profile_id UUID REFERENCES tax_profile(id),
    track_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_item_org_sku UNIQUE (org_id, sku)
);

CREATE TABLE IF NOT EXISTS item_barcode (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    item_id UUID NOT NULL REFERENCES item(id),
    barcode TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_barcode_org_code UNIQUE (org_id, barcode)
);

CREATE TABLE IF NOT EXISTS item_uom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    item_id UUID NOT NULL REFERENCES item(id),
    uom_id UUID NOT NULL REFERENCES uom(id),
    conversion_to_base NUMERIC(18,6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_item_uom UNIQUE (org_id, item_id, uom_id)
);

CREATE TABLE IF NOT EXISTS modifier_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    min_select INT NOT NULL DEFAULT 0,
    max_select INT NOT NULL DEFAULT 1,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_modifier_group_org_name UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS modifier_option (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    modifier_group_id UUID NOT NULL REFERENCES modifier_group(id),
    name TEXT NOT NULL,
    price_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
    item_id UUID REFERENCES item(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_modifier_option UNIQUE (org_id, modifier_group_id, name)
);

CREATE TABLE IF NOT EXISTS item_modifier_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    item_id UUID NOT NULL REFERENCES item(id),
    modifier_group_id UUID NOT NULL REFERENCES modifier_group(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_item_modifier_group UNIQUE (org_id, item_id, modifier_group_id)
);

-- ===== Pricing =====
CREATE TABLE IF NOT EXISTS price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID REFERENCES branch(id),
    channel TEXT,
    name TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_list UNIQUE (org_id, branch_id, channel, name)
);

CREATE TABLE IF NOT EXISTS price_list_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    price_list_id UUID NOT NULL REFERENCES price_list(id),
    item_id UUID NOT NULL REFERENCES item(id),
    price NUMERIC(18,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_list_item UNIQUE (org_id, price_list_id, item_id)
);

CREATE TABLE IF NOT EXISTS price_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    name TEXT NOT NULL,
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    days_of_week INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_schedule UNIQUE (org_id, branch_id, name)
);

CREATE TABLE IF NOT EXISTS scheduled_price (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    price_schedule_id UUID NOT NULL REFERENCES price_schedule(id),
    item_id UUID NOT NULL REFERENCES item(id),
    price NUMERIC(18,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheduled_price UNIQUE (org_id, price_schedule_id, item_id)
);

CREATE TABLE IF NOT EXISTS promotion_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID REFERENCES branch(id),
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    conditions_json JSONB NOT NULL,
    actions_json JSONB NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Customers (optional) =====
CREATE TABLE IF NOT EXISTS customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Shift / Cash control =====
CREATE TABLE IF NOT EXISTS shift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    status shift_status NOT NULL DEFAULT 'OPEN',
    opening_float_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    closing_counted_amount NUMERIC(18,2),
    expected_cash_amount NUMERIC(18,2),
    variance_amount NUMERIC(18,2),
    closed_by_manager_id UUID REFERENCES staff_user(id),
    variance_reason_code_id UUID REFERENCES reason_code(id)
);

CREATE TABLE IF NOT EXISTS shift_denomination_count (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    shift_id UUID NOT NULL REFERENCES shift(id),
    stage denom_stage NOT NULL,
    denomination_value INT NOT NULL,
    count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shift_denom UNIQUE (org_id, shift_id, stage, denomination_value)
);

CREATE TABLE IF NOT EXISTS cash_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    shift_id UUID NOT NULL REFERENCES shift(id),
    type cash_movement_type NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reason_code_id UUID REFERENCES reason_code(id),
    approved_by UUID REFERENCES staff_user(id),
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS no_sale_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    shift_id UUID NOT NULL REFERENCES shift(id),
    staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Receipt sequencing =====
CREATE TABLE IF NOT EXISTS receipt_sequence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID REFERENCES terminal(id),
    business_date DATE NOT NULL,
    next_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipt_seq UNIQUE (org_id, branch_id, terminal_id, business_date)
);

CREATE TABLE IF NOT EXISTS receipt_block_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    business_date DATE NOT NULL,
    start_number BIGINT NOT NULL,
    end_number BIGINT NOT NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipt_block UNIQUE (org_id, branch_id, terminal_id, business_date, start_number, end_number)
);

CREATE TABLE IF NOT EXISTS receipt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    business_date DATE NOT NULL,
    receipt_number BIGINT NOT NULL,
    printed_at TIMESTAMPTZ,
    reprint_count INT NOT NULL DEFAULT 0,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipt_number UNIQUE (org_id, branch_id, business_date, terminal_id, receipt_number)
);

-- ===== Sales =====
CREATE TABLE IF NOT EXISTS sale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    shift_id UUID REFERENCES shift(id),
    status sale_status NOT NULL DEFAULT 'OPEN',
    receipt_id UUID REFERENCES receipt(id),
    customer_id UUID REFERENCES customer(id),
    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    service_charge_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    total NUMERIC(18,2) NOT NULL DEFAULT 0,
    pricing_context_json JSONB,
    created_by_staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sale_org_branch_created ON sale(org_id, branch_id, created_at);

CREATE TABLE IF NOT EXISTS sale_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    item_id UUID NOT NULL REFERENCES item(id),
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    unit_price NUMERIC(18,2) NOT NULL,
    line_subtotal NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    routing TEXT,
    seat_no INT,
    course TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_line_sale ON sale_line(org_id, sale_id);

CREATE TABLE IF NOT EXISTS sale_line_modifier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sale_line_id UUID NOT NULL REFERENCES sale_line(id),
    modifier_option_id UUID NOT NULL REFERENCES modifier_option(id),
    qty NUMERIC(18,3) NOT NULL DEFAULT 1,
    price_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_tax_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    tax_profile_id UUID REFERENCES tax_profile(id),
    tax_rate NUMERIC(6,5) NOT NULL,
    tax_amount NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_discount_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    promotion_rule_id UUID REFERENCES promotion_rule(id),
    discount_type TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    approved_by UUID REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Tenders =====
CREATE TABLE IF NOT EXISTS tender_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tender_type UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS tender (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    tender_type_id UUID NOT NULL REFERENCES tender_type(id),
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    captured_by_staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    tender_id UUID NOT NULL REFERENCES tender(id),
    reference_type TEXT NOT NULL,
    reference_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional duplicate detection; enable only if your references are reliably unique:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_ref ON payment_reference(org_id, reference_type, reference_value);

-- ===== Hospitality =====
CREATE TABLE IF NOT EXISTS table_area (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_table_area UNIQUE (org_id, branch_id, name)
);

CREATE TABLE IF NOT EXISTS table_entity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    table_area_id UUID REFERENCES table_area(id),
    name TEXT NOT NULL,
    capacity INT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_table UNIQUE (org_id, branch_id, name)
);

CREATE TABLE IF NOT EXISTS tab (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    opened_by UUID NOT NULL REFERENCES staff_user(id),
    status TEXT NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tab_sale_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    tab_id UUID NOT NULL REFERENCES tab(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tab_sale UNIQUE (org_id, tab_id, sale_id)
);

CREATE TABLE IF NOT EXISTS order_ticket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    ticket_type ticket_type NOT NULL,
    status ticket_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_ticket_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    order_ticket_id UUID NOT NULL REFERENCES order_ticket(id),
    sale_line_id UUID NOT NULL REFERENCES sale_line(id),
    status ticket_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Inventory =====
CREATE TABLE IF NOT EXISTS supplier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_supplier UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS purchase_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    supplier_id UUID NOT NULL REFERENCES supplier(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_order(id),
    item_id UUID NOT NULL REFERENCES item(id),
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    expected_unit_cost NUMERIC(18,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_receipt_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    supplier_id UUID NOT NULL REFERENCES supplier(id),
    purchase_order_id UUID REFERENCES purchase_order(id),
    received_by UUID NOT NULL REFERENCES staff_user(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grn_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    grn_id UUID NOT NULL REFERENCES goods_receipt_note(id),
    item_id UUID NOT NULL REFERENCES item(id),
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    received_unit_cost NUMERIC(18,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    item_id UUID NOT NULL REFERENCES item(id),
    on_hand_qty NUMERIC(18,3) NOT NULL DEFAULT 0,
    reserved_qty NUMERIC(18,3) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(18,3),
    reorder_qty NUMERIC(18,3),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventory_item UNIQUE (org_id, branch_id, item_id)
);

CREATE TABLE IF NOT EXISTS stock_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    item_id UUID NOT NULL REFERENCES item(id),
    movement_type movement_type NOT NULL,
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    unit_cost NUMERIC(18,2),
    source_type source_type NOT NULL,
    source_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason_code_id UUID REFERENCES reason_code(id),
    approved_by UUID REFERENCES staff_user(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_movement_item_time ON stock_movement(org_id, branch_id, item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movement_source ON stock_movement(org_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS stock_count_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    status TEXT NOT NULL DEFAULT 'OPEN',
    started_by UUID NOT NULL REFERENCES staff_user(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_count_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    session_id UUID NOT NULL REFERENCES stock_count_session(id),
    item_id UUID NOT NULL REFERENCES item(id),
    counted_qty NUMERIC(18,3) NOT NULL,
    system_qty NUMERIC(18,3) NOT NULL,
    variance_qty NUMERIC(18,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    from_branch_id UUID NOT NULL REFERENCES branch(id),
    to_branch_id UUID NOT NULL REFERENCES branch(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_order_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    transfer_order_id UUID NOT NULL REFERENCES transfer_order(id),
    item_id UUID NOT NULL REFERENCES item(id),
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Recipes / BOM =====
CREATE TABLE IF NOT EXISTS recipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    menu_item_id UUID NOT NULL REFERENCES item(id),
    yield_qty NUMERIC(18,3) NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recipe UNIQUE (org_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS recipe_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    recipe_id UUID NOT NULL REFERENCES recipe(id),
    ingredient_item_id UUID NOT NULL REFERENCES item(id),
    qty NUMERIC(18,3) NOT NULL,
    uom_id UUID REFERENCES uom(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theoretical_consumption_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    business_date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES item(id),
    theoretical_qty NUMERIC(18,3) NOT NULL,
    actual_qty NUMERIC(18,3) NOT NULL,
    variance_qty NUMERIC(18,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_theoretical_snapshot UNIQUE (org_id, branch_id, business_date, item_id)
);

-- ===== Ledger (double-entry) =====
CREATE TABLE IF NOT EXISTS ledger_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type ledger_account_type NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ledger_account UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS ledger_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    business_date DATE NOT NULL,
    source_type source_type NOT NULL,
    source_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES ledger_account(id),
    direction debit_credit NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_branch_date ON ledger_entry(org_id, branch_id, business_date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entry(org_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_date ON ledger_entry(org_id, account_id, business_date);

CREATE TABLE IF NOT EXISTS posting_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    event_type TEXT NOT NULL,
    debit_account_code TEXT NOT NULL,
    credit_account_code TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_posting_rule UNIQUE (org_id, event_type)
);

-- ===== Day close / Z report =====
CREATE TABLE IF NOT EXISTS day_close (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    business_date DATE NOT NULL,
    status day_close_status NOT NULL DEFAULT 'OPEN',
    closed_by UUID REFERENCES staff_user(id),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_day_close UNIQUE (org_id, branch_id, business_date)
);

CREATE TABLE IF NOT EXISTS z_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    business_date DATE NOT NULL,
    sales_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    cash_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    mpesa_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    card_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hash_snapshot TEXT,
    CONSTRAINT uq_z_report UNIQUE (org_id, branch_id, business_date)
);

-- ===== Audit log + tamper-evident vault =====
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID REFERENCES branch(id),
    terminal_id UUID REFERENCES terminal(id),
    actor_staff_user_id UUID REFERENCES staff_user(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    before_json JSONB,
    after_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_branch_time ON audit_log(org_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(org_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS audit_vault_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID REFERENCES terminal(id),
    event_type TEXT NOT NULL,
    event_id UUID NOT NULL,
    payload_hash TEXT NOT NULL,
    previous_hash TEXT,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_vault_time ON audit_vault_record(org_id, branch_id, created_at);

-- ===== Offline outbox =====
CREATE TABLE IF NOT EXISTS outbox_event (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES org(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    status outbox_status NOT NULL DEFAULT 'PENDING',
    CONSTRAINT uq_outbox_idem UNIQUE (org_id, terminal_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS sync_priority_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    event_id UUID NOT NULL REFERENCES outbox_event(id),
    priority INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== eTIMS optional =====
CREATE TABLE IF NOT EXISTS vscu_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    config_json JSONB NOT NULL,
    status status_common NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vscu UNIQUE (org_id, branch_id)
);

CREATE TABLE IF NOT EXISTS etims_invoice_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    submission_status etims_status NOT NULL DEFAULT 'PENDING',
    fiscal_code TEXT,
    qr_payload TEXT,
    submitted_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_etims_sale UNIQUE (org_id, sale_id)
);
