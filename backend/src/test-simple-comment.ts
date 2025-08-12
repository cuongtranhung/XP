// Test simple comment query
import { getCommentsSimple } from './modules/comments/comment.service.simple';

async function test() {
  const result = await getCommentsSimple('123866b4-0c6d-448e-b4cb-bb78818de408');
  console.log('🚨 FINAL RESULT:', result);
}

test().catch(console.error);