/* oslint-disable @typescript-eslint/no-empty-function */

// Simple mock LoggerService class for main process
export class MockMainLoggerService {
  private static instance: MockMainLoggerService

  public static getInstance(): MockMainLoggerService {
    if (!MockMainLoggerService.instance) {
      MockMainLoggerService.instance = new MockMainLoggerService()
    }
    return MockMainLoggerService.instance
  }

  public static resetInstance(): void {
    MockMainLoggerService.instance = new MockMainLoggerService()
  }

  public withContext(): MockMainLoggerService {
    return this
  }
  public finish(): void {}
  public setLevel(): void {}
  public getLevel(): string {
    return 'silly'
  }
  public resetLevel(): void {}
  public getLogsDir(): string {
    return '/mock/logs'
  }
  public getBaseLogger(): any {
    return {}
  }
  public error(): void {}
  public warn(): void {}
  public info(): void {}
  public verbose(): void {}
  public debug(): void {}
  public silly(): void {}
}

// Create and export the mock instance
export const mockMainLoggerService = MockMainLoggerService.getInstance()

// Mock the LoggerService module for main process
const MainLoggerServiceMock = {
  LoggerService: MockMainLoggerService,
  loggerService: mockMainLoggerService
}

export default MainLoggerServiceMock
