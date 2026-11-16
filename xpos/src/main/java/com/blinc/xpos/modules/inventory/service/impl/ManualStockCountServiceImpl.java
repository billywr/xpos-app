package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.inventory.domain.ManualStockCountLine;
import com.blinc.xpos.modules.inventory.domain.ManualStockCountSheet;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountLineResponse;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountLineSaveDto;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountSheetResponse;
import com.blinc.xpos.modules.inventory.repository.ManualStockCountLineRepository;
import com.blinc.xpos.modules.inventory.repository.ManualStockCountSheetRepository;
import com.blinc.xpos.modules.inventory.service.ManualStockCountService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManualStockCountServiceImpl implements ManualStockCountService {

  private static final int COMMENTS_MAX_LEN = 2000;
  private static final int PRICE_SCALE = 4;
  private static final int AMOUNT_SCALE = 2;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final ManualStockCountSheetRepository sheetRepository;
  private final ManualStockCountLineRepository lineRepository;
  private final ItemRepository itemRepository;
  private final BranchService branchService;

  public ManualStockCountServiceImpl(
      ManualStockCountSheetRepository sheetRepository,
      ManualStockCountLineRepository lineRepository,
      ItemRepository itemRepository,
      BranchService branchService) {
    this.sheetRepository = Objects.requireNonNull(sheetRepository, "sheetRepository");
    this.lineRepository = Objects.requireNonNull(lineRepository, "lineRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
  }

  @Override
  @Transactional(readOnly = true)
  public ManualStockCountSheetResponse getSheet(UUID orgId, UUID branchId, LocalDate businessDate) {
    branchService.require(orgId, branchId);
    return sheetRepository
        .findByBranchIdAndBusinessDateFetchLines(branchId, businessDate)
        .map(this::toSheetResponse)
        .orElseGet(
            () -> new ManualStockCountSheetResponse(businessDate, branchId, null, List.of()));
  }

  @Override
  @Transactional
  public ManualStockCountSheetResponse saveSheet(
      UUID orgId, UUID branchId, UUID staffUserId, ManualStockCountSaveRequest request) {
    Objects.requireNonNull(staffUserId, "staffUserId");
    if (!branchId.equals(request.outletId())) {
      throw new ConflictException("OUTLET_MISMATCH", "Branch ID does not match request outlet ID.");
    }
    Branch branch = branchService.require(orgId, branchId);
    Instant now = Instant.now();
    ManualStockCountSheet sheet =
        sheetRepository
            .findByBranchIdAndBusinessDateFetchLines(branchId, request.date())
            .orElseGet(() -> newManualSheet(branch, request.date(), now));

    sheet.getLines().clear();
    Set<UUID> itemIds =
        request.rows().stream()
            .map(ManualStockCountLineSaveDto::itemId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    Map<UUID, Item> itemsById =
        itemIds.isEmpty()
            ? Map.of()
            : itemRepository.findAllByIdInAndOrgId(itemIds, orgId).stream()
                .collect(Collectors.toMap(Item::getId, i -> i, (a, b) -> a));

    int order = 0;
    for (ManualStockCountLineSaveDto dto : request.rows()) {
      ManualStockCountLine line = buildLine(orgId, branchId, request.date(), dto, now, itemsById);
      line.setLineOrder(dto.lineOrder() != null ? dto.lineOrder() : order++);
      line.setSheet(sheet);
      sheet.getLines().add(line);
    }
    sheet.setLastSavedAt(now);
    sheetRepository.save(sheet);
    return getSheet(orgId, branchId, request.date());
  }

  private ManualStockCountSheet newManualSheet(Branch branch, LocalDate businessDate, Instant now) {
    ManualStockCountSheet sheet = new ManualStockCountSheet();
    sheet.setOrg(branch.getOrg());
    sheet.setBranch(branch);
    sheet.setBusinessDate(businessDate);
    sheet.setCreatedAt(now);
    sheet.setLastSavedAt(now);
    return sheet;
  }

  private ManualStockCountLine buildLine(
      UUID orgId,
      UUID branchId,
      LocalDate businessDate,
      ManualStockCountLineSaveDto dto,
      Instant now,
      Map<UUID, Item> itemsById) {
    ManualStockCountLine line = new ManualStockCountLine();
    line.setCreatedAt(now);
    line.setUpdatedAt(now);
    applyItem(orgId, line, dto, itemsById);
    int opening =
        dto.openingQty() != null
            ? Math.max(0, dto.openingQty())
            : resolveDefaultOpening(branchId, businessDate, dto.itemId(), dto.itemName());
    line.setOpeningQty(opening);
    line.setAddedQty(dto.addedQty());
    line.setAddedTodayQty(dto.addedTodayQty());
    line.setClosingQty(dto.closingQty());
    line.setSystemQty(dto.systemQty());
    line.setSellingPrice(dto.sellingPrice().setScale(PRICE_SCALE, ROUNDING));
    line.setComments(normalizeComments(dto.comments()));
    return line;
  }

  private void applyItem(
      UUID orgId,
      ManualStockCountLine line,
      ManualStockCountLineSaveDto dto,
      Map<UUID, Item> itemsById) {
    if (dto.itemId() != null) {
      Item item = itemsById.get(dto.itemId());
      if (item == null) {
        item =
            itemRepository
                .findByIdAndOrgId(dto.itemId(), orgId)
                .orElseThrow(() -> new NotFoundException("ITEM_NOT_FOUND", "Item not found."));
      }
      line.setItem(item);
      String name = dto.itemName().isBlank() ? item.getName() : dto.itemName().trim();
      line.setItemName(name);
      if (dto.sku() == null || dto.sku().isBlank()) {
        line.setSku(item.getSku());
      } else {
        line.setSku(dto.sku().trim());
      }
    } else {
      line.setItem(null);
      line.setItemName(dto.itemName().trim());
      line.setSku(dto.sku() != null && !dto.sku().isBlank() ? dto.sku().trim() : null);
    }
  }

  private int resolveDefaultOpening(
      UUID branchId, LocalDate businessDate, UUID itemId, String itemName) {
    LocalDate prev = businessDate.minusDays(1);
    List<ManualStockCountLine> found;
    if (itemId != null) {
      found = lineRepository.findByBranchPreviousDateAndItemId(branchId, prev, itemId);
    } else {
      found =
          lineRepository.findByBranchPreviousDateAndItemNameNormalized(
              branchId, prev, itemName.trim());
    }
    if (found.isEmpty()) {
      return 0;
    }
    Integer c = found.get(0).getClosingQty();
    return c != null ? Math.max(0, c) : 0;
  }

  private static String normalizeComments(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    String t = raw.trim();
    return t.length() > COMMENTS_MAX_LEN ? t.substring(0, COMMENTS_MAX_LEN) : t;
  }

  private ManualStockCountSheetResponse toSheetResponse(ManualStockCountSheet sheet) {
    List<ManualStockCountLineResponse> rows =
        sheet.getLines().stream().map(this::toLineResponse).toList();
    return new ManualStockCountSheetResponse(
        sheet.getBusinessDate(), sheet.getBranch().getId(), sheet.getLastSavedAt(), rows);
  }

  private ManualStockCountLineResponse toLineResponse(ManualStockCountLine line) {
    int opening = line.getOpeningQty();
    int added = line.getAddedQty();
    int addedToday = line.getAddedTodayQty();
    int total = opening + added + addedToday;
    Integer closing = line.getClosingQty();
    int closingN = closing != null ? closing : 0;
    int unitsSold = Math.max(0, total - closingN);
    BigDecimal amount =
        line.getSellingPrice()
            .multiply(BigDecimal.valueOf(unitsSold))
            .setScale(AMOUNT_SCALE, ROUNDING);
    Integer system = line.getSystemQty();
    Integer variance = null;
    if (closing != null && system != null) {
      variance = closing - system;
    }
    return new ManualStockCountLineResponse(
        line.getId(),
        line.getItem() != null ? line.getItem().getId() : null,
        line.getItemName(),
        line.getSku(),
        opening,
        added,
        addedToday,
        total,
        closing,
        system,
        variance,
        unitsSold,
        line.getSellingPrice(),
        amount,
        line.getComments(),
        line.getLineOrder());
  }
}
