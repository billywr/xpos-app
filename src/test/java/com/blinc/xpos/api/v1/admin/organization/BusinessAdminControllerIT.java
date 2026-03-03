package com.blinc.xpos.api.v1.admin.organization;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class BusinessAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createRejectsDuplicateKraPin() throws Exception {
    UUID orgId = createOrg();
    String kraPin = "P051234567X";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/businesses")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"legalName\":\"First Business\",\"kraPin\":\"" + kraPin + "\"}"))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/businesses")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"legalName\":\"Second Business\",\"kraPin\":\"" + kraPin + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("KRA_PIN_ALREADY_EXISTS"));
  }

  @Test
  void updateRejectsDuplicateKraPin() throws Exception {
    UUID orgId = createOrg();
    String kraPin = "A038475566Y";
    MvcResult first =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"legalName\":\"Biz A\",\"kraPin\":\"" + kraPin + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID firstId =
        UUID.fromString(
            objectMapper.readTree(first.getResponse().getContentAsString()).get("id").asText());

    MvcResult second =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Biz B\",\"kraPin\":\"P999999999Z\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID secondId =
        UUID.fromString(
            objectMapper.readTree(second.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/businesses/" + secondId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"legalName\":\"Biz B\",\"kraPin\":\"" + kraPin + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("KRA_PIN_ALREADY_EXISTS"));
  }

  @Test
  void deleteSoftDeletesBusinessAndExcludesFromList() throws Exception {
    UUID orgId = createOrg();
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Business To Delete\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID businessId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/businesses/" + businessId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/businesses?page=0&size=100")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '%s')]", businessId.toString()).isEmpty());
  }

  private UUID createOrg() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            new OrgCreateRequest("Business Admin Test Org " + UUID.randomUUID()))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class).id();
  }
}
