package com.blinc.xpos.modules.inventory.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.service.impl.InventoryItemServiceImpl;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryItemServiceImplTest {

  @Mock private InventoryItemRepository inventoryItemRepository;
  @Mock private BranchService branchService;
  @Mock private ItemService itemService;

  private final Clock clock = Clock.fixed(Instant.parse("2026-11-22T10:00:00Z"), ZoneId.of("UTC"));
  private InventoryItemServiceImpl service;

  private final UUID orgId = UUID.randomUUID();
  private final UUID branchId = UUID.randomUUID();
  private final UUID itemId1 = UUID.randomUUID();
  private final UUID itemId2 = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    service =
        new InventoryItemServiceImpl(inventoryItemRepository, branchService, itemService, clock);
  }

  @Test
  void shouldGetOnHandQtysByItemIdsInSingleBatch() {
    Item item1 = new Item();
    item1.setId(itemId1);
    InventoryItem inv1 = new InventoryItem();
    inv1.setItem(item1);
    inv1.setOnHandQty(new BigDecimal("25.000"));

    when(inventoryItemRepository.findAllByOrgIdAndBranchIdAndItemIdIn(
            orgId, branchId, Set.of(itemId1, itemId2)))
        .thenReturn(List.of(inv1));

    Map<UUID, BigDecimal> result =
        service.getOnHandQtysByItemIds(orgId, branchId, Set.of(itemId1, itemId2));

    assertEquals(2, result.size());
    assertEquals(new BigDecimal("25.000"), result.get(itemId1));
    assertEquals(BigDecimal.ZERO, result.get(itemId2));
  }

  @Test
  void shouldGetAllOnHandQtysByBranch() {
    Item item1 = new Item();
    item1.setId(itemId1);
    InventoryItem inv1 = new InventoryItem();
    inv1.setItem(item1);
    inv1.setOnHandQty(new BigDecimal("10.000"));

    when(inventoryItemRepository.findAllByOrgIdAndBranchIdWithItem(orgId, branchId))
        .thenReturn(List.of(inv1));

    Map<UUID, BigDecimal> result = service.getAllOnHandQtysByBranch(orgId, branchId);

    assertEquals(1, result.size());
    assertEquals(new BigDecimal("10.000"), result.get(itemId1));
  }

  @Test
  void shouldDecrementOnHandSuccessfully() {
    Item item = new Item();
    item.setId(itemId1);
    item.setName("Best gin 750ml");

    InventoryItem inv = new InventoryItem();
    inv.setItem(item);
    inv.setOnHandQty(new BigDecimal("25.000"));

    when(inventoryItemRepository.findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId1))
        .thenReturn(Optional.of(inv));

    service.decrementOnHand(orgId, branchId, itemId1, new BigDecimal("1"));

    assertEquals(new BigDecimal("24.000"), inv.getOnHandQty());
    verify(inventoryItemRepository).save(inv);
  }

  @Test
  void shouldThrowConflictWhenInsufficientStock() {
    Item item = new Item();
    item.setId(itemId1);
    item.setName("Best gin 750ml");

    InventoryItem inv = new InventoryItem();
    inv.setItem(item);
    inv.setOnHandQty(new BigDecimal("1.000"));

    when(inventoryItemRepository.findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId1))
        .thenReturn(Optional.of(inv));

    ConflictException ex =
        assertThrows(
            ConflictException.class,
            () -> service.decrementOnHand(orgId, branchId, itemId1, new BigDecimal("2")));

    assertEquals("INSUFFICIENT_STOCK", ex.getCode());
  }

  @Test
  void shouldIncrementOnHandSuccessfully() {
    Org org = new Org();
    org.setId(orgId);
    Branch branch = new Branch();
    branch.setId(branchId);
    branch.setOrg(org);
    Item item = new Item();
    item.setId(itemId1);

    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(itemService.requireActive(orgId, itemId1)).thenReturn(item);

    InventoryItem inv = new InventoryItem();
    inv.setOrg(org);
    inv.setBranch(branch);
    inv.setItem(item);
    inv.setOnHandQty(new BigDecimal("5.000"));

    when(inventoryItemRepository.findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId1))
        .thenReturn(Optional.of(inv));

    service.incrementOnHand(orgId, branchId, itemId1, new BigDecimal("3"));

    assertEquals(new BigDecimal("8.000"), inv.getOnHandQty());
    verify(inventoryItemRepository).save(inv);
  }
}
