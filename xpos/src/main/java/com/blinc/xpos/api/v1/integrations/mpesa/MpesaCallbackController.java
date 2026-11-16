package com.blinc.xpos.api.v1.integrations.mpesa;

import com.blinc.xpos.modules.mpesa.service.MpesaCallbackService;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/integrations/mpesa/stk")
public class MpesaCallbackController {

  private static final Logger log = LoggerFactory.getLogger(MpesaCallbackController.class);

  private final MpesaCallbackService mpesaCallbackService;

  public MpesaCallbackController(MpesaCallbackService mpesaCallbackService) {
    this.mpesaCallbackService = Objects.requireNonNull(mpesaCallbackService);
  }

  @PostMapping("/callback")
  public ResponseEntity<Void> stkCallback(@RequestBody String rawJson) {
    try {
      mpesaCallbackService.handleStkCallback(rawJson);
    } catch (Exception ex) {
      log.error("M-Pesa callback processing error", ex);
    }
    return ResponseEntity.ok().build();
  }
}
