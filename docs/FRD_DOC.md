# XPOS -- Functional Requirements Document (FRD)

Version 1.0 Multi-Vertical Kenyan Point of Sale Platform

## 1. System Overview

XPOS is a centralized transactional system responsible for recording all
commercial activities of a business outlet. The system must operate even
when external payment integrations are unavailable and allow manual
capture of tender references such as M-Pesa codes and card slips. All
commercial activities must produce a verifiable audit trail and
financial ledger entry.

## 2. System Actors

-   System Administrator: configures businesses, branches, pricing, tax
    and policies.
-   Branch Manager: supervises staff, approvals, reporting and day
    close.
-   Cashier: performs sales and tender capture.
-   Waiter: opens tables, tabs and submits kitchen orders.
-   Kitchen/Bar Operator: prepares orders and updates ticket status.
-   Auditor: views logs and financial activity but cannot modify
    records.

## 3. Authentication and Identity Management

Users are authenticated through Keycloak. The POS backend must not store
passwords. Each request must contain a valid JWT access token. The
system shall extract user identity (iam_user_id) and permissions from
the token. Each action must be associated with a staff_user and recorded
in audit logs.

## 4. Sales Functional Requirements

A cashier shall create a new sale at a terminal. Items may be added via
barcode, search or menu interface. The system must calculate subtotal,
tax, service charge and discounts. A sale must support multiple tenders.
Manual payment references must be captured. Upon payment completion, a
receipt must be generated and sale status becomes COMPLETED. Voiding or
refunding a sale requires approval.

## 5. Inventory Management

The system shall maintain per-branch stock levels. Stock must be
affected by sales, waste, transfers and purchase receipts. Stock receipt
(GRN) must increase inventory quantities. Stock take sessions must
record counted quantities and calculate variance. The system shall
produce alerts for negative stock and low stock.

## 6. Shift and Cash Control

Cashiers must open a shift with opening float. The system must record
denomination counts. Cash movements (paid-in, paid-out) must be
recorded. During shift close, the cashier enters counted amount. System
calculates variance and requires manager approval if thresholds
exceeded. Blind close: expected amount must not be shown to cashier.

## 7. Audit & Financial Ledger

Every financial transaction must produce ledger entries using
double-entry accounting. Every event must produce an audit log record.
Audit vault records must be cryptographically hash-chained. Tampering
with historical data must be detectable.

## 8. Hospitality Features

Tables may be opened and associated with sales. Orders must generate
kitchen or bar tickets. Tickets progress through states: Pending,
Preparing, Ready.

## 9. Compliance (KRA eTIMS)

The system must submit completed sales to eTIMS VSCU. Receipts must
include fiscal QR code. If offline, submissions are queued and retried
automatically. Rejected invoices must be flagged for manager action.

## 10. Offline Operation

The terminal must continue selling without internet connectivity. Events
are stored in an outbox queue. Sales must sync before profile/config
changes. Duplicate prevention must be ensured via idempotency keys.

## 11. Reporting Requirements

Daily Z Report per branch. Sales by category, item and cashier. Tax
summaries. Stock valuation and consumption variance. Cash variance
reports.

## 12. High-Level Acceptance Criteria

-   Sale must not complete without tender covering total amount.
-   Receipt number must be unique per branch per day.
-   Every sale produces balanced debit and credit entries.
-   All changes are logged with actor and timestamp.
-   Shift close variance beyond threshold requires manager approval.
