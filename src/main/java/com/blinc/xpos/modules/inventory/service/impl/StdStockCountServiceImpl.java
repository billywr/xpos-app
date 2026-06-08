package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingResponse;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import com.blinc.xpos.modules.inventory.dto.StdStockCountCountDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRecordSalesResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRowDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSalesLineDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSalesLineStatus;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSalesPreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import com.blinc.xpos.modules.inventory.repository.GrnLineRepository;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.service.SalesRecordingService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Standard Stock Count Sheet service. Bar-style: {@code openingStock} is the latest saved physical
 * closing before the sheet date when a snapshot exists; otherwise {@code 0} (no ledger-derived
 * fallback — operators must save a closing to seed the chain). {@code addedStock} and {@code
 * addedTodayStock} cover receipts from the day after that last save through the sheet date. Units
 * Sold = Total − Closing.
 */
@Service
public class StdStockCountServiceImpl implements StdStockCountService {

  private static final int SCALE = 3;
  private static final int MONEY_SCALE = 2;
  private static final int BACKDATE_MAX_DAYS = 7;
  private static final int COMMENTS_MAX_LEN = 2000;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final GrnLineRepository grnLineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;
  private final SalesRecordingService salesRecordingService;
  private final SaleLineRepository saleLineRepository;
  private final AuditLogService auditLogService;
  private final Clock clock;

  @SuppressWarnings("checkstyle:ParameterNumber")
  public StdStockCountServiceImpl(
      StdStockCountSnapshotRepository snapshotRepository,
      GrnLineRepository grnLineRepository,
      StockMovementRepository stockMovementRepository,
      ItemRepository itemRepository,
      BranchService branchService,
      SalesRecordingService salesRecordingService,
      SaleLineRepository saleLineRepository,
      AuditLogService auditLogService,
      Clock clock) {
    this.snapshotRepository = Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.salesRecordingService =
        Objects.requireNonNull(salesRecordingService, "salesRecordingService");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  private static void applyCommentsIfPresent(
      StdStockCountCountDto dto, StdStockCountSnapshot snap) {
    dto.comments()
        .ifPresent(
            raw -> {
              if (raw == null || raw.isBlank()) {
                snap.setComments(null);
              } else {
                String t = raw.trim();
                snap.setComments(
                    t.length() > COMMENTS_MAX_LEN ? t.substring(0, COMMENTS_MAX_LEN) : t);
              }
            });
  }

  private static Map<UUID, BigDecimal> qtyByItemFromSumRows(List<Object[]> rows) {
    return rows.stream()
        .collect(
            Collectors.toMap(
                row -> (UUID) row[0], row -> ((BigDecimal) row[1]).setScale(SCALE, ROUNDING)));
  }

  private static BigDecimal nonnegativeQtyFromLedgerQty(BigDecimal qty) {
    BigDecimal scaled = qty.setScale(SCALE, ROUNDING);
    return scaled.signum() < 0 ? BigDecimal.ZERO.setScale(SCALE) : scaled;
  }

  /**
   * Strip trailing zeros so whole-number quantities serialize as integers (e.g. {@code 5} not
   * {@code 5.000}).
   */
  private static BigDecimal compact(BigDecimal x) {
    if (x == null) {
      return null;
    }
    BigDecimal s = x.stripTrailingZeros();
    return s.scale() < 0 ? s.setScale(0) : s;
  }

  @Override
  @Transactional(readOnly = true)
  public StdStockCountSheetDto getSheet(UUID orgId, UUID branchId, LocalDate businessDate) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = ZoneId.of(branch.getTimezone());
    Instant dayEnd = businessDate.plusDays(1).atStartOfDay(zone).toInstant();

    List<Item> items = itemRepository.findActiveWithSellingPriceByOrgId(orgId);
    if (items.isEmpty()) {
      return new StdStockCountSheetDto(businessDate, branchId, List.of());
    }

    List<StdStockCountSnapshot> todaySnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, businessDate);
    Map<UUID, StdStockCountSnapshot> todayByItem =
        todaySnapshots.stream()
            .collect(Collectors.toMap(s -> s.getItem().getId(), s -> s, (a, b) -> a));

    List<StdStockCountSnapshot> priorSnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDateBefore(branchId, businessDate);
    Set<LocalDate> blankSaveDates = computeBlankSaveDates(priorSnapshots);
    Map<UUID, StdStockCountSnapshot> latestPriorByItem =
        resolveLatestMeaningfulPriorByItem(priorSnapshots, blankSaveDates);

    Map<UUID, BigDecimal> addedGrnByItem =
        loadReceiptQtyByItemForRanges(
            orgId, branchId, zone, businessDate, dayEnd, items, latestPriorByItem);
    Map<UUID, BigDecimal> stockTakeAddedByItem =
        loadStockTakeAddedByItemForRanges(
            orgId, branchId, zone, businessDate, dayEnd, items, latestPriorByItem);

    List<StdStockCountRowDto> rows = new ArrayList<>();
    for (Item item : items) {
      UUID itemId = item.getId();
      BigDecimal addedGrn = addedGrnByItem.getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal addedToday = stockTakeAddedByItem.getOrDefault(itemId, BigDecimal.ZERO);
      StdStockCountSnapshot priorSnap = latestPriorByItem.get(itemId);
      BigDecimal opening =
          priorSnap != null
              ? nonnegativeQtyFromLedgerQty(priorSnap.getClosingQty())
              : BigDecimal.ZERO.setScale(SCALE);
      BigDecimal price =
          item.getDefaultSellingPrice() != null ? item.getDefaultSellingPrice() : BigDecimal.ZERO;
      StdStockCountSnapshot snap = todayByItem.get(itemId);
      BigDecimal closing = snap != null ? snap.getClosingQty().setScale(SCALE, ROUNDING) : null;
      Instant lastSavedAt = snap != null ? snap.getLastSavedAt() : null;
      String rowComments = snap != null ? snap.getComments() : null;

      rows.add(
          new StdStockCountRowDto(
              itemId,
              item.getSku() != null ? item.getSku() : "",
              item.getName(),
              compact(opening),
              compact(addedGrn),
              compact(addedToday),
              price,
              compact(closing),
              lastSavedAt,
              rowComments));
    }

    return new StdStockCountSheetDto(businessDate, branchId, rows);
  }

  /**
   * A "blank save day" is when multiple items were saved together with closing zero — typically
   * opening a sheet with no stock carried forward and clicking Save. Those rows must not block
   * carry-forward from an earlier meaningful count.
   */
  private static Set<LocalDate> computeBlankSaveDates(List<StdStockCountSnapshot> priorSnapshots) {
    Map<LocalDate, List<StdStockCountSnapshot>> byDate =
        priorSnapshots.stream()
            .collect(Collectors.groupingBy(StdStockCountSnapshot::getBusinessDate));
    Set<LocalDate> blank = new HashSet<>();
    for (Map.Entry<LocalDate, List<StdStockCountSnapshot>> entry : byDate.entrySet()) {
      List<StdStockCountSnapshot> snaps = entry.getValue();
      if (snaps.size() > 1 && snaps.stream().allMatch(s -> s.getClosingQty().signum() == 0)) {
        blank.add(entry.getKey());
      }
    }
    return blank;
  }

  private static Map<UUID, StdStockCountSnapshot> resolveLatestMeaningfulPriorByItem(
      List<StdStockCountSnapshot> priorSnapshots, Set<LocalDate> blankSaveDates) {
    Map<UUID, List<StdStockCountSnapshot>> byItem =
        priorSnapshots.stream().collect(Collectors.groupingBy(s -> s.getItem().getId()));
    Map<UUID, StdStockCountSnapshot> latestPriorByItem = new HashMap<>();
    for (Map.Entry<UUID, List<StdStockCountSnapshot>> entry : byItem.entrySet()) {
      entry.getValue().stream()
          .sorted(Comparator.comparing(StdStockCountSnapshot::getBusinessDate).reversed())
          .filter(
              s -> s.getClosingQty().signum() > 0 || !blankSaveDates.contains(s.getBusinessDate()))
          .findFirst()
          .ifPresent(s -> latestPriorByItem.put(entry.getKey(), s));
    }
    return latestPriorByItem;
  }

  private static LocalDate addedRangeStartForItem(
      LocalDate businessDate, UUID itemId, Map<UUID, StdStockCountSnapshot> latestPriorByItem) {
    StdStockCountSnapshot prior = latestPriorByItem.get(itemId);
    return prior != null ? prior.getBusinessDate().plusDays(1) : businessDate;
  }

  private static Set<LocalDate> distinctAddedRangeStarts(
      LocalDate businessDate,
      List<Item> items,
      Map<UUID, StdStockCountSnapshot> latestPriorByItem) {
    Set<LocalDate> rangeStarts = new HashSet<>();
    for (Item item : items) {
      rangeStarts.add(addedRangeStartForItem(businessDate, item.getId(), latestPriorByItem));
    }
    return rangeStarts;
  }

  private Map<UUID, BigDecimal> loadReceiptQtyByItemForRanges(
      UUID orgId,
      UUID branchId,
      ZoneId zone,
      LocalDate businessDate,
      Instant dayEnd,
      List<Item> items,
      Map<UUID, StdStockCountSnapshot> latestPriorByItem) {
    Map<UUID, BigDecimal> addedGrnByItem = new HashMap<>();
    for (LocalDate rangeStart : distinctAddedRangeStarts(businessDate, items, latestPriorByItem)) {
      Instant rangeStartInstant = rangeStart.atStartOfDay(zone).toInstant();
      addedGrnByItem.putAll(
          qtyByItemFromSumRows(
              grnLineRepository.sumLineQtyByItemIdForBranchAndGrnReceivedAtRange(
                  orgId, branchId, rangeStartInstant, dayEnd)));
    }
    return addedGrnByItem;
  }

  private Map<UUID, BigDecimal> loadStockTakeAddedByItemForRanges(
      UUID orgId,
      UUID branchId,
      ZoneId zone,
      LocalDate businessDate,
      Instant dayEnd,
      List<Item> items,
      Map<UUID, StdStockCountSnapshot> latestPriorByItem) {
    Map<UUID, BigDecimal> stockTakeAddedByItem = new HashMap<>();
    for (LocalDate rangeStart : distinctAddedRangeStarts(businessDate, items, latestPriorByItem)) {
      Instant rangeStartInstant = rangeStart.atStartOfDay(zone).toInstant();
      stockTakeAddedByItem.putAll(
          qtyByItemFromSumRows(
              stockMovementRepository.sumStockTakePositiveAdjustQtyByItemIdForBranchAndDateRange(
                  orgId, branchId, rangeStartInstant, dayEnd)));
    }
    return stockTakeAddedByItem;
  }

  @Override
  @Transactional
  public StdStockCountSheetDto saveCounts(
      UUID orgId, UUID branchId, UUID staffUserId, StdStockCountSaveRequest request) {
    if (!branchId.equals(request.outletId())) {
      throw new ConflictException("OUTLET_MISMATCH", "Branch ID does not match request outlet ID.");
    }
    branchService.require(orgId, branchId);
    Instant now = Instant.now();

    Branch branch = branchService.require(orgId, branchId);

    for (StdStockCountCountDto dto : request.counts()) {
      Optional<StdStockCountSnapshot> existingOpt =
          snapshotRepository.findByBranchAndItemAndDate(branchId, dto.itemId(), request.date());

      StdStockCountSnapshot snap;
      if (existingOpt.isPresent()) {
        snap = existingOpt.get();
      } else {
        var itemOpt = itemRepository.findByIdAndOrgId(dto.itemId(), orgId);
        if (itemOpt.isEmpty()) {
          continue;
        }
        snap = new StdStockCountSnapshot();
        snap.setOrg(branch.getOrg());
        snap.setBranch(branch);
        snap.setItem(itemOpt.get());
        snap.setBusinessDate(request.date());
        snap.setCreatedAt(now);
      }

      BigDecimal qty =
          dto.closingStock() != null
              ? dto.closingStock().setScale(SCALE, ROUNDING)
              : BigDecimal.ZERO;
      if (qty.compareTo(BigDecimal.ZERO) < 0) {
        qty = BigDecimal.ZERO;
      }
      snap.setClosingQty(qty);
      snap.setLastSavedAt(now);
      applyCommentsIfPresent(dto, snap);
      snapshotRepository.save(snap);
    }

    return getSheet(orgId, branchId, request.date());
  }

  @Override
  @Transactional(readOnly = true)
  public StdStockCountSalesPreviewDto previewSalesFromSheet(
      UUID orgId, UUID branchId, LocalDate businessDate) {
    validateSaleDate(businessDate);
    branchService.require(orgId, branchId);
    List<StdStockCountSalesLineDto> lines = buildSalesLineDtos(orgId, branchId, businessDate);
    return toPreviewDto(businessDate, branchId, lines);
  }

  @Override
  @Transactional
  public StdStockCountRecordSalesResponse recordSalesFromSheet(
      UUID orgId, UUID branchId, UUID terminalId, UUID staffUserId, LocalDate businessDate) {
    validateSaleDate(businessDate);
    branchService.require(orgId, branchId);
    List<StdStockCountSalesLineDto> previewLines =
        buildSalesLineDtos(orgId, branchId, businessDate);
    List<SalesRecordingService.Entry> entries = new ArrayList<>();
    for (StdStockCountSalesLineDto line : previewLines) {
      if (line.qtyToRecord() != null && line.qtyToRecord().compareTo(BigDecimal.ZERO) > 0) {
        entries.add(new SalesRecordingService.Entry(line.itemId(), line.qtyToRecord()));
      }
    }
    if (entries.isEmpty()) {
      return new StdStockCountRecordSalesResponse(
          businessDate,
          terminalId,
          BigDecimal.ZERO.setScale(SCALE),
          BigDecimal.ZERO.setScale(MONEY_SCALE),
          List.of(),
          previewLines);
    }
    SalesRecordingResponse batch =
        salesRecordingService.recordBatch(
            orgId, branchId, terminalId, staffUserId, businessDate, entries);
    auditLogService.append(
        orgId,
        branchId,
        terminalId,
        staffUserId,
        "RECORD_FROM_STD_STOCK_COUNT",
        "StdStockCountSheet",
        branchId,
        null,
        null);
    List<StdStockCountSalesLineDto> recordedLines = markRecordedLines(previewLines, entries);
    return new StdStockCountRecordSalesResponse(
        businessDate,
        terminalId,
        batch.totalItemsSold(),
        batch.totalValue(),
        batch.createdSaleIds(),
        recordedLines);
  }

  private void validateSaleDate(LocalDate saleDate) {
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
          "SALE_DATE_TOO_OLD", "Sale date cannot be earlier than " + earliest + " (7 days ago).");
    }
  }

  private Map<UUID, BigDecimal> loadAlreadyRecordedQtyByItem(
      UUID orgId, UUID branchId, LocalDate businessDate) {
    Map<UUID, BigDecimal> qtyByItem = new HashMap<>();
    for (Object[] row :
        saleLineRepository.sumQtyByItemForOrgBranchAndBusinessDate(orgId, branchId, businessDate)) {
      UUID itemId = (UUID) row[0];
      BigDecimal qty = ((BigDecimal) row[1]).setScale(SCALE, ROUNDING);
      qtyByItem.put(itemId, qty);
    }
    return qtyByItem;
  }

  private static BigDecimal impliedSoldFromRow(StdStockCountRowDto row) {
    if (row.closingStock() == null) {
      return null;
    }
    BigDecimal total =
        row.openingStock()
            .add(row.addedStock())
            .add(row.addedTodayStock() != null ? row.addedTodayStock() : BigDecimal.ZERO);
    BigDecimal implied = total.subtract(row.closingStock());
    if (implied.compareTo(BigDecimal.ZERO) < 0) {
      implied = BigDecimal.ZERO;
    }
    return implied.setScale(SCALE, ROUNDING);
  }

  private List<StdStockCountSalesLineDto> buildSalesLineDtos(
      UUID orgId, UUID branchId, LocalDate businessDate) {
    StdStockCountSheetDto sheet = getSheet(orgId, branchId, businessDate);
    Map<UUID, BigDecimal> alreadyRecorded =
        loadAlreadyRecordedQtyByItem(orgId, branchId, businessDate);
    List<StdStockCountSalesLineDto> lines = new ArrayList<>();
    for (StdStockCountRowDto row : sheet.rows()) {
      lines.add(buildSalesLineDto(row, alreadyRecorded));
    }
    return lines;
  }

  private static StdStockCountSalesLineDto buildSalesLineDto(
      StdStockCountRowDto row, Map<UUID, BigDecimal> alreadyRecorded) {
    BigDecimal zeroQty = BigDecimal.ZERO.setScale(SCALE);
    BigDecimal zeroMoney = BigDecimal.ZERO.setScale(MONEY_SCALE);
    BigDecimal unitPrice =
        row.sellingPrice() != null ? row.sellingPrice().setScale(MONEY_SCALE, ROUNDING) : zeroMoney;
    if (row.closingStock() == null) {
      return new StdStockCountSalesLineDto(
          row.itemId(),
          row.name(),
          zeroQty,
          alreadyRecorded.getOrDefault(row.itemId(), zeroQty),
          zeroQty,
          null,
          unitPrice,
          zeroMoney,
          StdStockCountSalesLineStatus.SKIPPED_NO_CLOSING);
    }
    BigDecimal implied = impliedSoldFromRow(row);
    BigDecimal already = alreadyRecorded.getOrDefault(row.itemId(), zeroQty);
    if (implied == null || implied.compareTo(BigDecimal.ZERO) == 0) {
      return new StdStockCountSalesLineDto(
          row.itemId(),
          row.name(),
          zeroQty,
          already,
          zeroQty,
          null,
          unitPrice,
          zeroMoney,
          StdStockCountSalesLineStatus.SKIPPED_NO_IMPLIED_SALE);
    }
    BigDecimal qtyToRecord = implied.subtract(already).max(zeroQty);
    BigDecimal lineValue = qtyToRecord.multiply(unitPrice).setScale(MONEY_SCALE, ROUNDING);
    StdStockCountSalesLineStatus status;
    if (already.compareTo(implied) > 0) {
      status = StdStockCountSalesLineStatus.WARNING_OVER_RECORDED;
    } else if (qtyToRecord.compareTo(BigDecimal.ZERO) == 0) {
      status = StdStockCountSalesLineStatus.SKIPPED_NO_QTY;
    } else {
      status = null;
    }
    return new StdStockCountSalesLineDto(
        row.itemId(),
        row.name(),
        implied,
        already,
        qtyToRecord,
        null,
        unitPrice,
        lineValue,
        status);
  }

  private static StdStockCountSalesPreviewDto toPreviewDto(
      LocalDate businessDate, UUID branchId, List<StdStockCountSalesLineDto> lines) {
    BigDecimal totalQty = BigDecimal.ZERO.setScale(SCALE);
    BigDecimal totalValue = BigDecimal.ZERO.setScale(MONEY_SCALE);
    for (StdStockCountSalesLineDto line : lines) {
      if (line.qtyToRecord() != null && line.qtyToRecord().compareTo(BigDecimal.ZERO) > 0) {
        totalQty = totalQty.add(line.qtyToRecord());
        totalValue = totalValue.add(line.lineValue() != null ? line.lineValue() : BigDecimal.ZERO);
      }
    }
    return new StdStockCountSalesPreviewDto(
        businessDate,
        branchId,
        lines,
        totalQty.setScale(SCALE, ROUNDING),
        totalValue.setScale(MONEY_SCALE, ROUNDING));
  }

  private static List<StdStockCountSalesLineDto> markRecordedLines(
      List<StdStockCountSalesLineDto> previewLines, List<SalesRecordingService.Entry> entries) {
    Map<UUID, BigDecimal> recordedQty = new HashMap<>();
    for (SalesRecordingService.Entry entry : entries) {
      recordedQty.merge(entry.itemId(), entry.qty(), BigDecimal::add);
    }
    List<StdStockCountSalesLineDto> out = new ArrayList<>(previewLines.size());
    for (StdStockCountSalesLineDto line : previewLines) {
      BigDecimal qtyRecorded = recordedQty.get(line.itemId());
      if (qtyRecorded != null && qtyRecorded.compareTo(BigDecimal.ZERO) > 0) {
        out.add(
            new StdStockCountSalesLineDto(
                line.itemId(),
                line.name(),
                line.impliedSold(),
                line.alreadyRecorded(),
                line.qtyToRecord(),
                qtyRecorded.setScale(SCALE, ROUNDING),
                line.unitPrice(),
                qtyRecorded.multiply(line.unitPrice()).setScale(MONEY_SCALE, ROUNDING),
                StdStockCountSalesLineStatus.RECORDED));
      } else {
        out.add(line);
      }
    }
    return out;
  }
}
