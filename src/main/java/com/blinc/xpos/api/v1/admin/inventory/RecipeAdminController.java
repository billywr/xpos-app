package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.RecipeCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.RecipeLineAddRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.RecipeLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.RecipeResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.RecipeUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.Recipe;
import com.blinc.xpos.modules.inventory.domain.RecipeLine;
import com.blinc.xpos.modules.inventory.repository.RecipeLineRepository;
import com.blinc.xpos.modules.inventory.service.RecipeService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/recipes")
public class RecipeAdminController {

  private final RecipeService recipeService;
  private final RecipeLineRepository recipeLineRepository;
  private final PageRequestFactory pageRequestFactory;

  public RecipeAdminController(
      RecipeService recipeService,
      RecipeLineRepository recipeLineRepository,
      PageRequestFactory pageRequestFactory) {
    this.recipeService = Objects.requireNonNull(recipeService, "recipeService");
    this.recipeLineRepository = Objects.requireNonNull(recipeLineRepository, "recipeLineRepository");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RecipeResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody RecipeCreateRequest request) {
    Recipe recipe = recipeService.create(orgId, request.menuItemId(), request.yieldQty());
    return toResponse(recipe);
  }

  @GetMapping
  public Page<RecipeResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return recipeService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{recipeId}")
  public RecipeResponse get(@PathVariable UUID orgId, @PathVariable UUID recipeId) {
    return toResponse(recipeService.require(orgId, recipeId));
  }

  @PatchMapping("/{recipeId}")
  public RecipeResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID recipeId,
      @Valid @RequestBody RecipeUpdateRequest request) {
    Recipe recipe =
        recipeService.update(
            orgId, recipeId, request.yieldQty(), request.active());
    return toResponse(recipe);
  }

  @PostMapping("/{recipeId}/lines")
  public RecipeResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID recipeId,
      @Valid @RequestBody RecipeLineAddRequest request) {
    Recipe recipe =
        recipeService.addLine(
            orgId,
            recipeId,
            request.ingredientItemId(),
            request.qty(),
            request.uomId());
    return toResponse(recipe);
  }

  private RecipeResponse toResponse(Recipe r) {
    List<RecipeLine> lines = recipeLineRepository.findByRecipeIdOrderByCreatedAt(r.getId());
    List<RecipeLineResponse> lineResponses = lines.stream().map(this::toLineResponse).toList();
    return new RecipeResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getMenuItem().getId(),
        r.getMenuItem().getName(),
        r.getYieldQty(),
        r.getActive(),
        r.getCreatedAt(),
        r.getUpdatedAt(),
        lineResponses);
  }

  private RecipeLineResponse toLineResponse(RecipeLine l) {
    return new RecipeLineResponse(
        l.getId(),
        l.getRecipe().getId(),
        l.getIngredientItem().getId(),
        l.getIngredientItem().getName(),
        l.getQty(),
        l.getUom() != null ? l.getUom().getId() : null,
        l.getCreatedAt());
  }
}
