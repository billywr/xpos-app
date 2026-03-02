package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.RecipeLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeLineRepository extends JpaRepository<RecipeLine, UUID> {

  @Query(
      """
      select l from RecipeLine l
      where l.recipe.id = :recipeId
      order by l.createdAt
      """)
  List<RecipeLine> findByRecipeIdOrderByCreatedAt(@Param("recipeId") UUID recipeId);
}
