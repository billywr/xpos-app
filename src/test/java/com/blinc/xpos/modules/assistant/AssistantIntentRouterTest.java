package com.blinc.xpos.modules.assistant;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AssistantIntentRouterTest {

  @Test
  void routesSalesTodayKeywords() {
    assertThat(AssistantIntentRouter.resolve("How many sales today?"))
        .isEqualTo(AssistantIntent.SALES_TODAY);
    assertThat(AssistantIntentRouter.resolve("today revenue"))
        .isEqualTo(AssistantIntent.SALES_TODAY);
  }

  @Test
  void routesTopDrinksWhenBeverageMentioned() {
    assertThat(AssistantIntentRouter.resolve("most popular drink"))
        .isEqualTo(AssistantIntent.TOP_DRINKS);
    assertThat(AssistantIntentRouter.resolve("top beer sellers"))
        .isEqualTo(AssistantIntent.TOP_DRINKS);
    assertThat(AssistantIntentRouter.resolve("popular drink this week"))
        .isEqualTo(AssistantIntent.TOP_DRINKS);
  }

  @Test
  void routesSalesForExplicitPeriod() {
    assertThat(AssistantIntentRouter.resolve("sales this week"))
        .isEqualTo(AssistantIntent.SALES_TODAY);
  }

  @Test
  void routesLowStockAndCatalog() {
    assertThat(AssistantIntentRouter.resolve("what needs restock"))
        .isEqualTo(AssistantIntent.LOW_STOCK);
    assertThat(AssistantIntentRouter.resolve("how many items in catalog"))
        .isEqualTo(AssistantIntent.CATALOG_COUNT);
  }

  @Test
  void routesTopDebtorsWhenMostDebtMentioned() {
    assertThat(AssistantIntentRouter.resolve("who has the most the debt"))
        .isEqualTo(AssistantIntent.TOP_DEBTORS);
    assertThat(AssistantIntentRouter.resolve("who owes the most"))
        .isEqualTo(AssistantIntent.TOP_DEBTORS);
  }

  @Test
  void routesSessionContextForLoggedInUser() {
    assertThat(AssistantIntentRouter.resolve("which user is logged in now"))
        .isEqualTo(AssistantIntent.SESSION_CONTEXT);
    assertThat(AssistantIntentRouter.resolve("Who am I?"))
        .isEqualTo(AssistantIntent.SESSION_CONTEXT);
  }

  @Test
  void routesHelpForUnknown() {
    assertThat(AssistantIntentRouter.resolve("help")).isEqualTo(AssistantIntent.HELP);
    assertThat(AssistantIntentRouter.resolve("xyzzy random question"))
        .isEqualTo(AssistantIntent.UNKNOWN);
  }
}
