package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ModifierOption;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.ModifierOptionService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.debt.service.CustomerDebtService;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.ledger.service.LedgerPostingService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.domain.SaleLineModifier;
import com.blinc.xpos.modules.sales.repository.SaleLineModifierRepository;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.service.ReceiptService;
import com.blinc.xpos.modules.sales.service.SaleService;
import com.blinc.xpos.modules.sales.service.TenderService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SaleServiceImpl implements SaleService {

  private static final int SCALE = 2;
  private static final int INV_SCALE = 3;

  private final SaleRepository saleRepository;
  private final SaleLineRepository saleLineRepository;
  private final SaleLineModifierRepository saleLineModifierRepository;
  private final ShiftService shiftService;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final StaffUserService staffUserService;
  private final ItemService itemService;
  private final UomService uomService;
  private final ModifierOptionService modifierOptionService;
  private final ReceiptService receiptService;
  private final TenderService tenderService;
  private final CustomerService customerService;
  private final AuditLogService auditLogService;
  private final LedgerPostingService ledgerPostingService;
  private final InventoryItemService inventoryItemService;
  private final StockMovementRepository stockMovementRepository;
  private final StdStockCountSnapshotRepository stdStockCountSnapshotRepository;
  private final CustomerDebtService customerDebtService;
  private final Clock clock;

  @SuppressWarnings("checkstyle:ParameterNumber")
  public SaleServiceImpl(
      SaleRepository saleRepository,
      SaleLineRepository saleLineRepository,
      SaleLineModifierRepository saleLineModifierRepository,
      ShiftService shiftService,
      BranchService branchService,
      TerminalService terminalService,
      StaffUserService staffUserService,
      ItemService itemService,
      UomService uomService,
      ModifierOptionService modifierOptionService,
      ReceiptService receiptService,
      TenderService tenderService,
      CustomerService customerService,
      AuditLogService auditLogService,
      LedgerPostingService ledgerPostingService,
      InventoryItemService inventoryItemService,
      StockMovementRepository stockMovementRepository,
      StdStockCountSnapshotRepository stdStockCountSnapshotRepository,
      @Lazy CustomerDebtService customerDebtService,
      Clock clock) {
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.saleLineModifierRepository =
        Objects.requireNonNull(saleLineModifierRepository, "saleLineModifierRepository");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.modifierOptionService =
        Objects.requireNonNull(modifierOptionService, "modifierOptionService");
    this.receiptService = Objects.requireNonNull(receiptService, "receiptService");
    this.tenderService = Objects.requireNonNull(tenderService, "tenderService");
    this.customerService = Objects.requireNonNull(customerService, "customerService");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.ledgerPostingService =
        Objects.requireNonNull(ledgerPostingService, "ledgerPostingService");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.stdStockCountSnapshotRepository =
        Objects.requireNonNull(stdStockCountSnapshotRepository, "stdStockCountSnapshotRepository");
    this.customerDebtService = Objects.requireNonNull(customerDebtService, "customerDebtService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Sale create(
      UUID orgId, UUID branchId, UUID terminalId, UUID staffUserId, UUID customerId) {
    Branch branch = branchService.require(orgId, branchId);
    Terminal terminal = terminalService.require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
    }
    Shift shift =
        shiftService
            .getCurrentOpenShift(orgId, branchId, terminalId)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No open shift for this terminal. Open a shift first."));
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    Customer customer = null;
    if (customerId != null) {
      customer = customerService.require(orgId, customerId);
    }
    Sale sale = new Sale();
    sale.setOrg(branch.getOrg());
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setShift(shift);
    sale.setStatus(SaleStatus.OPEN);
    sale.setCustomer(customer);
    sale.setSubtotal(BigDecimal.ZERO);
    sale.setTaxTotal(BigDecimal.ZERO);
    sale.setDiscountTotal(BigDecimal.ZERO);
    sale.setServiceChargeTotal(BigDecimal.ZERO);
    sale.setTotal(BigDecimal.ZERO);
    sale.setCreatedByStaffUser(staffUser);
    Instant now = Instant.now(clock);
    sale.setCreatedAt(now);
    sale.setBusinessDate(resolveBusinessDate(branch, now));
    Sale saved = saleRepository.save(sale);
    return loadSaleWithAssociations(orgId, saved.getId());
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Sale> getByIdAndOrg(UUID orgId, UUID saleId) {
    return saleRepository.findByIdAndOrgIdWithAssociations(saleId, orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public List<Sale> listOpenOrHeld(UUID orgId, UUID branchId, UUID terminalId) {
    return saleRepository.findByOrgIdAndBranchIdAndTerminalIdAndStatusInWithAssociations(
        orgId, branchId, terminalId, List.of(SaleStatus.OPEN, SaleStatus.HELD));
  }

  @Override
  @Transactional(readOnly = true)
  public org.springframework.data.domain.Page<Sale> listByBranch(
      UUID orgId, UUID branchId, SaleStatus status, Instant start, Instant end, Pageable pageable) {
    branchService.require(orgId, branchId);
    return saleRepository.findByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
        orgId, branchId, status, start, end, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public List<SaleLine> listLines(UUID orgId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    return saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(sale.getId());
  }

  @Override
  @Transactional
  public Sale addLine(
      UUID orgId,
      UUID saleId,
      UUID itemId,
      BigDecimal qty,
      UUID uomId,
      BigDecimal unitPriceOverride,
      List<ModifierQuantity> modifiers) {
    Sale sale = requireOpenOrHeldSale(orgId, saleId);
    Item item = itemService.requireActive(orgId, itemId);
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    BigDecimal unitPrice = resolveUnitPrice(sale, orgId, itemId, unitPriceOverride);
    Uom uom = (uomId != null) ? uomService.require(orgId, uomId) : null;
    Instant now = Instant.now(clock);

    SaleLine line = new SaleLine();
    line.setOrg(sale.getOrg());
    line.setSale(sale);
    line.setItem(item);
    line.setQty(qty);
    line.setUom(uom);
    line.setUnitPrice(unitPrice);
    BigDecimal lineSubtotal = unitPrice.multiply(qty).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal modifierTotal = BigDecimal.ZERO;
    if (modifiers != null && !modifiers.isEmpty()) {
      for (ModifierQuantity mq : modifiers) {
        ModifierOption opt = modifierOptionService.require(orgId, mq.modifierOptionId());
        BigDecimal delta =
            opt.getPriceDelta().multiply(mq.qty()).setScale(SCALE, RoundingMode.HALF_UP);
        modifierTotal = modifierTotal.add(delta);
      }
    }
    line.setLineSubtotal(lineSubtotal);
    line.setLineTotal(lineSubtotal.add(modifierTotal).setScale(SCALE, RoundingMode.HALF_UP));
    line.setCreatedAt(now);
    saleLineRepository.save(line);
    if (modifiers != null && !modifiers.isEmpty()) {
      for (ModifierQuantity mq : modifiers) {
        ModifierOption opt = modifierOptionService.require(orgId, mq.modifierOptionId());
        SaleLineModifier slm = new SaleLineModifier();
        slm.setOrg(sale.getOrg());
        slm.setSaleLine(line);
        slm.setModifierOption(opt);
        slm.setQty(mq.qty());
        slm.setPriceDelta(opt.getPriceDelta());
        slm.setCreatedAt(now);
        saleLineModifierRepository.save(slm);
      }
    }

    recalcSaleTotals(sale);
    Sale saved = saleRepository.save(sale);
    return loadSaleWithAssociations(orgId, saved.getId());
  }

  @Override
  @Transactional
  public Sale hold(UUID orgId, UUID saleId) {
    Sale sale = requireOpenSale(orgId, saleId);
    sale.setStatus(SaleStatus.HELD);
    saleRepository.save(sale);
    return loadSaleWithAssociations(orgId, saleId);
  }

  @Override
  @Transactional
  public Sale complete(UUID orgId, UUID saleId) {
    Sale sale = requireOpenSale(orgId, saleId);
    BigDecimal tenderTotal = sumTenders(orgId, saleId);
    if (tenderTotal.compareTo(sale.getTotal()) < 0) {
      throw new IllegalStateException(
          "Tender total (" + tenderTotal + ") is less than sale total (" + sale.getTotal() + ")");
    }
    return doComplete(orgId, sale);
  }

  @Override
  @Transactional
  public Sale completeAllowingPartialWithDebt(UUID orgId, UUID saleId) {
    Sale sale = requireOpenSale(orgId, saleId);
    return doComplete(orgId, sale);
  }

  private Sale doComplete(UUID orgId, Sale sale) {
    List<SaleLine> lines =
        saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(sale.getId());
    Map<UUID, BigDecimal> qtyNeededByItem = new HashMap<>();
    for (SaleLine line : lines) {
      if (Boolean.TRUE.equals(line.getItem().getTrackInventory())) {
        UUID itemId = line.getItem().getId();
        qtyNeededByItem.merge(
            itemId, line.getQty().setScale(INV_SCALE, RoundingMode.HALF_UP), BigDecimal::add);
      }
    }
    for (Map.Entry<UUID, BigDecimal> e : qtyNeededByItem.entrySet()) {
      BigDecimal onHand =
          inventoryItemService.getOnHandQty(orgId, sale.getBranch().getId(), e.getKey());
      if (onHand.compareTo(e.getValue()) < 0) {
        Item item = itemService.require(orgId, e.getKey());
        throw new ConflictException(
            "INSUFFICIENT_STOCK",
            "Insufficient stock for "
                + item.getName()
                + ". Only "
                + onHand.stripTrailingZeros().toPlainString()
                + " remaining. (Hakuna stock ya kutosha.)");
      }
    }
    Instant now = Instant.now(clock);
    LocalDate businessDate =
        sale.getBusinessDate() != null
            ? sale.getBusinessDate()
            : resolveBusinessDate(sale.getBranch(), now);
    sale.setBusinessDate(businessDate);
    for (SaleLine line : lines) {
      if (Boolean.TRUE.equals(line.getItem().getTrackInventory())) {
        BigDecimal unitCost = BigDecimal.ZERO;
        var latestIn =
            stockMovementRepository.findLatestInByOrgAndBranchAndItem(
                orgId, sale.getBranch().getId(), line.getItem().getId(), PageRequest.of(0, 1));
        if (!latestIn.isEmpty() && latestIn.getContent().get(0).getUnitCost() != null) {
          unitCost = latestIn.getContent().get(0).getUnitCost();
        } else if (line.getItem().getBuyingPrice() != null) {
          unitCost = line.getItem().getBuyingPrice();
        }
        StockMovement mov = new StockMovement();
        mov.setOrg(sale.getOrg());
        mov.setBranch(sale.getBranch());
        mov.setItem(line.getItem());
        mov.setMovementType(MovementType.OUT);
        mov.setQty(line.getQty().setScale(INV_SCALE, RoundingMode.HALF_UP));
        mov.setUom(line.getUom());
        mov.setUnitCost(unitCost);
        mov.setSourceType(SourceType.SALE);
        mov.setSourceId(sale.getId());
        mov.setCreatedBy(sale.getCreatedByStaffUser());
        mov.setCreatedAt(now);
        stockMovementRepository.save(mov);
        inventoryItemService.decrementOnHand(
            orgId, sale.getBranch().getId(), line.getItem().getId(), line.getQty());
        stdStockCountSnapshotRepository
            .findByBranchIdAndItemIdAndBusinessDate(
                sale.getBranch().getId(), line.getItem().getId(), businessDate)
            .ifPresent(
                snap -> {
                  BigDecimal onHand =
                      inventoryItemService.getOnHandQty(
                          orgId, sale.getBranch().getId(), line.getItem().getId());
                  BigDecimal newClosing =
                      snap.getClosingQty().subtract(line.getQty()).max(BigDecimal.ZERO);
                  if (onHand != null
                      && newClosing.compareTo(onHand) < 0
                      && snap.getClosingQty().compareTo(onHand) < 0) {
                    newClosing = onHand;
                  }
                  snap.setClosingQty(newClosing.setScale(SCALE, RoundingMode.HALF_UP));
                  snap.setLastSavedAt(now);
                  stdStockCountSnapshotRepository.save(snap);
                });
      }
    }

    var receipt = receiptService.createForSale(sale);
    sale.setReceipt(receipt);
    sale.setStatus(SaleStatus.COMPLETED);
    sale.setCompletedAt(Instant.now(clock));
    Sale saved = saleRepository.save(sale);
    auditLogService.append(
        orgId,
        sale.getBranch().getId(),
        sale.getTerminal().getId(),
        sale.getCreatedByStaffUser().getId(),
        "COMPLETE",
        "Sale",
        sale.getId(),
        null,
        null);
    ledgerPostingService.postSaleComplete(orgId, saved);
    return loadSaleWithAssociations(orgId, saved.getId());
  }

  @Override
  @Transactional
  public Sale voidSale(UUID orgId, UUID saleId) {
    Sale sale = requireOpenOrHeldSale(orgId, saleId);
    sale.setStatus(SaleStatus.VOIDED);
    saleRepository.save(sale);
    auditLogService.append(
        orgId,
        sale.getBranch().getId(),
        sale.getTerminal().getId(),
        sale.getCreatedByStaffUser().getId(),
        "VOID",
        "Sale",
        sale.getId(),
        null,
        null);
    return loadSaleWithAssociations(orgId, saleId);
  }

  @Override
  @Transactional
  public Sale refundSale(UUID orgId, UUID saleId, UUID refundedByStaffUserId) {
    Sale sale = requireCompletedSale(orgId, saleId);
    List<SaleLine> lines =
        saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(sale.getId());

    Instant now = Instant.now(clock);
    for (SaleLine line : lines) {
      if (Boolean.TRUE.equals(line.getItem().getTrackInventory())) {
        BigDecimal unitCost = BigDecimal.ZERO;
        var latestIn =
            stockMovementRepository.findLatestInByOrgAndBranchAndItem(
                orgId, sale.getBranch().getId(), line.getItem().getId(), PageRequest.of(0, 1));
        if (!latestIn.isEmpty() && latestIn.getContent().get(0).getUnitCost() != null) {
          unitCost = latestIn.getContent().get(0).getUnitCost();
        } else if (line.getItem().getBuyingPrice() != null) {
          unitCost = line.getItem().getBuyingPrice();
        }
        StockMovement mov = new StockMovement();
        mov.setOrg(sale.getOrg());
        mov.setBranch(sale.getBranch());
        mov.setItem(line.getItem());
        mov.setMovementType(MovementType.IN);
        mov.setQty(line.getQty().setScale(INV_SCALE, RoundingMode.HALF_UP));
        mov.setUom(line.getUom());
        mov.setUnitCost(unitCost);
        mov.setSourceType(SourceType.REFUND);
        mov.setSourceId(sale.getId());
        mov.setCreatedBy(staffUserService.require(orgId, refundedByStaffUserId));
        mov.setCreatedAt(now);
        stockMovementRepository.save(mov);
        inventoryItemService.incrementOnHand(
            orgId, sale.getBranch().getId(), line.getItem().getId(), line.getQty());
        LocalDate refundBusinessDate =
            sale.getBusinessDate() != null
                ? sale.getBusinessDate()
                : resolveBusinessDate(sale.getBranch(), now);
        stdStockCountSnapshotRepository
            .findByBranchIdAndItemIdAndBusinessDate(
                sale.getBranch().getId(), line.getItem().getId(), refundBusinessDate)
            .ifPresent(
                snap -> {
                  BigDecimal onHand =
                      inventoryItemService.getOnHandQty(
                          orgId, sale.getBranch().getId(), line.getItem().getId());
                  BigDecimal newClosing = snap.getClosingQty().add(line.getQty());
                  if (onHand != null
                      && newClosing.compareTo(onHand) < 0
                      && snap.getClosingQty().compareTo(onHand) < 0) {
                    newClosing = onHand;
                  }
                  snap.setClosingQty(newClosing.setScale(SCALE, RoundingMode.HALF_UP));
                  snap.setLastSavedAt(now);
                  stdStockCountSnapshotRepository.save(snap);
                });
      }
    }

    customerDebtService.cancelDebtsForSale(orgId, saleId, refundedByStaffUserId);

    sale.setStatus(SaleStatus.REFUNDED);
    saleRepository.save(sale);
    auditLogService.append(
        orgId,
        sale.getBranch().getId(),
        sale.getTerminal().getId(),
        refundedByStaffUserId,
        "REFUND",
        "Sale",
        sale.getId(),
        null,
        null);
    return loadSaleWithAssociations(orgId, saleId);
  }

  private Sale requireCompletedSale(UUID orgId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    if (sale.getStatus() != SaleStatus.COMPLETED) {
      throw new IllegalStateException(
          "Sale must be completed to refund. Current status: " + sale.getStatus());
    }
    return sale;
  }

  private Sale loadSaleWithAssociations(UUID orgId, UUID saleId) {
    return saleRepository
        .findByIdAndOrgIdWithAssociations(saleId, orgId)
        .orElseThrow(() -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
  }

  private Sale requireOpenSale(UUID orgId, UUID saleId) {
    Sale sale = loadSaleWithAssociations(orgId, saleId);
    if (sale.getStatus() != SaleStatus.OPEN) {
      throw new BadRequestException(
          "SALE_NOT_OPEN", "Sale is not open. Status: " + sale.getStatus());
    }
    return sale;
  }

  private Sale requireOpenOrHeldSale(UUID orgId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    if (sale.getStatus() != SaleStatus.OPEN && sale.getStatus() != SaleStatus.HELD) {
      throw new IllegalStateException(
          "Sale must be open or held. Current status: " + sale.getStatus());
    }
    return sale;
  }

  private BigDecimal resolveUnitPrice(Sale sale, UUID orgId, UUID itemId, BigDecimal override) {
    if (override != null && override.compareTo(BigDecimal.ZERO) >= 0) {
      return override.setScale(SCALE, RoundingMode.HALF_UP);
    }
    Item item = itemService.requireActive(orgId, itemId);
    if (item.getDefaultSellingPrice() == null
        || item.getDefaultSellingPrice().compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException(
          "ITEM_NO_SELLING_PRICE",
          "Item '" + item.getName() + "' has no selling price. Set a selling price in Catalog.");
    }
    return item.getDefaultSellingPrice().setScale(SCALE, RoundingMode.HALF_UP);
  }

  private void recalcSaleTotals(Sale sale) {
    List<SaleLine> lines = saleLineRepository.findBySaleIdOrderByCreatedAt(sale.getId());
    BigDecimal subtotal =
        lines.stream()
            .map(SaleLine::getLineTotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(SCALE, RoundingMode.HALF_UP);
    sale.setSubtotal(subtotal);
    sale.setTaxTotal(BigDecimal.ZERO);
    sale.setDiscountTotal(BigDecimal.ZERO);
    sale.setServiceChargeTotal(BigDecimal.ZERO);
    sale.setTotal(subtotal);
  }

  private BigDecimal sumTenders(UUID orgId, UUID saleId) {
    return tenderService.listBySale(orgId, saleId).stream()
        .map(t -> t.getAmount())
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private LocalDate resolveBusinessDate(Branch branch, Instant instant) {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    if (branch != null && branch.getTimezone() != null && !branch.getTimezone().isBlank()) {
      try {
        zone = ZoneId.of(branch.getTimezone().trim());
      } catch (Exception ignored) {
        // Fallback to Africa/Nairobi
      }
    }
    return instant.atZone(zone).toLocalDate();
  }
}
