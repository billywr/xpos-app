-- Std stock count inventory reconcile: distinct from session STOCKTAKE (Added today).
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'STD_STOCK_COUNT_RECONCILE';
