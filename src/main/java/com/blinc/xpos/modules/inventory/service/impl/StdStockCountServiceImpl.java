package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import com.blinc.xpos.modules.inventory.dto.StdStockCountCountDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRowDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import com.blinc.xpos.modules.inventory.repository.GrnLineRepository;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Standard Stock Count Sheet service. Bar-style: {@code openingStock} is strictly the previous
 * branch business day's saved physical closing when a snapshot exists; otherwise {@code 0} (no
 * ledger-derived fallback — operators must save a closing to seed the next day's opening). Opening
 * + Added + Added today may differ from System when yesterday's count diverged from the ledger.
 * Units Sold = Total − Closing.
 */
@Service
public class StdStockCountServiceImpl implements StdStockCountService {

  private static final int SCALE = 3;
  private static final int COMMENTS_MAX_LEN = 2000;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final GrnLineRepository grnLineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;

  public StdStockCountServiceImpl(
      StdStockCountSnapshotRepository snapshotRepository,
      GrnLineRepository grnLineRepository,
      StockMovementRepository stockMovementRepository,
      ItemRepository itemRepository,
      BranchService branchService) {
    this.snapshotRepository = Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
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
    Instant dayStart = businessDate.atStartOfDay(zone).toInstant();
    Instant dayEnd = businessDate.plusDays(1).atStartOfDay(zone).toInstant();

    List<Item> items = itemRepository.findActiveWithSellingPriceByOrgId(orgId);
    if (items.isEmpty()) {
      return new StdStockCountSheetDto(businessDate, branchId, List.of());
    }

    Map<UUID, BigDecimal> addedGrnByItem =
        qtyByItemFromSumRows(
            grnLineRepository.sumLineQtyByItemIdForBranchAndGrnReceivedAtRange(
                orgId, branchId, dayStart, dayEnd));

    Map<UUID, BigDecimal> stockTakeAddedByItem =
        qtyByItemFromSumRows(
            stockMovementRepository.sumStockTakePositiveAdjustQtyByItemIdForBranchAndDateRange(
                orgId, branchId, dayStart, dayEnd));

    List<StdStockCountSnapshot> todaySnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, businessDate);
    Map<UUID, StdStockCountSnapshot> todayByItem =
        todaySnapshots.stream()
            .collect(Collectors.toMap(s -> s.getItem().getId(), s -> s, (a, b) -> a));

    LocalDate previousBusinessDate = businessDate.minusDays(1);
    List<StdStockCountSnapshot> previousSnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, previousBusinessDate);
    Map<UUID, StdStockCountSnapshot> previousByItem =
        previousSnapshots.stream()
            .collect(Collectors.toMap(s -> s.getItem().getId(), s -> s, (a, b) -> a));

    List<StdStockCountRowDto> rows = new ArrayList<>();
    for (Item item : items) {
      UUID itemId = item.getId();
      BigDecimal addedGrn = addedGrnByItem.getOrDefault(itemId, BigDecimal.ZERO);
      BigDecimal addedToday = stockTakeAddedByItem.getOrDefault(itemId, BigDecimal.ZERO);
      StdStockCountSnapshot previousSnap = previousByItem.get(itemId);
      BigDecimal opening =
          previousSnap != null
              ? nonnegativeQtyFromLedgerQty(previousSnap.getClosingQty())
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
}
