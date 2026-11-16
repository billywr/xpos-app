package com.blinc.xpos.modules.mpesa.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.mpesa.client.DarajaClient;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfigStatus;
import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigCreateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigResponse;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigUpdateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaOperatorSettingsResponse;
import com.blinc.xpos.modules.mpesa.repository.MpesaConfigRepository;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import com.blinc.xpos.modules.mpesa.util.MpesaSecretMasker;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.OrgRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MpesaConfigServiceImpl implements MpesaConfigService {

  private final MpesaConfigRepository mpesaConfigRepository;
  private final OrgRepository orgRepository;
  private final BranchService branchService;
  private final DarajaClient darajaClient;
  private final Clock clock;

  public MpesaConfigServiceImpl(
      MpesaConfigRepository mpesaConfigRepository,
      OrgRepository orgRepository,
      BranchService branchService,
      DarajaClient darajaClient,
      Clock clock) {
    this.mpesaConfigRepository = Objects.requireNonNull(mpesaConfigRepository);
    this.orgRepository = Objects.requireNonNull(orgRepository);
    this.branchService = Objects.requireNonNull(branchService);
    this.darajaClient = Objects.requireNonNull(darajaClient);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional(readOnly = true)
  public boolean isStkOperatorEnabled(UUID orgId) {
    return requireOrg(orgId).isMpesaStkOperatorEnabled();
  }

  @Override
  @Transactional(readOnly = true)
  public MpesaOperatorSettingsResponse getOperatorSettings(UUID orgId) {
    return new MpesaOperatorSettingsResponse(requireOrg(orgId).isMpesaStkOperatorEnabled());
  }

  @Override
  @Transactional
  public MpesaOperatorSettingsResponse updateOperatorSettings(
      UUID orgId, boolean stkOperatorEnabled) {
    Org org = requireOrg(orgId);
    org.setMpesaStkOperatorEnabled(stkOperatorEnabled);
    org.setUpdatedAt(Instant.now(clock));
    orgRepository.save(org);
    return new MpesaOperatorSettingsResponse(stkOperatorEnabled);
  }

  @Override
  @Transactional(readOnly = true)
  public MpesaConfig resolve(UUID orgId, UUID branchId) {
    return mpesaConfigRepository
        .findActiveByOrgIdAndBranchId(orgId, branchId, MpesaConfigStatus.ACTIVE)
        .or(() -> mpesaConfigRepository.findActiveOrgDefault(orgId, MpesaConfigStatus.ACTIVE))
        .orElseThrow(
            () ->
                new BadRequestException(
                    "MPESA_NOT_CONFIGURED",
                    "M-Pesa is not configured for this branch. Ask an admin to set up Daraja"
                        + " credentials in Admin Settings."));
  }

  @Override
  public boolean isAutoComplete(MpesaConfig config) {
    return config.isStkAutoComplete();
  }

  @Override
  @Transactional(readOnly = true)
  public List<MpesaConfigResponse> listByOrg(UUID orgId) {
    requireOrg(orgId);
    return mpesaConfigRepository.findAllByOrgId(orgId).stream().map(this::toResponse).toList();
  }

  @Override
  @Transactional(readOnly = true)
  public MpesaConfigResponse get(UUID orgId, UUID configId) {
    return toResponse(requireConfig(orgId, configId));
  }

  @Override
  @Transactional
  public MpesaConfigResponse createOrgDefault(UUID orgId, MpesaConfigCreateRequest request) {
    if (request.branchId() != null && !request.branchId().isBlank()) {
      throw new BadRequestException(
          "MPESA_CONFIG_INVALID", "Use branch override endpoint for branch-specific config");
    }
    requireOrg(orgId);
    mpesaConfigRepository
        .findActiveOrgDefault(orgId, MpesaConfigStatus.ACTIVE)
        .ifPresent(
            c -> {
              throw new ConflictException(
                  "MPESA_CONFIG_EXISTS", "Active org-default M-Pesa config already exists");
            });
    MpesaConfig config = buildConfig(orgId, null, request);
    return toResponse(mpesaConfigRepository.save(config));
  }

  @Override
  @Transactional
  public MpesaConfigResponse createBranchOverride(
      UUID orgId, UUID branchId, MpesaConfigCreateRequest request) {
    requireOrg(orgId);
    Branch branch = branchService.require(orgId, branchId);
    mpesaConfigRepository
        .findActiveByOrgIdAndBranchId(orgId, branchId, MpesaConfigStatus.ACTIVE)
        .ifPresent(
            c -> {
              throw new ConflictException(
                  "MPESA_CONFIG_EXISTS",
                  "Active M-Pesa config already exists for branch " + branch.getName());
            });
    MpesaConfig config = buildConfig(orgId, branch, request);
    return toResponse(mpesaConfigRepository.save(config));
  }

  @Override
  @Transactional(readOnly = true)
  public void verifyDarajaConnection(UUID orgId, UUID configId) {
    MpesaConfig config = requireConfig(orgId, configId);
    darajaClient.verifyOAuth(config);
  }

  @Override
  @Transactional
  public MpesaConfigResponse update(UUID orgId, UUID configId, MpesaConfigUpdateRequest request) {
    MpesaConfig config = requireConfig(orgId, configId);
    if (request.environment() != null) {
      config.setEnvironment(request.environment());
    }
    if (request.consumerKey() != null && !request.consumerKey().isBlank()) {
      config.setConsumerKey(request.consumerKey().trim());
    }
    if (request.consumerSecret() != null
        && !request.consumerSecret().isBlank()
        && !MpesaSecretMasker.isMasked(request.consumerSecret())) {
      config.setConsumerSecret(request.consumerSecret().trim());
    }
    if (request.passkey() != null
        && !request.passkey().isBlank()
        && !MpesaSecretMasker.isMasked(request.passkey())) {
      config.setPasskey(request.passkey().trim());
    }
    if (request.shortcode() != null && !request.shortcode().isBlank()) {
      config.setShortcode(request.shortcode().trim());
    }
    if (request.tillNumber() != null) {
      config.setTillNumber(request.tillNumber().isBlank() ? null : request.tillNumber().trim());
    }
    if (request.stkAutoComplete() != null) {
      config.setStkAutoComplete(request.stkAutoComplete());
    }
    if (request.callbackBaseUrl() != null) {
      config.setCallbackBaseUrl(
          request.callbackBaseUrl().isBlank() ? null : request.callbackBaseUrl().trim());
    }
    if (request.status() != null) {
      config.setStatus(request.status());
    }
    config.setUpdatedAt(Instant.now(clock));
    MpesaConfig saved = mpesaConfigRepository.save(config);
    darajaClient.invalidateOAuthCache(saved.getId());
    return toResponse(saved);
  }

  @Override
  @Transactional
  public void deactivate(UUID orgId, UUID configId) {
    MpesaConfig config = requireConfig(orgId, configId);
    config.setStatus(MpesaConfigStatus.INACTIVE);
    config.setUpdatedAt(Instant.now(clock));
    mpesaConfigRepository.save(config);
  }

  private MpesaConfig buildConfig(UUID orgId, Branch branch, MpesaConfigCreateRequest request) {
    Org org = requireOrg(orgId);
    Instant now = Instant.now(clock);
    MpesaConfig config = new MpesaConfig();
    config.setOrg(org);
    config.setBranch(branch);
    config.setEnvironment(request.environment());
    config.setConsumerKey(request.consumerKey().trim());
    config.setConsumerSecret(request.consumerSecret().trim());
    config.setPasskey(
        request.passkey() == null || request.passkey().isBlank() ? "" : request.passkey().trim());
    config.setShortcode(request.shortcode().trim());
    config.setTillNumber(
        request.tillNumber() == null || request.tillNumber().isBlank()
            ? null
            : request.tillNumber().trim());
    config.setStkAutoComplete(request.stkAutoComplete());
    config.setCallbackBaseUrl(
        request.callbackBaseUrl() == null || request.callbackBaseUrl().isBlank()
            ? null
            : request.callbackBaseUrl().trim());
    config.setStatus(MpesaConfigStatus.ACTIVE);
    config.setCreatedAt(now);
    config.setUpdatedAt(now);
    return config;
  }

  private Org requireOrg(UUID orgId) {
    return orgRepository
        .findById(orgId)
        .orElseThrow(() -> new NotFoundException("ORG_NOT_FOUND", "Org not found: " + orgId));
  }

  private MpesaConfig requireConfig(UUID orgId, UUID configId) {
    return mpesaConfigRepository
        .findByIdAndOrgId(orgId, configId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "MPESA_CONFIG_NOT_FOUND", "M-Pesa config not found: " + configId));
  }

  private MpesaConfigResponse toResponse(MpesaConfig config) {
    return new MpesaConfigResponse(
        config.getId(),
        config.getOrg().getId(),
        config.getBranch() != null ? config.getBranch().getId() : null,
        config.getBranch() != null ? config.getBranch().getName() : null,
        config.getEnvironment(),
        config.getConsumerKey(),
        MpesaSecretMasker.mask(config.getConsumerSecret()),
        passkeyMasked(config),
        config.getShortcode(),
        config.getTillNumber(),
        config.isStkAutoComplete(),
        config.getCallbackBaseUrl(),
        config.getStatus(),
        config.getCreatedAt(),
        config.getUpdatedAt());
  }

  private static String passkeyMasked(MpesaConfig config) {
    if (config.getPasskey() == null || config.getPasskey().isBlank()) {
      return config.getEnvironment() == MpesaEnvironment.SANDBOX ? "(sandbox default)" : "";
    }
    return MpesaSecretMasker.mask(config.getPasskey());
  }
}
