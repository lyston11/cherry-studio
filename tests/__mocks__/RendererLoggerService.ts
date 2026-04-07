/* oxlint-disable @typescript-eslint/no-empty-function */

// Simple mock LoggerService class for renderer process
export class MockRendererLoggerService {
  private static instance: MockRendererLoggerService

  public static getInstance(): MockRendererLoggerService {
    if (!MockRendererLoggerService.instance) {
      MockRendererLoggerService.instance = new MockRendererLoggerService()
    }
    return MockRendererLoggerService.instance
  }

  public static resetInstance(): void {
    MockRendererLoggerService.instance = new MockRendererLoggerService()
  }

  public initWindowSource(): MockRendererLoggerService {
    return this
  }
  public withContext(): MockRendererLoggerService {
    return this
  }
  public setLevel(): void {}
  public getLevel(): string {
    return 'silly'
  }
  public resetLevel(): void {}
  public error(): void {}
  public warn(): void {}
  public info(): void {}
  public verbose(): void {}
  public debug(): void {}
  public silly(): void {}
}

// Create and export the mock instance
export const mockRendererLoggerService = MockRendererLoggerService.getInstance()

// Mock the LoggerService module
const RendererLoggerServiceMock = {
  LoggerService: MockRendererLoggerService,
  loggerService: mockRendererLoggerService
}

export default RendererLoggerServiceMock
