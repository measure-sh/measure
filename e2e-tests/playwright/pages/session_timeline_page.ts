import { type Locator, type Page } from "@playwright/test";

export class SessionTimelinePage {
  readonly page: Page;
  readonly teamId: string;
  readonly eventsList: Locator;
  readonly eventDetails: Locator;
  readonly errorDetailsLink: Locator;
  readonly anrDetailsLink: Locator;
  readonly bugReportDetailsLink: Locator;
  readonly traceDetailsLink: Locator;
  readonly eventTypeFilter: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.eventsList = page.getByTestId("session-timeline-events");
    this.eventDetails = page.getByTestId("session-timeline-event-details");
    this.errorDetailsLink = page.getByRole("link", {
      name: "View Error Details",
    });
    this.anrDetailsLink = page.getByRole("link", {
      name: "View ANR Details",
    });
    this.bugReportDetailsLink = page.getByRole("link", {
      name: "View Bug Report Details",
    });
    this.traceDetailsLink = page.getByRole("link", {
      name: "View Trace Details",
    });
    this.eventTypeFilter = page.getByRole("button", { name: "Event types" });
  }

  userIdHeader(userId: string): Locator {
    return this.page.getByText(`User ID: ${userId}`);
  }

  selectEvent(type: string, title?: RegExp): Locator {
    const events = this.eventsList.locator(`[data-event-type="${type}"]`);
    return title ? events.filter({ hasText: title }) : events;
  }

  selectError(title: RegExp): Locator {
    return this.selectEvent("error", title);
  }

  selectAnr(title: RegExp): Locator {
    return this.selectEvent("anr", title);
  }

  selectBugReport(title: RegExp): Locator {
    return this.selectEvent("bug_report", title);
  }

  // The filter defaults to all types selected, so clear before picking one.
  async filterByEventType(eventType: string) {
    await this.eventTypeFilter.click();
    await this.page.getByRole("button", { name: "Clear", exact: true }).click();
    await this.page
      .getByRole("option", { name: eventType, exact: true })
      .click();
    await this.page.keyboard.press("Escape");
  }

  selectEventPill(event: Locator, label: string): Locator {
    return event.getByText(label, { exact: true });
  }

  async openErrorDetails() {
    await this.errorDetailsLink.click();
    await this.page.waitForURL(`**/${this.teamId}/errors/**`);
  }

  async openAnrDetails() {
    await this.anrDetailsLink.click();
    await this.page.waitForURL(`**/${this.teamId}/errors/**`);
  }

  async openBugReportDetails() {
    await this.bugReportDetailsLink.click();
    await this.page.waitForURL(`**/${this.teamId}/bug_reports/**`);
  }

  async openTraceDetails() {
    await this.traceDetailsLink.click();
    await this.page.waitForURL(`**/${this.teamId}/traces/**`);
  }
}
