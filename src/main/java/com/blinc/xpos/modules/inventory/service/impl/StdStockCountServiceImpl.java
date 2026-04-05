package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
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
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import com.blinc.xpos.modules.pricing.repository.PriceListItemRepository;
import com.blinc.xpos.modules.pricing.repository.PriceListRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
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
 * Standard Stock Count Sheet service. Bar-style: {@code openingStock} is the previous branch
 * business day's saved physical closing when a snapshot exists; otherwise {@code max(0, System −
 * same-day GRN − stock-take adds)}. Opening + Added + Added today may differ from System when
 * yesterday's count diverged from the ledger. Units Sold = Total − Closing. Closing may default to
 * System.
 */
@Service
public class StdStockCountServiceImpl implements StdStockCountService {

  private static final int SCALE = 3;
  private static final int COMMENTS_MAX_LEN = 2000;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final GrnLineRepository grnLineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final PriceListRepository priceListRepository;
  private final PriceListItemRepository priceListItemRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;

  public StdStockCountServiceImpl(
      StdStockCountSnapshotRepository snapshotRepository,
      GrnLineRepository grnLineRepository,
      StockMovementRepository stockMovementRepository,
      PriceListRepository priceListRepository,
      PriceListItemRepository priceListItemRepository,
      ItemRepository itemRepository,
      BranchService branchService) {
    this.snapshotRepository = Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.priceListRepository = Objects.requireNonNull(priceListRepository, "priceListRepository");
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
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

  private static Map<UUID, Integer> qtyByItemFromSumRows(List<Object[]> rows) {
    return rows.stream()
        .collect(
            Collectors.toMap(
                row -> (UUID) row[0],
                row -> ((BigDecimal) row[1]).setScale(0, ROUNDING).intValue()));
  }

  private static int nonnegativeIntFromLedgerQty(BigDecimal qty) {
    return Math.max(0, qty.setScale(0, ROUNDING).intValue());
  }

  private Map<UUID, BigDecimal> ledgerNetQtyByItemUpToExclusive(
      UUID orgId, UUID branchId, Set<UUID> itemIds, Instant asOfExclusive) {
    if (itemIds.isEmpty()) {
      return Map.of();
    }
    List<Object[]> rows =
        stockMovementRepository.sumNetQtyByItemForBranchUpToExclusive(
            orgId, branchId, new ArrayList<>(itemIds), asOfExclusive);
    Map<UUID, BigDecimal> map = new HashMap<>();
    for (Object[] row : rows) {
      map.put((UUID) row[0], (BigDecimal) row[1]);
    }
    return map;
  }

  @Override
  @Transactional(readOnly = true)
  public StdStockCountSheetDto getSheet(UUID orgId, UUID branchId, LocalDate businessDate) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = ZoneId.of(branch.getTimezone());
    Instant dayStart = businessDate.atStartOfDay(zone).toInstant();
    Instant dayEnd = businessDate.plusDays(1).atStartOfDay(zone).toInstant();

    List<PriceList> priceLists =
        priceListRepository.findActiveByOrgIdAndBranchIdOrderByPriorityDesc(orgId, branchId);
    if (priceLists.isEmpty()) {
      return new StdStockCountSheetDto(businessDate, branchId, List.of());
    }
    var priceList = priceLists.getFirst();
    List<PriceListItem> items =
        priceListItemRepository.findAllByPriceListIdAndOrgId(priceList.getId(), orgId);
    if (items.isEmpty()) {
      return new StdStockCountSheetDto(businessDate, branchId, List.of());
    }

    Map<UUID, Integer> addedGrnByItem =
        qtyByItemFromSumRows(
            grnLineRepository.sumLineQtyByItemIdForBranchAndGrnReceivedAtRange(
                orgId, branchId, dayStart, dayEnd));

    Map<UUID, Integer> stockTakeAddedByItem =
        qtyByItemFromSumRows(
            stockMovementRepository.sumStockTakePositiveAdjustQtyByItemIdForBranchAndDateRange(
                orgId, branchId, dayStart, dayEnd));

    Set<UUID> itemIds =
        items.stream().map(pli -> pli.getItem().getId()).collect(Collectors.toSet());
    Map<UUID, BigDecimal> ledgerAtDayEnd =
        ledgerNetQtyByItemUpToExclusive(orgId, branchId, itemIds, dayEnd);

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
    for (PriceListItem pli : items) {
      UUID itemId = pli.getItem().getId();
      int addedGrn = addedGrnByItem.getOrDefault(itemId, 0);
      int addedToday = stockTakeAddedByItem.getOrDefault(itemId, 0);
      int systemCountBeforeToday =
          nonnegativeIntFromLedgerQty(ledgerAtDayEnd.getOrDefault(itemId, BigDecimal.ZERO));
      int impliedOpening = systemCountBeforeToday - addedGrn - addedToday;
      int fallbackOpening = Math.max(0, impliedOpening);
      StdStockCountSnapshot previousSnap = previousByItem.get(itemId);
      int opening =
          previousSnap != null
              ? nonnegativeIntFromLedgerQty(previousSnap.getClosingQty())
              : fallbackOpening;
      BigDecimal price = pli.getPrice() != null ? pli.getPrice() : BigDecimal.ZERO;
      StdStockCountSnapshot snap = todayByItem.get(itemId);
      Integer closing = snap != null ? snap.getClosingQty().setScale(0, ROUNDING).intValue() : null;
      Instant lastSavedAt = snap != null ? snap.getLastSavedAt() : null;
      String rowComments = snap != null ? snap.getComments() : null;

      rows.add(
          new StdStockCountRowDto(
              itemId,
              pli.getItem().getSku() != null ? pli.getItem().getSku() : "",
              pli.getItem().getName(),
              opening,
              addedGrn,
              addedToday,
              systemCountBeforeToday,
              price,
              closing,
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
