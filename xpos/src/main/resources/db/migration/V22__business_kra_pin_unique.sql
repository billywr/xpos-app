-- KRA PIN is a national tax identifier; must be unique across all businesses
CREATE UNIQUE INDEX uq_business_kra_pin ON business (kra_pin) WHERE kra_pin IS NOT NULL;
