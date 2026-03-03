package com.blinc.xpos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {"com.blinc.xpos.modules", "com.blinc.xpos.common"})
@EnableScheduling
public class XposApplication {

  public static void main(String[] args) {
    SpringApplication.run(XposApplication.class, args);
  }
}
