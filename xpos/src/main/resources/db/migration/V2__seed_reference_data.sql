-- Seed reference data (minimal)
INSERT INTO tender_type (org_id, code, name)
SELECT o.id, x.code, x.name
FROM org o
CROSS JOIN (VALUES
    ('CASH', 'Cash'),
    ('MPESA_MANUAL', 'M-Pesa (Manual)'),
    ('CARD_MANUAL', 'Card (Manual)'),
    ('BANK_TRANSFER', 'Bank Transfer'),
    ('VOUCHER', 'Voucher'),
    ('CREDIT', 'Customer Credit')
) AS x(code, name)
ON CONFLICT (org_id, code) DO NOTHING;
