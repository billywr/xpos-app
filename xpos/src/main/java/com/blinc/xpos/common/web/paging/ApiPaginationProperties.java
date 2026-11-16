package com.blinc.xpos.common.web.paging;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "xpos.api.pagination")
public class ApiPaginationProperties {

  private int defaultSize = 25;
  private int maxSize = 200;

  public int getDefaultSize() {
    return defaultSize;
  }

  public void setDefaultSize(int defaultSize) {
    this.defaultSize = defaultSize;
  }

  public int getMaxSize() {
    return maxSize;
  }

  public void setMaxSize(int maxSize) {
    this.maxSize = maxSize;
  }
}
