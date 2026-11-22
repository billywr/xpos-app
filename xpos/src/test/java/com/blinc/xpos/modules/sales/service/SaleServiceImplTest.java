package com.blinc.xpos.modules.sales.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.ModifierOptionService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.debt.service.CustomerDebtService;
import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.ledger.service.LedgerPostingService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.Receipt;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.repository.SaleLineModifierRepository;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.service.impl.SaleServiceImpl;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class SaleServiceImplTest {

  @Mock private SaleRepository saleRepository;
  @Mock private SaleLineRepository saleLineRepository;
  @Mock private SaleLineModifierRepository saleLineModifierRepository;
  @Mock private ShiftService shiftService;
  @Mock private BranchService branchService;
  @Mock private TerminalService terminalService;
  @Mock private StaffUserService staffUserService;
  @Mock private ItemService itemService;
  @Mock private UomService uomService;
  @Mock private ModifierOptionService modifierOptionService;
  @Mock private ReceiptService receiptService;
  @Mock private TenderService tenderService;
  @Mock private CustomerService customerService;
  @Mock private AuditLogService auditLogService;
  @Mock private LedgerPostingService ledgerPostingService;
  @Mock private InventoryItemService inventoryItemService;
  @Mock private StockMovementRepository stockMovementRepository;
  @Mock private StdStockCountSnapshotRepository stdStockCountSnapshotRepository;
  @Mock private CustomerDebtService customerDebtService;

  private final Clock clock =
      Clock.fixed(Instant.parse("2026-11-22T14:30:00Z"), ZoneId.of("Africa/Nairobi"));
  private SaleServiceImpl service;

  private final UUID orgId = UUID.randomUUID();
  private final UUID branchId = UUID.randomUUID();
  private final UUID terminalId = UUID.randomUUID();
  private final UUID staffUserId = UUID.randomUUID();
  private final UUID saleId = UUID.randomUUID();
  private final UUID itemId = UUID.randomUUID();

  private Org org;
  private Branch branch;
  private Terminal terminal;
  private StaffUser staffUser;
  private Item item;

  @BeforeEach
  void setUp() {
    service =
        new SaleServiceImpl(
            saleRepository,
            saleLineRepository,
            saleLineModifierRepository,
            shiftService,
            branchService,
            terminalService,
            staffUserService,
            itemService,
            uomService,
            modifierOptionService,
            receiptService,
            tenderService,
            customerService,
            auditLogService,
            ledgerPostingService,
            inventoryItemService,
            stockMovementRepository,
            stdStockCountSnapshotRepository,
            customerDebtService,
            clock);

    org = new Org();
    org.setId(orgId);

    branch = new Branch();
    branch.setId(branchId);
    branch.setOrg(org);
    branch.setTimezone("Africa/Nairobi");

    terminal = new Terminal();
    terminal.setId(terminalId);
    terminal.setBranch(branch);

    staffUser = new StaffUser();
    staffUser.setId(staffUserId);

    item = new Item();
    item.setId(itemId);
    item.setName("Best gin 750ml");
    item.setTrackInventory(true);
    item.setDefaultSellingPrice(new BigDecimal("900.00"));
    item.setBuyingPrice(new BigDecimal("700.00"));
  }

  @Test
  void shouldSetBusinessDateOnCreateSale() {
    Shift shift = new Shift();
    shift.setId(UUID.randomUUID());

    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(terminalService.require(orgId, terminalId)).thenReturn(terminal);
    when(shiftService.getCurrentOpenShift(orgId, branchId, terminalId))
        .thenReturn(Optional.of(shift));
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(saleRepository.save(any(Sale.class))).thenAnswer(inv -> inv.getArgument(0));
    when(saleRepository.findByIdAndOrgIdWithAssociations(any(), eq(orgId)))
        .thenAnswer(
            inv -> {
              Sale s = new Sale();
              s.setId(inv.getArgument(0));
              return Optional.of(s);
            });

    Sale created = service.create(orgId, branchId, terminalId, staffUserId, null);
    assertNotNull(created);

    ArgumentCaptor<Sale> captor = ArgumentCaptor.forClass(Sale.class);
    verify(saleRepository).save(captor.capture());
    Sale saved = captor.getValue();
    assertEquals(LocalDate.of(2026, 11, 22), saved.getBusinessDate());
    assertEquals(SaleStatus.OPEN, saved.getStatus());
  }

  @Test
  void shouldDecrementInventorySaveStockMovementAndUpdateSnapshotOnComplete() {
    Sale sale = new Sale();
    sale.setId(saleId);
    sale.setOrg(org);
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setStatus(SaleStatus.OPEN);
    sale.setTotal(new BigDecimal("900.00"));
    sale.setCreatedByStaffUser(staffUser);

    SaleLine line = new SaleLine();
    line.setId(UUID.randomUUID());
    line.setSale(sale);
    line.setItem(item);
    line.setQty(new BigDecimal("1.000"));

    Tender tender = new Tender();
    tender.setAmount(new BigDecimal("900.00"));

    StdStockCountSnapshot snap = new StdStockCountSnapshot();
    snap.setId(UUID.randomUUID());
    snap.setBranch(branch);
    snap.setItem(item);
    snap.setBusinessDate(LocalDate.of(2026, 11, 22));
    snap.setClosingQty(new BigDecimal("25.00"));

    when(tenderService.listBySale(orgId, saleId)).thenReturn(List.of(tender));
    when(saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(saleId))
        .thenReturn(List.of(line));
    when(inventoryItemService.getOnHandQty(orgId, branchId, itemId))
        .thenReturn(new BigDecimal("25.000"));
    when(stockMovementRepository.findLatestInByOrgAndBranchAndItem(
            eq(orgId), eq(branchId), eq(itemId), any(PageRequest.class)))
        .thenReturn(new PageImpl<>(List.of()));
    when(stdStockCountSnapshotRepository.findByBranchIdAndItemIdAndBusinessDate(
            branchId, itemId, LocalDate.of(2026, 11, 22)))
        .thenReturn(Optional.of(snap));
    when(receiptService.createForSale(sale)).thenReturn(new Receipt());
    when(saleRepository.save(any(Sale.class))).thenAnswer(inv -> inv.getArgument(0));
    when(saleRepository.findByIdAndOrgIdWithAssociations(saleId, orgId))
        .thenReturn(Optional.of(sale));

    Sale completed = service.complete(orgId, saleId);

    assertEquals(SaleStatus.COMPLETED, completed.getStatus());
    assertEquals(LocalDate.of(2026, 11, 22), completed.getBusinessDate());

    // Verify inventory decrement
    verify(inventoryItemService).decrementOnHand(orgId, branchId, itemId, new BigDecimal("1.000"));

    // Verify StockMovement
    ArgumentCaptor<StockMovement> movCaptor = ArgumentCaptor.forClass(StockMovement.class);
    verify(stockMovementRepository).save(movCaptor.capture());
    StockMovement mov = movCaptor.getValue();
    assertEquals(MovementType.OUT, mov.getMovementType());
    assertEquals(SourceType.SALE, mov.getSourceType());
    assertEquals(new BigDecimal("1.000"), mov.getQty());
    assertEquals(new BigDecimal("700.00"), mov.getUnitCost()); // buying price fallback

    // Verify StdStockCountSnapshot updated
    assertEquals(new BigDecimal("24.00"), snap.getClosingQty());
    verify(stdStockCountSnapshotRepository).save(snap);
  }

  @Test
  void shouldHealStalePreReceiptSnapshotToOnHandWhenCompletingSale() {
    Sale sale = new Sale();
    sale.setId(saleId);
    sale.setOrg(org);
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setStatus(SaleStatus.OPEN);
    sale.setTotal(new BigDecimal("18000.00"));
    sale.setCreatedByStaffUser(staffUser);
    sale.setBusinessDate(LocalDate.of(2026, 11, 22));

    SaleLine line = new SaleLine();
    line.setSale(sale);
    line.setItem(item);
    line.setQty(new BigDecimal("20.000"));

    Tender tender = new Tender();
    tender.setAmount(new BigDecimal("18000.00"));

    // Snapshot has 30 (pre-receipt baseline), but onHand after 20 sold from 74 total is 54
    StdStockCountSnapshot snap = new StdStockCountSnapshot();
    snap.setId(UUID.randomUUID());
    snap.setBranch(branch);
    snap.setItem(item);
    snap.setBusinessDate(LocalDate.of(2026, 11, 22));
    snap.setClosingQty(new BigDecimal("30.00"));

    when(tenderService.listBySale(orgId, saleId)).thenReturn(List.of(tender));
    when(saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(saleId))
        .thenReturn(List.of(line));
    when(inventoryItemService.getOnHandQty(orgId, branchId, itemId))
        .thenReturn(new BigDecimal("74.000"), new BigDecimal("54.000"));
    when(stockMovementRepository.findLatestInByOrgAndBranchAndItem(
            eq(orgId), eq(branchId), eq(itemId), any(PageRequest.class)))
        .thenReturn(new PageImpl<>(List.of()));
    when(stdStockCountSnapshotRepository.findByBranchIdAndItemIdAndBusinessDate(
            branchId, itemId, LocalDate.of(2026, 11, 22)))
        .thenReturn(Optional.of(snap));
    when(receiptService.createForSale(sale)).thenReturn(new Receipt());
    when(saleRepository.save(any(Sale.class))).thenAnswer(inv -> inv.getArgument(0));
    when(saleRepository.findByIdAndOrgIdWithAssociations(saleId, orgId))
        .thenReturn(Optional.of(sale));

    Sale completed = service.complete(orgId, saleId);

    assertEquals(SaleStatus.COMPLETED, completed.getStatus());
    // Closing qty must heal to 54.00 (onHand) instead of dropping to 10.00 (30 - 20)
    assertEquals(new BigDecimal("54.00"), snap.getClosingQty());
    verify(stdStockCountSnapshotRepository).save(snap);
  }

  @Test
  void shouldThrowConflictWhenInsufficientStockOnComplete() {
    Sale sale = new Sale();
    sale.setId(saleId);
    sale.setOrg(org);
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setStatus(SaleStatus.OPEN);
    sale.setTotal(new BigDecimal("900.00"));
    sale.setCreatedByStaffUser(staffUser);

    SaleLine line = new SaleLine();
    line.setSale(sale);
    line.setItem(item);
    line.setQty(new BigDecimal("5.000"));

    Tender tender = new Tender();
    tender.setAmount(new BigDecimal("900.00"));

    when(saleRepository.findByIdAndOrgIdWithAssociations(saleId, orgId))
        .thenReturn(Optional.of(sale));
    when(tenderService.listBySale(orgId, saleId)).thenReturn(List.of(tender));
    when(saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(saleId))
        .thenReturn(List.of(line));
    when(inventoryItemService.getOnHandQty(orgId, branchId, itemId))
        .thenReturn(new BigDecimal("2.000"));
    when(itemService.require(orgId, itemId)).thenReturn(item);

    ConflictException ex =
        assertThrows(ConflictException.class, () -> service.complete(orgId, saleId));

    assertEquals("INSUFFICIENT_STOCK", ex.getCode());
    verify(inventoryItemService, never()).decrementOnHand(any(), any(), any(), any());
    verify(stockMovementRepository, never()).save(any());
  }

  @Test
  void shouldRestoreInventoryAndSnapshotOnRefund() {
    Sale sale = new Sale();
    sale.setId(saleId);
    sale.setOrg(org);
    sale.setBranch(branch);
    sale.setTerminal(terminal);
    sale.setStatus(SaleStatus.COMPLETED);
    sale.setBusinessDate(LocalDate.of(2026, 11, 22));

    SaleLine line = new SaleLine();
    line.setSale(sale);
    line.setItem(item);
    line.setQty(new BigDecimal("1.000"));

    StdStockCountSnapshot snap = new StdStockCountSnapshot();
    snap.setClosingQty(new BigDecimal("24.00"));

    when(saleRepository.findByIdAndOrgId(saleId, orgId)).thenReturn(Optional.of(sale));
    when(saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(saleId))
        .thenReturn(List.of(line));
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(stockMovementRepository.findLatestInByOrgAndBranchAndItem(
            eq(orgId), eq(branchId), eq(itemId), any(PageRequest.class)))
        .thenReturn(new PageImpl<>(List.of()));
    when(stdStockCountSnapshotRepository.findByBranchIdAndItemIdAndBusinessDate(
            branchId, itemId, LocalDate.of(2026, 11, 22)))
        .thenReturn(Optional.of(snap));
    when(saleRepository.save(any(Sale.class))).thenAnswer(inv -> inv.getArgument(0));
    when(saleRepository.findByIdAndOrgIdWithAssociations(saleId, orgId))
        .thenReturn(Optional.of(sale));

    Sale refunded = service.refundSale(orgId, saleId, staffUserId);

    assertEquals(SaleStatus.REFUNDED, refunded.getStatus());
    verify(inventoryItemService).incrementOnHand(orgId, branchId, itemId, new BigDecimal("1.000"));

    ArgumentCaptor<StockMovement> movCaptor = ArgumentCaptor.forClass(StockMovement.class);
    verify(stockMovementRepository).save(movCaptor.capture());
    StockMovement mov = movCaptor.getValue();
    assertEquals(MovementType.IN, mov.getMovementType());
    assertEquals(SourceType.REFUND, mov.getSourceType());

    assertEquals(new BigDecimal("25.00"), snap.getClosingQty());
    verify(stdStockCountSnapshotRepository).save(snap);
  }
}
