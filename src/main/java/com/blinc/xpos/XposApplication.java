package com.blinc.xpos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class XposApplication {

  public static void main(String[] args) {
    SpringApplication.run(XposApplication.class, args);
  }
}
