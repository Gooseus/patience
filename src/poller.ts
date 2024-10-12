import type { Client, Response, PollerOptions } from './types/index.js';

export class Poller {
  private client: Client;
  private options: PollerOptions;

  constructor(client: Client, options: PollerOptions) {
    this.client = client;
    this.options = options;
  }

  async poll(): Promise<Response> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    while (Date.now() - startTime < this.options.timeout) {
      try {
        const response = await this.client.request(this.options.method, this.options.url);

        const action = this.evaluateResponse(response);

        if (action === 'success') {
          return response;
        } else if (action === 'fail') {
          throw new Error('Received response triggering failure.');
        }
      } catch (error) {
        lastError = error as Error;
      }

      await this.delay(this.options.interval);
    }

    throw lastError || new Error('Polling exceeded timeout.');
  }

  private evaluateResponse(response: Response) : 'success' | 'fail' | 'poll' {
    const { expectedResponses } = this.options;
    const { statusCode, body } = response;

    if (expectedResponses?.length > 0) {
      for (const { action, bodyRegex, body: expectedBody, status } of expectedResponses) {
        const statusMatch = !status || status === statusCode;
        const bodyMatch = !expectedBody || expectedBody === body;
        const bodyRegexMatch = !bodyRegex || bodyRegex.test(body);

        if (statusMatch && (bodyMatch || bodyRegexMatch)) return action || 'success';
      }
    } else {
      // No expected responses
      if (statusCode === this.options.expectStatus) {
        if (this.options?.expectBody !== body) return 'poll';
        if (this.options.expectBodyRegex?.test(body)) return 'poll';
        return 'success';
      }
    }

    return 'poll';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
