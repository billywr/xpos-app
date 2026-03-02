package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ItemBarcode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemBarcodeRepository extends JpaRepository<ItemBarcode, UUID> {

  @Query(
      """
      select b from ItemBarcode b
      where b.id = :id and b.org.id = :orgId
      """)
  Optional<ItemBarcode> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select b from ItemBarcode b
      where b.item.id = :itemId and b.org.id = :orgId
      order by b.createdAt
      """)
  List<ItemBarcode> findAllByItemIdAndOrgId(
      @Param("itemId") UUID itemId, @Param("orgId") UUID orgId);
}
