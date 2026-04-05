package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.SupplierCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.SupplierResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.SupplierUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.Supplier;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/suppliers")
public class SupplierAdminController {

  private final SupplierService supplierService;
  private final PageRequestFactory pageRequestFactory;

  public SupplierAdminController(
      SupplierService supplierService, PageRequestFactory pageRequestFactory) {
    this.supplierService = Objects.requireNonNull(supplierService, "supplierService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  private static SupplierResponse toResponse(Supplier supplier) {
    return new SupplierResponse(
        supplier.getId(),
        supplier.getOrg().getId(),
        supplier.getName(),
        supplier.getPhone(),
        supplier.getEmail(),
        supplier.getActive(),
        supplier.getCreatedAt(),
        supplier.getUpdatedAt());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SupplierResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody SupplierCreateRequest request) {
    Supplier created =
        supplierService.create(orgId, request.name(), request.phone(), request.email());
    return toResponse(created);
  }

  @GetMapping
  public Page<SupplierResponse> list(
      @PathVariable UUID orgId,
      @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive,
      Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("name").ascending());
    Page<Supplier> page =
        includeInactive
            ? supplierService.list(orgId, normalized)
            : supplierService.listActiveOnly(orgId, normalized);
    return page.map(SupplierAdminController::toResponse);
  }

  @GetMapping("/{supplierId}")
  public SupplierResponse get(@PathVariable UUID orgId, @PathVariable UUID supplierId) {
    return toResponse(supplierService.require(orgId, supplierId));
  }

  @PatchMapping("/{supplierId}")
  public SupplierResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID supplierId,
      @Valid @RequestBody SupplierUpdateRequest request) {
    Supplier updated =
        supplierService.update(
            orgId, supplierId, request.name(), request.phone(), request.email(), request.active());
    return toResponse(updated);
  }
}
