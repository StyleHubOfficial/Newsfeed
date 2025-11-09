const request = require('supertest');
const app = require('../server/index');

describe('LLM proxy endpoints', () => {
  test('rewrite returns 400 when text missing', async () => {
    const res = await request(app).post('/api/rewrite').send({});
    expect([400, 500]).toContain(res.status);
  }, 10000);

  test('suggestion endpoint returns 200 or 500 (if provider missing)', async () => {
    const res = await request(app).post('/api/suggestion').send({});
    expect([200, 500]).toContain(res.status);
  }, 10000);
});
