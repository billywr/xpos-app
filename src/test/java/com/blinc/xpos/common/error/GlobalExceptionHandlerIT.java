package com.blinc.xpos.common.error;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Integration tests that trigger GlobalExceptionHandler paths to improve coverage of error
 * responses (validation, type mismatch, 404, 409, malformed JSON, etc.).
 */
@SpringBootTest
@AutoConfigureMockMvc
class GlobalExceptionHandlerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void invalidUuidInPathReturnsTypeMismatch() throws Exception {
    mockMvc
        .perform(get("/api/v1/admin/orgs/not-a-valid-uuid").with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
        .andExpect(jsonPath("$.message").isString())
        .andExpect(jsonPath("$.requestId").exists());
  }

  @Test
  void validationErrorWhenCreatingOrgWithBlankName() throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest(""));
    mockMvc
        .perform(
            post("/api/v1/admin/orgs")
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.message").value("One or more fields are invalid."))
        .andExpect(jsonPath("$.details").isArray())
        .andExpect(jsonPath("$.requestId").exists());
  }

  @Test
  void malformedJsonReturnsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs")
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content("not valid json {"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MALFORMED_JSON"))
        .andExpect(jsonPath("$.requestId").exists());
  }

  @Test
  void getNonExistentOrgReturnsNotFound() throws Exception {
    UUID randomId = UUID.randomUUID();
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + randomId).with(user("admin").roles("ADMIN")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("ORG_NOT_FOUND"))
        .andExpect(jsonPath("$.requestId").exists());
  }

  @Test
  void duplicateOrgNameReturnsConflict() throws Exception {
    String uniqueName = "Conflict Test Org " + UUID.randomUUID();
    String body = objectMapper.writeValueAsString(new OrgCreateRequest(uniqueName));
    mockMvc
        .perform(
            post("/api/v1/admin/orgs")
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/v1/admin/orgs")
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").exists())
        .andExpect(jsonPath("$.message").isString())
        .andExpect(jsonPath("$.requestId").exists());
  }

  @Test
  void getNonExistentBusinessReturnsNotFound() throws Exception {
    UUID orgId = createOrg();
    UUID randomBusinessId = UUID.randomUUID();
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/businesses/" + randomBusinessId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("BUSINESS_NOT_FOUND"));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("GlobalExceptionHandler IT " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
