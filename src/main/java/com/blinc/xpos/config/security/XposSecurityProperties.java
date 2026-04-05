package com.blinc.xpos.config.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "xpos.security")
public class XposSecurityProperties {

  private Roles roles = new Roles();

  public Roles getRoles() {
    return roles;
  }

  public void setRoles(Roles roles) {
    this.roles = roles;
  }

  public static class Roles {

    private String admin = "xpos-admin";
    private String operator = "xpos-operator";

    public String getAdmin() {
      return admin;
    }

    public void setAdmin(String admin) {
      this.admin = admin;
    }

    public String getOperator() {
      return operator;
    }

    public void setOperator(String operator) {
      this.operator = operator;
    }
  }
}
