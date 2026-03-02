package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.inventory.domain.Recipe;
import com.blinc.xpos.modules.inventory.domain.RecipeLine;
import com.blinc.xpos.modules.inventory.repository.RecipeLineRepository;
import com.blinc.xpos.modules.inventory.repository.RecipeRepository;
import com.blinc.xpos.modules.inventory.service.RecipeService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecipeServiceImpl implements RecipeService {

  private final RecipeRepository recipeRepository;
  private final RecipeLineRepository recipeLineRepository;
  private final OrgService orgService;
  private final ItemService itemService;
  private final UomService uomService;
  private final Clock clock;

  public RecipeServiceImpl(
      RecipeRepository recipeRepository,
      RecipeLineRepository recipeLineRepository,
      OrgService orgService,
      ItemService itemService,
      UomService uomService,
      Clock clock) {
    this.recipeRepository = Objects.requireNonNull(recipeRepository, "recipeRepository");
    this.recipeLineRepository = Objects.requireNonNull(recipeLineRepository, "recipeLineRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Recipe create(UUID orgId, UUID menuItemId, BigDecimal yieldQty) {
    var org = orgService.require(orgId);
    var menuItem = itemService.require(orgId, menuItemId);
    if (recipeRepository.findByOrgIdAndMenuItemId(orgId, menuItemId).isPresent()) {
      throw new IllegalStateException(
          "Recipe already exists for menu item: " + menuItemId);
    }
    if (yieldQty == null || yieldQty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Yield quantity must be positive");
    }
    Instant now = Instant.now(clock);
    Recipe recipe = new Recipe();
    recipe.setOrg(org);
    recipe.setMenuItem(menuItem);
    recipe.setYieldQty(yieldQty);
    recipe.setActive(true);
    recipe.setCreatedAt(now);
    recipe.setUpdatedAt(now);
    return recipeRepository.save(recipe);
  }

  @Override
  @Transactional(readOnly = true)
  public Recipe require(UUID orgId, UUID recipeId) {
    return recipeRepository
        .findByIdAndOrgId(recipeId, orgId)
        .orElseThrow(
            () -> new NotFoundException("RECIPE_NOT_FOUND", "Recipe not found: " + recipeId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Recipe> list(UUID orgId, Pageable pageable) {
    return recipeRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public Recipe addLine(
      UUID orgId, UUID recipeId, UUID ingredientItemId, BigDecimal qty, UUID uomId) {
    Recipe recipe = require(orgId, recipeId);
    var ingredient = itemService.require(orgId, ingredientItemId);
    var uom = (uomId != null) ? uomService.require(orgId, uomId) : null;
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    Instant now = Instant.now(clock);
    RecipeLine line = new RecipeLine();
    line.setOrg(recipe.getOrg());
    line.setRecipe(recipe);
    line.setIngredientItem(ingredient);
    line.setQty(qty);
    line.setUom(uom);
    line.setCreatedAt(now);
    recipeLineRepository.save(line);
    recipe.setUpdatedAt(now);
    return recipeRepository.save(recipe);
  }

  @Override
  @Transactional
  public Recipe update(UUID orgId, UUID recipeId, BigDecimal yieldQty, Boolean active) {
    Recipe recipe = require(orgId, recipeId);
    if (yieldQty != null && yieldQty.compareTo(BigDecimal.ZERO) > 0) {
      recipe.setYieldQty(yieldQty);
    }
    if (active != null) {
      recipe.setActive(active);
    }
    recipe.setUpdatedAt(Instant.now(clock));
    return recipeRepository.save(recipe);
  }
}
