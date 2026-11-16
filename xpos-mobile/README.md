# XPOS Mobile App

Production-grade React Native Expo mobile application for **Catalog**, **Standard Stock Count**, and **Debts & Expenses**.

Built specifically for store cashiers, stock-takers, and operators to audit stock and manage credit/expenses directly on mobile devices without opening a desktop browser.

---

## Features

### 1. Standard Stock Count (`Stock Count`)
- **High-Speed Counting Sheet**: Displays Opening, Added, Total Stock, Closing input, Implied Sold, and Revenue (KSH).
- **Fast Auto-Save on Blur (150ms)**: Auto-saves within 150ms when moving between items, with 2.5s typing debounce protection while typing.
- **Haptic Feedback**: Tactile phone vibrations on saves, settlements, and button presses.
- **Discrepancy Detection & Reconcile**: Reconcile on-hand inventory when closing counts mismatch.
- **Record Sales**: Direct POS sales generation from implied sales with line preview.
- **Integrated Barcode Scanner**: Scan items directly using the phone's camera to filter/jump to any product.

### 2. Catalog (`Catalog`)
- **Instant Search**: Search by name, SKU, or scanned barcode.
- **Category Filter Pills**: Quick horizontal scrolling category selector.
- **Product Cards**: Clear pricing, inventory tracking status, and active badges.
- **Barcode Management**: View all assigned barcodes and attach new barcodes via camera scanner.

### 3. Debts & Expenses (`Debts & Exp`)
- **Customer Debts**:
  - Total pending outstanding debt metric.
  - Track customer balance, status (Open, Partial, Closed), due date, and phone number.
  - Settle debt payment modal with remaining balance calculation.
  - Record new customer credit debt.
- **Store Expenses**:
  - Total expense expenditure metric.
  - Categorized expenses (Supplies, Utilities, Wages, Transport).
  - Incurred by, receipt reference, and timestamp audit trail.
  - Record new store expense.

### 4. Settings & Multi-Tenant Control (`Settings`)
- Switch Organization and Branch context.
- Configurable Spring Boot API and Keycloak IAM endpoints (supports LAN IP for physical device testing).
- Dark Theme & Light Theme toggle.
- Secure sign-out.

---

## Quick Start

### 1. Start Expo Development Server
```bash
cd xpos-mobile
npm start
```

### 2. Run on Device / Simulator
- **Android Device**: Install **Expo Go** from Google Play, scan the QR code.
- **iOS Device**: Install **Expo Go** from App Store, scan the QR code with camera.
- **Android Emulator**: Press `a` in terminal.
- **iOS Simulator**: Press `i` in terminal (macOS only).
- **Web Browser**: Press `w` in terminal.

---

## Configuration

When running on a physical phone, point the backend URL to your computer's local network IP:
- **API URL**: `http://<YOUR-LAN-IP>:9003` (e.g. `http://192.168.1.105:9003`)
- **Keycloak URL**: `http://<YOUR-LAN-IP>:8080` (e.g. `http://192.168.1.105:8080`)
*(Configure this in the gear icon on the login screen or in Settings).*
