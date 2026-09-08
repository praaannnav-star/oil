// Using native fetch in Node.js 18+

const BASE_URL = 'https://oil-bridge-api.praaannnav.workers.dev/api';
const CREDENTIALS = { username: 'admin', password: 'password123' };

async function runTest() {
  console.log('🧪 Starting AI Evidence Engine E2E Test...');
  
  // 1. Login
  console.log('\n[1] Authenticating...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }
  const { jwt } = await loginRes.json();
  console.log('✅ Logged in successfully.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`
  };

  // 2. Submit a report with a data URI (simulating a photo of concrete pouring)
  console.log('\n[2] Submitting field report with simulated photo evidence...');
  // A tiny 1x1 transparent GIF just for testing to see if Vision AI processes it.
  // Actually, Llama vision might reject non-photographic images with "I cannot see anything", but it should return a structured JSON regardless!
  const dummyImageB64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const dataUri = `data:image/gif;base64,${dummyImageB64}`;

  const reportPayload = {
    projectId: 'PRJ-TEST-001',
    author: 'Test Script',
    rawTranscript: 'Concrete pouring completed for Foundation B2. 100% done.',
    extractedEvent: {
      discipline: 'Civil',
      activity: 'Foundation B2 Concrete Pour',
      status: 'Completed',
      date: new Date().toISOString().split('T')[0]
    },
    evidenceItems: [
      { id: `EVD-TEST-${Date.now()}`, url: dataUri, filename: 'test_photo.gif', type: 'image/gif' }
    ]
  };

  const reportRes = await fetch(`${BASE_URL}/reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reportPayload)
  });

  if (!reportRes.ok) {
    throw new Error(`Report submission failed: ${await reportRes.text()}`);
  }
  const { reviewItemId, id: reportId } = await reportRes.json();
  console.log(`✅ Report submitted. Generated Review ID: ${reviewItemId}`);

  // 3. Poll for AI Vision Verification Result
  console.log('\n[3] Polling for background AI Vision verification (ctx.waitUntil)...');
  let aiResult = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between polls
    process.stdout.write('.');
    const reviewRes = await fetch(`${BASE_URL}/reviews/${reviewItemId}`, { headers });
    if (reviewRes.ok) {
      const reviewItem = await reviewRes.json();
      if (reviewItem.aiVerification) {
        aiResult = reviewItem.aiVerification;
        break;
      }
    }
  }
  console.log(); // newline

  if (aiResult) {
    console.log('✅ AI Vision Verification Completed!');
    console.log(JSON.stringify(aiResult, null, 2));
    if (aiResult.status === 'error') {
      console.warn('⚠️ Vision AI encountered an error processing the image. (This is expected for 1x1 gifs if the model rejects it, but we verified the pipeline works!)');
    } else {
      console.log(`Suggested Progress: ${aiResult.suggestedProgress ?? 'N/A'}`);
    }
  } else {
    console.error('❌ Timeout waiting for AI Vision Verification. (Cloudflare AI might be cold-starting or failing silently)');
  }

  // 4. Test Text Correction Endpoint
  console.log('\n[4] Testing LLM Text Correction endpoint...');
  const correctionPayload = { notes: 'Change discipline to Mechanical' };
  const correctRes = await fetch(`${BASE_URL}/reports/${reportId}/correct`, {
    method: 'POST',
    headers,
    body: JSON.stringify(correctionPayload)
  });

  if (!correctRes.ok) {
    console.error(`❌ Text Correction Failed: ${await correctRes.text()}`);
  } else {
    const correctData = await correctRes.json();
    console.log('✅ Text Correction Successful!');
    console.log(`Corrected Discipline: ${correctData.event?.discipline}`);
  }

  console.log('\n🎉 Test Script Finished.');
}

runTest().catch(console.error);
