package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.constants.enums.CashMovementType;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.repository.CashMovementRepository;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.cash.service.ShiftExpectedCashService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShiftExpectedCashServiceImpl implements ShiftExpectedCashService {

  private static final String TENDER_CODE_CASH = "CASH";

  private final ShiftRepository shiftRepository;
  private final SaleRepository saleRepository;
  private final TenderRepository tenderRepository;
  private final CashMovementRepository cashMovementRepository;

  public ShiftExpectedCashServiceImpl(
      ShiftRepository shiftRepository,
      SaleRepository saleRepository,
      TenderRepository tenderRepository,
      CashMovementRepository cashMovementRepository) {
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.tenderRepository = Objects.requireNonNull(tenderRepository, "tenderRepository");
    this.cashMovementRepository =
        Objects.requireNonNull(cashMovementRepository, "cashMovementRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal computeForOpenShift(UUID orgId, UUID shiftId) {
    Shift shift = shiftRepository.findByIdAndOrgId(shiftId, orgId).orElse(null);
    if (shift == null || shift.getStatus() != ShiftStatus.OPEN) {
      return null;
    }
    BigDecimal opening =
        shift.getOpeningFloatAmount() != null
            ? shift.getOpeningFloatAmount()
            : BigDecimal.ZERO;
    List<Sale> sales =
        saleRepository.findByShiftIdAndStatus(shiftId, SaleStatus.COMPLETED);
    List<UUID> saleIds = sales.stream().map(Sale::getId).toList();
    BigDecimal cashTenders = BigDecimal.ZERO;
    if (!saleIds.isEmpty()) {
      List<Tender> tenders = tenderRepository.findBySaleIdIn(saleIds);
      for (Tender t : tenders) {
        String code =
            t.getTenderType().getCode() == null ? "" : t.getTenderType().getCode();
        if (TENDER_CODE_CASH.equalsIgnoreCase(code)) {
          cashTenders =
              cashTenders.add(t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO);
        }
      }
    }
    BigDecimal paidIn = BigDecimal.ZERO;
    BigDecimal paidOut = BigDecimal.ZERO;
    for (CashMovement m : cashMovementRepository.findAllByShiftId(shiftId)) {
      BigDecimal amt = m.getAmount() != null ? m.getAmount() : BigDecimal.ZERO;
      if (m.getType() == CashMovementType.PAID_IN) {
        paidIn = paidIn.add(amt);
      } else if (m.getType() == CashMovementType.PAID_OUT) {
        paidOut = paidOut.add(amt);
      }
    }
    return opening.add(cashTenders).add(paidIn).subtract(paidOut);
  }
}
