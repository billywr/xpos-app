# Kenyan Multi-Vertical POS Platform -- Product Requirements Document (PRD)

Version 2.0 Date: 2026-02-25

## Executive Summary

The platform is a multi-tenant, multi-branch POS operating system
supporting retail and hospitality in a single product. It works with or
without integrated payments by treating tenders as auditable,
reconcilable events. It prevents losses through strong cash controls,
approval workflows, and a tamper-evident audit vault.

### Key Differentiators

-   Tamper-evident Audit Vault (hash chain)
-   Financial Sub-Ledger double-entry postings
-   Blind Shift Close and denomination counts
-   Offline-safe receipt numbering
-   Smart inventory and variance detection
-   Native Kenyan eTIMS compliance support

## Problem Statement and Goals

Observed problems: - Cash leakage - Stock leakage - Reporting distrust -
Operational inefficiency - Compliance burden

Goals: - Reduce cash and stock variance - Provide trustworthy
reporting - Run reliably offline - Support retail and hospitality
workflows - Enable compliance-ready receipting

## Core Modules

-   Admin Portal
-   POS Terminal App
-   KDS / Bar Screen
-   Identity + Device Control
-   Pricing Engine
-   Inventory Engine
-   Cash Control
-   Finance Sub-Ledger
-   Audit Vault
-   Offline Sync
-   Compliance
-   Analytics

## Core Workflows

### Retail Sale

1.  Scan items
2.  Calculate tax and service charges
3.  Capture tender references
4.  Print receipt
5.  Post stock consumption
6.  Post financial ledger
7.  Record audit vault event

### Restaurant Workflow

-   Open tables
-   Route tickets to kitchen/bar
-   Split bills
-   Capture payment
-   Generate audit logs

### Shift Control

-   Shift open with float
-   Record cash movements
-   Blind close counting
-   Manager approval
-   Ledger postings

### Purchasing

-   Create PO
-   Record GRN
-   Update stock
-   Audit record

### Refund/Void

-   Supervisor approval required
-   Reversal ledger entries created

## Data Integrity

### Sub-Ledger

Append-only ledger. Corrections through reversals only.

### Audit Vault

Hash-chained event storage. Tampering detectable.

## Offline Mode

-   Local outbox queue
-   Idempotency keys
-   Priority sync order

## Compliance (eTIMS)

-   Generate invoice payload
-   Retry failed submissions
-   Print QR fiscal receipt

## Reporting

-   Sales summary
-   Tax summary
-   Cash variance
-   Stock valuation
-   Fraud detection

## Security

-   RBAC permissions
-   Device binding
-   Encryption at rest
-   HTTPS transport

## Non-Functional Requirements

Performance: \<2s checkout median. API latency: \<200ms p95. Offline
safe multi-day operation. Scales to thousands of terminals.

## Rollout Plan

Phase 1: Core retail accountability Phase 2: Hospitality and smart
inventory Phase 3: Compliance and integrations

## Acceptance Criteria

-   Offline sales sync correctly
-   Blind shift close enforced
-   Refunds produce reversals
-   Audit vault detects tampering
-   eTIMS receipts contain QR code
