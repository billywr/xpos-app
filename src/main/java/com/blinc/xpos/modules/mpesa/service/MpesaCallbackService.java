package com.blinc.xpos.modules.mpesa.service;

public interface MpesaCallbackService {

  void handleStkCallback(String rawJson);
}
