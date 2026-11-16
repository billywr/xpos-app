package com.blinc.xpos.modules.inventory.domain;

import com.blinc.xpos.modules.catalog.domain.Item;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Editable line on a manual stock sheet (operator-entered quantities). */
@Entity
@Table(name = "manual_stock_count_line")
@Getter
@Setter
@NoArgsConstructor
public class ManualStockCountLine {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "sheet_id", nullable = false)
  private ManualStockCountSheet sheet;

  @Column(name = "line_order", nullable = false)
  private int lineOrder;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "item_id")
  private Item item;

  @Column(name = "item_name", nullable = false, length = 512)
  private String itemName;

  @Column(name = "sku", length = 128)
  private String sku;

  @Column(name = "opening_qty", nullable = false)
  private int openingQty;

  @Column(name = "added_qty", nullable = false)
  private int addedQty;

  @Column(name = "added_today_qty", nullable = false)
  private int addedTodayQty;

  @Column(name = "closing_qty")
  private Integer closingQty;

  @Column(name = "system_qty")
  private Integer systemQty;

  @Column(name = "selling_price", nullable = false, precision = 20, scale = 4)
  private BigDecimal sellingPrice;

  @Column(name = "comments", columnDefinition = "text")
  private String comments;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
