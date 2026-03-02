package com.blinc.xpos.common.error;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Maps database constraint names to safe, user-facing messages.
 *
 * <p>These messages are returned to POS clients (web/mobile) and should be clear and actionable.
 * Avoid leaking internal table/column details unless it helps the user resolve the issue.
 */
public class ConstraintMessageCatalog {

  private static final Map<String, String> DEFAULT_MESSAGES = createDefaultMessages();

  private final Map<String, String> messagesByConstraint;

  public ConstraintMessageCatalog() {
    this(DEFAULT_MESSAGES);
  }

  public ConstraintMessageCatalog(Map<String, String> messagesByConstraint) {
    this.messagesByConstraint = Map.copyOf(messagesByConstraint);
  }

  public String messageFor(String constraintName) {
    if (constraintName == null || constraintName.isBlank()) {
      return null;
    }
    return this.messagesByConstraint.get(constraintName);
  }

  private static Map<String, String> createDefaultMessages() {
    Map<String, String> m = new HashMap<>();
    addUniqueConstraintMessages(m);
    addForeignKeyMessagesPart1(m);
    addForeignKeyMessagesPart2(m);
    addForeignKeyMessagesPart3(m);
    addForeignKeyMessagesPart4(m);
    return Collections.unmodifiableMap(m);
  }

  private static void addUniqueConstraintMessages(Map<String, String> m) {
    m.put(
        "uq_approval_policy",
        "An approval policy with this key already exists in this organization.");
    m.put(
        "uq_audit_vault_chain_hash",
        "This audit record hash already exists. Audit records must be unique.");
    m.put("uq_audit_vault_event", "This audit event is already recorded for this branch.");
    m.put("uq_barcode_org_code", "This barcode is already assigned in this organization.");
    m.put(
        "uq_branch_org_business_name", "A branch with this name already exists for this business.");
    m.put(
        "uq_business_org_legal",
        "A business with this legal name already exists in this organization.");
    m.put(
        "uq_category_org_parent_name",
        "A category with this name already exists under the same parent category.");
    m.put("uq_day_close", "A day close record already exists for this branch and business date.");
    m.put("uq_device_org_device", "This device is already registered in this organization.");
    m.put("uq_etims_sale", "This sale is already linked to an eTIMS submission record.");
    m.put(
        "uq_inventory_item",
        "An inventory item record already exists for this item in this branch.");
    m.put("uq_item_modifier_group", "This modifier group is already linked to this item.");
    m.put("uq_item_org_sku", "An item with this SKU already exists in this organization.");
    m.put("uq_item_uom", "This item already has this unit of measure configured.");
    m.put(
        "uq_ledger_account",
        "A ledger account with this code already exists in this organization.");
    m.put(
        "uq_modifier_group_org_name",
        "A modifier group with this name already exists in this organization.");
    m.put(
        "uq_modifier_option",
        "A modifier option with this name already exists in this modifier group.");
    m.put("uq_outbox_idem", "This operation has already been processed.");
    m.put("uq_org_name", "An organization with this name already exists.");
    m.put("uq_posting_rule", "A posting rule with this code already exists in this organization.");
    m.put("uq_price_list", "A price list with this name already exists in this organization.");
    m.put("uq_price_list_item", "This item already has a price in this price list.");
    m.put(
        "uq_price_schedule",
        "A price schedule with this name already exists in this organization.");
    m.put(
        "uq_printer_profile_org_name",
        "A printer profile with this name already exists in this organization.");
    m.put(
        "uq_reason_code_org_code",
        "A reason code with this code already exists in this organization.");
    m.put("uq_receipt_block", "This receipt number range is already allocated.");
    m.put(
        "uq_receipt_number",
        "This receipt number already exists. Please retry the sale to get a new receipt number.");
    m.put("uq_receipt_seq", "A receipt sequence already exists for this terminal.");
    m.put(
        "uq_receipt_template_org_name",
        "A receipt template with this name already exists in this organization.");
    m.put("uq_recipe", "A recipe with this name already exists in this organization.");
    m.put(
        "uq_sale_org_receipt",
        "This receipt is already linked to another sale in this organization.");
    m.put("uq_scheduled_price", "A scheduled price already exists for this item in this schedule.");
    m.put("uq_shift_denom", "A denomination count already exists for this shift and tender type.");
    m.put("uq_staff_branch_assign", "This staff user is already assigned to this branch.");
    m.put(
        "uq_staff_profile_org_user",
        "A staff profile already exists for this staff user in this organization.");
    m.put(
        "uq_staff_user_org_iam",
        "A staff user with this IAM user id already exists in this organization.");
    m.put("uq_supplier", "A supplier with this name already exists in this organization.");
    m.put("uq_tab_sale", "This sale is already linked to a tab.");
    m.put("uq_table", "A table with this name already exists in this branch.");
    m.put("uq_table_area", "A table area with this name already exists in this branch.");
    m.put(
        "uq_tax_agency_org_name",
        "A tax agency with this name already exists in this organization.");
    m.put(
        "uq_tax_profile_org_name",
        "A tax profile with this name already exists in this organization.");
    m.put("uq_tender_type", "A tender type with this code already exists in this organization.");
    m.put(
        "uq_terminal_org_branch_code", "A terminal with this code already exists in this branch.");
    m.put(
        "uq_theoretical_snapshot",
        "A theoretical inventory snapshot already exists for this branch and business date.");
    m.put(
        "uq_uom_org_name", "A unit of measure with this name already exists in this organization.");
    m.put("uq_vscu", "This VSCU record already exists.");
    m.put("uq_z_report", "A Z-report already exists for this branch and business date.");
  }

  private static void addForeignKeyMessagesPart1(Map<String, String> m) {
    m.put("approval_event_approved_by_staff_user_id_fkey", "Staff user not found.");
    m.put("approval_event_branch_id_fkey", "Branch not found.");
    m.put("approval_event_org_id_fkey", "Organization not found.");
    m.put("approval_event_reason_code_id_fkey", "Invalid reason code: reason code not found.");
    m.put("approval_event_requested_by_staff_user_id_fkey", "Staff user not found.");
    m.put("approval_policy_branch_id_fkey", "Branch not found.");
    m.put("approval_policy_org_id_fkey", "Organization not found.");
    m.put("audit_log_actor_staff_user_id_fkey", "Staff user not found.");
    m.put("audit_log_branch_id_fkey", "Branch not found.");
    m.put("audit_log_org_id_fkey", "Organization not found.");
    m.put("audit_log_terminal_id_fkey", "Terminal not found.");
    m.put("audit_vault_record_branch_id_fkey", "Branch not found.");
    m.put("audit_vault_record_org_id_fkey", "Organization not found.");
    m.put("audit_vault_record_terminal_id_fkey", "Terminal not found.");
    m.put("branch_business_id_fkey", "Business not found.");
    m.put("branch_org_id_fkey", "Organization not found.");
    m.put(
        "branch_receipt_template_id_fkey", "Invalid receipt template: receipt template not found.");
    m.put(
        "branch_tax_agency_config_id_fkey",
        "Invalid tax agency config: tax agency config not found.");
    m.put("business_org_id_fkey", "Organization not found.");
    m.put("cash_movement_approved_by_fkey", "Invalid approved by: staff user not found.");
    m.put("cash_movement_branch_id_fkey", "Branch not found.");
    m.put("cash_movement_created_by_fkey", "Invalid created by: staff user not found.");
    m.put("cash_movement_org_id_fkey", "Organization not found.");
    m.put("cash_movement_reason_code_id_fkey", "Invalid reason code: reason code not found.");
    m.put("cash_movement_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("cash_movement_terminal_id_fkey", "Terminal not found.");
    m.put("category_org_id_fkey", "Organization not found.");
    m.put("category_parent_id_fkey", "Invalid parent: category not found.");
    m.put("customer_debt_branch_id_fkey", "Branch not found.");
    m.put("customer_debt_created_by_fkey", "Invalid created by: staff user not found.");
    m.put("customer_debt_customer_id_fkey", "Invalid customer: customer not found.");
    m.put("customer_debt_org_id_fkey", "Organization not found.");
    m.put("customer_debt_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("customer_debt_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("customer_debt_terminal_id_fkey", "Terminal not found.");
    m.put("customer_org_id_fkey", "Organization not found.");
    m.put("day_close_branch_id_fkey", "Branch not found.");
    m.put("day_close_closed_by_fkey", "Invalid closed by: staff user not found.");
    m.put("day_close_org_id_fkey", "Organization not found.");
    m.put("device_registration_branch_id_fkey", "Branch not found.");
    m.put("device_registration_org_id_fkey", "Organization not found.");
    m.put("etims_invoice_record_branch_id_fkey", "Branch not found.");
    m.put("etims_invoice_record_org_id_fkey", "Organization not found.");
    m.put("etims_invoice_record_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("goods_receipt_note_branch_id_fkey", "Branch not found.");
    m.put("goods_receipt_note_org_id_fkey", "Organization not found.");
    m.put(
        "goods_receipt_note_purchase_order_id_fkey",
        "Invalid purchase order: purchase order not found.");
    m.put("goods_receipt_note_received_by_fkey", "Invalid received by: staff user not found.");
    m.put("goods_receipt_note_supplier_id_fkey", "Invalid supplier: supplier not found.");
    m.put("grn_line_grn_id_fkey", "Invalid goods receipt note: goods receipt note not found.");
    m.put("grn_line_item_id_fkey", "Item not found.");
    m.put("grn_line_org_id_fkey", "Organization not found.");
    m.put("grn_line_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("inventory_item_branch_id_fkey", "Branch not found.");
    m.put("inventory_item_item_id_fkey", "Item not found.");
    m.put("inventory_item_org_id_fkey", "Organization not found.");
    m.put("item_barcode_item_id_fkey", "Item not found.");
    m.put("item_barcode_org_id_fkey", "Organization not found.");
    m.put("item_base_uom_id_fkey", "Invalid base uom: unit of measure not found.");
    m.put("item_category_id_fkey", "Invalid category: category not found.");
    m.put("item_modifier_group_item_id_fkey", "Item not found.");
    m.put(
        "item_modifier_group_modifier_group_id_fkey",
        "Invalid modifier group: modifier group not found.");
    m.put("item_modifier_group_org_id_fkey", "Organization not found.");
    m.put("item_org_id_fkey", "Organization not found.");
    m.put("item_tax_profile_id_fkey", "Invalid tax profile: tax profile not found.");
    m.put("item_uom_item_id_fkey", "Item not found.");
    m.put("item_uom_org_id_fkey", "Organization not found.");
  }

  private static void addForeignKeyMessagesPart2(Map<String, String> m) {
    m.put("item_uom_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("misc_expense_branch_id_fkey", "Branch not found.");
    m.put("misc_expense_created_by_fkey", "Invalid created by: staff user not found.");
    m.put("misc_expense_org_id_fkey", "Organization not found.");
    m.put("misc_expense_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("misc_expense_terminal_id_fkey", "Terminal not found.");
    m.put("ledger_account_org_id_fkey", "Organization not found.");
    m.put("ledger_entry_account_id_fkey", "Invalid account: ledger account not found.");
    m.put("ledger_entry_branch_id_fkey", "Branch not found.");
    m.put("ledger_entry_org_id_fkey", "Organization not found.");
    m.put("modifier_group_org_id_fkey", "Organization not found.");
    m.put("modifier_option_item_id_fkey", "Item not found.");
    m.put(
        "modifier_option_modifier_group_id_fkey",
        "Invalid modifier group: modifier group not found.");
    m.put("modifier_option_org_id_fkey", "Organization not found.");
    m.put("no_sale_event_branch_id_fkey", "Branch not found.");
    m.put("no_sale_event_org_id_fkey", "Organization not found.");
    m.put("no_sale_event_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("no_sale_event_staff_user_id_fkey", "Staff user not found.");
    m.put("no_sale_event_terminal_id_fkey", "Terminal not found.");
    m.put("order_ticket_branch_id_fkey", "Branch not found.");
    m.put(
        "order_ticket_line_order_ticket_id_fkey", "Invalid order ticket: order ticket not found.");
    m.put("order_ticket_line_org_id_fkey", "Organization not found.");
    m.put("order_ticket_line_sale_line_id_fkey", "Invalid sale line: sale line not found.");
    m.put("order_ticket_org_id_fkey", "Organization not found.");
    m.put("order_ticket_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("outbox_event_org_id_fkey", "Organization not found.");
    m.put("outbox_event_terminal_id_fkey", "Terminal not found.");
    m.put("payment_reference_org_id_fkey", "Organization not found.");
    m.put("payment_reference_tender_id_fkey", "Invalid tender: tender not found.");
    m.put("posting_rule_org_id_fkey", "Organization not found.");
    m.put("price_list_branch_id_fkey", "Branch not found.");
    m.put("price_list_item_item_id_fkey", "Item not found.");
    m.put("price_list_item_org_id_fkey", "Organization not found.");
    m.put("price_list_item_price_list_id_fkey", "Invalid price list: price list not found.");
    m.put("price_list_org_id_fkey", "Organization not found.");
    m.put("price_schedule_branch_id_fkey", "Branch not found.");
    m.put("price_schedule_org_id_fkey", "Organization not found.");
    m.put("printer_profile_org_id_fkey", "Organization not found.");
    m.put("promotion_rule_branch_id_fkey", "Branch not found.");
    m.put("promotion_rule_org_id_fkey", "Organization not found.");
    m.put("purchase_order_branch_id_fkey", "Branch not found.");
    m.put("purchase_order_created_by_fkey", "Invalid created by: staff user not found.");
    m.put("purchase_order_line_item_id_fkey", "Item not found.");
    m.put("purchase_order_line_org_id_fkey", "Organization not found.");
    m.put(
        "purchase_order_line_purchase_order_id_fkey",
        "Invalid purchase order: purchase order not found.");
    m.put("purchase_order_line_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("purchase_order_org_id_fkey", "Organization not found.");
    m.put("purchase_order_supplier_id_fkey", "Invalid supplier: supplier not found.");
    m.put("reason_code_org_id_fkey", "Organization not found.");
    m.put("receipt_block_allocation_branch_id_fkey", "Branch not found.");
    m.put("receipt_block_allocation_org_id_fkey", "Organization not found.");
    m.put("receipt_block_allocation_terminal_id_fkey", "Terminal not found.");
    m.put("receipt_branch_id_fkey", "Branch not found.");
    m.put("receipt_org_id_fkey", "Organization not found.");
    m.put("receipt_sequence_branch_id_fkey", "Branch not found.");
    m.put("receipt_sequence_org_id_fkey", "Organization not found.");
    m.put("receipt_sequence_terminal_id_fkey", "Terminal not found.");
    m.put("receipt_template_org_id_fkey", "Organization not found.");
    m.put("receipt_terminal_id_fkey", "Terminal not found.");
    m.put("recipe_line_ingredient_item_id_fkey", "Item not found.");
    m.put("recipe_line_org_id_fkey", "Organization not found.");
    m.put("recipe_line_recipe_id_fkey", "Invalid recipe: recipe not found.");
    m.put("recipe_line_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("recipe_menu_item_id_fkey", "Item not found.");
    m.put("recipe_org_id_fkey", "Organization not found.");
  }

  private static void addForeignKeyMessagesPart3(Map<String, String> m) {
    m.put("sale_branch_id_fkey", "Branch not found.");
    m.put("sale_created_by_staff_user_id_fkey", "Staff user not found.");
    m.put("sale_customer_id_fkey", "Invalid customer: customer not found.");
    m.put("sale_discount_line_approved_by_fkey", "Invalid approved by: staff user not found.");
    m.put("sale_discount_line_org_id_fkey", "Organization not found.");
    m.put(
        "sale_discount_line_promotion_rule_id_fkey",
        "Invalid promotion rule: promotion rule not found.");
    m.put("sale_discount_line_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("sale_line_item_id_fkey", "Item not found.");
    m.put(
        "sale_line_modifier_modifier_option_id_fkey",
        "Invalid modifier option: modifier option not found.");
    m.put("sale_line_modifier_org_id_fkey", "Organization not found.");
    m.put("sale_line_modifier_sale_line_id_fkey", "Invalid sale line: sale line not found.");
    m.put("sale_line_org_id_fkey", "Organization not found.");
    m.put("sale_line_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("sale_line_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("sale_org_id_fkey", "Organization not found.");
    m.put("sale_receipt_id_fkey", "Invalid receipt: receipt not found.");
    m.put("sale_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("sale_tax_line_org_id_fkey", "Organization not found.");
    m.put("sale_tax_line_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("sale_tax_line_tax_profile_id_fkey", "Invalid tax profile: tax profile not found.");
    m.put("sale_terminal_id_fkey", "Terminal not found.");
    m.put("scheduled_price_item_id_fkey", "Item not found.");
    m.put("scheduled_price_org_id_fkey", "Organization not found.");
    m.put(
        "scheduled_price_price_schedule_id_fkey",
        "Invalid price schedule: price schedule not found.");
    m.put("shift_branch_id_fkey", "Branch not found.");
    m.put("shift_closed_by_manager_id_fkey", "Invalid closed by manager: staff user not found.");
    m.put("shift_denomination_count_org_id_fkey", "Organization not found.");
    m.put("shift_denomination_count_shift_id_fkey", "Invalid shift: shift not found.");
    m.put("shift_org_id_fkey", "Organization not found.");
    m.put("shift_staff_user_id_fkey", "Staff user not found.");
    m.put("shift_terminal_id_fkey", "Terminal not found.");
    m.put(
        "shift_variance_reason_code_id_fkey",
        "Invalid variance reason code: reason code not found.");
    m.put("staff_branch_assignment_branch_id_fkey", "Branch not found.");
    m.put("staff_branch_assignment_org_id_fkey", "Organization not found.");
    m.put("staff_branch_assignment_staff_user_id_fkey", "Staff user not found.");
    m.put("staff_profile_default_branch_id_fkey", "Branch not found.");
    m.put("staff_profile_org_id_fkey", "Organization not found.");
    m.put("staff_profile_staff_user_id_fkey", "Staff user not found.");
    m.put("staff_user_org_id_fkey", "Organization not found.");
    m.put("stock_count_line_item_id_fkey", "Item not found.");
    m.put("stock_count_line_org_id_fkey", "Organization not found.");
    m.put("stock_count_line_session_id_fkey", "Invalid session: stock count session not found.");
    m.put("stock_count_session_branch_id_fkey", "Branch not found.");
    m.put("stock_count_session_org_id_fkey", "Organization not found.");
    m.put("stock_count_session_started_by_fkey", "Invalid started by: staff user not found.");
    m.put("stock_movement_approved_by_fkey", "Invalid approved by: staff user not found.");
    m.put("stock_movement_branch_id_fkey", "Branch not found.");
    m.put("stock_movement_created_by_fkey", "Invalid created by: staff user not found.");
    m.put("stock_movement_item_id_fkey", "Item not found.");
    m.put("stock_movement_org_id_fkey", "Organization not found.");
    m.put("stock_movement_reason_code_id_fkey", "Invalid reason code: reason code not found.");
    m.put("stock_movement_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("supplier_org_id_fkey", "Organization not found.");
    m.put("sync_priority_queue_event_id_fkey", "Invalid event: outbox event not found.");
    m.put("sync_priority_queue_org_id_fkey", "Organization not found.");
    m.put("sync_priority_queue_terminal_id_fkey", "Terminal not found.");
    m.put("tab_branch_id_fkey", "Branch not found.");
    m.put("tab_opened_by_fkey", "Invalid opened by: staff user not found.");
    m.put("tab_org_id_fkey", "Organization not found.");
    m.put("tab_sale_link_org_id_fkey", "Organization not found.");
  }

  private static void addForeignKeyMessagesPart4(Map<String, String> m) {
    m.put("tab_sale_link_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("tab_sale_link_tab_id_fkey", "Invalid tab: tab not found.");
    m.put("tab_terminal_id_fkey", "Terminal not found.");
    m.put("table_area_branch_id_fkey", "Branch not found.");
    m.put("table_area_org_id_fkey", "Organization not found.");
    m.put("table_entity_branch_id_fkey", "Branch not found.");
    m.put("table_entity_org_id_fkey", "Organization not found.");
    m.put("table_entity_table_area_id_fkey", "Invalid table area: table area not found.");
    m.put("tax_agency_config_org_id_fkey", "Organization not found.");
    m.put("tax_profile_org_id_fkey", "Organization not found.");
    m.put("tender_captured_by_staff_user_id_fkey", "Staff user not found.");
    m.put("tender_org_id_fkey", "Organization not found.");
    m.put("tender_sale_id_fkey", "Invalid sale: sale not found.");
    m.put("tender_tender_type_id_fkey", "Invalid tender type: tender type not found.");
    m.put("tender_type_org_id_fkey", "Organization not found.");
    m.put("terminal_branch_id_fkey", "Branch not found.");
    m.put(
        "terminal_device_registration_id_fkey",
        "Invalid device registration: device registration not found.");
    m.put("terminal_org_id_fkey", "Organization not found.");
    m.put(
        "terminal_printer_profile_id_fkey", "Invalid printer profile: printer profile not found.");
    m.put("theoretical_consumption_snapshot_branch_id_fkey", "Branch not found.");
    m.put("theoretical_consumption_snapshot_item_id_fkey", "Item not found.");
    m.put("theoretical_consumption_snapshot_org_id_fkey", "Organization not found.");
    m.put("transfer_order_from_branch_id_fkey", "Branch not found.");
    m.put("transfer_order_line_item_id_fkey", "Item not found.");
    m.put("transfer_order_line_org_id_fkey", "Organization not found.");
    m.put(
        "transfer_order_line_transfer_order_id_fkey",
        "Invalid transfer order: transfer order not found.");
    m.put("transfer_order_line_uom_id_fkey", "Invalid unit of measure: unit of measure not found.");
    m.put("transfer_order_org_id_fkey", "Organization not found.");
    m.put("transfer_order_to_branch_id_fkey", "Branch not found.");
    m.put("uom_org_id_fkey", "Organization not found.");
    m.put("vscu_config_branch_id_fkey", "Branch not found.");
    m.put("vscu_config_org_id_fkey", "Organization not found.");
    m.put("z_report_branch_id_fkey", "Branch not found.");
    m.put("z_report_org_id_fkey", "Organization not found.");
  }
}
