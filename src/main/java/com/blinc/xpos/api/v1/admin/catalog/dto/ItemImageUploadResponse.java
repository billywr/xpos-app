package com.blinc.xpos.api.v1.admin.catalog.dto;

/**
 * Response after uploading an item image. The URL can be used as imageUrl when creating or updating
 * an item.
 */
public record ItemImageUploadResponse(String url) {}
