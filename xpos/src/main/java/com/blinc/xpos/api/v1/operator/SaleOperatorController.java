package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.CompleteWithDebtRequest;
import com.blinc.xpos.api.v1.operator.dto.ReceiptDetailResponse;
import com.blinc.xpos.api.v1.operator.dto.ReceiptResponse;
import com.blinc.xpos.api.v1.operator.dto.SaleCreateRequest;
import com.blinc.xpos.api.v1.operator.dto.SaleLineAddRequest;
import com.blinc.xpos.api.v1.operator.dto.SaleLineModifierResponse;
import com.blinc.xpos.api.v1.operator.dto.SaleLineResponse;
import com.blinc.xpos.api.v1.operator.dto.SaleResponse;
import com.blinc.xpos.api.v1.operator.dto.TenderAddRequest;
import com.blinc.xpos.api.v1.operator.dto.TenderResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.sales.domain.Receipt;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.domain.SaleLineModifier;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.repository.SaleLineModifierRepository;
import com.blinc.xpos.modules.sales.service.CompleteWithDebtService;
import com.blinc.xpos.modules.sales.service.ReceiptService;
import com.blinc.xpos.modules.sales.service.SaleService;
import com.blinc.xpos.modules.sales.service.TenderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales")
public class SaleOperatorController {

  private final SaleService saleService;
  private final TenderService tenderService;
  private final ReceiptService receiptService;
  private final CompleteWithDebtService completeWithDebtService;
  private final SaleLineModifierRepository saleLineModifierRepository;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public SaleOperatorController(
      SaleService saleService,
      TenderService tenderService,
      ReceiptService receiptService,
      CompleteWithDebtService completeWithDebtService,
      SaleLineModifierRepository saleLineModifierRepository,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.saleService = Objects.requireNonNull(saleService, "saleService");
    this.tenderService = Objects.requireNonNull(tenderService, "tenderService");
    this.receiptService = Objects.requireNonNull(receiptService, "receiptService");
    this.completeWithDebtService =
        Objects.requireNonNull(completeWithDebtService, "completeWithDebtService");
    this.saleLineModifierRepository =
        Objects.requireNonNull(saleLineModifierRepository, "saleLineModifierRepository");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SaleResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody(required = false) SaleCreateRequest request) {
    StaffUser staffUser = requireCurrentStaffUser(orgId);
    UUID customerId = request != null ? request.customerId() : null;
    Sale sale;
    if (request != null && request.lines() != null && !request.lines().isEmpty()) {
      List<SaleService.LineInput> lineInputs =
          request.lines().stream()
              .map(
                  l -> {
                    List<SaleService.ModifierQuantity> mods =
                        l.modifiers() != null
                            ? l.modifiers().stream()
                                .map(
                                    m ->
                                        new SaleService.ModifierQuantity(
                                            m.modifierOptionId(), m.qty()))
                                .toList()
                            : List.of();
                    return new SaleService.LineInput(
                        l.itemId(), l.qty(), l.uomId(), l.unitPriceOverride(), mods);
                  })
              .toList();
      sale =
          saleService.createWithLines(
              orgId, branchId, terminalId, staffUser.getId(), customerId, lineInputs);
    } else {
      sale = saleService.create(orgId, branchId, terminalId, staffUser.getId(), customerId);
    }
    return toSaleResponse(sale);
  }

  @GetMapping
  public List<SaleResponse> listOpenOrHeld(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID terminalId) {
    return saleService.listOpenOrHeld(orgId, branchId, terminalId).stream()
        .map(this::toSaleResponse)
        .toList();
  }

  @GetMapping("/{saleId}")
  public ResponseEntity<SaleResponse> get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    return saleService
        .getByIdAndOrg(orgId, saleId)
        .map(s -> ResponseEntity.ok(toSaleResponse(s)))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PostMapping("/{saleId}/lines")
  public SaleResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @Valid @RequestBody SaleLineAddRequest request) {
    List<SaleService.ModifierQuantity> mods =
        request.modifiers() != null
            ? request.modifiers().stream()
                .map(m -> new SaleService.ModifierQuantity(m.modifierOptionId(), m.qty()))
                .toList()
            : List.of();
    Sale sale =
        saleService.addLine(
            orgId,
            saleId,
            request.itemId(),
            request.qty(),
            request.uomId(),
            request.unitPriceOverride(),
            mods);
    return toSaleResponse(sale);
  }

  @PostMapping("/{saleId}/tenders")
  @ResponseStatus(HttpStatus.CREATED)
  public TenderResponse addTender(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @Valid @RequestBody TenderAddRequest request) {
    StaffUser staffUser = requireCurrentStaffUser(orgId);
    Tender tender =
        tenderService.addTender(
            orgId,
            saleId,
            request.tenderTypeId(),
            request.amount(),
            request.currency(),
            staffUser.getId());
    return toTenderResponse(tender);
  }

  @DeleteMapping("/{saleId}/tenders/{tenderId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeTender(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @PathVariable UUID tenderId) {
    requireCurrentStaffUser(orgId);
    tenderService.removeTender(orgId, saleId, tenderId);
  }

  @PostMapping("/{saleId}/complete")
  public SaleResponse complete(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    Sale sale = saleService.complete(orgId, saleId);
    return toSaleResponse(sale);
  }

  @PostMapping("/{saleId}/complete-with-debt")
  public SaleResponse completeWithDebt(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @Valid @RequestBody CompleteWithDebtRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    Sale completed =
        completeWithDebtService.completeWithDebt(
            orgId, branchId, terminalId, saleId, staffUser.getId(), request);
    return toSaleResponse(completed);
  }

  @PostMapping("/{saleId}/hold")
  public SaleResponse hold(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    Sale sale = saleService.hold(orgId, saleId);
    return toSaleResponse(sale);
  }

  @PostMapping("/{saleId}/void")
  public SaleResponse voidSale(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    Sale sale = saleService.voidSale(orgId, saleId);
    return toSaleResponse(sale);
  }

  @GetMapping("/{saleId}/receipt")
  public ResponseEntity<ReceiptResponse> getReceipt(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    return receiptService
        .getBySaleId(orgId, saleId)
        .map(r -> ResponseEntity.ok(toReceiptResponse(r)))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @GetMapping("/{saleId}/receipt/details")
  public ResponseEntity<ReceiptDetailResponse> getReceiptDetails(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId) {
    return receiptService
        .getDetailBySaleId(orgId, saleId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private StaffUser requireCurrentStaffUser(UUID orgId) {
    return staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
  }

  private SaleResponse toSaleResponse(Sale sale) {
    UUID orgId = sale.getOrg().getId();
    List<SaleLine> lines = saleService.listLines(orgId, sale.getId());
    List<Tender> tenders = tenderService.listBySale(orgId, sale.getId());
    List<SaleLineResponse> lineResponses = lines.stream().map(l -> toSaleLineResponse(l)).toList();
    List<TenderResponse> tenderResponses = tenders.stream().map(this::toTenderResponse).toList();
    return new SaleResponse(
        sale.getId(),
        sale.getOrg().getId(),
        sale.getBranch().getId(),
        sale.getTerminal().getId(),
        sale.getShift() != null ? sale.getShift().getId() : null,
        sale.getStatus().name(),
        sale.getReceipt() != null ? sale.getReceipt().getId() : null,
        sale.getCustomer() != null ? sale.getCustomer().getId() : null,
        sale.getSubtotal(),
        sale.getTaxTotal(),
        sale.getDiscountTotal(),
        sale.getServiceChargeTotal(),
        sale.getTotal(),
        sale.getCreatedByStaffUser().getId(),
        sale.getCreatedAt(),
        sale.getCompletedAt(),
        lineResponses,
        tenderResponses);
  }

  private SaleLineResponse toSaleLineResponse(SaleLine line) {
    List<SaleLineModifier> modifiers =
        saleLineModifierRepository.findBySaleLineIdOrderByCreatedAtWithModifierOption(line.getId());
    List<SaleLineModifierResponse> modResponses =
        modifiers.stream()
            .map(
                m ->
                    new SaleLineModifierResponse(
                        m.getId(),
                        m.getModifierOption().getId(),
                        m.getModifierOption().getName(),
                        m.getQty(),
                        m.getPriceDelta()))
            .toList();
    return new SaleLineResponse(
        line.getId(),
        line.getSale().getId(),
        line.getItem().getId(),
        line.getItem().getName(),
        line.getQty(),
        line.getUom() != null ? line.getUom().getId() : null,
        line.getUnitPrice(),
        line.getLineSubtotal(),
        line.getLineTotal(),
        line.getCreatedAt(),
        modResponses);
  }

  private TenderResponse toTenderResponse(Tender t) {
    return new TenderResponse(
        t.getId(),
        t.getSale().getId(),
        t.getTenderType().getId(),
        t.getTenderType().getCode(),
        t.getAmount(),
        t.getCurrency(),
        t.getCapturedByStaffUser().getId(),
        t.getCapturedAt());
  }

  private static ReceiptResponse toReceiptResponse(Receipt r) {
    return new ReceiptResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getBranch().getId(),
        r.getTerminal().getId(),
        r.getBusinessDate(),
        r.getReceiptNumber(),
        r.getPrintedAt(),
        r.getReprintCount(),
        r.getCreatedAt());
  }
}
