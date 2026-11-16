# Stock Taking – Implementation Guide

Daily/weekly automatic and manual stock taking for XPOS. Aligned with retail industry standards
(cycle counts, scheduled counts, variance adjustment, operator floor counts).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STOCK TAKING FLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  MANUAL (operator / admin)              AUTOMATIC (scheduler)                 │
│  ┌──────────────────────┐              ┌──────────────────────┐              │
│  │ POST /stock-count-    │              │ StockTakingScheduler │              │
│  │ sessions (operator)   │              │ cron: every minute   │              │
│  │ or admin start        │              └──────────┬───────────┘              │
│  └──────────┬───────────┘                           │                         │
│             │                                       │                         │
│             │     ┌─────────────────────────────────┘                         │
│             │     │                                                           │
│             ▼     ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              StockCountSessionService                                  │   │
│  │  start() | startScheduled() | addLine() | close()                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │ StockCountSession     │    │ StockCountLine        │                      │
│  │ (OPEN → CLOSED)       │───▶│ countedQty, systemQty,│                      │
│  │ source: MANUAL|       │    │ varianceQty           │                      │
│  │         SCHEDULED     │    └──────────┬─────────────┘                      │
│  └──────────────────────┘               │                                    │
│                                          ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ close(): StockMovement (ADJUST, STOCKTAKE) + InventoryItemService     │   │
│  │          .applyStockTakeVariance()                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  SCHEDULES (admin)                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ StockTakingSchedule (one per branch)                                   │   │
│  │ frequency: DAILY | WEEKLY  dayOfWeek: 0-6 (0=Sun)  scheduledHour/Min  │   │
│  │ lastRunAt: idempotency (one run per period)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  POST .../trigger → run schedule now (manual trigger)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Role    | Path                                   | Purpose                          |
|---------|----------------------------------------|----------------------------------|
| Admin   | `GET/POST/PUT/DELETE stock-taking-schedules` | Create, list, update, delete schedules |
| Admin   | `POST stock-taking-schedules/{id}/trigger`   | Run schedule now                  |
| Admin   | `POST/GET stock-count-sessions` (branchId)   | Start, list, add line, close      |
| Operator| `POST/GET .../branches/{branchId}/stock-count-sessions` | Manual stock take at branch |

---

## Industry Standards Applied

- **Cycle counts:** DAILY or WEEKLY per branch; configurable hour/minute.
- **Idempotency:** `last_run_at` prevents duplicate sessions when cron fires multiple times.
- **Manual trigger:** Admin can run a scheduled count immediately without waiting.
- **Operator counts:** Floor staff perform manual counts at their branch (industry norm).
- **Variance handling:** On close, `StockMovement` ADJUST + `InventoryItem` delta; audit trail preserved.
- **Variance display:** Each line shows countedQty, systemQty, varianceQty.

---

## Configuration

- `xpos.stock-taking.cron`: Cron for scheduler (default: `0 * * * * ?` = every minute).
- `xpos.stock-taking.timezone`: Timezone for schedule matching (default: `Africa/Nairobi`).

---

## Database (Flyway)

- `stock_taking_schedule`: frequency, day_of_week, scheduled_hour/minute, is_active, last_run_at.
- `stock_count_session`: source_type (MANUAL|SCHEDULED), schedule_id, closed_by.
- `stock_count_line`: counted_qty, system_qty, variance_qty.
