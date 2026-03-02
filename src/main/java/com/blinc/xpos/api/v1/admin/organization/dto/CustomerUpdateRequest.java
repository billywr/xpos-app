package com.blinc.xpos.api.v1.admin.organization.dto;

public record CustomerUpdateRequest(String name, String phone, String email, Boolean active) {}
