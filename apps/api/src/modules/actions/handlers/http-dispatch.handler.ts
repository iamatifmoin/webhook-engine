import { Injectable } from '@nestjs/common';
import axios, { AxiosError, HttpStatusCode } from 'axios';

@Injectable()
export class HttpDispatchHandler {
  async execute(
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<{ body: string; status: number }> {
    const url = this.readRequiredString(config.url, 'HTTP dispatch requires a url');
    const method = this.readOptionalString(config.method)?.toUpperCase() ?? 'POST';
    const headers = this.readHeaders(config.headers);

    try {
      const response = await axios.request({
        url,
        method,
        headers,
        timeout: 5000,
        data: method === 'GET' ? undefined : payload,
        validateStatus: () => true,
      });

      if (
        response.status < HttpStatusCode.Ok ||
        response.status >= HttpStatusCode.MultipleChoices
      ) {
        throw new Error(`HTTP dispatch failed with status ${response.status}`);
      }

      return {
        status: response.status,
        body: this.truncateResponse(response.data),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(this.formatAxiosError(error));
      }

      throw error instanceof Error
        ? error
        : new Error('HTTP dispatch failed with an unknown error');
    }
  }

  private formatAxiosError(error: AxiosError): string {
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return 'HTTP dispatch timed out after 5000ms';
    }

    if (error.response) {
      return `HTTP dispatch failed with status ${error.response.status}`;
    }

    return error.message || 'HTTP dispatch failed';
  }

  private readHeaders(headers: unknown): Record<string, string> {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      return {};
    }

    const normalizedHeaders = Object.entries(headers).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        if (typeof value === 'string') {
          accumulator[key] = value;
        }

        return accumulator;
      },
      {},
    );

    return normalizedHeaders;
  }

  private readRequiredString(value: unknown, errorMessage: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    throw new Error(errorMessage);
  }

  private readOptionalString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  private truncateResponse(data: unknown): string {
    const serialized =
      typeof data === 'string' ? data : JSON.stringify(data ?? null);

    return serialized.slice(0, 2000);
  }
}
