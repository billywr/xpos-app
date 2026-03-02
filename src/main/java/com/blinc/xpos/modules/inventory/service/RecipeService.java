package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.Recipe;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface RecipeService {

  Recipe create(UUID orgId, UUID menuItemId, BigDecimal yieldQty);

  Recipe require(UUID orgId, UUID recipeId);

  Page<Recipe> list(UUID orgId, Pageable pageable);

  Recipe addLine(
      UUID orgId, UUID recipeId, UUID ingredientItemId, BigDecimal qty, UUID uomId);

  Recipe update(UUID orgId, UUID recipeId, BigDecimal yieldQty, Boolean active);
}
