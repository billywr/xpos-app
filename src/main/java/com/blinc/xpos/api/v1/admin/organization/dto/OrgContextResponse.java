package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.api.v1.admin.catalog.dto.CategoryResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierGroupResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.UomResponse;
import com.blinc.xpos.api.v1.admin.compliance.dto.TaxAgencyConfigResponse;
import com.blinc.xpos.api.v1.admin.fraud.dto.ApprovalPolicyResponse;
import com.blinc.xpos.api.v1.admin.fraud.dto.ReasonCodeResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.SupplierResponse;
import com.blinc.xpos.api.v1.admin.ledger.dto.LedgerAccountResponse;
import com.blinc.xpos.api.v1.admin.ledger.dto.PostingRuleResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.TaxProfileResponse;
import com.blinc.xpos.api.v1.admin.sales.dto.TenderTypeResponse;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffUserResponse;
import com.blinc.xpos.api.v1.operator.dto.ShiftResponse;
import java.util.List;

/**
 * Aggregate response containing org-level reference data in a single call: org, businesses,
 * branches, staff, categories, tax, UoMs, modifier groups, price lists, tender types, tax agency
 * configs, suppliers, reason codes, ledger accounts, receipt templates, printer profiles,
 * customers, approval policies, posting rules, items, devices, open shifts. Each list is bounded
 * (e.g. first 500 per type).
 */
public record OrgContextResponse(
    OrgResponse org,
    List<BusinessResponse> businesses,
    List<BranchResponse> branches,
    List<StaffUserResponse> staffUsers,
    List<CategoryResponse> categories,
    List<TaxProfileResponse> taxProfiles,
    List<UomResponse> uoms,
    List<ModifierGroupResponse> modifierGroups,
    List<PriceListResponse> priceLists,
    List<TenderTypeResponse> tenderTypes,
    List<TaxAgencyConfigResponse> taxAgencyConfigs,
    List<SupplierResponse> suppliers,
    List<ReasonCodeResponse> reasonCodes,
    List<LedgerAccountResponse> ledgerAccounts,
    List<ReceiptTemplateResponse> receiptTemplates,
    List<PrinterProfileResponse> printerProfiles,
    List<CustomerResponse> customers,
    List<ApprovalPolicyResponse> approvalPolicies,
    List<PostingRuleResponse> postingRules,
    List<ItemResponse> items,
    List<DeviceResponse> devices,
    List<ShiftResponse> openShifts) {}
