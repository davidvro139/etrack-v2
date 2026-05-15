// Sets environment variables before any modules are required
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'etrack-test-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';
