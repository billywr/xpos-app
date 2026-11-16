package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingResponse;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingStatsResponse;
import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.ledger.service.LedgerPostingService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.Receipt;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import com.blinc.xpos.modules.sales.repository.TenderTypeRepository;
import com.blinc.xpos.modules.sales.service.ReceiptService;
import com.blinc.xpos.modules.sales.service.SalesRecordingService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalesRecordingServiceImpl implements SalesRecordingService {

  private static final int BACKDATE_MAX_DAYS = 14;
  private static final int SCALE = 2;
  private static final int INV_SCALE = 3;
  private static final String DEFAULT_CURRENCY = "KES";
  private static final String CASH_CODE = "CASH";
  private static final int TOP_SELLERS_LIMIT = 5;
  private static final int LOW_STOCK_LIMIT = 10;

  private final SaleRepository saleRepository;
  private final SaleLineRepository saleLineRepository;
  private final TenderRepository tenderRepository;
  private final TenderTypeRepository tenderTypeRepository;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final StaffUserService staffUserService;
  private final ItemService itemService;
  private final InventoryItemService inventoryItemService;
  private final InventoryItemRepository inventoryItemRepository;
  private final StockMovementRepository stockMovementRepository;
  private final ReceiptService receiptService;
  private final LedgerPostingService ledgerPostingService;
  private final AuditLogService auditLogService;
  private final Clock clock;

  @SuppressWarnings("checkstyle:ParameterNumber")
  public SalesRecordingServiceImpl(
      SaleRepository saleRepository,
      SaleLineRepository saleLineRepository,
      TenderRepository tenderRepository,
      TenderTypeRepository tenderTypeRepository,
      BranchService branchService,
      TerminalService terminalService,
      StaffUserService staffUserService,
      ItemService itemService,
      InventoryItemService inventoryItemService,
      InventoryItemRepository inventoryItemRepository,
      StockMovementRepository stockMovementRepository,
      ReceiptService receiptService,
      LedgerPostingService ledgerPostingService,
      AuditLogService auditLogService,
      Clock clock) {
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.tenderRepository = Objects.requireNonNull(tenderRepository, "tenderRepository");
    this.tenderTypeRepository =
        Objects.requireNonNull(tenderTypeRepository, "tenderTypeRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.receiptService = Objects.requireNonNull(receiptService, "receiptService");
    this.ledgerPostingService =
        Objects.requireNonNull(ledgerPostingService, "ledgerPostingService");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public SalesRecordingResponse recordBatch(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID staffUserId,
      LocalDate saleDate,
      List<Entry> entries) {
    validateDate(saleDate);
    if (entries == null || entries.isEmpty()) {
      throw new BadRequestException("NO_ENTRIES", "At least one sale entry is required.");
    }
    Branch branch = branchService.require(orgId, branchId);
    Terminal terminal = terminalService.require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
    }
    StaffUser staff = staffUserService.require(orgId, staffUserId);
    TenderType cashTenderType = resolveCashTenderType(orgId);

    Map<UUID, BigDecimal> requiredPerItem = sumRequiredQtyPerItem(entries);
    preCheckStockForBatch(orgId, branchId, requiredPerItem);

    List<UUID> createdIds = new ArrayList<>(entries.size());
    BigDecimal totalValue = BigDecimal.ZERO;
    BigDecimal totalItems = BigDecimal.ZERO;
    for (Entry e : entries) {
      Item item = itemService.requireActive(orgId, e.itemId());
      BigDecimal qty = requireQty(e.qty());
      BigDecimal unitPrice = requireSellingPrice(item);
      Sale sale =
          persistSale(
              orgId, branch, terminal, staff, item, qty, unitPrice, saleDate, cashTenderType);
      createdIds.add(sale.getId());
      totalValue = totalValue.add(sale.getTotal());
      totalItems = totalItems.add(qty);
    }
    return new SalesRecordingResponse(
        saleDate,
        createdIds,
        totalValue.setScale(SCALE, RoundingMode.HALF_UP),
        totalItems.setScale(INV_SCALE, RoundingMode.HALF_UP));
  }

  private Sale persistSale(
      UUID orgId,
      Branch branch,
      Terminal terminal,
      StaffUser staff,
      Item item,
      BigDecimal qty,
      BigDecimal unitPrice,
      LocalDate saleDate,
      TenderType cashTenderType) {
    Instant now = Instant.now(clock);
    BigDecimal lineTotal = unitPrice.multiply(qty).setScale(SCALE, RoundingMode.HALF_UP);

    Sale sale = new Sale();
    sale.setOrg(branch.getOrg());
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setShift(null);
    sale.setStatus(SaleStatus.OPEN);
    sale.setSubtotal(lineTotal);
    sale.setTaxTotal(BigDecimal.ZERO);
    sale.setDiscountTotal(BigDecimal.ZERO);
    sale.setServiceChargeTotal(BigDecimal.ZERO);
    sale.setTotal(lineTotal);
    sale.setCreatedByStaffUser(staff);
    sale.setCreatedAt(now);
    sale.setBusinessDate(saleDate);
    Sale saved = saleRepository.save(sale);

    persistLine(saved, item, qty, unitPrice, lineTotal, now);
    persistCashTender(saved, cashTenderType, staff, lineTotal, branch.getCurrency(), now);
    persistStockMovement(orgId, saved, item, qty, staff, now);
    if (Boolean.TRUE.equals(item.getTrackInventory())) {
      inventoryItemService.decrementOnHand(orgId, branch.getId(), item.getId(), qty);
    }
    Receipt receipt = receiptService.createForSale(saved);
    saved.setReceipt(receipt);
    saved.setStatus(SaleStatus.COMPLETED);
    saved.setCompletedAt(Instant.now(clock));
    Sale finalSale = saleRepository.save(saved);
    auditLogService.append(
        orgId,
        branch.getId(),
        terminal.getId(),
        staff.getId(),
        "RECORD_HISTORICAL",
        "Sale",
        finalSale.getId(),
        null,
        null);
    ledgerPostingService.postSaleComplete(orgId, finalSale);
    return finalSale;
  }

  private void persistLine(
      Sale sale,
      Item item,
      BigDecimal qty,
      BigDecimal unitPrice,
      BigDecimal lineTotal,
      Instant now) {
    SaleLine line = new SaleLine();
    line.setOrg(sale.getOrg());
    line.setSale(sale);
    line.setItem(item);
    line.setQty(qty);
    line.setUom(null);
    line.setUnitPrice(unitPrice);
    line.setLineSubtotal(lineTotal);
    line.setLineTotal(lineTotal);
    line.setCreatedAt(now);
    saleLineRepository.save(line);
  }

  private void persistCashTender(
      Sale sale,
      TenderType cashTenderType,
      StaffUser staff,
      BigDecimal amount,
      String branchCurrency,
      Instant now) {
    Tender tender = new Tender();
    tender.setOrg(sale.getOrg());
    tender.setSale(sale);
    tender.setTenderType(cashTenderType);
    tender.setAmount(amount);
    tender.setCurrency(
        branchCurrency != null && !branchCurrency.isBlank() ? branchCurrency : DEFAULT_CURRENCY);
    tender.setCapturedByStaffUser(staff);
    tender.setCapturedAt(now);
    tenderRepository.save(tender);
  }

  private void persistStockMovement(
      UUID orgId, Sale sale, Item item, BigDecimal qty, StaffUser staff, Instant now) {
    if (!Boolean.TRUE.equals(item.getTrackInventory())) {
      return;
    }
    BigDecimal unitCost = BigDecimal.ZERO;
    var latestIn =
        stockMovementRepository.findLatestInByOrgAndBranchAndItem(
            orgId, sale.getBranch().getId(), item.getId(), PageRequest.of(0, 1));
    if (!latestIn.isEmpty() && latestIn.getContent().get(0).getUnitCost() != null) {
      unitCost = latestIn.getContent().get(0).getUnitCost();
    }
    StockMovement mov = new StockMovement();
    mov.setOrg(sale.getOrg());
    mov.setBranch(sale.getBranch());
    mov.setItem(item);
    mov.setMovementType(MovementType.OUT);
    mov.setQty(qty.setScale(INV_SCALE, RoundingMode.HALF_UP));
    mov.setUom(null);
    mov.setUnitCost(unitCost);
    mov.setSourceType(SourceType.SALE);
    mov.setSourceId(sale.getId());
    mov.setCreatedBy(staff);
    mov.setCreatedAt(now);
    stockMovementRepository.save(mov);
  }

  private void preCheckStockForBatch(
      UUID orgId, UUID branchId, Map<UUID, BigDecimal> requiredPerItem) {
    for (Map.Entry<UUID, BigDecimal> e : requiredPerItem.entrySet()) {
      Item item = itemService.requireActive(orgId, e.getKey());
      if (!Boolean.TRUE.equals(item.getTrackInventory())) {
        continue;
      }
      BigDecimal onHand = inventoryItemService.getOnHandQty(orgId, branchId, e.getKey());
      if (onHand.compareTo(e.getValue()) < 0) {
        throw new ConflictException(
            "INSUFFICIENT_STOCK",
            "Insufficient stock for "
                + item.getName()
                + ". Only "
                + onHand.stripTrailingZeros().toPlainString()
                + " remaining. (Hakuna stock ya kutosha.)");
      }
    }
  }

  private Map<UUID, BigDecimal> sumRequiredQtyPerItem(List<Entry> entries) {
    Map<UUID, BigDecimal> required = new HashMap<>();
    for (Entry e : entries) {
      if (e.itemId() == null) {
        throw new BadRequestException("ITEM_REQUIRED", "Item is required for every entry.");
      }
      BigDecimal qty = requireQty(e.qty());
      required.merge(e.itemId(), qty.setScale(INV_SCALE, RoundingMode.HALF_UP), BigDecimal::add);
    }
    return required;
  }

  private BigDecimal requireQty(BigDecimal qty) {
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException("INVALID_QUANTITY", "Quantity must be greater than zero.");
    }
    return qty.setScale(INV_SCALE, RoundingMode.HALF_UP);
  }

  private BigDecimal requireSellingPrice(Item item) {
    if (item.getDefaultSellingPrice() == null
        || item.getDefaultSellingPrice().compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException(
          "ITEM_NO_SELLING_PRICE",
          "Item '" + item.getName() + "' has no selling price. Set a selling price in Catalog.");
    }
    return item.getDefaultSellingPrice().setScale(SCALE, RoundingMode.HALF_UP);
  }

  private TenderType resolveCashTenderType(UUID orgId) {
    return tenderTypeRepository.findByOrgIdAndActiveTrue(orgId).stream()
        .filter(t -> CASH_CODE.equalsIgnoreCase(t.getCode()))
        .findFirst()
        .orElseThrow(
            () ->
                new NotFoundException(
                    "CASH_TENDER_NOT_CONFIGURED",
                    "No active Cash tender type configured for this organization."));
  }

  private void validateDate(LocalDate saleDate) {
    if (saleDate == null) {
      throw new BadRequestException("SALE_DATE_REQUIRED", "Sale date is required.");
    }
    LocalDate today = LocalDate.now(clock);
    LocalDate earliest = today.minusDays(BACKDATE_MAX_DAYS);
    if (saleDate.isAfter(today)) {
      throw new BadRequestException("SALE_DATE_FUTURE", "Sale date cannot be in the future.");
    }
    if (saleDate.isBefore(earliest)) {
      throw new BadRequestException(
          "SALE_DATE_TOO_OLD",
          "Sale date cannot be earlier than "
              + earliest
              + " ("
              + BACKDATE_MAX_DAYS
              + " days ago).");
    }
  }

  @Override
  @Transactional(readOnly = true)
  public SalesRecordingStatsResponse getStats(UUID orgId, UUID branchId, LocalDate saleDate) {
    if (saleDate == null) {
      throw new BadRequestException("SALE_DATE_REQUIRED", "Sale date is required.");
    }
    branchService.require(orgId, branchId);
    List<Sale> sales =
        saleRepository.findByOrgBranchStatusAndBusinessDate(
            orgId, branchId, SaleStatus.COMPLETED, saleDate);
    BigDecimal totalSales = BigDecimal.ZERO;
    Map<UUID, BigDecimal> qtyByItem = new HashMap<>();
    Map<UUID, BigDecimal> valueByItem = new HashMap<>();
    Map<UUID, String> nameByItem = new HashMap<>();
    for (Sale sale : sales) {
      totalSales = totalSales.add(sale.getTotal() != null ? sale.getTotal() : BigDecimal.ZERO);
      for (SaleLine line :
          saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(sale.getId())) {
        qtyByItem.merge(line.getItem().getId(), line.getQty(), BigDecimal::add);
        valueByItem.merge(line.getItem().getId(), line.getLineTotal(), BigDecimal::add);
        nameByItem.putIfAbsent(line.getItem().getId(), line.getItem().getName());
      }
    }
    BigDecimal totalItemsSold =
        qtyByItem.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    List<SalesRecordingStatsResponse.ItemSoldQty> soldByItem =
        qtyByItem.entrySet().stream()
            .map(
                e ->
                    new SalesRecordingStatsResponse.ItemSoldQty(
                        e.getKey(),
                        e.getValue().setScale(INV_SCALE, RoundingMode.HALF_UP),
                        valueByItem
                            .getOrDefault(e.getKey(), BigDecimal.ZERO)
                            .setScale(SCALE, RoundingMode.HALF_UP)))
            .toList();
    List<SalesRecordingStatsResponse.TopSellingItem> top =
        qtyByItem.entrySet().stream()
            .map(
                e ->
                    new SalesRecordingStatsResponse.TopSellingItem(
                        e.getKey(),
                        nameByItem.get(e.getKey()),
                        e.getValue().setScale(INV_SCALE, RoundingMode.HALF_UP),
                        valueByItem
                            .getOrDefault(e.getKey(), BigDecimal.ZERO)
                            .setScale(SCALE, RoundingMode.HALF_UP)))
            .sorted(
                Comparator.comparing(SalesRecordingStatsResponse.TopSellingItem::qtySold)
                    .reversed())
            .limit(TOP_SELLERS_LIMIT)
            .toList();
    List<SalesRecordingStatsResponse.LowStockItem> lowStock =
        inventoryItemRepository
            .findLowStockByOrgAndBranch(orgId, branchId, PageRequest.of(0, LOW_STOCK_LIMIT))
            .stream()
            .map(this::toLowStockItem)
            .toList();
    return new SalesRecordingStatsResponse(
        saleDate,
        totalSales.setScale(SCALE, RoundingMode.HALF_UP),
        totalItemsSold.setScale(INV_SCALE, RoundingMode.HALF_UP),
        sales.size(),
        top,
        lowStock,
        soldByItem);
  }

  private SalesRecordingStatsResponse.LowStockItem toLowStockItem(InventoryItem inv) {
    return new SalesRecordingStatsResponse.LowStockItem(
        inv.getItem().getId(),
        inv.getItem().getName(),
        inv.getOnHandQty().setScale(INV_SCALE, RoundingMode.HALF_UP));
  }
}
