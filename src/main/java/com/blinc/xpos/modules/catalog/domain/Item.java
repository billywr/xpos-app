package com.blinc.xpos.modules.catalog.domain;

import com.blinc.xpos.common.constants.enums.ItemType;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
@Table(name = "item")
@Getter
@Setter
@NoArgsConstructor
public class Item {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @Column(name = "sku")
  private String sku;

  @Column(name = "name", nullable = false)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "item_type", nullable = false)
  private ItemType itemType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "category_id")
  private Category category;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "base_uom_id")
  private Uom baseUom;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tax_profile_id")
  private TaxProfile taxProfile;

  @Column(name = "track_inventory", nullable = false)
  private Boolean trackInventory;

  @Column(name = "active", nullable = false)
  private Boolean active;

  @Column(name = "buying_price", precision = 18, scale = 2)
  private BigDecimal buyingPrice;

  @Column(name = "default_selling_price", precision = 18, scale = 2)
  private BigDecimal defaultSellingPrice;

  @Column(name = "visible_in_pos", nullable = false)
  private boolean visibleInPos = true;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  /**
   * STOCK/MENU are physical sellables: price lists that respect inventory should hide lines when
   * there is no on-hand, even if {@code trackInventory} was left off. Tracked items always follow
   * on-hand rules.
   */
  public boolean requiresOnHandForSellableListing() {
    if (Boolean.TRUE.equals(trackInventory)) {
      return true;
    }
    return itemType == ItemType.STOCK || itemType == ItemType.MENU;
  }
}
