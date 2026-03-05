package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import com.blinc.xpos.modules.inventory.dto.StdStockCountCountDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRowDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
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
 * Standard Stock Count Sheet service. Bar-style: Opening + Added = Total; Units Sold = Total -
 * Closing; Amount = Units Sold × Selling Price.
 */
@Service
public class StdStockCountServiceImpl implements StdStockCountService {

  private static final int SCALE = 3;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final StockMovementRepository stockMovementRepository;
  private final InventoryItemService inventoryItemService;
  private final PriceListRepository priceListRepository;
  private final PriceListItemRepository priceListItemRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;

  public StdStockCountServiceImpl(
      StdStockCountSnapshotRepository snapshotRepository,
      StockMovementRepository stockMovementRepository,
      InventoryItemService inventoryItemService,
      PriceListRepository priceListRepository,
      PriceListItemRepository priceListItemRepository,
      ItemRepository itemRepository,
      BranchService branchService) {
    this.snapshotRepository =
        Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.priceListRepository =
        Objects.requireNonNull(priceListRepository, "priceListRepository");
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
  }

  @Override
  @Transactional(readOnly = true)
  public StdStockCountSheetDto getSheet(UUID orgId, UUID branchId, LocalDate businessDate) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = ZoneId.of(branch.getTimezone());
    Instant dayStart = businessDate.atStartOfDay(zone).toInstant();
    Instant dayEnd = businessDate.plusDays(1).atStartOfDay(zone).toInstant();
    LocalDate prevDate = businessDate.minusDays(1);

    List<PriceList> priceLists =
        priceListRepository.findActiveByOrgIdAndBranchIdOrderByPriorityDesc(orgId, branchId);
    if (priceLists.isEmpty()) {
      return new StdStockCountSheetDto(businessDate, branchId, List.of());
    }
    var priceList = priceLists.getFirst();
    List<PriceListItem> items =
        priceListItemRepository.findAllByPriceListIdAndOrgId(priceList.getId(), orgId);

    Map<UUID, Integer> prevClosing =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, prevDate).stream()
            .collect(
                Collectors.toMap(
                    s -> s.getItem().getId(),
                    s -> s.getClosingQty().setScale(0, ROUNDING).intValue()));

    List<Object[]> addedRows =
        stockMovementRepository.sumInQtyByItemIdForBranchAndDateRange(
            orgId, branchId, dayStart, dayEnd);
    Map<UUID, Integer> addedByItem =
        addedRows.stream()
            .collect(
                Collectors.toMap(
                    row -> (UUID) row[0],
                    row ->
                        ((BigDecimal) row[1]).setScale(0, ROUNDING).intValue()));

    Set<UUID> itemIds =
        items.stream().map(pli -> pli.getItem().getId()).collect(Collectors.toSet());
    Map<UUID, BigDecimal> onHandByItem =
        inventoryItemService.getOnHandQtysByItemIds(orgId, branchId, itemIds);

    List<StdStockCountSnapshot> todaySnapshots =
        snapshotRepository.findAllByBranchIdAndBusinessDate(branchId, businessDate);
    Map<UUID, StdStockCountSnapshot> todayByItem =
        todaySnapshots.stream().collect(Collectors.toMap(s -> s.getItem().getId(), s -> s));

    List<StdStockCountRowDto> rows = new ArrayList<>();
    for (PriceListItem pli : items) {
      UUID itemId = pli.getItem().getId();
      int added = addedByItem.getOrDefault(itemId, 0);
      int currentOnHand =
          onHandByItem
              .getOrDefault(itemId, BigDecimal.ZERO)
              .setScale(0, ROUNDING)
              .intValue();
      int systemCountBeforeToday = Math.max(0, currentOnHand - added);
      int opening;
      if (prevClosing.containsKey(itemId)) {
        opening = prevClosing.get(itemId);
      } else {
        opening = systemCountBeforeToday;
      }
      BigDecimal price = pli.getPrice() != null ? pli.getPrice() : BigDecimal.ZERO;
      StdStockCountSnapshot snap = todayByItem.get(itemId);
      Integer closing = snap != null ? snap.getClosingQty().setScale(0, ROUNDING).intValue() : null;
      Instant lastSavedAt = snap != null ? snap.getLastSavedAt() : null;

      rows.add(
          new StdStockCountRowDto(
              itemId,
              pli.getItem().getSku() != null ? pli.getItem().getSku() : "",
              pli.getItem().getName(),
              opening,
              added,
              systemCountBeforeToday,
              price,
              closing,
              lastSavedAt));
    }

    return new StdStockCountSheetDto(businessDate, branchId, rows);
  }

  @Override
  @Transactional
  public StdStockCountSheetDto saveCounts(
      UUID orgId, UUID branchId, UUID staffUserId, StdStockCountSaveRequest request) {
    if (!branchId.equals(request.outletId())) {
      throw new ConflictException(
          "OUTLET_MISMATCH", "Branch ID does not match request outlet ID.");
    }
    branchService.require(orgId, branchId);
    Instant now = Instant.now();

    Branch branch = branchService.require(orgId, branchId);

    for (StdStockCountCountDto dto : request.counts()) {
      Optional<StdStockCountSnapshot> existingOpt =
          snapshotRepository.findByBranchAndItemAndDate(
              branchId, dto.itemId(), request.date());

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
      snapshotRepository.save(snap);
    }

    return getSheet(orgId, branchId, request.date());
  }
}
