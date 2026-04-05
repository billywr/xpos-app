package com.blinc.xpos.config.web;

import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded item images from the configured upload directory. Maps /uploads/** to the
 * filesystem path (e.g. uploads/items/).
 */
@Configuration
public class UploadResourceConfig implements WebMvcConfigurer {

  private final String uploadDir;

  public UploadResourceConfig(@Value("${xpos.upload.dir:uploads}") String uploadDir) {
    this.uploadDir = uploadDir.replaceAll("/$", "");
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    Path basePath = Path.of(uploadDir, "items").toAbsolutePath();
    String location = "file:" + basePath + "/";
    registry.addResourceHandler("/uploads/items/**").addResourceLocations(location);
  }
}
