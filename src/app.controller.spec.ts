import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('root() returns the running-status HTML page', () => {
    const html = appController.root();
    expect(html).toContain('Backend is running correctly');
    expect(html).toContain('Eatofine API');
  });

  it('health() returns a JSON status payload', () => {
    const res = appController.health();
    expect(res.ok).toBe(true);
    expect(res.service).toBe('eatofine-api');
    expect(res.database).toBe('MongoDB Atlas');
  });
});
