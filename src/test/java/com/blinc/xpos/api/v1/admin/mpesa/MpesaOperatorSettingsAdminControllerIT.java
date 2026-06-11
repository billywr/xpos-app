package com.blinc.xpos.api.v1.admin.mpesa;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
class MpesaOperatorSettingsAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void getDefaultsToDisabled() throws Exception {
    UUID orgId = createOrg();

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/mpesa/operator-settings").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stkOperatorEnabled").value(false));
  }

  @Test
  void patchEnablesAndDisablesStkOperator() throws Exception {
    UUID orgId = createOrg();
    String base = "/api/v1/admin/orgs/" + orgId + "/mpesa/operator-settings";

    mockMvc
        .perform(
            patch(base)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"stkOperatorEnabled\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stkOperatorEnabled").value(true));

    mockMvc
        .perform(get(base).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stkOperatorEnabled").value(true));

    mockMvc
        .perform(
            patch(base)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"stkOperatorEnabled\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stkOperatorEnabled").value(false));
  }

  @Test
  void patchWithoutBodyReturns400() throws Exception {
    UUID orgId = createOrg();

    mockMvc
        .perform(patch("/api/v1/admin/orgs/" + orgId + "/mpesa/operator-settings").with(adminJwt()))
        .andExpect(status().isBadRequest());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Mpesa Operator Settings Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readValue(result.getResponse().getContentAsString(), OrgResponse.class)
        .id();
  }
}
