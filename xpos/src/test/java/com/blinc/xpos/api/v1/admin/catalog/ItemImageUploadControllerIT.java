package com.blinc.xpos.api.v1.admin.catalog;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class ItemImageUploadControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void uploadImageReturnsUrl() throws Exception {
    UUID orgId = createOrg();
    MockMultipartFile file =
        new MockMultipartFile(
            "file", "item.png", MediaType.IMAGE_PNG_VALUE, "fake-png-content".getBytes());

    MvcResult result =
        mockMvc
            .perform(
                multipart("/api/v1/admin/orgs/" + orgId + "/item-images/upload")
                    .file(file)
                    .with(adminJwt()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.url").exists())
            .andReturn();

    String url =
        objectMapper.readTree(result.getResponse().getContentAsString()).get("url").asText();
    if (!url.startsWith("/uploads/items/" + orgId + "/")) {
      throw new AssertionError(
          "Expected url to start with /uploads/items/" + orgId + "/, got: " + url);
    }
  }

  @Test
  void uploadNonImageReturns400() throws Exception {
    UUID orgId = createOrg();
    MockMultipartFile file =
        new MockMultipartFile("file", "document.pdf", "application/pdf", "fake-pdf".getBytes());

    mockMvc
        .perform(
            multipart("/api/v1/admin/orgs/" + orgId + "/item-images/upload")
                .file(file)
                .with(adminJwt()))
        .andExpect(status().isBadRequest());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Upload " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }
}
