export class ProviderApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number, name = "ProviderApiError") {
    super(message);
    this.name = name;
    this.status = status;
  }
}
