package com.blinc.xpos;

import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {"com.blinc.xpos.modules", "com.blinc.xpos.common"})
@EnableScheduling
public class XposApplication {

  private static final Logger log = LoggerFactory.getLogger(XposApplication.class);

  private final Environment environment;

  public XposApplication(Environment environment) {
    this.environment = environment;
  }

  public static void main(String[] args) {
    SpringApplication.run(XposApplication.class, args);
  }

  @EventListener(ApplicationReadyEvent.class)
  public void onApplicationReady() {
    String port =
        environment.getProperty(
            "local.server.port", environment.getProperty("server.port", "9003"));
    String[] activeProfiles = environment.getActiveProfiles();
    String profiles = activeProfiles.length > 0 ? Arrays.toString(activeProfiles) : "default";
    log.info(
        "[READY] XPOS Application started successfully on port {} [profiles: {}]", port, profiles);
  }
}
