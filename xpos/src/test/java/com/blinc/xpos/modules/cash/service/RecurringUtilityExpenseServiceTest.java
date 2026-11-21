package com.blinc.xpos.modules.cash.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import com.blinc.xpos.modules.cash.repository.RecurringUtilityExpenseRepository;
import com.blinc.xpos.modules.cash.service.impl.RecurringUtilityExpenseServiceImpl;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RecurringUtilityExpenseServiceTest {

  @Mock private RecurringUtilityExpenseRepository repository;
  @Mock private BranchService branchService;
  @Mock private StaffUserService staffUserService;

  private RecurringUtilityExpenseServiceImpl service;

  private final UUID orgId = UUID.randomUUID();
  private final UUID branchId = UUID.randomUUID();
  private final UUID staffUserId = UUID.randomUUID();
  private final UUID utilityId = UUID.randomUUID();

  private Org org;
  private Branch branch;
  private StaffUser staffUser;

  @BeforeEach
  void setUp() {
    service = new RecurringUtilityExpenseServiceImpl(repository, branchService, staffUserService);

    org = new Org();
    org.setId(orgId);

    branch = new Branch();
    branch.setId(branchId);
    branch.setOrg(org);

    staffUser = new StaffUser();
    staffUser.setId(staffUserId);
  }

  @Test
  void createSetsExplicitEffectiveFrom() {
    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LocalDate effective = LocalDate.of(2026, 6, 1);
    RecurringUtilityExpense created =
        service.create(
            orgId,
            branchId,
            "DSTV",
            new BigDecimal("4200.00"),
            effective,
            null,
            RecurringUtilityApplyTiming.BEGINNING_OF_MONTH,
            1,
            "MultiChoice",
            "DSTV-123",
            "Admin",
            "Monthly office entertainment",
            staffUserId);

    assertNotNull(created);
    assertEquals("DSTV", created.getName());
    assertEquals(new BigDecimal("4200.00"), created.getAmount());
    assertEquals(effective, created.getEffectiveFrom());
    assertNull(created.getEffectiveTo());
    assertTrue(created.isActive());
  }

  @Test
  void createDefaultsEffectiveFromToTodayWhenNull() {
    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    RecurringUtilityExpense created =
        service.create(
            orgId,
            branchId,
            "Internet",
            new BigDecimal("5000.00"),
            null,
            null,
            RecurringUtilityApplyTiming.BEGINNING_OF_MONTH,
            1,
            null,
            null,
            null,
            null,
            staffUserId);

    assertNotNull(created);
    assertEquals(LocalDate.now().withDayOfMonth(1), created.getEffectiveFrom());
    assertNull(created.getEffectiveTo());
  }

  @Test
  void updateInPlaceWhenNotRateChange() {
    RecurringUtilityExpense existing = new RecurringUtilityExpense();
    existing.setId(utilityId);
    existing.setOrg(org);
    existing.setBranch(branch);
    existing.setName("DSTV");
    existing.setAmount(new BigDecimal("4000.00"));
    existing.setEffectiveFrom(LocalDate.of(2026, 1, 1));
    existing.setActive(true);

    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    RecurringUtilityExpense updated =
        service.update(
            orgId,
            branchId,
            utilityId,
            "DSTV Premium",
            new BigDecimal("4000.00"),
            LocalDate.of(2026, 1, 1),
            null,
            false,
            null,
            null,
            null,
            null,
            null,
            null,
            "Corrected name",
            staffUserId);

    assertEquals("DSTV Premium", updated.getName());
    assertEquals(new BigDecimal("4000.00"), updated.getAmount());
    assertEquals(LocalDate.of(2026, 1, 1), updated.getEffectiveFrom());
    assertNull(updated.getEffectiveTo());
    assertTrue(updated.isActive());
  }

  @Test
  void updateWithRateChangePreservesPriorPeriodAndCreatesNewRecord() {
    RecurringUtilityExpense existing = new RecurringUtilityExpense();
    existing.setId(utilityId);
    existing.setOrg(org);
    existing.setBranch(branch);
    existing.setName("DSTV");
    existing.setAmount(new BigDecimal("4000.00"));
    existing.setEffectiveFrom(LocalDate.of(2026, 1, 1));
    existing.setApplyTiming(RecurringUtilityApplyTiming.BEGINNING_OF_MONTH);
    existing.setDueDayOfMonth(1);
    existing.setActive(true);

    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    // Even if user provides mid-month date (e.g. June 15th), it normalizes on month basis
    LocalDate newEffective = LocalDate.of(2026, 6, 15);
    RecurringUtilityExpense result =
        service.update(
            orgId,
            branchId,
            utilityId,
            "DSTV",
            new BigDecimal("4200.00"),
            newEffective,
            null,
            true, // explicit rate change
            null,
            null,
            null,
            null,
            null,
            true,
            "New subscription tier starting June",
            staffUserId);

    // Old utility capped on month basis at end of May (2026-05-31) - ZERO GAP with June 1st
    assertEquals(LocalDate.of(2026, 5, 31), existing.getEffectiveTo());
    assertFalse(existing.isActive());

    // New utility starts on month basis at start of June (2026-06-01)
    assertNotNull(result);
    assertEquals("DSTV", result.getName());
    assertEquals(new BigDecimal("4200.00"), result.getAmount());
    assertEquals(LocalDate.of(2026, 6, 1), result.getEffectiveFrom());
    assertNull(result.getEffectiveTo());
    assertTrue(result.isActive());
  }

  @Test
  void createWithExplicitEffectivePeriod() {
    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LocalDate from = LocalDate.of(2026, 1, 15);
    LocalDate to = LocalDate.of(2026, 8, 20);

    RecurringUtilityExpense created =
        service.create(
            orgId,
            branchId,
            "Water",
            new BigDecimal("3000.00"),
            from,
            to,
            RecurringUtilityApplyTiming.BEGINNING_OF_MONTH,
            1,
            null,
            null,
            null,
            null,
            staffUserId);

    assertNotNull(created);
    assertEquals(LocalDate.of(2026, 1, 1), created.getEffectiveFrom());
    assertEquals(LocalDate.of(2026, 8, 31), created.getEffectiveTo());
  }

  @Test
  void createThrowsWhenEffectiveToBeforeEffectiveFrom() {
    when(branchService.require(orgId, branchId)).thenReturn(branch);
    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);

    LocalDate from = LocalDate.of(2026, 10, 1);
    LocalDate to = LocalDate.of(2026, 6, 1);

    BadRequestException ex =
        assertThrows(
            BadRequestException.class,
            () ->
                service.create(
                    orgId,
                    branchId,
                    "Water",
                    new BigDecimal("3000.00"),
                    from,
                    to,
                    RecurringUtilityApplyTiming.BEGINNING_OF_MONTH,
                    1,
                    null,
                    null,
                    null,
                    null,
                    staffUserId));

    assertEquals("INVALID_EFFECTIVE_PERIOD", ex.getCode());
  }

  @Test
  void updateThrowsWhenEffectiveToBeforeEffectiveFrom() {
    RecurringUtilityExpense existing = new RecurringUtilityExpense();
    existing.setId(utilityId);
    existing.setOrg(org);
    existing.setBranch(branch);
    existing.setName("Water");
    existing.setAmount(new BigDecimal("3000.00"));
    existing.setEffectiveFrom(LocalDate.of(2026, 10, 1));
    existing.setActive(true);

    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId))
        .thenReturn(Optional.of(existing));

    BadRequestException ex =
        assertThrows(
            BadRequestException.class,
            () ->
                service.update(
                    orgId,
                    branchId,
                    utilityId,
                    "Water",
                    new BigDecimal("3000.00"),
                    LocalDate.of(2026, 10, 1),
                    LocalDate.of(2026, 6, 1),
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    true,
                    null,
                    staffUserId));

    assertEquals("INVALID_EFFECTIVE_PERIOD", ex.getCode());
  }

  @Test
  void updateInPlaceCanClearEffectiveTo() {
    RecurringUtilityExpense existing = new RecurringUtilityExpense();
    existing.setId(utilityId);
    existing.setOrg(org);
    existing.setBranch(branch);
    existing.setName("Water");
    existing.setAmount(new BigDecimal("3000.00"));
    existing.setEffectiveFrom(LocalDate.of(2026, 1, 1));
    existing.setEffectiveTo(LocalDate.of(2026, 12, 31));
    existing.setActive(true);

    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    // When updating in-place with null effectiveTo and explicit effectiveFrom, effectiveTo is
    // cleared to null
    RecurringUtilityExpense updated =
        service.update(
            orgId,
            branchId,
            utilityId,
            "Water",
            new BigDecimal("3000.00"),
            LocalDate.of(2026, 1, 1),
            null,
            false,
            null,
            null,
            null,
            null,
            null,
            true,
            null,
            staffUserId);

    assertNotNull(updated);
    assertNull(updated.getEffectiveTo());
  }

  @Test
  void updateAutomaticallyPreservesPriorPeriodWhenEffectiveFromIsAfterCurrent() {
    RecurringUtilityExpense existing = new RecurringUtilityExpense();
    existing.setId(utilityId);
    existing.setOrg(org);
    existing.setBranch(branch);
    existing.setName("Water");
    existing.setAmount(new BigDecimal("3000.00"));
    existing.setEffectiveFrom(LocalDate.of(2026, 1, 1));
    existing.setActive(true);

    when(staffUserService.require(orgId, staffUserId)).thenReturn(staffUser);
    when(repository.findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(RecurringUtilityExpense.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    // When isRateChange is null, advancing effectiveFrom to August automatically closes prior
    // period in July (2026-07-31)
    LocalDate newEffective = LocalDate.of(2026, 8, 1);
    RecurringUtilityExpense result =
        service.update(
            orgId,
            branchId,
            utilityId,
            "Water",
            new BigDecimal("2000.00"),
            newEffective,
            null,
            null, // automatic, no manual checkbox needed
            null,
            null,
            null,
            null,
            null,
            true,
            "Rate reduced to 2000 starting August",
            staffUserId);

    assertEquals(LocalDate.of(2026, 7, 31), existing.getEffectiveTo());
    assertFalse(existing.isActive());

    assertNotNull(result);
    assertEquals("Water", result.getName());
    assertEquals(new BigDecimal("2000.00"), result.getAmount());
    assertEquals(LocalDate.of(2026, 8, 1), result.getEffectiveFrom());
    assertNull(result.getEffectiveTo());
    assertTrue(result.isActive());
  }
}
