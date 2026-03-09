package com.blinc.xpos.modules.organization.service.impl;

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
import com.blinc.xpos.api.v1.admin.organization.dto.BranchResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.BusinessResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.CustomerResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.DeviceResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgContextResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.PrinterProfileResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.ReceiptTemplateResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.TaxProfileResponse;
import com.blinc.xpos.api.v1.admin.sales.dto.TenderTypeResponse;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffUserResponse;
import com.blinc.xpos.api.v1.operator.dto.ShiftResponse;
import com.blinc.xpos.modules.catalog.domain.Category;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import com.blinc.xpos.modules.fraud.domain.ApprovalPolicy;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.ledger.domain.LedgerAccount;
import com.blinc.xpos.modules.ledger.domain.PostingRule;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Business;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.fraud.service.ApprovalPolicyService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.BusinessService;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.DeviceRegistrationService;
import com.blinc.xpos.modules.organization.service.OrgContextService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.PrinterProfileService;
import com.blinc.xpos.modules.organization.service.ReceiptTemplateService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.service.TenderTypeService;
import com.blinc.xpos.modules.catalog.service.CategoryService;
import com.blinc.xpos.modules.catalog.service.ItemImageService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.ModifierGroupService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.compliance.service.TaxAgencyConfigService;
import com.blinc.xpos.modules.fraud.service.ReasonCodeService;
import com.blinc.xpos.modules.inventory.domain.Supplier;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import com.blinc.xpos.modules.ledger.service.LedgerAccountService;
import com.blinc.xpos.modules.ledger.service.PostingRuleService;
import com.blinc.xpos.modules.pricing.service.PriceListService;
import com.blinc.xpos.modules.pricing.service.TaxProfileService;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrgContextServiceImpl implements OrgContextService {

  private static final int CONTEXT_PAGE_SIZE = 500;

  private final OrgService orgService;
  private final BusinessService businessService;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final CategoryService categoryService;
  private final TaxProfileService taxProfileService;
  private final UomService uomService;
  private final ModifierGroupService modifierGroupService;
  private final PriceListService priceListService;
  private final TenderTypeService tenderTypeService;
  private final TaxAgencyConfigService taxAgencyConfigService;
  private final SupplierService supplierService;
  private final ReasonCodeService reasonCodeService;
  private final LedgerAccountService ledgerAccountService;
  private final ReceiptTemplateService receiptTemplateService;
  private final PrinterProfileService printerProfileService;
  private final CustomerService customerService;
  private final ApprovalPolicyService approvalPolicyService;
  private final PostingRuleService postingRuleService;
  private final ItemService itemService;
  private final ItemImageService itemImageService;
  private final DeviceRegistrationService deviceRegistrationService;
  private final ShiftService shiftService;
  private final StockMovementRepository stockMovementRepository;

  public OrgContextServiceImpl(
      OrgService orgService,
      BusinessService businessService,
      BranchService branchService,
      StaffUserService staffUserService,
      CategoryService categoryService,
      TaxProfileService taxProfileService,
      UomService uomService,
      ModifierGroupService modifierGroupService,
      PriceListService priceListService,
      TenderTypeService tenderTypeService,
      TaxAgencyConfigService taxAgencyConfigService,
      SupplierService supplierService,
      ReasonCodeService reasonCodeService,
      LedgerAccountService ledgerAccountService,
      ReceiptTemplateService receiptTemplateService,
      PrinterProfileService printerProfileService,
      CustomerService customerService,
      ApprovalPolicyService approvalPolicyService,
      PostingRuleService postingRuleService,
      ItemService itemService,
      ItemImageService itemImageService,
      DeviceRegistrationService deviceRegistrationService,
      ShiftService shiftService,
      StockMovementRepository stockMovementRepository) {
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.businessService = Objects.requireNonNull(businessService, "businessService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.categoryService = Objects.requireNonNull(categoryService, "categoryService");
    this.taxProfileService = Objects.requireNonNull(taxProfileService, "taxProfileService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.modifierGroupService =
        Objects.requireNonNull(modifierGroupService, "modifierGroupService");
    this.priceListService = Objects.requireNonNull(priceListService, "priceListService");
    this.tenderTypeService = Objects.requireNonNull(tenderTypeService, "tenderTypeService");
    this.taxAgencyConfigService =
        Objects.requireNonNull(taxAgencyConfigService, "taxAgencyConfigService");
    this.supplierService = Objects.requireNonNull(supplierService, "supplierService");
    this.reasonCodeService = Objects.requireNonNull(reasonCodeService, "reasonCodeService");
    this.ledgerAccountService =
        Objects.requireNonNull(ledgerAccountService, "ledgerAccountService");
    this.receiptTemplateService =
        Objects.requireNonNull(receiptTemplateService, "receiptTemplateService");
    this.printerProfileService =
        Objects.requireNonNull(printerProfileService, "printerProfileService");
    this.customerService = Objects.requireNonNull(customerService, "customerService");
    this.approvalPolicyService =
        Objects.requireNonNull(approvalPolicyService, "approvalPolicyService");
    this.postingRuleService =
        Objects.requireNonNull(postingRuleService, "postingRuleService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.itemImageService = Objects.requireNonNull(itemImageService, "itemImageService");
    this.deviceRegistrationService =
        Objects.requireNonNull(deviceRegistrationService, "deviceRegistrationService");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public OrgContextResponse getContext(UUID orgId) {
    Org org = orgService.require(orgId);
    Pageable page = PageRequest.of(0, CONTEXT_PAGE_SIZE, Sort.by("createdAt").ascending());
    Pageable shiftsPage =
        PageRequest.of(0, CONTEXT_PAGE_SIZE, Sort.by("openedAt").descending());

    return new OrgContextResponse(
        toOrgResponse(org),
        businessService.list(orgId, page).getContent().stream().map(this::toBusinessResponse).toList(),
        branchService.list(orgId, page).getContent().stream().map(this::toBranchResponse).toList(),
        staffUserService.list(orgId, page).getContent().stream().map(this::toStaffUserResponse).toList(),
        categoryService.list(orgId, page).getContent().stream().map(this::toCategoryResponse).toList(),
        taxProfileService.list(orgId, page).getContent().stream().map(this::toTaxProfileResponse).toList(),
        uomService.list(orgId, page).getContent().stream().map(this::toUomResponse).toList(),
        modifierGroupService.list(orgId, page).getContent().stream()
            .map(this::toModifierGroupResponse).toList(),
        priceListService.list(orgId, page).getContent().stream().map(this::toPriceListResponse).toList(),
        tenderTypeService.listActiveByOrg(orgId).stream().map(this::toTenderTypeResponse).toList(),
        taxAgencyConfigService.list(orgId, page).getContent().stream()
            .map(this::toTaxAgencyConfigResponse).toList(),
        supplierService.listActiveOnly(orgId, page).getContent().stream()
            .map(this::toSupplierResponse).toList(),
        reasonCodeService.list(orgId, page).getContent().stream()
            .map(this::toReasonCodeResponse).toList(),
        ledgerAccountService.list(orgId, page).getContent().stream()
            .map(this::toLedgerAccountResponse).toList(),
        receiptTemplateService.list(orgId, page).getContent().stream()
            .map(this::toReceiptTemplateResponse).toList(),
        printerProfileService.list(orgId, page).getContent().stream()
            .map(this::toPrinterProfileResponse).toList(),
        customerService.list(orgId, page).getContent().stream()
            .map(this::toCustomerResponse).toList(),
        approvalPolicyService.list(orgId, page).getContent().stream()
            .map(this::toApprovalPolicyResponse).toList(),
        postingRuleService.list(orgId, page).getContent().stream()
            .map(this::toPostingRuleResponse).toList(),
        toItemResponses(orgId, itemService.list(orgId, null, page).getContent()),
        deviceRegistrationService.list(orgId, page).getContent().stream()
            .map(this::toDeviceResponse).toList(),
        shiftService.listOpenByOrg(orgId, shiftsPage).getContent().stream()
            .map(this::toShiftResponse).toList());
  }

  private SupplierResponse toSupplierResponse(Supplier s) {
    return new SupplierResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getName(),
        s.getPhone(),
        s.getEmail(),
        s.getActive(),
        s.getCreatedAt(),
        s.getUpdatedAt());
  }

  private OrgResponse toOrgResponse(Org o) {
    return new OrgResponse(o.getId(), o.getName(), o.getStatus(), o.getCreatedAt(), o.getUpdatedAt());
  }

  private BusinessResponse toBusinessResponse(Business b) {
    return new BusinessResponse(
        b.getId(),
        b.getOrg().getId(),
        b.getLegalName(),
        b.getKraPin(),
        b.getLogoUrl(),
        b.getReceiptFooter(),
        b.getStatus(),
        b.getCreatedAt(),
        b.getUpdatedAt());
  }

  private BranchResponse toBranchResponse(Branch b) {
    return new BranchResponse(
        b.getId(),
        b.getOrg().getId(),
        b.getBusiness().getId(),
        b.getName(),
        b.getTimezone(),
        b.getCurrency(),
        b.getAddressJson(),
        b.getTaxAgencyConfig() == null ? null : b.getTaxAgencyConfig().getId(),
        b.getReceiptTemplate() == null ? null : b.getReceiptTemplate().getId(),
        b.getStatus(),
        b.getCreatedAt(),
        b.getUpdatedAt());
  }

  private StaffUserResponse toStaffUserResponse(StaffUser u) {
    return new StaffUserResponse(
        u.getId(),
        u.getOrg().getId(),
        u.getIamUserId(),
        u.getUsername(),
        u.getStatus(),
        u.getCreatedAt(),
        u.getUpdatedAt());
  }

  private CategoryResponse toCategoryResponse(Category c) {
    return new CategoryResponse(
        c.getId(),
        c.getOrg().getId(),
        c.getParent() != null ? c.getParent().getId() : null,
        c.getName(),
        c.getType(),
        c.getCreatedAt(),
        c.getUpdatedAt());
  }

  private TaxProfileResponse toTaxProfileResponse(TaxProfile t) {
    return new TaxProfileResponse(
        t.getId(),
        t.getOrg().getId(),
        t.getName(),
        t.getVatCategory(),
        t.getServiceChargeRate(),
        t.getLevyRate(),
        t.getCreatedAt(),
        t.getUpdatedAt());
  }

  private UomResponse toUomResponse(Uom u) {
    return new UomResponse(
        u.getId(),
        u.getOrg().getId(),
        u.getName(),
        u.getSymbol(),
        u.getCreatedAt());
  }

  private ModifierGroupResponse toModifierGroupResponse(ModifierGroup g) {
    return new ModifierGroupResponse(
        g.getId(),
        g.getOrg().getId(),
        g.getName(),
        g.getMinSelect(),
        g.getMaxSelect(),
        g.getRequired(),
        g.getCreatedAt(),
        g.getUpdatedAt());
  }

  private PriceListResponse toPriceListResponse(PriceList p) {
    return new PriceListResponse(
        p.getId(),
        p.getOrg().getId(),
        p.getBranch() != null ? p.getBranch().getId() : null,
        p.getChannel(),
        p.getName(),
        p.getPriority(),
        p.getActive(),
        p.getCreatedAt(),
        p.getUpdatedAt());
  }

  private TenderTypeResponse toTenderTypeResponse(TenderType t) {
    return new TenderTypeResponse(
        t.getId(),
        t.getOrg().getId(),
        t.getCode(),
        t.getName(),
        t.getActive(),
        t.getCreatedAt());
  }

  private TaxAgencyConfigResponse toTaxAgencyConfigResponse(TaxAgencyConfig t) {
    return new TaxAgencyConfigResponse(
        t.getId(),
        t.getOrg().getId(),
        t.getName(),
        t.getVatStandardRate(),
        t.getVatReducedRate(),
        t.getSupportsEtims(),
        t.getEtimsMappingJson(),
        t.getCreatedAt(),
        t.getUpdatedAt());
  }

  private ReasonCodeResponse toReasonCodeResponse(ReasonCode r) {
    return new ReasonCodeResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getCode(),
        r.getDescription(),
        r.getActive(),
        r.getCreatedAt());
  }

  private LedgerAccountResponse toLedgerAccountResponse(LedgerAccount a) {
    return new LedgerAccountResponse(
        a.getId(),
        a.getOrg().getId(),
        a.getCode(),
        a.getName(),
        a.getAccountType(),
        a.getActive(),
        a.getCreatedAt());
  }

  private ReceiptTemplateResponse toReceiptTemplateResponse(ReceiptTemplate t) {
    return new ReceiptTemplateResponse(
        t.getId(),
        t.getName(),
        t.getTemplateJson(),
        t.getActive(),
        t.getCreatedAt(),
        t.getUpdatedAt());
  }

  private PrinterProfileResponse toPrinterProfileResponse(PrinterProfile p) {
    return new PrinterProfileResponse(
        p.getId(),
        p.getName(),
        p.getConfigJson(),
        p.getActive(),
        p.getCreatedAt(),
        p.getUpdatedAt());
  }

  private CustomerResponse toCustomerResponse(Customer c) {
    return new CustomerResponse(
        c.getId(),
        c.getName(),
        c.getPhone(),
        c.getEmail(),
        c.getActive(),
        c.getCreatedAt(),
        c.getUpdatedAt());
  }

  private ApprovalPolicyResponse toApprovalPolicyResponse(ApprovalPolicy p) {
    return new ApprovalPolicyResponse(
        p.getId(),
        p.getOrg().getId(),
        p.getBranch() != null ? p.getBranch().getId() : null,
        p.getPolicyCode(),
        p.getThresholdValue(),
        p.getRequiresManager(),
        p.getCreatedAt(),
        p.getUpdatedAt());
  }

  private PostingRuleResponse toPostingRuleResponse(PostingRule r) {
    return new PostingRuleResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getEventType(),
        r.getDebitAccountCode(),
        r.getCreditAccountCode(),
        r.getActive(),
        r.getCreatedAt(),
        r.getUpdatedAt());
  }

  private List<ItemResponse> toItemResponses(UUID orgId, List<Item> items) {
    if (items.isEmpty()) {
      return List.of();
    }
    var itemIds = items.stream().map(Item::getId).toList();
    var primaryUrls = itemImageService.findPrimaryUrlsByItemIds(orgId, itemIds);
    var idsWithHistory =
        new java.util.HashSet<>(stockMovementRepository.findItemIdsWithPurchaseHistoryByOrgId(orgId));
    return items.stream()
        .map(
            i ->
                toItemResponse(
                    i,
                    primaryUrls.get(i.getId()),
                    idsWithHistory.contains(i.getId())))
        .toList();
  }

  private ItemResponse toItemResponse(Item i, String primaryImageUrl, boolean hasPurchaseHistory) {
    return new ItemResponse(
        i.getId(),
        i.getOrg().getId(),
        i.getSku(),
        i.getName(),
        i.getItemType(),
        i.getCategory() != null ? i.getCategory().getId() : null,
        i.getBaseUom() != null ? i.getBaseUom().getId() : null,
        i.getTaxProfile() != null ? i.getTaxProfile().getId() : null,
        i.getTrackInventory(),
        i.getActive(),
        i.getBuyingPrice(),
        i.getDefaultSellingPrice(),
        primaryImageUrl,
        hasPurchaseHistory,
        i.getCreatedAt(),
        i.getUpdatedAt(),
        null);
  }

  private DeviceResponse toDeviceResponse(DeviceRegistration d) {
    return new DeviceResponse(
        d.getId(),
        d.getOrg().getId(),
        d.getBranch().getId(),
        d.getDeviceId(),
        d.getDeviceFingerprint(),
        d.getStatus(),
        d.getLastSeenAt(),
        d.getCreatedAt(),
        d.getUpdatedAt());
  }

  private ShiftResponse toShiftResponse(Shift s) {
    return new ShiftResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getBranch().getId(),
        s.getTerminal().getId(),
        s.getStaffUser().getId(),
        s.getOpenedAt(),
        s.getClosedAt(),
        s.getStatus().name(),
        s.getOpeningFloatAmount(),
        s.getClosingCountedAmount(),
        s.getExpectedCashAmount(),
        s.getVarianceAmount(),
        s.getClosedByManager() != null ? s.getClosedByManager().getId() : null,
        s.getVarianceReasonCode() != null ? s.getVarianceReasonCode().getId() : null);
  }
}
