package com.blinc.xpos.modules.assistant.service;

import com.blinc.xpos.modules.assistant.dto.AssistantQueryContext;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryResponse;

public interface AssistantQueryService {

  AssistantQueryResponse query(AssistantQueryContext context);
}
