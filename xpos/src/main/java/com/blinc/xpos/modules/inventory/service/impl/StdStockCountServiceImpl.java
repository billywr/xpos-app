package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingResponse;
import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.dto.StdStockCountAutoSyncResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountCountDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcileLineDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcilePreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcileResponse;
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
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.service.SalesRecordingService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Standard Stock Count Sheet service. Bar-style: {@code openingStock} is the effective
 * carry-forward from the latest meaningful saved closing before the sheet date, plus GRN/stock-take
 * receipts on that prior day that arrived after {@code last_saved_at}; otherwise {@code 0} (no
 * ledger-derived fallback). {@code addedStock} and {@code addedTodayStock} cover GRN receipts and
 * stock-take positive adjustments on the sheet date only (not accumulated from skipped days). Units
 * Sold = Total − Closing.
 */
@Service
public class StdStockCountServiceImpl implements StdStockCountService {

  private static final int SCALE = 3;
  private static final int MONEY_SCALE = 2;
  private static final int BACKDATE_MAX_DAYS = 14;
  private static final int COMMENTS_MAX_LEN = 2000;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final GrnLineRepository grnLineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;
  private final SalesRecordingService salesRecordingService;
  private final SaleLineRepository saleLineRepository;
  private final InventoryItemService inventoryItemService;
  private final StaffUserService staffUserService;
  private final AuditLogService auditLogService;
  private final Clock clock;
  private final EntityManager entityManager;

  @Value("${xpos.std-stock-count.auto-sync.max-backfill-days:90}")
  private int autoSyncMaxBackfillDays;

  @SuppressWarnings("checkstyle:ParameterNumber")
  public StdStockCountServiceImpl(
      StdStockCountSnapshotRepository snapshotRepository,
      GrnLineRepository grnLineRepository,
      StockMovementRepository stockMovementRepository,
      ItemRepository itemRepository,
      BranchService branchService,
      SalesRecordingService salesRecordingService,
      SaleLineRepository saleLineRepository,
      InventoryItemService inventoryItemService,
      StaffUserService staffUserService,
      AuditLogService auditLogService,
      Clock clock,
      EntityManager entityManager) {
    this.snapshotRepository = Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.salesRecordingService =
        Objects.requireNonNull(salesRecordingService, "salesRecordingService");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.clock = Objects.requireNonNull(clock, "clock");
    this.entityManager = Objects.requireNonNull(entityManager, "entityManager");
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

    List<Item> sortedItems = sortItemsBySalesVelocity(orgId, branchId, items, businessDate, zone);

    List<StdStockCountSnapshot> todaySnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, businessDate);
    Map<UUID, StdStockCountSnapshot> todayByItem =
        todaySnapshots.stream()
            .collect(Collectors.toMap(s -> s.getItem().getId(), s -> s, (a, b) -> a));

    List<StdStockCountSnapshot> priorSnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDateBefore(branchId, businessDate);
    Set<LocalDate> blankSaveDates = computeBlankSaveDates(priorSnapshots);
    Map<UUID, List<StdStockCountSnapshot>> priorByItem =
        priorSnapshots.stream().collect(Collectors.groupingBy(s -> s.getItem().getId()));

    Set<LocalDate> neededDates = new HashSet<>();
    for (Item item : sortedItems) {
      collectNeededDates(item.getId(), businessDate, priorByItem, blankSaveDates, neededDates);
    }

    LocalDate minDate = neededDates.isEmpty() ? businessDate : Collections.min(neededDates);
    if (minDate.isAfter(businessDate)) {
      minDate = businessDate;
    }
    Instant rangeStart = minDate.atStartOfDay(zone).toInstant();

    List<Object[]> grnRows =
        grnLineRepository.findGrnLineQtyWithReceivedAtAndDateByBranchAndRange(
            orgId, branchId, rangeStart, dayEnd);
    List<Object[]> stockTakeRows =
        stockMovementRepository.findStockTakePositiveAdjustRowsByBranchAndDateRange(
            orgId, branchId, rangeStart, dayEnd);

    PartitionedDateData grnData = partitionGrnRows(grnRows, zone);
    PartitionedDateData stockTakeData = partitionStockTakeRows(stockTakeRows, zone);

    Map<UUID, BigDecimal> addedGrnByItem =
        grnData.addedByDate().getOrDefault(businessDate, Map.of());
    Map<UUID, BigDecimal> stockTakeAddedByItem =
        stockTakeData.addedByDate().getOrDefault(businessDate, Map.of());

    Map<UUID, Instant> firstStockAddedAtByItem = new HashMap<>();
    Map<UUID, Instant> latestStockAddedAtByItem = new HashMap<>();
    mergeEarliestTimestampedQtyRows(
        firstStockAddedAtByItem, grnData.rowsByDate().getOrDefault(businessDate, List.of()));
    mergeEarliestTimestampedQtyRows(
        firstStockAddedAtByItem, stockTakeData.rowsByDate().getOrDefault(businessDate, List.of()));
    mergeLatestTimestampedQtyRows(
        latestStockAddedAtByItem, grnData.rowsByDate().getOrDefault(businessDate, List.of()));
    mergeLatestTimestampedQtyRows(
        latestStockAddedAtByItem, stockTakeData.rowsByDate().getOrDefault(businessDate, List.of()));

    Set<LocalDate> datesForSales = new HashSet<>(neededDates);
    datesForSales.add(businessDate);
    List<Object[]> saleRows =
        saleLineRepository.sumQtyByItemForOrgBranchAndBusinessDates(orgId, branchId, datesForSales);
    Map<LocalDate, Map<UUID, BigDecimal>> salesData = partitionSalesRows(saleRows);

    CarryForwardContext carryForward =
        new CarryForwardContext(
            priorByItem,
            blankSaveDates,
            grnData.rowsByDate(),
            stockTakeData.rowsByDate(),
            grnData.addedByDate(),
            stockTakeData.addedByDate(),
            salesData);

    Map<UUID, BigDecimal> recordedSalesToday = salesData.getOrDefault(businessDate, Map.of());

    List<StdStockCountRowDto> rows =
        buildSheetRows(
            sortedItems,
            addedGrnByItem,
            stockTakeAddedByItem,
            firstStockAddedAtByItem,
            latestStockAddedAtByItem,
            carryForward,
            todayByItem,
            recordedSalesToday,
            businessDate);

    return new StdStockCountSheetDto(businessDate, branchId, rows);
  }

  private List<Item> sortItemsBySalesVelocity(
      UUID orgId, UUID branchId, List<Item> items, LocalDate businessDate, ZoneId zone) {
    LocalDate salesSinceDate = businessDate.minusDays(90);
    Instant salesSinceInstant = salesSinceDate.atStartOfDay(zone).toInstant();
    List<Object[]> amountRows =
        saleLineRepository.sumAmountYieldByItemForOrgBranchSince(
            orgId, branchId, salesSinceDate, salesSinceInstant);
    if (amountRows.isEmpty()) {
      amountRows = saleLineRepository.sumAmountYieldByItemForOrgBranch(orgId, branchId);
    }
    Map<UUID, BigDecimal> amountYieldByItem = new HashMap<>();
    for (Object[] r : amountRows) {
      amountYieldByItem.put((UUID) r[0], (BigDecimal) r[1]);
    }

    List<Item> sortedItems = new ArrayList<>(items);
    sortedItems.sort(
        Comparator.<Item, BigDecimal>comparing(
                item -> amountYieldByItem.getOrDefault(item.getId(), BigDecimal.ZERO),
                Comparator.reverseOrder())
            .thenComparing(Item::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
    return sortedItems;
  }

  private record PartitionedDateData(
      Map<LocalDate, List<Object[]>> rowsByDate,
      Map<LocalDate, Map<UUID, BigDecimal>> addedByDate) {}

  private static PartitionedDateData partitionGrnRows(List<Object[]> grnRows, ZoneId zone) {
    Map<LocalDate, List<Object[]>> rowsByDate = new HashMap<>();
    Map<LocalDate, Map<UUID, BigDecimal>> addedByDate = new HashMap<>();
    for (Object[] row : grnRows) {
      UUID itemId = (UUID) row[0];
      Instant createdAt = (Instant) row[1];
      BigDecimal qty = ((BigDecimal) row[2]).setScale(SCALE, ROUNDING);
      Instant receivedAt = (Instant) row[3];
      LocalDate rowDate = receivedAt.atZone(zone).toLocalDate();
      rowsByDate
          .computeIfAbsent(rowDate, k -> new ArrayList<>())
          .add(new Object[] {itemId, createdAt, qty});
      addedByDate
          .computeIfAbsent(rowDate, k -> new HashMap<>())
          .merge(itemId, qty, BigDecimal::add);
    }
    return new PartitionedDateData(rowsByDate, addedByDate);
  }

  private static PartitionedDateData partitionStockTakeRows(
      List<Object[]> stockTakeRows, ZoneId zone) {
    Map<LocalDate, List<Object[]>> rowsByDate = new HashMap<>();
    Map<LocalDate, Map<UUID, BigDecimal>> addedByDate = new HashMap<>();
    for (Object[] row : stockTakeRows) {
      UUID itemId = (UUID) row[0];
      Instant createdAt = (Instant) row[1];
      BigDecimal qty = ((BigDecimal) row[2]).setScale(SCALE, ROUNDING);
      LocalDate rowDate = createdAt.atZone(zone).toLocalDate();
      rowsByDate
          .computeIfAbsent(rowDate, k -> new ArrayList<>())
          .add(new Object[] {itemId, createdAt, qty});
      addedByDate
          .computeIfAbsent(rowDate, k -> new HashMap<>())
          .merge(itemId, qty, BigDecimal::add);
    }
    return new PartitionedDateData(rowsByDate, addedByDate);
  }

  private static Map<LocalDate, Map<UUID, BigDecimal>> partitionSalesRows(List<Object[]> rows) {
    Map<LocalDate, Map<UUID, BigDecimal>> map = new HashMap<>();
    for (Object[] row : rows) {
      LocalDate date = (LocalDate) row[0];
      UUID itemId = (UUID) row[1];
      BigDecimal qty = ((BigDecimal) row[2]).setScale(SCALE, ROUNDING);
      map.computeIfAbsent(date, k -> new HashMap<>()).put(itemId, qty);
    }
    return map;
  }

  @SuppressWarnings("checkstyle:ParameterNumber")
  private List<StdStockCountRowDto> buildSheetRows(
      List<Item> items,
      Map<UUID, BigDecimal> addedGrnByItem,
      Map<UUID, BigDecimal> stockTakeAddedByItem,
      Map<UUID, Instant> firstStockAddedAtByItem,
      Map<UUID, Instant> latestStockAddedAtByItem,
      CarryForwardContext carryForward,
      Map<UUID, StdStockCountSnapshot> todayByItem,
      Map<UUID, BigDecimal> recordedSalesTodayByItem,
      LocalDate businessDate) {
    List<StdStockCountRowDto> rows = new ArrayList<>(items.size());
    for (Item item : items) {
      UUID itemId = item.getId();
      BigDecimal addedGrn = addedGrnByItem.getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal addedToday = stockTakeAddedByItem.getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal opening = carryForward.openingForSheetDate(itemId, businessDate);
      BigDecimal price =
          item.getDefaultSellingPrice() != null ? item.getDefaultSellingPrice() : BigDecimal.ZERO;
      StdStockCountSnapshot snap = todayByItem.get(itemId);
      BigDecimal closing = snap != null ? snap.getClosingQty().setScale(SCALE, ROUNDING) : null;
      Instant lastSavedAt = snap != null ? snap.getLastSavedAt() : null;
      String rowComments = snap != null ? snap.getComments() : null;

      BigDecimal recordedSales = recordedSalesTodayByItem.getOrDefault(itemId, BigDecimal.ZERO);
      if (recordedSales.signum() > 0) {
        BigDecimal dayTotal = opening.add(addedGrn).add(addedToday).setScale(SCALE, ROUNDING);
        BigDecimal maxPhysicalStock =
            dayTotal.subtract(recordedSales).max(BigDecimal.ZERO).setScale(SCALE, ROUNDING);
        if (closing != null && closing.compareTo(maxPhysicalStock) > 0) {
          closing = maxPhysicalStock;
        }
      }

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
              firstStockAddedAtByItem.get(itemId),
              latestStockAddedAtByItem.get(itemId),
              rowComments));
    }
    return rows;
  }

  private static void collectNeededDates(
      UUID itemId,
      LocalDate beforeDate,
      Map<UUID, List<StdStockCountSnapshot>> priorByItem,
      Set<LocalDate> blankSaveDates,
      Set<LocalDate> visitedDates) {
    StdStockCountSnapshot snap =
        latestMeaningfulBefore(priorByItem.get(itemId), beforeDate, blankSaveDates);
    if (snap == null) {
      return;
    }
    LocalDate snapDate = snap.getBusinessDate();
    if (visitedDates.add(snapDate)) {
      collectNeededDates(itemId, snapDate, priorByItem, blankSaveDates, visitedDates);
    }
  }

  private static StdStockCountSnapshot latestMeaningfulBefore(
      List<StdStockCountSnapshot> itemSnaps, LocalDate beforeDate, Set<LocalDate> blankSaveDates) {
    if (itemSnaps == null || itemSnaps.isEmpty()) {
      return null;
    }
    return itemSnaps.stream()
        .filter(s -> s.getBusinessDate().isBefore(beforeDate))
        .sorted(Comparator.comparing(StdStockCountSnapshot::getBusinessDate).reversed())
        .filter(
            s -> s.getClosingQty().signum() > 0 || !blankSaveDates.contains(s.getBusinessDate()))
        .findFirst()
        .orElse(null);
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

  private static void mergeEarliestTimestampedQtyRows(
      Map<UUID, Instant> firstByItem, List<Object[]> rows) {
    for (Object[] row : rows) {
      UUID itemId = (UUID) row[0];
      Instant at = (Instant) row[1];
      BigDecimal qty = (BigDecimal) row[2];
      if (qty.signum() <= 0) {
        continue;
      }
      firstByItem.merge(
          itemId, at, (existing, incoming) -> existing.isBefore(incoming) ? existing : incoming);
    }
  }

  private static void mergeLatestTimestampedQtyRows(
      Map<UUID, Instant> latestByItem, List<Object[]> rows) {
    for (Object[] row : rows) {
      UUID itemId = (UUID) row[0];
      Instant at = (Instant) row[1];
      BigDecimal qty = (BigDecimal) row[2];
      if (qty.signum() <= 0) {
        continue;
      }
      latestByItem.merge(
          itemId, at, (existing, incoming) -> existing.isAfter(incoming) ? existing : incoming);
    }
  }

  /**
   * Resolves effective carry-forward per item/date: when saved closing still equals opening but
   * same-day receipts exist, uses day total (opening + added); when saved closing reflects sales
   * after receipts (above opening, below total), uses saved closing; otherwise saved closing plus
   * GRN lines created after {@code last_saved_at}.
   */
  private final class CarryForwardContext {
    private final Map<UUID, List<StdStockCountSnapshot>> priorByItem;
    private final Set<LocalDate> blankSaveDates;
    private final Map<LocalDate, List<Object[]>> grnRowsByDate;
    private final Map<LocalDate, List<Object[]>> stockTakeRowsByDate;
    private final Map<LocalDate, Map<UUID, BigDecimal>> grnAddedByDate;
    private final Map<LocalDate, Map<UUID, BigDecimal>> stockTakeAddedByDate;
    private final Map<LocalDate, Map<UUID, BigDecimal>> salesByDate;
    private final Map<LocalDate, PriorDayLateAddedCache> lateCacheByDate = new HashMap<>();
    private final Map<UUID, Map<LocalDate, BigDecimal>> effectiveByItemAndDate = new HashMap<>();

    private CarryForwardContext(
        Map<UUID, List<StdStockCountSnapshot>> priorByItem,
        Set<LocalDate> blankSaveDates,
        Map<LocalDate, List<Object[]>> grnRowsByDate,
        Map<LocalDate, List<Object[]>> stockTakeRowsByDate,
        Map<LocalDate, Map<UUID, BigDecimal>> grnAddedByDate,
        Map<LocalDate, Map<UUID, BigDecimal>> stockTakeAddedByDate,
        Map<LocalDate, Map<UUID, BigDecimal>> salesByDate) {
      this.priorByItem = priorByItem;
      this.blankSaveDates = blankSaveDates;
      this.grnRowsByDate = grnRowsByDate;
      this.stockTakeRowsByDate = stockTakeRowsByDate;
      this.grnAddedByDate = grnAddedByDate;
      this.stockTakeAddedByDate = stockTakeAddedByDate;
      this.salesByDate = salesByDate;
    }

    private BigDecimal openingForSheetDate(UUID itemId, LocalDate sheetDate) {
      StdStockCountSnapshot priorSnap = latestMeaningfulBefore(itemId, sheetDate);
      if (priorSnap == null) {
        return BigDecimal.ZERO.setScale(SCALE);
      }
      return effectiveCarryForward(priorSnap);
    }

    private PriorDayLateAddedCache getLateCache(LocalDate snapDate) {
      return lateCacheByDate.computeIfAbsent(
          snapDate,
          d ->
              new PriorDayLateAddedCache(
                  grnRowsByDate.getOrDefault(d, List.of()),
                  stockTakeRowsByDate.getOrDefault(d, List.of())));
    }

    private BigDecimal effectiveCarryForward(StdStockCountSnapshot snap) {
      UUID itemId = snap.getItem().getId();
      LocalDate snapDate = snap.getBusinessDate();
      Map<LocalDate, BigDecimal> itemCache =
          effectiveByItemAndDate.computeIfAbsent(itemId, k -> new HashMap<>());
      BigDecimal cached = itemCache.get(snapDate);
      if (cached != null) {
        return cached;
      }

      BigDecimal openingOnDay = openingAtStartOfSnapDay(itemId, snapDate);
      BigDecimal addedOnDay = addedOnSnapDay(itemId, snapDate);
      BigDecimal dayTotal = openingOnDay.add(addedOnDay).setScale(SCALE, ROUNDING);
      BigDecimal saved = snap.getClosingQty().setScale(SCALE, ROUNDING);

      BigDecimal recordedSales =
          salesByDate.getOrDefault(snapDate, Map.of()).getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal maxPhysicalStock =
          dayTotal.subtract(recordedSales).max(BigDecimal.ZERO).setScale(SCALE, ROUNDING);

      if (recordedSales.signum() > 0 && saved.compareTo(maxPhysicalStock) > 0) {
        saved = maxPhysicalStock;
      }

      PriorDayLateAddedCache cache = getLateCache(snapDate);
      BigDecimal lateGrn =
          cache != null ? cache.lateGrnQtyAfter(itemId, snap.getLastSavedAt()) : BigDecimal.ZERO;
      BigDecimal lateStockTake =
          cache != null
              ? cache.lateStockTakeQtyAfter(itemId, snap.getLastSavedAt())
              : BigDecimal.ZERO;

      BigDecimal effective;
      if (recordedSales.signum() > 0) {
        // Sales were recorded on this date; saved closing reflects post-sales physical stock.
        effective = saved.add(lateStockTake).min(maxPhysicalStock).setScale(SCALE, ROUNDING);
      } else if (saved.compareTo(openingOnDay) == 0 && addedOnDay.signum() > 0) {
        effective = dayTotal;
      } else if (lateGrn.signum() > 0) {
        // Stock arrived after last saved closing; add late receipts up to day total
        effective = saved.add(lateGrn).add(lateStockTake).min(dayTotal).setScale(SCALE, ROUNDING);
      } else if (saved.compareTo(dayTotal) >= 0) {
        // Saved closing already reflects same-day receipts; only post-save stock-take adjusts.
        effective = saved.add(lateStockTake).setScale(SCALE, ROUNDING);
      } else {
        effective = saved.add(lateStockTake).setScale(SCALE, ROUNDING);
      }

      effective = nonnegativeQtyFromLedgerQty(effective);
      itemCache.put(snapDate, effective);
      return effective;
    }

    private BigDecimal openingAtStartOfSnapDay(UUID itemId, LocalDate snapDate) {
      StdStockCountSnapshot before = latestMeaningfulBefore(itemId, snapDate);
      if (before == null) {
        return BigDecimal.ZERO.setScale(SCALE);
      }
      return effectiveCarryForward(before);
    }

    private BigDecimal addedOnSnapDay(UUID itemId, LocalDate snapDate) {
      BigDecimal grn =
          grnAddedByDate.getOrDefault(snapDate, Map.of()).getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal stockTake =
          stockTakeAddedByDate
              .getOrDefault(snapDate, Map.of())
              .getOrDefault(itemId, BigDecimal.ZERO);
      return grn.add(stockTake).setScale(SCALE, ROUNDING);
    }

    private StdStockCountSnapshot latestMeaningfulBefore(UUID itemId, LocalDate beforeDate) {
      return StdStockCountServiceImpl.latestMeaningfulBefore(
          priorByItem.get(itemId), beforeDate, blankSaveDates);
    }
  }

  private static final class PriorDayLateAddedCache {
    private final Map<UUID, List<TimestampedQty>> grnByItem;
    private final Map<UUID, List<TimestampedQty>> stockTakeByItem;

    private PriorDayLateAddedCache(List<Object[]> grnRows, List<Object[]> stockTakeRows) {
      this.grnByItem = groupTimestampedQtyRows(grnRows);
      this.stockTakeByItem = groupTimestampedQtyRows(stockTakeRows);
    }

    private BigDecimal lateGrnQtyAfter(UUID itemId, Instant afterExclusive) {
      return sumQtyAfter(grnByItem.getOrDefault(itemId, List.of()), afterExclusive);
    }

    private BigDecimal lateStockTakeQtyAfter(UUID itemId, Instant afterExclusive) {
      return sumQtyAfter(stockTakeByItem.getOrDefault(itemId, List.of()), afterExclusive);
    }

    private static Map<UUID, List<TimestampedQty>> groupTimestampedQtyRows(List<Object[]> rows) {
      Map<UUID, List<TimestampedQty>> byItem = new HashMap<>();
      for (Object[] row : rows) {
        UUID itemId = (UUID) row[0];
        Instant at = (Instant) row[1];
        BigDecimal qty = ((BigDecimal) row[2]).setScale(SCALE, ROUNDING);
        byItem.computeIfAbsent(itemId, k -> new ArrayList<>()).add(new TimestampedQty(at, qty));
      }
      return byItem;
    }

    private static BigDecimal sumQtyAfter(List<TimestampedQty> rows, Instant afterExclusive) {
      BigDecimal sum = BigDecimal.ZERO.setScale(SCALE);
      for (TimestampedQty row : rows) {
        if (row.at().isAfter(afterExclusive)) {
          sum = sum.add(row.qty());
        }
      }
      return sum.setScale(SCALE, ROUNDING);
    }
  }

  private record TimestampedQty(Instant at, BigDecimal qty) {}

  @Override
  @Transactional
  public StdStockCountSheetDto saveCounts(
      UUID orgId, UUID branchId, UUID staffUserId, StdStockCountSaveRequest request) {
    if (!branchId.equals(request.outletId())) {
      throw new ConflictException("OUTLET_MISMATCH", "Branch ID does not match request outlet ID.");
    }
    Branch branch = branchService.require(orgId, branchId);
    Instant now = Instant.now();

    List<StdStockCountCountDto> counts = request.counts();
    if (counts != null && !counts.isEmpty()) {
      saveCountsInternal(orgId, branch, branchId, request.date(), counts, now);
    }

    return getSheet(orgId, branchId, request.date());
  }

  private void saveCountsInternal(
      UUID orgId,
      Branch branch,
      UUID branchId,
      LocalDate businessDate,
      List<StdStockCountCountDto> counts,
      Instant now) {
    Set<UUID> itemIds =
        counts.stream().map(StdStockCountCountDto::itemId).collect(Collectors.toSet());
    Map<UUID, Item> itemsById =
        itemRepository.findAllByIdInAndOrgId(itemIds, orgId).stream()
            .collect(Collectors.toMap(Item::getId, Function.identity()));

    Map<UUID, StdStockCountSnapshot> existingByItem =
        snapshotRepository
            .findAllByBranchIdAndBusinessDateAndItemIdIn(branchId, businessDate, itemIds)
            .stream()
            .collect(Collectors.toMap(s -> s.getItem().getId(), Function.identity(), (a, b) -> a));

    List<StdStockCountSnapshot> toSave = new ArrayList<>(counts.size());
    for (StdStockCountCountDto dto : counts) {
      Item item = itemsById.get(dto.itemId());
      if (item == null) {
        continue;
      }
      BigDecimal qty = normalizeClosingQty(dto.closingStock());
      StdStockCountSnapshot snap = existingByItem.get(dto.itemId());
      if (snap == null) {
        snap = new StdStockCountSnapshot();
        snap.setOrg(branch.getOrg());
        snap.setBranch(branch);
        snap.setItem(item);
        snap.setBusinessDate(businessDate);
        snap.setCreatedAt(now);
      }
      applySnapshotValues(snap, qty, now, dto);
      toSave.add(snap);
    }

    if (!toSave.isEmpty()) {
      try {
        snapshotRepository.saveAllAndFlush(toSave);
      } catch (DataIntegrityViolationException ex) {
        entityManager.clear();
        for (StdStockCountSnapshot s : toSave) {
          StdStockCountCountDto dto = findDtoFor(counts, s.getItem().getId());
          if (dto != null) {
            upsertSnapshot(orgId, branch, branchId, businessDate, dto, now);
          }
        }
      }
    }
  }

  private static StdStockCountCountDto findDtoFor(List<StdStockCountCountDto> counts, UUID itemId) {
    for (StdStockCountCountDto dto : counts) {
      if (dto.itemId().equals(itemId)) {
        return dto;
      }
    }
    return null;
  }

  private void upsertSnapshot(
      UUID orgId,
      Branch branch,
      UUID branchId,
      LocalDate businessDate,
      StdStockCountCountDto dto,
      Instant now) {
    var itemOpt = itemRepository.findByIdAndOrgId(dto.itemId(), orgId);
    if (itemOpt.isEmpty()) {
      return;
    }
    BigDecimal qty = normalizeClosingQty(dto.closingStock());
    Optional<StdStockCountSnapshot> existingOpt =
        snapshotRepository.findByBranchAndItemAndDate(branchId, dto.itemId(), businessDate);

    StdStockCountSnapshot snap;
    if (existingOpt.isPresent()) {
      snap = existingOpt.get();
    } else {
      snap = new StdStockCountSnapshot();
      snap.setOrg(branch.getOrg());
      snap.setBranch(branch);
      snap.setItem(itemOpt.get());
      snap.setBusinessDate(businessDate);
      snap.setCreatedAt(now);
    }
    applySnapshotValues(snap, qty, now, dto);
    try {
      snapshotRepository.saveAndFlush(snap);
    } catch (DataIntegrityViolationException ex) {
      entityManager.clear();
      StdStockCountSnapshot existing =
          snapshotRepository
              .findByBranchAndItemAndDate(branchId, dto.itemId(), businessDate)
              .orElseThrow(() -> ex);
      applySnapshotValues(existing, qty, now, dto);
      snapshotRepository.save(existing);
    }
  }

  private static BigDecimal normalizeClosingQty(BigDecimal closingStock) {
    BigDecimal qty =
        closingStock != null ? closingStock.setScale(SCALE, ROUNDING) : BigDecimal.ZERO;
    if (qty.compareTo(BigDecimal.ZERO) < 0) {
      qty = BigDecimal.ZERO;
    }
    return qty;
  }

  private static void applySnapshotValues(
      StdStockCountSnapshot snap, BigDecimal qty, Instant now, StdStockCountCountDto dto) {
    snap.setClosingQty(qty);
    snap.setLastSavedAt(now);
    applyCommentsIfPresent(dto, snap);
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
          "SALE_DATE_TOO_OLD",
          "Sale date cannot be earlier than "
              + earliest
              + " ("
              + BACKDATE_MAX_DAYS
              + " days ago).");
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

  @Override
  @Transactional(readOnly = true)
  public StdStockCountReconcilePreviewDto previewReconcileInventory(
      UUID orgId, UUID branchId, LocalDate businessDate) {
    validateReconcileDate(businessDate);
    branchService.require(orgId, branchId);
    ReconcileBuildResult built = buildReconcileLines(orgId, branchId, businessDate);
    return new StdStockCountReconcilePreviewDto(
        businessDate,
        branchId,
        built.linesToAdjust(),
        built.linesToAdjust().size(),
        built.itemsAlreadyMatched());
  }

  @Override
  @Transactional
  public StdStockCountReconcileResponse reconcileInventoryToClosing(
      UUID orgId, UUID branchId, UUID staffUserId, LocalDate businessDate) {
    validateReconcileDate(businessDate);
    Branch branch = branchService.require(orgId, branchId);
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    StdStockCountSheetDto sheet = getSheet(orgId, branchId, businessDate);
    Map<UUID, Item> itemsById =
        itemRepository.findActiveWithSellingPriceByOrgId(orgId).stream()
            .collect(Collectors.toMap(Item::getId, i -> i, (a, b) -> a));
    Instant now = Instant.now(clock);
    List<StdStockCountReconcileLineDto> adjusted = new ArrayList<>();
    int matched = 0;
    for (StdStockCountRowDto row : sheet.rows()) {
      Optional<BigDecimal> closingOpt = resolveClosingForReconcile(row);
      if (closingOpt.isEmpty()) {
        continue;
      }
      Item item = itemsById.get(row.itemId());
      if (item == null || !item.requiresOnHandForSellableListing()) {
        continue;
      }
      BigDecimal onHand =
          inventoryItemService
              .getOnHandQty(orgId, branchId, row.itemId())
              .setScale(SCALE, ROUNDING);
      BigDecimal closing = closingOpt.get();
      BigDecimal variance = closing.subtract(onHand).setScale(SCALE, ROUNDING);
      if (variance.compareTo(BigDecimal.ZERO) == 0) {
        matched++;
        continue;
      }
      StockMovement mov = new StockMovement();
      mov.setOrg(branch.getOrg());
      mov.setBranch(branch);
      mov.setItem(item);
      mov.setMovementType(MovementType.ADJUST);
      mov.setQty(variance);
      mov.setSourceType(SourceType.STD_STOCK_COUNT_RECONCILE);
      mov.setSourceId(branchId);
      mov.setCreatedBy(staffUser);
      mov.setCreatedAt(now);
      stockMovementRepository.save(mov);
      inventoryItemService.applyStockTakeVariance(orgId, branchId, row.itemId(), variance);
      entityManager.flush();
      adjusted.add(
          new StdStockCountReconcileLineDto(row.itemId(), row.name(), closing, onHand, variance));
    }
    if (!adjusted.isEmpty()) {
      auditLogService.append(
          orgId,
          branchId,
          null,
          staffUserId,
          "RECONCILE_STD_STOCK_TO_INVENTORY",
          "StdStockCountSheet",
          branchId,
          null,
          null);
    }
    return new StdStockCountReconcileResponse(
        businessDate, branchId, adjusted, adjusted.size(), matched);
  }

  private void validateReconcileDate(LocalDate businessDate) {
    if (businessDate == null) {
      throw new BadRequestException("SALE_DATE_REQUIRED", "Business date is required.");
    }
    LocalDate today = LocalDate.now(clock);
    if (!businessDate.equals(today)) {
      throw new BadRequestException(
          "RECONCILE_DATE_NOT_TODAY",
          "Inventory reconcile is only allowed for today (" + today + ").");
    }
  }

  private record ReconcileBuildResult(
      List<StdStockCountReconcileLineDto> linesToAdjust, int itemsAlreadyMatched) {}

  /** Saved closing for reconcile, including explicit zero. Empty when no closing is available. */
  private static Optional<BigDecimal> resolveClosingForReconcile(StdStockCountRowDto row) {
    if (isStaleSavedClosingRow(row)) {
      // Stock arrived after this closing was saved, with no subsequent sales or count.
      // Reconciling to this stale pre-receipt closing would incorrectly subtract the received
      // stock!
      // Treat target closing as totalStock (which matches POS on-hand after receipt) so variance is
      // 0.
      return Optional.of(totalStockFromRow(row));
    }
    if (row.lastSavedAt() != null) {
      BigDecimal saved =
          row.closingStock() != null
              ? row.closingStock().setScale(SCALE, ROUNDING)
              : BigDecimal.ZERO.setScale(SCALE, ROUNDING);
      return Optional.of(saved);
    }
    if (totalStockFromRow(row).signum() == 0) {
      return Optional.of(BigDecimal.ZERO.setScale(SCALE, ROUNDING));
    }
    return Optional.empty();
  }

  private ReconcileBuildResult buildReconcileLines(
      UUID orgId, UUID branchId, LocalDate businessDate) {
    StdStockCountSheetDto sheet = getSheet(orgId, branchId, businessDate);
    Map<UUID, Item> itemsById =
        itemRepository.findActiveWithSellingPriceByOrgId(orgId).stream()
            .collect(Collectors.toMap(Item::getId, i -> i, (a, b) -> a));
    List<StdStockCountReconcileLineDto> toAdjust = new ArrayList<>();
    int matched = 0;
    for (StdStockCountRowDto row : sheet.rows()) {
      Optional<BigDecimal> closingOpt = resolveClosingForReconcile(row);
      if (closingOpt.isEmpty()) {
        continue;
      }
      Item item = itemsById.get(row.itemId());
      if (item == null || !item.requiresOnHandForSellableListing()) {
        continue;
      }
      BigDecimal onHand =
          inventoryItemService
              .getOnHandQty(orgId, branchId, row.itemId())
              .setScale(SCALE, ROUNDING);
      BigDecimal closing = closingOpt.get();
      BigDecimal variance = closing.subtract(onHand).setScale(SCALE, ROUNDING);
      if (variance.compareTo(BigDecimal.ZERO) == 0) {
        matched++;
        continue;
      }
      toAdjust.add(
          new StdStockCountReconcileLineDto(row.itemId(), row.name(), closing, onHand, variance));
    }
    return new ReconcileBuildResult(toAdjust, matched);
  }

  @Override
  @Transactional
  public StdStockCountAutoSyncResponse autoSyncCarryForward(UUID orgId, UUID branchId) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = ZoneId.of(branch.getTimezone());
    LocalDate today = LocalDate.now(clock.withZone(zone));

    Optional<LocalDate> maxDateOpt = snapshotRepository.findMaxBusinessDateByBranchId(branchId);
    if (maxDateOpt.isEmpty()) {
      return new StdStockCountAutoSyncResponse(today, 0);
    }

    LocalDate maxDate = maxDateOpt.get();
    LocalDate startDate = maxDate.isBefore(today) ? maxDate.plusDays(1) : today;
    LocalDate minStart = today.minusDays(autoSyncMaxBackfillDays);
    if (startDate.isBefore(minStart)) {
      startDate = minStart;
    }

    int rowsSynced = 0;
    Instant now = clock.instant();
    for (LocalDate date = startDate; !date.isAfter(today); date = date.plusDays(1)) {
      rowsSynced += autoSyncSnapshotsForDate(orgId, branch, branchId, date, now);
    }
    return new StdStockCountAutoSyncResponse(today, rowsSynced);
  }

  private int autoSyncSnapshotsForDate(
      UUID orgId, Branch branch, UUID branchId, LocalDate businessDate, Instant now) {
    StdStockCountSheetDto sheet = getSheet(orgId, branchId, businessDate);
    Map<UUID, BigDecimal> alreadyRecorded =
        loadAlreadyRecordedQtyByItem(orgId, branchId, businessDate);
    List<StdStockCountCountDto> counts = new ArrayList<>();
    for (StdStockCountRowDto row : sheet.rows()) {
      BigDecimal recorded = alreadyRecorded.getOrDefault(row.itemId(), BigDecimal.ZERO);
      if (shouldAutoSyncClosingRow(row, recorded)) {
        BigDecimal syncClosing =
            recorded.signum() > 0
                ? totalStockFromRow(row)
                    .subtract(recorded)
                    .max(BigDecimal.ZERO)
                    .setScale(SCALE, ROUNDING)
                : totalStockFromRow(row);
        counts.add(new StdStockCountCountDto(row.itemId(), syncClosing, Optional.empty()));
      }
    }
    if (counts.isEmpty()) {
      return 0;
    }
    saveCountsInternal(orgId, branch, branchId, businessDate, counts, now);
    return counts.size();
  }

  /** Mirrors frontend {@code shouldAutoSyncClosing} for carry-forward / stale-receipt cases. */
  private static boolean shouldAutoSyncClosingRow(
      StdStockCountRowDto row, BigDecimal recordedSales) {
    if (recordedSales != null && recordedSales.signum() > 0) {
      BigDecimal total = totalStockFromRow(row);
      return row.closingStock() == null && total.signum() > 0;
    }
    if (isStaleSavedClosingRow(row)) {
      return true;
    }
    BigDecimal total = totalStockFromRow(row);
    return row.closingStock() == null && total.signum() > 0;
  }

  private static boolean isStaleSavedClosingRow(StdStockCountRowDto row) {
    Instant stockAddedAt =
        row.latestStockAddedAt() != null ? row.latestStockAddedAt() : row.firstStockAddedAt();
    if (row.closingStock() == null || row.lastSavedAt() == null || stockAddedAt == null) {
      return false;
    }
    BigDecimal total = totalStockFromRow(row);
    return row.closingStock().compareTo(total) < 0
        && row.closingStock().compareTo(row.openingStock()) == 0
        && row.lastSavedAt().isBefore(stockAddedAt);
  }

  private static BigDecimal totalStockFromRow(StdStockCountRowDto row) {
    BigDecimal addedToday = row.addedTodayStock() != null ? row.addedTodayStock() : BigDecimal.ZERO;
    return row.openingStock().add(row.addedStock()).add(addedToday).setScale(SCALE, ROUNDING);
  }
}
